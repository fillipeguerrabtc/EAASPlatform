import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, boolean, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { products, productVariants } from "./schema";

// ========================================
// ERP MODULE - Additional Tables
// Reuses existing: products, productVariants from schema.ts
// Adds: prices, inventory, orders, payments, shipping, etc.
// ========================================

// ========================================
// ENUMS
// ========================================

export const orderStatusEnum = pgEnum("erp_order_status", [
  "cart",
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded"
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "credit_card",
  "debit_card",
  "pix",
  "boleto",
  "stripe",
  "paypal",
  "cash",
  "other"
]);

export const fulfillmentStatusEnum = pgEnum("fulfillment_status", [
  "pending",
  "picked",
  "packed",
  "shipped",
  "delivered",
  "failed"
]);

export const returnStatusEnum = pgEnum("return_status", [
  "requested",
  "approved",
  "rejected",
  "received",
  "refunded"
]);

// ========================================
// PRICING (Time-based promotions)
// ========================================

export const prices = pgTable("erp_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // References EXISTING products or productVariants
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }),
  variantId: varchar("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
  
  // Price in cents (avoid floating point)
  priceCents: integer("price_cents").notNull(),
  
  // Time window (null = always active)
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  
  // Metadata
  label: text("label"), // "Black Friday", "Early Bird", etc.
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_prices_tenant_product").on(table.tenantId, table.productId),
  index("idx_prices_tenant_variant").on(table.tenantId, table.variantId),
  index("idx_prices_valid_dates").on(table.validFrom, table.validUntil),
]);

// ========================================
// INVENTORY (Multi-warehouse with reserved stock)
// ========================================

export const inventory = pgTable("erp_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // References EXISTING productVariants
  variantId: varchar("variant_id").references(() => productVariants.id, { onDelete: "cascade" }).notNull(),
  
  // Warehouse location
  warehouseCode: text("warehouse_code").notNull().default("MAIN"),
  
  // Stock levels
  stockOnHand: integer("stock_on_hand").default(0).notNull(),
  stockReserved: integer("stock_reserved").default(0).notNull(), // Prevents oversell
  stockAvailable: integer("stock_available").generatedAlwaysAs(sql`stock_on_hand - stock_reserved`),
  
  // Alerts
  minStockLevel: integer("min_stock_level").default(0),
  
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_inventory_tenant_variant").on(table.tenantId, table.variantId),
  index("idx_inventory_warehouse").on(table.warehouseCode),
]);

// ========================================
// ORDERS
// ========================================

export const orders = pgTable("erp_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Customer info (can be anonymous with sessionId or authenticated userId)
  userId: varchar("user_id"), // References users.id if authenticated
  sessionId: text("session_id"), // For anonymous carts
  
  // Order details
  orderNumber: text("order_number").notNull().unique(), // Human-readable: ORD-20250127-001
  status: orderStatusEnum("status").default("cart").notNull(),
  
  // Pricing (in cents)
  subtotalCents: integer("subtotal_cents").default(0).notNull(),
  taxCents: integer("tax_cents").default(0).notNull(),
  shippingCents: integer("shipping_cents").default(0).notNull(),
  discountCents: integer("discount_cents").default(0).notNull(),
  totalCents: integer("total_cents").default(0).notNull(),
  
  // Shipping
  shippingMethod: text("shipping_method"),
  trackingNumber: text("tracking_number"),
  
  // Customer notes
  customerNotes: text("customer_notes"),
  internalNotes: text("internal_notes"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  paidAt: timestamp("paid_at"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
  cancelledAt: timestamp("cancelled_at"),
}, (table) => [
  index("idx_orders_tenant_status").on(table.tenantId, table.status),
  index("idx_orders_user").on(table.userId),
  index("idx_orders_session").on(table.sessionId),
  index("idx_orders_number").on(table.orderNumber),
]);

// ========================================
// ORDER ITEMS
// ========================================

export const orderItems = pgTable("erp_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  
  // Product info (snapshot at purchase time)
  productId: varchar("product_id").references(() => products.id).notNull(),
  variantId: varchar("variant_id").references(() => productVariants.id),
  
  // Snapshot data (prices may change over time)
  productName: text("product_name").notNull(),
  variantSku: text("variant_sku"),
  variantOptions: text("variant_options"), // JSON string: {"Color": "Red", "Size": "M"}
  
  // Pricing snapshot (in cents)
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  subtotalCents: integer("subtotal_cents").notNull(), // quantity * unitPriceCents
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_order_items_tenant_order").on(table.tenantId, table.orderId),
]);

