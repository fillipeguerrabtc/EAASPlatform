import { Request, Response, NextFunction } from "express";
import type { IStorage } from "./storage";

// Feature names matching the featureEnum
export type Feature = "finance" | "products" | "customers" | "conversations" | "calendar" | "ai" | "payments" | "settings";
export type AccessLevel = "no_access" | "read" | "write" | "admin";

// Helper to check if user has required access level
export function hasAccess(
  userLevel: AccessLevel,
  requiredLevel: "read" | "write" | "admin"
): boolean {
  const levels: AccessLevel[] = ["no_access", "read", "write", "admin"];
  const userIndex = levels.indexOf(userLevel);
  const requiredIndex = levels.indexOf(requiredLevel);
  return userIndex >= requiredIndex;
}

// Middleware factory to check feature permissions
export function requireFeatureAccess(
  feature: Feature,
  requiredLevel: "read" | "write" | "admin",
  storage: IStorage
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Super admins bypass all checks
      if (user.role === "super_admin") {
        return next();
      }

      // If user has custom role, check permissions
      if (user.customRoleId) {
        const permissions = await storage.getRolePermissions(user.customRoleId);
        const permission = permissions.find(p => p.feature === feature);
        
        if (permission && hasAccess(permission.accessLevel, requiredLevel)) {
          return next();
        }
        
        return res.status(403).json({ 
          error: "Forbidden",
          message: `You don't have ${requiredLevel} access to ${feature}`
        });
      }

      // Fallback to basic role-based access (tenant_admin has all access)
      if (user.role === "tenant_admin") {
        return next();
      }

      // Default: deny access
      return res.status(403).json({ 
        error: "Forbidden",
        message: "No permissions configured for your user"
      });
    } catch (error) {
      console.error("RBAC middleware error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}
