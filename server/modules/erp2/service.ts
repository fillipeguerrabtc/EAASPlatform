import { db } from "../../db";
import {
  orders,
  orderAddresses,
  shippingMethods,
  taxRates,
  coupons,
  invoices,
  fulfillments,
  returnsTbl,
} from "../../../shared/schema.erp";
import { eq, and, desc, sql, or, isNull, lte, gte } from "drizzle-orm";

// ========================================
// ERP2 SERVICE
// CRITICAL: ALL queries include tenantId filter
// HIGH FIX: Coupon redemption is atomic with transaction
// ========================================

export class ERP2Service {
  // ========================================
  // ORDER ADDRESSES
  // ========================================
  
  async setAddresses(tenantId: string, orderId: string, data: {
    billingAddress: {
      fullName: string;
      streetAddress: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      phone?: string;
    };
    shippingAddress: {
      fullName: string;
      streetAddress: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      phone?: string;
    };
  }) {
    // CRITICAL: tenantId filter - check order exists
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
      throw new Error("Order not found");
    }
    
    // Delete existing addresses
    await db
      .delete(orderAddresses)
      .where(
        and(
          eq(orderAddresses.tenantId, tenantId),
          eq(orderAddresses.orderId, orderId)
        )
      );
    
    // Insert new addresses
    const addresses = await db
      .insert(orderAddresses)
      .values([
        {
          tenantId,
          orderId,
          type: "billing",
          ...data.billingAddress,
        },
        {
          tenantId,
          orderId,
          type: "shipping",
          ...data.shippingAddress,
        },
      ])
      .returning();
    