// ========================================
// PAYMENTS
// ========================================

export const payments = pgTable("erp_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  
  // Payment details
  method: paymentMethodEnum("method").notNull(),
  amountCents: integer("amount_cents").notNull(),
  
  // External gateway info
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  gatewayResponse: text("gateway_response"), // JSON string
  
  // Status
  status: text("status").default("pending").notNull(), // pending, succeeded, failed
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_payments_tenant_order").on(table.tenantId, table.orderId),
  index("idx_payments_stripe").on(table.stripePaymentIntentId),
]);

// ========================================
// REFUNDS
// ========================================

export const refunds = pgTable("erp_refunds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  paymentId: varchar("payment_id").references(() => payments.id, { onDelete: "cascade" }).notNull(),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  
  amountCents: integer("amount_cents").notNull(),
  reason: text("reason"),
  
  // External gateway
  stripeRefundId: text("stripe_refund_id"),
  
  status: text("status").default("pending").notNull(), // pending, succeeded, failed
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_refunds_tenant_order").on(table.tenantId, table.orderId),
]);

// ========================================
// PARTE 2: SHIPPING, TAXES, COUPONS, ETC.
// ========================================

// Order Addresses (billing + shipping)
export const orderAddresses = pgTable("erp_order_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // CRITICAL FIX: Added cascade delete
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  
  type: text("type").notNull(), // "billing" or "shipping"
  
  fullName: text("full_name").notNull(),
  streetAddress: text("street_address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code").notNull(),
  country: text("country").notNull().default("BR"),
  phone: text("phone"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_order_addresses_tenant_order").on(table.tenantId, table.orderId),
]);

// Shipping Methods
export const shippingMethods = pgTable("erp_shipping_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  code: text("code").notNull(), // "SEDEX", "PAC", "EXPRESS"
  name: text("name").notNull(),
  description: text("description"),
  
  // Pricing
  baseCostCents: integer("base_cost_cents").notNull(),
  perKgCents: integer("per_kg_cents").default(0),
  
  // Delivery estimate
  minDays: integer("min_days").default(1),
  maxDays: integer("max_days").default(7),
  
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_shipping_methods_tenant_code").on(table.tenantId, table.code),
]);

// Tax Rates (basis points: 1% = 100, 18% = 1800)
export const taxRates = pgTable("erp_tax_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  code: text("code").notNull(), // "BR-ICMS", "BR-PIS", "BR-COFINS"
  name: text("name").notNull(),
  rateBasisPoints: integer("rate_basis_points").notNull(), // 18% = 1800
  
  // Geographic scope
  country: text("country"),
  state: text("state"),
  
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_tax_rates_tenant_code").on(table.tenantId, table.code),
]);

// Coupons / Discount Codes
export const coupons = pgTable("erp_coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  code: text("code").notNull(),
  description: text("description"),
  
  // Discount type
  discountType: text("discount_type").notNull(), // "percentage" or "fixed"
  discountValue: integer("discount_value").notNull(), // percentage: 10 = 10%, fixed: cents
  
  // Usage limits
  maxRedemptions: integer("max_redemptions"), // null = unlimited
  timesRedeemed: integer("times_redeemed").default(0).notNull(),
  
  // Time window
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  
  // Minimum order
  minOrderCents: integer("min_order_cents").default(0),
  
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_coupons_tenant_code").on(table.tenantId, table.code),
]);

