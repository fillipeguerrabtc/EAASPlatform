import express, { Request, Response } from "express";
import { db } from "../../db";
import { products, productVariants } from "../../../shared/schema";
import { orders, orderItems } from "../../../shared/schema.erp";
import { ERPService } from "../erp/service";
import { eq, and, desc, ilike, or, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = express.Router();
const erpService = new ERPService();

// ========================================
// TENANT CONTEXT HELPER
// CRITICAL FIX: Read from req (for authenticated) or env (for public)
// ========================================

function getTenantId(req: Request): string {
  // Try to get from authenticated session first
  const tenantId = (req as any).tenantId;
  if (tenantId) {
    return tenantId;
  }
  
  // Fallback to primary tenant for public marketplace
  return process.env.PRIMARY_TENANT_ID || "default";
}

// ========================================
// SESSION HELPER (for anonymous users)
// ========================================

function getOrCreateSessionId(req: Request, res: Response): string {
  // Check cookie first
  let sessionId = req.cookies?.marketplace_session;
  
  if (!sessionId) {
    // Generate new session ID
    sessionId = randomUUID();
    
    // Set cookie (30 days expiry)
    res.cookie("marketplace_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: "lax",
    });
  }
  
  return sessionId;
}

// ========================================
// CATALOG (PUBLIC - No auth required)
// ========================================

