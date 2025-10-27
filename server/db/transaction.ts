import { db } from "../db";
import { orders, productVariants } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Transaction Helper
 * 
 * Provides a simple wrapper for Drizzle transactions.
 * Usage: await withTx(async (tx) => { ... })
 */
export async function withTx<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => fn(tx));
}

/**
 * Create Order with Items (Atomic Transaction)
 * 
 * Creates an order and its line items in a single atomic transaction.
 * Also decrements inventory atomically to prevent overselling.
 * 
 * **Important:** This function requires all items to have SKUs from product_variants table.
 * Products without variants are not supported by this helper.
 * 
 * @param input Order data and items
 * @returns Created order with items
 * @throws Error if SKU not found or insufficient inventory
 */
export async function createOrderWithItems(input: {
  order: {
    customerId: string;
    total: string;
    status?: string;
    paymentId?: string;
    metadata?: any;
  };
  items: Array<{
    sku: string;
    qty: number;
    price: string;
    name: string;
  }>;
}) {
  return withTx(async (tx) => {
    // 1. Create order with items as JSONB
    const [order] = await tx
      .insert(orders)
      .values({
        customerId: input.order.customerId,
        total: input.order.total,
        status: (input.order.status as any) || "pending",
        paymentId: input.order.paymentId,
        metadata: input.order.metadata,
        items: input.items as any, // Store items as JSONB
      })
      .returning();

    // 2. Decrement inventory atomically (prevents overselling)
    for (const item of input.items) {
      const result = await tx.execute(
        sql`
          UPDATE product_variants 
          SET inventory = inventory - ${item.qty}
          WHERE sku = ${item.sku}
            AND inventory >= ${item.qty}
            AND is_active = true
          RETURNING id
        `
      );

      // If no rows affected, inventory was insufficient or SKU not found
      if (!result.rows || result.rows.length === 0) {
        throw new Error(`Insufficient inventory or invalid SKU: ${item.sku}`);
      }
    }

    return order;
  });
}

/**
 * Mark Order Paid (Atomic Transaction)
 * 
 * Updates order status and records payment atomically.
 * Used by Stripe webhooks.
 */
export async function markOrderPaidTx(orderId: string, paymentId: string) {
  return withTx(async (tx) => {
    const [updated] = await tx
      .update(orders)
      .set({
        status: "completed" as any, // Completed = paid
        paymentId,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    if (!updated) {
      throw new Error(`Order ${orderId} not found`);
    }

    return updated;
  });
}

/**
 * Refund Order (Atomic Transaction)
 * 
 * Marks order as refunded and restores inventory atomically.
 */
export async function refundOrderTx(orderId: string) {
  return withTx(async (tx) => {
    // 1. Get order items
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // 2. Restore inventory to variants (without is_active filter to allow refunds of archived products)
    const items = order.items as any[];
    for (const item of items) {
      const result = await tx.execute(
        sql`
          UPDATE product_variants 
          SET inventory = inventory + ${item.qty}
          WHERE sku = ${item.sku}
          RETURNING id
        `
      );

      // Warn if inventory restoration failed (variant deleted or never existed)
      if (!result.rows || result.rows.length === 0) {
        console.warn(`Warning: Could not restore inventory for SKU ${item.sku} (variant may have been deleted)`);
        // Continue processing other items rather than failing entirely
      }
    }

    // 3. Mark order as cancelled (refunded)
    const [updated] = await tx
      .update(orders)
      .set({
        status: "cancelled" as any, // Cancelled = refunded
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    return updated;
  });
}
