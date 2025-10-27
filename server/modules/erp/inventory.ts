import { db } from "../../db";
import { inventory } from "../../../shared/schema.erp";
import { eq, and, sql } from "drizzle-orm";

// ========================================
// INVENTORY MODULE
// Atomic stock operations to prevent overselling
// ========================================

/**
 * Reserve stock for a variant (e.g., during checkout)
 * Uses atomic UPDATE to prevent race conditions
 * 
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param variantId - Product variant ID
 * @param quantity - Quantity to reserve
 * @param warehouseCode - Warehouse location (default: MAIN)
 * @returns true if reservation successful, false if insufficient stock
 */
export async function reserveStock(
  tenantId: string,
  variantId: string,
  quantity: number,
  warehouseCode: string = "MAIN"
): Promise<boolean> {
  // CRITICAL: Atomic UPDATE with stock check
  // UPDATE inventory SET stock_reserved = stock_reserved + quantity
  // WHERE tenant_id = ? AND variant_id = ? AND warehouse_code = ?
  //   AND (stock_on_hand - stock_reserved) >= quantity
  
  const result = await db.execute(sql`
    UPDATE erp_inventory
    SET stock_reserved = stock_reserved + ${quantity},
        updated_at = NOW()
    WHERE tenant_id = ${tenantId}
      AND variant_id = ${variantId}
      AND warehouse_code = ${warehouseCode}
      AND (stock_on_hand - stock_reserved) >= ${quantity}
  `);
  
  // Check if any rows were updated
  const rowCount = (result as any).rowCount || 0;
  return rowCount > 0;
}

/**
 * Release reserved stock (e.g., cart abandonment, payment failure)
 * 
 * @param tenantId - Tenant ID
 * @param variantId - Product variant ID
 * @param quantity - Quantity to release
 * @param warehouseCode - Warehouse location
 * @returns true if release successful
 */
export async function releaseStock(
  tenantId: string,
  variantId: string,
  quantity: number,
  warehouseCode: string = "MAIN"
): Promise<boolean> {
  // CRITICAL: Prevent negative reserved stock
  const result = await db.execute(sql`
    UPDATE erp_inventory
    SET stock_reserved = GREATEST(0, stock_reserved - ${quantity}),
        updated_at = NOW()
    WHERE tenant_id = ${tenantId}
      AND variant_id = ${variantId}
      AND warehouse_code = ${warehouseCode}
  `);
  
  const rowCount = (result as any).rowCount || 0;
  return rowCount > 0;
}

/**
 * Consume reserved stock (after payment confirmed)
 * Decreases both stock_on_hand and stock_reserved
 * 
 * @param tenantId - Tenant ID
 * @param variantId - Product variant ID
 * @param quantity - Quantity to consume
 * @param warehouseCode - Warehouse location
 * @returns true if consumption successful
 */
export async function consumeReserved(
  tenantId: string,
  variantId: string,
  quantity: number,
  warehouseCode: string = "MAIN"
): Promise<boolean> {
  // CRITICAL: Atomic decrement of both stock_on_hand and stock_reserved
  const result = await db.execute(sql`
    UPDATE erp_inventory
    SET stock_on_hand = stock_on_hand - ${quantity},
        stock_reserved = stock_reserved - ${quantity},
        updated_at = NOW()
    WHERE tenant_id = ${tenantId}
      AND variant_id = ${variantId}
      AND warehouse_code = ${warehouseCode}
      AND stock_reserved >= ${quantity}
      AND stock_on_hand >= ${quantity}
  `);
  
  const rowCount = (result as any).rowCount || 0;
  return rowCount > 0;
}

/**
 * Adjust stock levels (receiving inventory, manual corrections)
 * 
 * @param tenantId - Tenant ID
 * @param variantId - Product variant ID
 * @param delta - Positive (add) or negative (subtract)
 * @param warehouseCode - Warehouse location
 * @returns Updated stock level or null if failed
 */
export async function adjustStock(
  tenantId: string,
  variantId: string,
  delta: number,
  warehouseCode: string = "MAIN"
): Promise<number | null> {
  // CRITICAL: Prevent negative stock_on_hand
  const result = await db.execute(sql`
    UPDATE erp_inventory
    SET stock_on_hand = GREATEST(0, stock_on_hand + ${delta}),
        updated_at = NOW()
    WHERE tenant_id = ${tenantId}
      AND variant_id = ${variantId}
      AND warehouse_code = ${warehouseCode}
    RETURNING stock_on_hand
  `);
  
  const rows = (result as any).rows || [];
  return rows.length > 0 ? rows[0].stock_on_hand : null;
}

/**
 * Get available stock for a variant
 * Available = OnHand - Reserved
 * 
 * @param tenantId - Tenant ID
 * @param variantId - Product variant ID
 * @param warehouseCode - Warehouse location
 * @returns Available stock quantity
 */
export async function getAvailableStock(
  tenantId: string,
  variantId: string,
  warehouseCode: string = "MAIN"
): Promise<number> {
  const [record] = await db
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.tenantId, tenantId),
        eq(inventory.variantId, variantId),
        eq(inventory.warehouseCode, warehouseCode)
      )
    )
    .limit(1);
  
  if (!record) {
    return 0;
  }
  
  // stockAvailable is a generated column: stock_on_hand - stock_reserved
  return record.stockAvailable || 0;
}

/**
 * Initialize inventory for a variant
 * Creates inventory record if it doesn't exist
 * 
 * @param tenantId - Tenant ID
 * @param variantId - Product variant ID
 * @param initialStock - Initial stock quantity
 * @param warehouseCode - Warehouse location
 * @param minStockLevel - Minimum stock alert level
 */
export async function initializeInventory(
  tenantId: string,
  variantId: string,
  initialStock: number = 0,
  warehouseCode: string = "MAIN",
  minStockLevel: number = 0
) {
  // Upsert: insert or update if exists
  const [existing] = await db
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.tenantId, tenantId),
        eq(inventory.variantId, variantId),
        eq(inventory.warehouseCode, warehouseCode)
      )
    )
    .limit(1);
  
  if (existing) {
    // Update existing
    await db
      .update(inventory)
      .set({
        stockOnHand: initialStock,
        minStockLevel,
        updatedAt: new Date(),
      })
      .where(eq(inventory.id, existing.id));
    
    return existing.id;
  } else {
    // Insert new
    const [created] = await db
      .insert(inventory)
      .values({
        tenantId,
        variantId,
        warehouseCode,
        stockOnHand: initialStock,
        stockReserved: 0,
        minStockLevel,
      })
      .returning();
    
    return created.id;
  }
}

/**
 * Get low stock alerts
 * Returns variants where stock_on_hand <= min_stock_level
 * 
 * @param tenantId - Tenant ID
 * @param warehouseCode - Warehouse location (optional)
 * @returns Array of low stock records
 */
export async function getLowStockAlerts(
  tenantId: string,
  warehouseCode?: string
) {
  const conditions = [
    eq(inventory.tenantId, tenantId),
    sql`${inventory.stockOnHand} <= ${inventory.minStockLevel}`,
  ];
  
  if (warehouseCode) {
    conditions.push(eq(inventory.warehouseCode, warehouseCode));
  }
  
  return await db
    .select()
    .from(inventory)
    .where(and(...conditions));
}
