import { db } from "../../db";
import { products, productVariants } from "../../../shared/schema";
import { prices, inventory, orders, orderItems, payments, refunds } from "../../../shared/schema.erp";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";
import { getActivePrice, getActivePriceCents } from "./pricing";
import { reserveStock, releaseStock, consumeReserved, getAvailableStock, initializeInventory } from "./inventory";
import slugify from "slugify";

// ========================================
// ERP SERVICE
// CRITICAL: ALL queries include tenantId filter
// Uses existing products/productVariants schema
// ========================================

export class ERPService {
  // ========================================
  // PRODUCTS (uses existing schema.ts)
  // ========================================
  
  async listProducts(tenantId: string, filters?: {
    search?: string;
    category?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }) {
    // CRITICAL: tenantId filter
    const conditions = [eq(products.tenantId, tenantId)];
    
    const { search, category, isActive, limit = 50, offset = 0 } = filters || {};
    
    if (search) {
      conditions.push(
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.description, `%${search}%`)
        )!
      );
    }
    
    if (category) {
      conditions.push(eq(products.category, category));
    }
    
    if (isActive !== undefined) {
      conditions.push(eq(products.isActive, isActive));
    }
    
    return await db
      .select()
      .from(products)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(products.createdAt));
  }
  
  async getProduct(tenantId: string, productId: string) {
    // CRITICAL: tenantId filter
    const [product] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.id, productId)
        )
      )
      .limit(1);
    
    return product || null;
  }
  
  async createProduct(tenantId: string, data: {
    name: string;
    description?: string;
    price: string;
    type?: string;
    category?: string;
    tags?: string[];
    images?: string[];
    inventory?: number;
    metadata?: any;
  }) {
    // Generate slug from name
    const slug = slugify(data.name, { lower: true, strict: true });
    
    const [product] = await db
      .insert(products)
      .values({
        tenantId,
        type: (data.type as any) || "product",
        name: data.name,
        description: data.description,
        price: data.price,
        category: data.category,
        tags: data.tags,
        images: data.images,
        inventory: data.inventory,
        metadata: data.metadata,
        isActive: true,
      })
      .returning();
    
    return product;
  }
  
  async updateProduct(tenantId: string, productId: string, data: Partial<{
    name: string;
    description: string;
    price: string;
    category: string;
    tags: string[];
    images: string[];
    inventory: number;
    metadata: any;
    isActive: boolean;
  }>) {
    // CRITICAL: tenantId filter to prevent cross-tenant modification
    const [updated] = await db
      .update(products)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.id, productId)
        )
      )
      .returning();
    
    return updated || null;
  }
  
  // ========================================
  // VARIANTS (uses existing schema.ts)
  // ========================================
  
  async listVariants(tenantId: string, productId?: string) {
    // CRITICAL: tenantId filter
    const conditions = [eq(productVariants.tenantId, tenantId)];
    
    if (productId) {
      conditions.push(eq(productVariants.productId, productId));
    }
    
    return await db
      .select()
      .from(productVariants)
      .where(and(...conditions))
      .orderBy(desc(productVariants.createdAt));
  }
  
  async getVariant(tenantId: string, variantId: string) {
    // CRITICAL: tenantId filter
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.tenantId, tenantId),
          eq(productVariants.id, variantId)
        )
      )
      .limit(1);
    
    return variant || null;
  }
  
  async createVariant(tenantId: string, data: {
    productId: string;
    sku: string;
    variantValues?: Record<string, string>;
    price?: string;
    inventory?: number;
    images?: string[];
    metadata?: any;
  }) {
    const [variant] = await db
      .insert(productVariants)
      .values({
        tenantId,
        productId: data.productId,
        sku: data.sku,
        variantValues: data.variantValues as any,
        price: data.price,
        inventory: data.inventory || 0,
        images: data.images,
        metadata: data.metadata,
        isActive: true,
      })
      .returning();
    
    // Initialize inventory tracking
    if (data.inventory) {
      await initializeInventory(tenantId, variant.id, data.inventory);
    }
    
    return variant;
  }
  
  // ========================================
  // PRICES (ERP time-based pricing)
  // ========================================
  
  async createPrice(tenantId: string, data: {
    productId?: string;
    variantId?: string;
    priceCents: number;
    validFrom?: Date;
    validUntil?: Date;
    label?: string;
  }) {
    // CRITICAL: tenantId filter
    const [price] = await db
      .insert(prices)
      .values({
        tenantId,
        productId: data.productId,
        variantId: data.variantId,
        priceCents: data.priceCents,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        label: data.label,
        isActive: true,
      })
      .returning();
    
    return price;
  }
  
  async listPrices(tenantId: string, productId?: string, variantId?: string) {
    // CRITICAL: tenantId filter
    const conditions = [eq(prices.tenantId, tenantId)];
    
    if (productId) {
      conditions.push(eq(prices.productId, productId));
    }
    
    if (variantId) {
      conditions.push(eq(prices.variantId, variantId));
    }
    
    return await db
      .select()
      .from(prices)
      .where(and(...conditions))
      .orderBy(desc(prices.createdAt));
  }
  
  // ========================================
  // ORDERS
  // ========================================
  
  async createOrder(tenantId: string, data: {
    userId?: string;
    sessionId?: string;
    items: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
    }>;
    shippingCents?: number;
    discountCents?: number;
    customerNotes?: string;
  }) {
    // Generate order number
    const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // Calculate subtotal
    let subtotalCents = 0;
    const orderItemsData = [];
    
    for (const item of data.items) {
      // Get product and variant
      const product = await this.getProduct(tenantId, item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }
      
      let variant = null;
      let priceCents = 0;
      let variantSku = null;
      let variantOptions = null;
      
      if (item.variantId) {
        variant = await this.getVariant(tenantId, item.variantId);
        if (!variant) {
          throw new Error(`Variant ${item.variantId} not found`);
        }
        
        // Get active price (ERP or fallback to variant price)
        const variantPriceDecimal = variant.price ? parseFloat(variant.price) : parseFloat(product.price);
        const fallbackPriceCents = Math.round(variantPriceDecimal * 100);
        
        priceCents = await getActivePriceCents(
          tenantId,
          item.productId,
          item.variantId,
          fallbackPriceCents
        );
        
        variantSku = variant.sku;
        variantOptions = variant.variantValues ? JSON.stringify(variant.variantValues) : null;
      } else {
        // No variant - use product base price
        const productPriceDecimal = parseFloat(product.price);
        priceCents = Math.round(productPriceDecimal * 100);
      }
      
      const itemSubtotal = priceCents * item.quantity;
      subtotalCents += itemSubtotal;
      
      orderItemsData.push({
        tenantId,
        productId: item.productId,
        variantId: item.variantId,
        productName: product.name,
        variantSku,
        variantOptions,
        unitPriceCents: priceCents,
        quantity: item.quantity,
        subtotalCents: itemSubtotal,
      });
    }
    
    const totalCents = subtotalCents + (data.shippingCents || 0) - (data.discountCents || 0);
    
    // CRITICAL: tenantId filter
    const [order] = await db
      .insert(orders)
      .values({
        tenantId,
        userId: data.userId,
        sessionId: data.sessionId,
        orderNumber,
        status: "cart",
        subtotalCents,
        taxCents: 0,
        shippingCents: data.shippingCents || 0,
        discountCents: data.discountCents || 0,
        totalCents,
        customerNotes: data.customerNotes,
      })
      .returning();
    
    // Insert order items
    const items = await db
      .insert(orderItems)
      .values(
        orderItemsData.map(item => ({
          ...item,
          orderId: order.id,
        }))
      )
      .returning();
    
    return { order, items };
  }
  
  async getOrder(tenantId: string, orderId: string) {
    // CRITICAL: tenantId filter
    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.id, orderId)
        )
      )
      .limit(1);
    
    if (!order) {
      return null;
    }
    
    // Get order items
    const items = await db
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.tenantId, tenantId),
          eq(orderItems.orderId, orderId)
        )
      );
    
    return { ...order, items };
  }
  
  async listOrders(tenantId: string, filters?: {
    userId?: string;
    sessionId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    // CRITICAL: tenantId filter
    const conditions = [eq(orders.tenantId, tenantId)];
    
    const { userId, sessionId, status, limit = 50, offset = 0 } = filters || {};
    
    if (userId) {
      conditions.push(eq(orders.userId, userId));
    }
    
    if (sessionId) {
      conditions.push(eq(orders.sessionId, sessionId));
    }
    
    if (status) {
      conditions.push(eq(orders.status, status as any));
    }
    
    return await db
      .select()
      .from(orders)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(orders.createdAt));
  }
  
  async updateOrderStatus(tenantId: string, orderId: string, data: {
    status: string;
    trackingNumber?: string;
    internalNotes?: string;
  }) {
    // CRITICAL: tenantId filter
    const updateData: any = {
      status: data.status,
      updatedAt: new Date(),
    };
    
    if (data.trackingNumber) {
      updateData.trackingNumber = data.trackingNumber;
    }
    
    if (data.internalNotes) {
      updateData.internalNotes = data.internalNotes;
    }
    
    // Update timestamps based on status
    if (data.status === "paid") {
      updateData.paidAt = new Date();
    } else if (data.status === "shipped") {
      updateData.shippedAt = new Date();
    } else if (data.status === "delivered") {
      updateData.deliveredAt = new Date();
    } else if (data.status === "cancelled" || data.status === "refunded") {
      updateData.cancelledAt = new Date();
    }
    
    const [updated] = await db
      .update(orders)
      .set(updateData)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.id, orderId)
        )
      )
      .returning();
    
    return updated || null;
  }
  
  // ========================================
  // PAYMENTS
  // ========================================
  
  async createPayment(tenantId: string, data: {
    orderId: string;
    method: string;
    amountCents: number;
    stripePaymentIntentId?: string;
    gatewayResponse?: string;
  }) {
    // CRITICAL: tenantId filter
    const [payment] = await db
      .insert(payments)
      .values({
        tenantId,
        orderId: data.orderId,
        method: data.method as any,
        amountCents: data.amountCents,
        stripePaymentIntentId: data.stripePaymentIntentId,
        gatewayResponse: data.gatewayResponse,
        status: "pending",
      })
      .returning();
    
    return payment;
  }
  
  async updatePaymentStatus(tenantId: string, paymentId: string, status: string) {
    // CRITICAL: tenantId filter
    const updateData: any = {
      status,
    };
    
    if (status === "succeeded") {
      updateData.completedAt = new Date();
    }
    
    const [updated] = await db
      .update(payments)
      .set(updateData)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.id, paymentId)
        )
      )
      .returning();
    
    return updated || null;
  }
  
  // ========================================
  // REFUNDS
  // ========================================
  
  async createRefund(tenantId: string, data: {
    paymentId: string;
    orderId: string;
    amountCents: number;
    reason?: string;
    stripeRefundId?: string;
  }) {
    // CRITICAL: tenantId filter
    const [refund] = await db
      .insert(refunds)
      .values({
        tenantId,
        paymentId: data.paymentId,
        orderId: data.orderId,
        amountCents: data.amountCents,
        reason: data.reason,
        stripeRefundId: data.stripeRefundId,
        status: "pending",
      })
      .returning();
    
    return refund;
  }
}
