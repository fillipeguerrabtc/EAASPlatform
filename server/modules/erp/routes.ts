import express, { Request, Response } from "express";
import { ERPService } from "./service";
import {
  productUpsertSchema,
  variantUpsertSchema,
  priceUpsertSchema,
  stockAdjustSchema,
  stockReserveSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  createPaymentSchema,
  createRefundSchema,
} from "./validators";
import { adjustStock, reserveStock, releaseStock, getAvailableStock } from "./inventory";

const router = express.Router();
const erpService = new ERPService();

// ========================================
// CONTEXT HELPER
// CRITICAL FIX: Read from req (not res)
// ========================================

function getCtx(req: Request) {
  const userId = (req as any).userId;
  const role = (req as any).role;
  
  if (!userId) {
    throw new Error("User not authenticated");
  }

  return {
    tenantId: (req as any).tenantId || process.env.PRIMARY_TENANT_ID!,
    userId,
    role: role || "agent",
  };
}

// RBAC helper
function requireAdmin(ctx: { role: string }) {
  if (ctx.role !== "super_admin" && ctx.role !== "tenant_admin") {
    throw new Error("Admin access required");
  }
}

// ========================================
// PRODUCTS
// ========================================

router.get("/products", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    
    const products = await erpService.listProducts(ctx.tenantId, {
      search: req.query.search as string,
      category: req.query.category as string,
      isActive: req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    });
    
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/products/:id", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    const product = await erpService.getProduct(ctx.tenantId, req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    res.json(product);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/products", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    requireAdmin(ctx);
    
    const validated = productUpsertSchema.parse(req.body);
    const product = await erpService.createProduct(ctx.tenantId, validated);
    
    res.status(201).json(product);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/products/:id", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    requireAdmin(ctx);
    
    const product = await erpService.updateProduct(ctx.tenantId, req.params.id, req.body);
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    res.json(product);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================
// VARIANTS
// ========================================

router.get("/variants", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    const productId = req.query.productId as string;
    
    const variants = await erpService.listVariants(ctx.tenantId, productId);
    res.json(variants);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/variants/:id", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    const variant = await erpService.getVariant(ctx.tenantId, req.params.id);
    
    if (!variant) {
      return res.status(404).json({ error: "Variant not found" });
    }
    
    res.json(variant);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/variants", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    requireAdmin(ctx);
    
    const validated = variantUpsertSchema.parse(req.body);
    const variant = await erpService.createVariant(ctx.tenantId, validated);
    
    res.status(201).json(variant);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================
// PRICES (time-based promotions)
// ========================================

router.get("/prices", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    
    const prices = await erpService.listPrices(
      ctx.tenantId,
      req.query.productId as string,
      req.query.variantId as string
    );
    
    res.json(prices);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/prices", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    requireAdmin(ctx);
    
    const validated = priceUpsertSchema.parse(req.body);
    const price = await erpService.createPrice(ctx.tenantId, {
      productId: validated.productId,
      variantId: validated.variantId,
      priceCents: validated.priceCents,
      validFrom: validated.validFrom ? new Date(validated.validFrom) : undefined,
      validUntil: validated.validUntil ? new Date(validated.validUntil) : undefined,
      label: validated.label,
    });
    
    res.status(201).json(price);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================
// INVENTORY
// ========================================

router.get("/inventory/:variantId", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    const warehouseCode = (req.query.warehouse as string) || "MAIN";
    
    const available = await getAvailableStock(ctx.tenantId, req.params.variantId, warehouseCode);
    
    res.json({ variantId: req.params.variantId, available, warehouseCode });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/inventory/adjust", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    requireAdmin(ctx);
    
    const validated = stockAdjustSchema.parse(req.body);
    const newStock = await adjustStock(
      ctx.tenantId,
      validated.variantId,
      validated.delta,
      validated.warehouseCode
    );
    
    if (newStock === null) {
      return res.status(404).json({ error: "Inventory record not found" });
    }
    
    res.json({ variantId: validated.variantId, stockOnHand: newStock });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/inventory/reserve", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    
    const validated = stockReserveSchema.parse(req.body);
    const success = await reserveStock(
      ctx.tenantId,
      validated.variantId,
      validated.quantity,
      validated.warehouseCode
    );
    
    if (!success) {
      return res.status(400).json({ error: "Insufficient stock" });
    }
    
    res.json({ success: true, variantId: validated.variantId, reserved: validated.quantity });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/inventory/release", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    
    const validated = stockReserveSchema.parse(req.body);
    const success = await releaseStock(
      ctx.tenantId,
      validated.variantId,
      validated.quantity,
      validated.warehouseCode
    );
    
    res.json({ success, variantId: validated.variantId, released: validated.quantity });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================
// ORDERS
// ========================================

router.get("/orders", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    
    const orders = await erpService.listOrders(ctx.tenantId, {
      userId: req.query.userId as string,
      sessionId: req.query.sessionId as string,
      status: req.query.status as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    });
    
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/orders/:id", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    const order = await erpService.getOrder(ctx.tenantId, req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/orders", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    
    const validated = createOrderSchema.parse(req.body);
    const result = await erpService.createOrder(ctx.tenantId, {
      userId: validated.userId || ctx.userId,
      sessionId: validated.sessionId,
      items: validated.items,
      shippingCents: validated.shippingCents,
      discountCents: validated.discountCents,
      customerNotes: validated.customerNotes,
    });
    
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/orders/:id/status", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    requireAdmin(ctx);
    
    const validated = updateOrderStatusSchema.parse(req.body);
    const order = await erpService.updateOrderStatus(ctx.tenantId, req.params.id, validated);
    
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    res.json(order);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================
// PAYMENTS
// ========================================

router.post("/payments", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    
    const validated = createPaymentSchema.parse(req.body);
    const payment = await erpService.createPayment(ctx.tenantId, validated);
    
    res.status(201).json(payment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/payments/:id/status", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    requireAdmin(ctx);
    
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }
    
    const payment = await erpService.updatePaymentStatus(ctx.tenantId, req.params.id, status);
    
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }
    
    res.json(payment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================
// REFUNDS
// ========================================

router.post("/refunds", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    requireAdmin(ctx);
    
    const validated = createRefundSchema.parse(req.body);
    const refund = await erpService.createRefund(ctx.tenantId, validated);
    
    res.status(201).json(refund);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export function registerERPRoutes(app: express.Application) {
  app.use("/api/erp", router);
}
