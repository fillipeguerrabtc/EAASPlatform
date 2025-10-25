import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Subdomain Detection Middleware
 * Detects subdomain from hostname and injects tenant context into request
 * 
 * Examples:
 * - tenant1.eaas.com → tenantId from tenant1
 * - admin.eaas.com → super admin mode
 * - eaas.com → central marketplace
 * - localhost:5000 → development mode (uses X-Tenant-ID header or session)
 */

declare global {
  namespace Express {
    interface Request {
      detectedTenant?: {
        id: string;
        subdomain: string;
        name: string;
        logoUrl?: string;
        faviconUrl?: string;
      } | null;
      isSuperAdminRoute?: boolean;
      isCentralMarketplace?: boolean;
    }
  }
}

export async function subdomainMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const hostname = req.hostname || req.headers.host?.split(':')[0] || 'localhost';
    
    console.log('🌐 Subdomain Middleware - Hostname:', hostname);

    // Development mode: localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      console.log('🔧 Development mode - using header/session for tenant');
      req.isCentralMarketplace = false;
      req.isSuperAdminRoute = false;
      return next();
    }

    // Extract subdomain
    const parts = hostname.split('.');
    const subdomain = parts.length > 2 ? parts[0] : null;

    console.log('📍 Detected subdomain:', subdomain);

    // Route: admin.eaas.com → Super Admin Dashboard
    if (subdomain === 'admin') {
      console.log('👑 Super Admin route detected');
      req.isSuperAdminRoute = true;
      req.isCentralMarketplace = false;
      req.detectedTenant = null;
      return next();
    }

    // Route: eaas.com → Central Marketplace (selling EAAS platform itself)
    if (!subdomain || subdomain === 'www') {
      console.log('🏪 Central Marketplace route detected');
      req.isCentralMarketplace = true;
      req.isSuperAdminRoute = false;
      req.detectedTenant = null;
      return next();
    }

    // Route: tenant1.eaas.com → Tenant Marketplace or Admin
    console.log('🏢 Tenant route detected - looking up:', subdomain);
    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.subdomain, subdomain))
      .limit(1)
      .then(rows => rows[0]);

    if (!tenant) {
      console.log('❌ Tenant not found for subdomain:', subdomain);
      return res.status(404).json({ 
        error: 'Tenant not found',
        subdomain,
        message: 'Este tenant não existe. Verifique a URL ou entre em contato com o suporte.'
      });
    }

    console.log('✅ Tenant found:', tenant.name, '(ID:', tenant.id, ')');
    
    // Inject tenant into request
    req.detectedTenant = {
      id: tenant.id,
      subdomain: tenant.subdomain,
      name: tenant.name,
      logoUrl: tenant.logoUrl || undefined,
      faviconUrl: tenant.faviconUrl || undefined,
    };

    req.isCentralMarketplace = false;
    req.isSuperAdminRoute = false;

    next();
  } catch (error: any) {
    console.error('💥 Subdomain middleware error:', error);
    next(error);
  }
}

/**
 * Helper: Get tenant ID from detected subdomain or fallback to session/header
 */
export function getTenantIdFromRequest(req: Request): string | null {
  // Priority 1: Detected tenant from subdomain
  if (req.detectedTenant?.id) {
    return req.detectedTenant.id;
  }

  // Priority 2: X-Tenant-ID header (for APIs, webhooks)
  const headerTenantId = req.headers['x-tenant-id'] as string;
  if (headerTenantId) {
    return headerTenantId;
  }

  // Priority 3: Session tenant (for authenticated users)
  if (req.user && (req.user as any).tenantId) {
    return (req.user as any).tenantId;
  }

  return null;
}