// List all products
router.get("/products", async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    
    const products = await erpService.listProducts(tenantId, {
      search: req.query.search as string,
      category: req.query.category as string,
      isActive: req.query.isActive === "false" ? false : true, // Default to active only
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    });
    
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single product with variants
router.get("/products/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    
    const product = await erpService.getProduct(tenantId, req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    // Get variants for this product
    const variants = await erpService.listVariants(tenantId, product.id);
    
    res.json({
      ...product,
      variants,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List variants for a product
router.get("/products/:id/variants", async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const variants = await erpService.listVariants(tenantId, req.params.id);
    
    res.json(variants);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// CART (PUBLIC - Session-based)
// ========================================

// Get cart (creates order with status="cart" if doesn't exist)
router.get("/cart", async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const sessionId = getOrCreateSessionId(req, res);
    
    // Get or create cart order
    const [cart] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.sessionId, sessionId),
          eq(orders.status, "cart")
        )
      )
      .limit(1);
    
    if (!cart) {
      // Return empty cart
      return res.json({
        id: null,
        items: [],
        subtotalCents: 0,
        totalCents: 0,
        sessionId,
      });
    }
    
    // Get cart items
    const items = await db
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.tenantId, tenantId),
          eq(orderItems.orderId, cart.id)
        )
      );
    
    res.json({
      ...cart,
      items,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add item to cart
router.post("/cart/items", async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const sessionId = getOrCreateSessionId(req, res);
    
    const { productId, variantId, quantity } = req.body;
    
    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ error: "Invalid request" });
    }
    
    // Get or create cart
    let [cart] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.sessionId, sessionId),
          eq(orders.status, "cart")
        )
      )
      .limit(1);
    
    if (!cart) {
      // Create new cart
      const result = await erpService.createOrder(tenantId, {
        sessionId,
        items: [{ productId, variantId, quantity }],
      });
      
      return res.status(201).json(result.order);
    }
    
    // Cart exists - add item
    // Get product info
    const product = await erpService.getProduct(tenantId, productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    let variant = null;
    let priceCents = 0;
    let variantSku = null;
    let variantOptions = null;
    
    if (variantId) {
      variant = await erpService.getVariant(tenantId, variantId);
      if (!variant) {
        return res.status(404).json({ error: "Variant not found" });
      }
      
      const variantPriceDecimal = variant.price ? parseFloat(variant.price) : parseFloat(product.price);
      priceCents = Math.round(variantPriceDecimal * 100);
      variantSku = variant.sku;
      variantOptions = variant.variantValues ? JSON.stringify(variant.variantValues) : null;
    } else {
      const productPriceDecimal = parseFloat(product.price);
      priceCents = Math.round(productPriceDecimal * 100);
    }
    
    const itemSubtotal = priceCents * quantity;
    
    // Check if item already in cart
    const [existingItem] = await db
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.orderId, cart.id),
          eq(orderItems.productId, productId),
          variantId ? eq(orderItems.variantId, variantId) : sql`${orderItems.variantId} IS NULL`
        )
      )
      .limit(1);
    
    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;
      const newSubtotal = priceCents * newQuantity;
      
      await db
        .update(orderItems)
        .set({
          quantity: newQuantity,
          subtotalCents: newSubtotal,
        })
        .where(eq(orderItems.id, existingItem.id));
    } else {
      // Add new item
      await db
        .insert(orderItems)
        .values({
          tenantId,
          orderId: cart.id,
          productId,
          variantId,
          productName: product.name,
          variantSku,
          variantOptions,
          unitPriceCents: priceCents,
          quantity,
          subtotalCents: itemSubtotal,
        });
    }
    
    // Recalculate cart totals
    const allItems = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, cart.id));
    
    const newSubtotal = allItems.reduce((sum, item) => sum + item.subtotalCents, 0);
    const newTotal = newSubtotal + cart.taxCents + cart.shippingCents - cart.discountCents;
    
    await db
      .update(orders)
      .set({
        subtotalCents: newSubtotal,
        totalCents: newTotal,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, cart.id));
    
    // Return updated cart
    const [updatedCart] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, cart.id))
      .limit(1);
    
    res.json({
      ...updatedCart,
      items: allItems,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update cart item quantity
router.patch("/cart/items/:itemId", async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const sessionId = getOrCreateSessionId(req, res);
    const { quantity } = req.body;
    
    if (quantity < 0) {
      return res.status(400).json({ error: "Invalid quantity" });
    }
    
    // Get cart
    const [cart] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.sessionId, sessionId),
          eq(orders.status, "cart")
        )
      )
      .limit(1);
    
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }
    
    // Get item
    const [item] = await db
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.id, req.params.itemId),
          eq(orderItems.orderId, cart.id)
        )
      )
      .limit(1);
    
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    
    if (quantity === 0) {
      // Remove item
      await db
        .delete(orderItems)
        .where(eq(orderItems.id, item.id));
    } else {
      // Update quantity
      const newSubtotal = item.unitPriceCents * quantity;
      
      await db
        .update(orderItems)
        .set({
          quantity,
          subtotalCents: newSubtotal,
        })
        .where(eq(orderItems.id, item.id));
    }
    
    // Recalculate cart totals
    const allItems = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, cart.id));
    
    const newSubtotal = allItems.reduce((sum, item) => sum + item.subtotalCents, 0);
    const newTotal = newSubtotal + cart.taxCents + cart.shippingCents - cart.discountCents;
    
    await db
      .update(orders)
      .set({
        subtotalCents: newSubtotal,
        totalCents: newTotal,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, cart.id));
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Clear cart
router.delete("/cart", async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const sessionId = getOrCreateSessionId(req, res);
    
    // Delete cart and items (cascade)
    await db
      .delete(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.sessionId, sessionId),
          eq(orders.status, "cart")
        )
      );
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// CHECKOUT (Converts cart to pending_payment)
// ========================================

router.post("/checkout", async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const sessionId = getOrCreateSessionId(req, res);
    
    // Get cart
    const [cart] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.sessionId, sessionId),
          eq(orders.status, "cart")
        )
      )
      .limit(1);
    
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }
    
    // Convert cart to pending_payment
    await db
      .update(orders)
      .set({
        status: "pending_payment",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, cart.id));
    
    res.json({ orderId: cart.id, orderNumber: cart.orderNumber });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export function registerMarketplaceRoutes(app: express.Application) {
  app.use("/api/marketplace", router);
}
