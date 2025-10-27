import { z } from "zod";

// ========================================
// ERP2 VALIDATORS
// Shipping, Tax, Coupons, Invoices, Fulfillments, Returns
// ========================================

// Address sub-schema
const addressSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  streetAddress: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(2).max(2).default("BR"), // ISO 3166-1 alpha-2
  phone: z.string().optional(),
});

export const setAddressesSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
});

export const shippingQuoteSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  shippingMethodId: z.string().min(1, "Shipping method ID is required"),
});

export const applyTaxSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  taxRateIds: z.array(z.string()).optional(),
});

export const couponApplySchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  code: z.string().min(1, "Coupon code is required"),
});

export const createInvoiceSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  invoiceNumber: z.string().optional(), // Auto-generated if not provided
  dueAt: z.string().datetime().optional(),
});

export const fulfillSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  warehouseCode: z.string().optional().default("MAIN"),
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const returnSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  reason: z.string().min(1, "Return reason is required"),
  customerComments: z.string().optional(),
  refundAmountCents: z.number().int().nonnegative().optional(),
});

export const approveReturnSchema = z.object({
  returnId: z.string().min(1, "Return ID is required"),
  approved: z.boolean(),
  refundAmountCents: z.number().int().nonnegative().optional(),
});

// Shipping Method CRUD
export const createShippingMethodSchema = z.object({
  code: z.string().min(1, "Method code is required"),
  name: z.string().min(1, "Method name is required"),
  description: z.string().optional(),
  baseCostCents: z.number().int().nonnegative(),
  perKgCents: z.number().int().nonnegative().default(0),
  minDays: z.number().int().positive().default(1),
  maxDays: z.number().int().positive().default(7),
  isActive: z.boolean().optional().default(true),
});

// Tax Rate CRUD
export const createTaxRateSchema = z.object({
  code: z.string().min(1, "Tax code is required"),
  name: z.string().min(1, "Tax name is required"),
  rateBasisPoints: z.number().int().nonnegative(), // 18% = 1800
  country: z.string().optional(),
  state: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

// Coupon CRUD
export const createCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required"),
  description: z.string().optional(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().int().positive(), // percentage: 10 = 10%, fixed: cents
  maxRedemptions: z.number().int().positive().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  minOrderCents: z.number().int().nonnegative().default(0),
  isActive: z.boolean().optional().default(true),
});

// ========================================
// TYPE EXPORTS
// ========================================

export type SetAddresses = z.infer<typeof setAddressesSchema>;
export type ShippingQuote = z.infer<typeof shippingQuoteSchema>;
export type ApplyTax = z.infer<typeof applyTaxSchema>;
export type CouponApply = z.infer<typeof couponApplySchema>;
export type CreateInvoice = z.infer<typeof createInvoiceSchema>;
export type Fulfill = z.infer<typeof fulfillSchema>;
export type Return = z.infer<typeof returnSchema>;
export type ApproveReturn = z.infer<typeof approveReturnSchema>;
export type CreateShippingMethod = z.infer<typeof createShippingMethodSchema>;
export type CreateTaxRate = z.infer<typeof createTaxRateSchema>;
export type CreateCoupon = z.infer<typeof createCouponSchema>;
