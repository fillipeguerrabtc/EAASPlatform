import { z } from "zod";

// ========================================
// PRODUCT VALIDATORS
// Uses existing products/productVariants from schema.ts
// ========================================

export const productUpsertSchema = z.object({
  id: z.string().optional(), // VARCHAR UUID
  type: z.enum(["product", "service", "experience", "real_estate", "vehicle"]).optional(),
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  price: z.string().or(z.number()).transform(val => String(val)), // Decimal as string
  images: z.array(z.string().url()).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  inventory: z.number().int().nonnegative().optional(),
  metadata: z.any().optional(),
  isActive: z.boolean().optional(),
});

export const variantUpsertSchema = z.object({
  id: z.string().optional(), // VARCHAR UUID
  productId: z.string().min(1, "Product ID is required"),
  sku: z.string().min(1, "SKU is required").max(64),
  variantValues: z.record(z.string()).optional(), // { "Color": "Red", "Size": "M" }
  price: z.string().or(z.number()).transform(val => String(val)).optional(), // Decimal
  inventory: z.number().int().nonnegative().optional(),
  images: z.array(z.string().url()).optional(),
  isActive: z.boolean().optional(),
  metadata: z.any().optional(),
});

// ========================================
// PRICE VALIDATORS (ERP time-based pricing)
// ========================================

export const priceUpsertSchema = z.object({
  productId: z.string().optional(),
  variantId: z.string().optional(),
  priceCents: z.number().int().positive("Price must be positive"),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  label: z.string().optional(),
  isActive: z.boolean().optional(),
}).refine(
  (data) => data.productId || data.variantId,
  { message: "Either productId or variantId must be provided" }
);

// ========================================
// INVENTORY VALIDATORS
// ========================================

export const stockAdjustSchema = z.object({
  variantId: z.string().min(1, "Variant ID is required"),
  delta: z.number().int(), // Positive or negative adjustment
  warehouseCode: z.string().optional().default("MAIN"),
});

export const stockReserveSchema = z.object({
  variantId: z.string().min(1, "Variant ID is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  warehouseCode: z.string().optional().default("MAIN"),
});

// ========================================
// ORDER VALIDATORS
// ========================================

export const createOrderSchema = z.object({
  // Customer (authenticated or anonymous)
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  
  // Order items
  items: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().optional(),
    quantity: z.number().int().min(1).max(100),
  })).min(1, "At least one item is required"),
  
  // Pricing
  shippingCents: z.number().int().nonnegative().default(0),
  discountCents: z.number().int().nonnegative().default(0),
  
  // Customer info
  customerNotes: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "cart",
    "pending_payment",
    "paid",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded"
  ]),
  trackingNumber: z.string().optional(),
  internalNotes: z.string().optional(),
});

// ========================================
// PAYMENT VALIDATORS
// ========================================

export const createPaymentSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  method: z.enum([
    "credit_card",
    "debit_card",
    "pix",
    "boleto",
    "stripe",
    "paypal",
    "cash",
    "other"
  ]),
  amountCents: z.number().int().positive("Amount must be positive"),
  stripePaymentIntentId: z.string().optional(),
  gatewayResponse: z.string().optional(),
});

// ========================================
// REFUND VALIDATORS
// ========================================

export const createRefundSchema = z.object({
  paymentId: z.string().min(1, "Payment ID is required"),
  orderId: z.string().min(1, "Order ID is required"),
  amountCents: z.number().int().positive("Amount must be positive"),
  reason: z.string().optional(),
  stripeRefundId: z.string().optional(),
});

// ========================================
// CART VALIDATORS (Marketplace)
// ========================================

export const addToCartSchema = z.object({
  items: z.array(z.object({
    variantId: z.string().min(1),
    quantity: z.number().int().min(1).max(100)
  })).min(1, "At least one item required"),
  
  customerEmail: z.string().email().optional(),
  customerName: z.string().optional(),
  shippingCents: z.number().int().nonnegative().default(0),
  discountCents: z.number().int().nonnegative().default(0),
});

export const updateCartItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(0).max(100), // 0 = remove
});

// ========================================
// TYPE EXPORTS
// ========================================

export type ProductUpsert = z.infer<typeof productUpsertSchema>;
export type VariantUpsert = z.infer<typeof variantUpsertSchema>;
export type PriceUpsert = z.infer<typeof priceUpsertSchema>;
export type StockAdjust = z.infer<typeof stockAdjustSchema>;
export type StockReserve = z.infer<typeof stockReserveSchema>;
export type CreateOrder = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatus = z.infer<typeof updateOrderStatusSchema>;
export type CreatePayment = z.infer<typeof createPaymentSchema>;
export type CreateRefund = z.infer<typeof createRefundSchema>;
export type AddToCart = z.infer<typeof addToCartSchema>;
export type UpdateCartItem = z.infer<typeof updateCartItemSchema>;
