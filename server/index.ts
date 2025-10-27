import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Subdomain middleware removed for single-tenant architecture

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '50mb', // Aumentado para permitir upload de imagens
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Seed default super admin user if not exists
  try {
    log("🔍 Checking for super admin user...");
    const { db } = await import("./db");
    const { users } = await import("../shared/schema");
    const bcrypt = await import("bcrypt");
    const { eq } = await import("drizzle-orm");
    
    // Check if any super_admin exists
    const existingAdmins = await db.select().from(users).where(eq(users.role, 'super_admin')).limit(1);
    
    if (existingAdmins.length === 0) {
      log("🔧 Creating default super admin user...");
      
      // Create super admin directly with bcrypt
      const passwordHash = await bcrypt.hash("admin123", 10);
      
      await db.insert(users).values({
        email: "admin@eaas.com",
        name: "Administrador",
        passwordHash,
        userType: "employee",
        role: "super_admin",
        approvalStatus: "approved",
        requestedAt: new Date(),
        approvedAt: new Date(),
      });
      
      log("✅ Default super admin created:");
      log("   📧 Email: admin@eaas.com");
      log("   🔑 Password: admin123");
      log("   ⚠️  CHANGE PASSWORD AFTER FIRST LOGIN");
    } else {
      log("✓ Super admin already exists, skipping seed");
    }
  } catch (error: any) {
    log(`❌ Error seeding super admin: ${error.message}`);
    console.error(error);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
