import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Single-Tenant Guard Middleware
 * 
 * Enforces single-tenant mode by:
 * 1. Dynamically fetching the primary tenant ID from database
 * 2. Injecting it into request context
 * 3. Neutralizing legacy tenant headers/params/body
 * 4. Preventing multi-tenant data leakage
 * 
 * This allows gradual migration without breaking existing code.
 * When SINGLE_TENANT=true, all operations use the primary tenant.
 */

// Cache the primary tenant ID to avoid repeated queries
let cachedPrimaryTenantId: string | null = null;

async function getPrimaryTenantId(): Promise<string> {
  if (cachedPrimaryTenantId) {
    return cachedPrimaryTenantId;
  }
  
  try {
    const [primaryTenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.isPrimary, true))
      .limit(1);
    
    if (!primaryTenant) {
      throw new Error("No primary tenant found in database");
    }
    
    cachedPrimaryTenantId = primaryTenant.id;
    return cachedPrimaryTenantId;
  } catch (error) {
    console.error("Failed to fetch primary tenant:", error);
    throw error;
  }
}

export async function singleTenantGuard(req: Request, _res: Response, next: NextFunction) {
  if (process.env.SINGLE_TENANT === "true") {
    try {
      const tenantId = await getPrimaryTenantId();
      
      // 1) Inject into request for legacy internal layers
      (req as any).tenantId = tenantId;
      
      // 2) Neutralize legacy headers
      if ("x-tenant-id" in req.headers) {
        req.headers["x-tenant-id"] = tenantId;
      }
      
      // 3) Override body tenantId if present (prevents client override)
      if (req.body && typeof req.body === "object") {
        req.body.tenantId = tenantId;
      }
      
      // 4) Override query tenantId if present
      if (req.query && typeof req.query === "object") {
        (req.query as any).tenantId = tenantId;
      }
      
      next();
    } catch (error) {
      console.error("Single-tenant guard failed:", error);
      next(error);
    }
  } else {
    next();
  }
}

/**
 * Helper to ensure tenantId is always present in data objects
 * Usage: const payload = withTenant({ name: "Acme Corp" });
 * Result: { name: "Acme Corp", tenantId: "tenant_xxx" }
 */
export function withTenant<T extends Record<string, any>>(data: T): T & { tenantId: string } {
  if (!cachedPrimaryTenantId) {
    throw new Error("Primary tenant not initialized. Call getPrimaryTenantId() first.");
  }
  return { ...data, tenantId: cachedPrimaryTenantId };
}

// Export for use in migrations
export { getPrimaryTenantId };
