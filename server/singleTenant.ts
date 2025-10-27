import type { Request, Response, NextFunction } from "express";

/**
 * Single-Tenant Guard Middleware
 * 
 * Enforces single-tenant mode by:
 * 1. Injecting fixed tenantId into request context
 * 2. Neutralizing legacy tenant headers/params/body
 * 3. Preventing multi-tenant data leakage
 * 
 * This allows gradual migration without breaking existing code.
 * When SINGLE_TENANT=true, all operations use the fixed tenant ID.
 */
export function singleTenantGuard(req: Request, _res: Response, next: NextFunction) {
  if (process.env.SINGLE_TENANT === "true") {
    const fixed = process.env.TENANT_FIXED_ID || "main";
    
    // 1) Inject into request for legacy internal layers
    (req as any).tenantId = fixed;
    
    // 2) Neutralize legacy headers
    if ("x-tenant-id" in req.headers) {
      req.headers["x-tenant-id"] = fixed;
    }
    
    // 3) Override body tenantId if present (prevents client override)
    if (req.body && typeof req.body === "object") {
      req.body.tenantId = fixed;
    }
    
    // 4) Override query tenantId if present
    if (req.query && typeof req.query === "object") {
      (req.query as any).tenantId = fixed;
    }
  }
  
  next();
}