    return addresses;
  }
  
  async getAddresses(tenantId: string, orderId: string) {
    // CRITICAL: tenantId filter
    const addresses = await db
      .select()
      .from(orderAddresses)
      .where(
        and(
          eq(orderAddresses.tenantId, tenantId),
          eq(orderAddresses.orderId, orderId)
        )
      );
    
    return {
      billing: addresses.find(a => a.type === "billing"),
      shipping: addresses.find(a => a.type === "shipping"),
    };
  }
  
  // ========================================
  // SHIPPING METHODS
  // ========================================
  
  async listShippingMethods(tenantId: string, isActive?: boolean) {
    // CRITICAL: tenantId filter
    const conditions = [eq(shippingMethods.tenantId, tenantId)];
    
    if (isActive !== undefined) {
      conditions.push(eq(shippingMethods.isActive, isActive));
    }
    
    return await db
      .select()
      .from(shippingMethods)
      .where(and(...conditions))
      .orderBy(shippingMethods.name);
  }
  
  async createShippingMethod(tenantId: string, data: {
    code: string;
    name: string;
    description?: string;
    baseCostCents: number;
    perKgCents?: number;
    minDays?: number;
    maxDays?: number;
    isActive?: boolean;
  }) {
    // CRITICAL: tenantId included
    const [method] = await db
      .insert(shippingMethods)
      .values({
        tenantId,
        ...data,
      })
      .returning();
    
    return method;
  }
  
  async calculateShipping(tenantId: string, orderId: string, shippingMethodId: string) {
    // CRITICAL: tenantId filter on both queries
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
      throw new Error("Order not found");
    }
    
    const [method] = await db
      .select()
      .from(shippingMethods)
      .where(
        and(
          eq(shippingMethods.tenantId, tenantId),
          eq(shippingMethods.id, shippingMethodId),
          eq(shippingMethods.isActive, true)
        )
      )
      .limit(1);
    
    if (!method) {
      throw new Error("Shipping method not found or inactive");
    }
    
    // Simple calculation: baseCost + perKg * estimatedWeight
    // TODO: Get actual weight from order items
    const estimatedWeightKg = 1; // Placeholder
    const shippingCents = method.baseCostCents + (method.perKgCents || 0) * estimatedWeightKg;
    
    return {
      methodId: method.id,
      methodName: method.name,
      shippingCents,
      estimatedDays: { min: method.minDays, max: method.maxDays },
    };
  }
  
  // ========================================
  // TAX RATES
  // ========================================
  
  async listTaxRates(tenantId: string, filters?: {
    country?: string;
    state?: string;
    isActive?: boolean;
  }) {
    // CRITICAL: tenantId filter
    const conditions = [eq(taxRates.tenantId, tenantId)];
    
    if (filters?.country) {
      conditions.push(eq(taxRates.country, filters.country));
    }
    
    if (filters?.state) {
      conditions.push(eq(taxRates.state, filters.state));
    }
    
    if (filters?.isActive !== undefined) {
      conditions.push(eq(taxRates.isActive, filters.isActive));
    }
    
    return await db
      .select()
      .from(taxRates)
      .where(and(...conditions))
      .orderBy(taxRates.name);
  }
  
  async createTaxRate(tenantId: string, data: {
    code: string;
    name: string;
    rateBasisPoints: number;
    country?: string;
    state?: string;
    isActive?: boolean;
  }) {
    // CRITICAL: tenantId included
    const [taxRate] = await db
      .insert(taxRates)
      .values({
        tenantId,
        ...data,
      })
      .returning();
    
    return taxRate;
  }
  
  async calculateTax(tenantId: string, orderId: string, taxRateIds?: string[]) {
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
      throw new Error("Order not found");
    }
    
    // Get applicable tax rates
    let applicableTaxRates;
    if (taxRateIds && taxRateIds.length > 0) {
      // CRITICAL: tenantId filter
      applicableTaxRates = await db
        .select()
        .from(taxRates)
        .where(
          and(
            eq(taxRates.tenantId, tenantId),
            eq(taxRates.isActive, true),
            sql`${taxRates.id} = ANY(${taxRateIds})`
          )
        );
    } else {
      // Get all active tax rates (could filter by address country/state here)
      applicableTaxRates = await db
        .select()
        .from(taxRates)
        .where(
          and(
            eq(taxRates.tenantId, tenantId),
            eq(taxRates.isActive, true)
          )
        );
    }
    
    // Calculate total tax in basis points
    const totalBasisPoints = applicableTaxRates.reduce(
      (sum, rate) => sum + rate.rateBasisPoints,
      0
    );
    
    // Apply to order subtotal (basis points: 1% = 100, so divide by 10000)
    const taxCents = Math.round((order.subtotalCents * totalBasisPoints) / 10000);
    
    return {
      taxCents,
      appliedRates: applicableTaxRates.map(r => ({
        code: r.code,
        name: r.name,
        rateBasisPoints: r.rateBasisPoints,
      })),
    };
  }
  
  // ========================================
  // COUPONS
  // HIGH FIX: Atomic redemption with transaction
  // ========================================
  
  async listCoupons(tenantId: string, isActive?: boolean) {
    // CRITICAL: tenantId filter
    const conditions = [eq(coupons.tenantId, tenantId)];
    
    if (isActive !== undefined) {
      conditions.push(eq(coupons.isActive, isActive));
    }
    
    return await db
      .select()
      .from(coupons)
      .where(and(...conditions))
      .orderBy(desc(coupons.createdAt));
  }
  
  async createCoupon(tenantId: string, data: {
    code: string;
    description?: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    maxRedemptions?: number;
    validFrom?: Date;
    validUntil?: Date;
    minOrderCents?: number;
    isActive?: boolean;
  }) {
    // CRITICAL: tenantId included
    const { code, ...rest } = data;
    const [coupon] = await db
      .insert(coupons)
      .values({
        tenantId,
        code: code.toUpperCase(), // Normalize to uppercase
        ...rest,
      })
      .returning();
    
    return coupon;
  }
  
  async applyCoupon(tenantId: string, orderId: string, code: string) {
    // HIGH FIX: Use transaction to prevent race condition
    return await db.transaction(async (tx) => {
      const now = new Date();
      
      // CRITICAL: tenantId filter - get coupon with FOR UPDATE lock
      const [coupon] = await tx
        .select()
        .from(coupons)
        .where(
          and(
            eq(coupons.tenantId, tenantId),
            eq(coupons.code, code.toUpperCase()),
            eq(coupons.isActive, true),
            or(
              isNull(coupons.validFrom),
              lte(coupons.validFrom, now)
            )!,
            or(
              isNull(coupons.validUntil),
              gte(coupons.validUntil, now)
            )!
          )
        )
        .limit(1)
        .for("update"); // Lock row for atomic update
      
      if (!coupon) {
        throw new Error("Coupon not found or not active");
      }
      
      // Check redemption limit
      if (coupon.maxRedemptions !== null && coupon.timesRedeemed >= coupon.maxRedemptions) {
        throw new Error("Coupon redemption limit reached");
      }
      
      // CRITICAL: tenantId filter - get order
      const [order] = await tx
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
        throw new Error("Order not found");
      }
      
      // Check minimum order amount
      if (coupon.minOrderCents !== null && order.subtotalCents < coupon.minOrderCents) {
        throw new Error(`Order minimum is ${coupon.minOrderCents / 100} cents`);
      }
      
      // Calculate discount
      let discountCents = 0;
      if (coupon.discountType === "percentage") {
        discountCents = Math.round((order.subtotalCents * coupon.discountValue) / 100);
      } else {
        discountCents = coupon.discountValue;
      }
      
      // Don't exceed order total
      discountCents = Math.min(discountCents, order.subtotalCents);
      
      // ATOMIC: Increment redemption counter
      // CRITICAL: tenantId filter to prevent cross-tenant modification
      await tx
        .update(coupons)
        .set({
          timesRedeemed: sql`${coupons.timesRedeemed} + 1`,
        })
        .where(
          and(
            eq(coupons.tenantId, tenantId),
            eq(coupons.id, coupon.id)
          )
        );
      
      // Update order with discount
      const newTotal = order.subtotalCents + order.taxCents + order.shippingCents - discountCents;
      
      // CRITICAL: tenantId filter to prevent cross-tenant modification
      await tx
        .update(orders)
        .set({
          discountCents,
          totalCents: newTotal,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(orders.tenantId, tenantId),
            eq(orders.id, orderId)
          )
        );
      
      return {
        discountCents,
        totalCents: newTotal,
        couponCode: coupon.code,
      };
    });
  }
  
  // ========================================
  // INVOICES
  // ========================================
  
  async createInvoice(tenantId: string, data: {
    orderId: string;
    invoiceNumber?: string;
    dueAt?: Date;
  }) {
    // CRITICAL: tenantId filter
    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.id, data.orderId)
        )
      )
      .limit(1);
    
    if (!order) {
      throw new Error("Order not found");
    }
    
    // Generate invoice number if not provided
    const invoiceNumber = data.invoiceNumber || 
      `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // CRITICAL: tenantId included
    const [invoice] = await db
      .insert(invoices)
      .values({
        tenantId,
        orderId: data.orderId,
        invoiceNumber,
        subtotalCents: order.subtotalCents,
        taxCents: order.taxCents,
        totalCents: order.totalCents,
        dueAt: data.dueAt,
      })
      .returning();
    
    return invoice;
  }
  
  async getInvoice(tenantId: string, invoiceId: string) {
    // CRITICAL: tenantId filter
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.id, invoiceId)
        )
      )
      .limit(1);
    
    return invoice || null;
  }
  
  // ========================================
  // FULFILLMENTS
  // ========================================
  
  async createFulfillment(tenantId: string, data: {
    orderId: string;
    warehouseCode?: string;
    carrier?: string;
    trackingNumber?: string;
    notes?: string;
  }) {
    // CRITICAL: tenantId filter
    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.id, data.orderId)
        )
      )
      .limit(1);
    
    if (!order) {
      throw new Error("Order not found");
    }
    
    // CRITICAL: tenantId included
    const [fulfillment] = await db
      .insert(fulfillments)
      .values({
        tenantId,
        orderId: data.orderId,
        warehouseCode: data.warehouseCode || "MAIN",
        carrier: data.carrier,
        trackingNumber: data.trackingNumber,
        notes: data.notes,
        status: "pending",
        pickedAt: new Date(),
      })
      .returning();
    
    // Update order status
    // CRITICAL: tenantId filter to prevent cross-tenant modification
    await db
      .update(orders)
      .set({
        status: "processing",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.id, data.orderId)
        )
      );
    
    return fulfillment;
  }
  
  async updateFulfillmentStatus(tenantId: string, fulfillmentId: string, status: string, data?: {
    trackingNumber?: string;
    carrier?: string;
  }) {
    // CRITICAL: tenantId filter
    const updateData: any = { status };
    
    if (status === "shipped") {
      updateData.shippedAt = new Date();
      if (data?.trackingNumber) updateData.trackingNumber = data.trackingNumber;
      if (data?.carrier) updateData.carrier = data.carrier;
    } else if (status === "delivered") {
      updateData.deliveredAt = new Date();
    }
    
    const [updated] = await db
      .update(fulfillments)
      .set(updateData)
      .where(
        and(
          eq(fulfillments.tenantId, tenantId),
          eq(fulfillments.id, fulfillmentId)
        )
      )
      .returning();
    
    return updated || null;
  }
  
  // ========================================
  // RETURNS
  // ========================================
  
  async createReturn(tenantId: string, data: {
    orderId: string;
    reason: string;
    customerComments?: string;
    refundAmountCents?: number;
  }) {
    // CRITICAL: tenantId filter
    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.id, data.orderId)
        )
      )
      .limit(1);
    
    if (!order) {
      throw new Error("Order not found");
    }
    
    // Generate RMA number
    const rmaNumber = `RMA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // CRITICAL: tenantId included
    const [returnRecord] = await db
      .insert(returnsTbl)
      .values({
        tenantId,
        orderId: data.orderId,
        rmaNumber,
        reason: data.reason,
        customerComments: data.customerComments,
        refundAmountCents: data.refundAmountCents,
        status: "requested",
      })
      .returning();
    
    return returnRecord;
  }
  
  async approveReturn(tenantId: string, returnId: string, approved: boolean, refundAmountCents?: number) {
    // CRITICAL: tenantId filter
    const [returnRecord] = await db
      .select()
      .from(returnsTbl)
      .where(
        and(
          eq(returnsTbl.tenantId, tenantId),
          eq(returnsTbl.id, returnId)
        )
      )
      .limit(1);
    
    if (!returnRecord) {
      throw new Error("Return not found");
    }
    
    // CRITICAL: tenantId filter to prevent cross-tenant modification
    const [updated] = await db
      .update(returnsTbl)
      .set({
        status: approved ? "approved" : "rejected",
        refundAmountCents: approved ? refundAmountCents : null,
        approvedAt: approved ? new Date() : null,
      })
      .where(
        and(
          eq(returnsTbl.tenantId, tenantId),
          eq(returnsTbl.id, returnId)
        )
      )
      .returning();
    
    return updated;
  }
}
