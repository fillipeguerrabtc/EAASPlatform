import { db } from "../../db";
import { prices } from "../../../shared/schema.erp";
import { and, eq, desc, isNull, or, gte, lte, sql } from "drizzle-orm";

// ========================================
// PRICING MODULE
// Time-based pricing with promotions
// ========================================

/**
 * Get active price for a product or variant at current time
 * Supports time windows for promotions (Black Friday, Early Bird, etc.)
 * 
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param productId - Product ID (optional if variantId provided)
 * @param variantId - Variant ID (optional if productId provided)
 * @returns Active price record or null if not found
 */
export async function getActivePrice(
  tenantId: string,
  productId?: string,
  variantId?: string
) {
  const now = new Date();
  
  // Build query conditions
  const conditions = [
    eq(prices.tenantId, tenantId),
    eq(prices.isActive, true),
  ];
  
  // Add product or variant filter
  if (variantId) {
    conditions.push(eq(prices.variantId, variantId));
  } else if (productId) {
    conditions.push(eq(prices.productId, productId));
  } else {
    throw new Error("Either productId or variantId must be provided");
  }
  
  // Time window filters (null = always active)
  conditions.push(
    or(
      isNull(prices.validFrom),
      lte(prices.validFrom, now)
    )!
  );
  
  conditions.push(
    or(
      isNull(prices.validUntil),
      gte(prices.validUntil, now)
    )!
  );
  
  // Get most recent price within time window
  const rows = await db
    .select()
    .from(prices)
    .where(and(...conditions))
    .orderBy(desc(prices.createdAt))
    .limit(1);
  
  return rows[0] || null;
}

/**
 * Get active price in cents for a variant
 * Falls back to product base price if no ERP price exists
 * 
 * @param tenantId - Tenant ID
 * @param productId - Product ID
 * @param variantId - Variant ID (optional)
 * @param fallbackPriceCents - Fallback price from product/variant table
 * @returns Price in cents
 */
export async function getActivePriceCents(
  tenantId: string,
  productId: string,
  variantId?: string,
  fallbackPriceCents?: number
): Promise<number> {
  // Try to get ERP price with time windows
  const erpPrice = await getActivePrice(tenantId, productId, variantId);
  
  if (erpPrice) {
    return erpPrice.priceCents;
  }
  
  // Fallback to base price
  if (fallbackPriceCents !== undefined) {
    return fallbackPriceCents;
  }
  
  throw new Error(`No price found for product ${productId} variant ${variantId}`);
}

/**
 * Get all active prices for a product (including variants)
 * Useful for displaying price ranges or promotional badges
 * 
 * @param tenantId - Tenant ID
 * @param productId - Product ID
 * @returns Array of active prices
 */
export async function getProductPrices(tenantId: string, productId: string) {
  const now = new Date();
  
  const rows = await db
    .select()
    .from(prices)
    .where(
      and(
        eq(prices.tenantId, tenantId),
        eq(prices.productId, productId),
        eq(prices.isActive, true),
        or(
          isNull(prices.validFrom),
          lte(prices.validFrom, now)
        )!,
        or(
          isNull(prices.validUntil),
          gte(prices.validUntil, now)
        )!
      )
    )
    .orderBy(desc(prices.createdAt));
  
  return rows;
}

/**
 * Check if a promotional price is active
 * 
 * @param priceId - Price record ID
 * @returns true if price is within valid time window
 */
export async function isPriceActive(priceId: string): Promise<boolean> {
  const now = new Date();
  
  const [price] = await db
    .select()
    .from(prices)
    .where(eq(prices.id, priceId))
    .limit(1);
  
  if (!price || !price.isActive) {
    return false;
  }
  
  // Check time window
  if (price.validFrom && price.validFrom > now) {
    return false;
  }
  
  if (price.validUntil && price.validUntil < now) {
    return false;
  }
  
  return true;
}