// Invoices
export const invoices = pgTable("erp_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // CRITICAL FIX: Added cascade delete
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  
  invoiceNumber: text("invoice_number").notNull().unique(),
  
  // Amounts (in cents)
  subtotalCents: integer("subtotal_cents").notNull(),
  taxCents: integer("tax_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  
  // PDF storage
  pdfUrl: text("pdf_url"),
  
  // Dates
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  dueAt: timestamp("due_at"),
  paidAt: timestamp("paid_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_invoices_tenant_order").on(table.tenantId, table.orderId),
  index("idx_invoices_number").on(table.invoiceNumber),
]);

// Fulfillments (picking, packing, shipping)
export const fulfillments = pgTable("erp_fulfillments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // CRITICAL FIX: Added cascade delete
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  
  status: fulfillmentStatusEnum("status").default("pending").notNull(),
  
  warehouseCode: text("warehouse_code").default("MAIN"),
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
  
  pickedAt: timestamp("picked_at"),
  packedAt: timestamp("packed_at"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
  
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_fulfillments_tenant_order").on(table.tenantId, table.orderId),
]);

// Returns / RMA
export const returnsTbl = pgTable("erp_returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // CRITICAL FIX: Added cascade delete
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  
  rmaNumber: text("rma_number").notNull().unique(),
  status: returnStatusEnum("status").default("requested").notNull(),
  
  reason: text("reason").notNull(),
  customerComments: text("customer_comments"),
  
  // Refund info
  refundAmountCents: integer("refund_amount_cents"),
  restockFee: integer("restock_fee").default(0),
  
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  receivedAt: timestamp("received_at"),
  refundedAt: timestamp("refunded_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_returns_tenant_order").on(table.tenantId, table.orderId),
  index("idx_returns_rma").on(table.rmaNumber),
]);

// ========================================
// ZOD VALIDATORS
// ========================================

export const insertPriceSchema = createInsertSchema(prices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPrice = z.infer<typeof insertPriceSchema>;
export type SelectPrice = typeof prices.$inferSelect;

export const insertInventorySchema = createInsertSchema(inventory).omit({
  id: true,
  updatedAt: true,
});
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type SelectInventory = typeof inventory.$inferSelect;

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  shippedAt: true,
  deliveredAt: true,
  cancelledAt: true,
});
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type SelectOrder = typeof orders.$inferSelect;

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
  createdAt: true,
});
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type SelectOrderItem = typeof orderItems.$inferSelect;

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type SelectPayment = typeof payments.$inferSelect;

export const insertRefundSchema = createInsertSchema(refunds).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
export type InsertRefund = z.infer<typeof insertRefundSchema>;
export type SelectRefund = typeof refunds.$inferSelect;

export const insertOrderAddressSchema = createInsertSchema(orderAddresses).omit({
  id: true,
  createdAt: true,
});
export type InsertOrderAddress = z.infer<typeof insertOrderAddressSchema>;
export type SelectOrderAddress = typeof orderAddresses.$inferSelect;

export const insertShippingMethodSchema = createInsertSchema(shippingMethods).omit({
  id: true,
  createdAt: true,
});
export type InsertShippingMethod = z.infer<typeof insertShippingMethodSchema>;
export type SelectShippingMethod = typeof shippingMethods.$inferSelect;

export const insertTaxRateSchema = createInsertSchema(taxRates).omit({
  id: true,
  createdAt: true,
});
export type InsertTaxRate = z.infer<typeof insertTaxRateSchema>;
export type SelectTaxRate = typeof taxRates.$inferSelect;

export const insertCouponSchema = createInsertSchema(coupons).omit({
  id: true,
  createdAt: true,
});
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type SelectCoupon = typeof coupons.$inferSelect;

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
});
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type SelectInvoice = typeof invoices.$inferSelect;

export const insertFulfillmentSchema = createInsertSchema(fulfillments).omit({
  id: true,
  createdAt: true,
});
export type InsertFulfillment = z.infer<typeof insertFulfillmentSchema>;
export type SelectFulfillment = typeof fulfillments.$inferSelect;

export const insertReturnSchema = createInsertSchema(returnsTbl).omit({
  id: true,
  createdAt: true,
});
export type InsertReturn = z.infer<typeof insertReturnSchema>;
export type SelectReturn = typeof returnsTbl.$inferSelect;
