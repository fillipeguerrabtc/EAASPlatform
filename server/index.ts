import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pino from "pino";
import { randomUUID } from "crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log as viteLog } from "./vite";
import { startSLAWorker } from "./workers/sla-worker";

// ========================================
// 1) VALIDAÇÃO DE AMBIENTE (falha cedo e alto)
// ========================================
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("5000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  STRIPE_SECRET_KEY: z.string().min(10, "STRIPE_SECRET_KEY required"),
  // OPCIONAIS:
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

let env: z.infer<typeof EnvSchema>;
try {
  env = EnvSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Environment validation failed:");
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join(".")}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

// ========================================
// 2) APP + LOGGER ESTRUTURADO
// ========================================
const app = express();
const logger = pino({ 
  level: env.LOG_LEVEL
});

// ========================================
// 3) SEGURANÇA BASE
// ========================================
app.set("trust proxy", 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: env.NODE_ENV === "production" ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  } : false, // Disable CSP in development for HMR
}));

// CORS restrito (ajuste conforme necessário)
const allowedOrigins = env.NODE_ENV === "production" 
  ? [process.env.PUBLIC_URL || "https://your-domain.com"].filter(Boolean)
  : ["http://localhost:5000", "http://localhost:5173"]; // Dev + Vite

app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn({ origin }, "CORS: origin not allowed");
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
}));

// ========================================
// 4) REQUEST ID + LOGS ESTRUTURADOS
// ========================================
app.use((req, res, next) => {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  (req as any).id = requestId;
  res.setHeader("x-request-id", requestId);
  
  const start = Date.now();
  
  logger.info({ 
    requestId, 
    method: req.method, 
    path: req.path,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  }, "request:start");
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info({ 
      requestId, 
      method: req.method,
      path: req.path,
      statusCode: res.statusCode, 
      duration 
    }, "request:end");
  });
  
  next();
});

// ========================================
// 5) PARSERS (IMPORTANTE: Stripe webhook terá express.raw isolado em routes.ts)
// ========================================
// NÃO use rawBody aqui - isso quebra assinatura do Stripe
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// ========================================
// 6) COOKIES
// ========================================
app.use(cookieParser());

// ========================================
// 7) RATE LIMIT (evite abuso)
// ========================================
const defaultLimiter = rateLimit({ 
  windowMs: 60_000, // 1 minute
  limit: 300, // 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please try again later",
});

app.use(defaultLimiter);

// Rate limiters específicos serão aplicados em routes.ts
// (ex: /api/auth/* = 50/min, /api/webhooks/* = 60/min)

// ========================================
// 8) HEALTHCHECK
// ========================================
app.get("/healthz", async (_req, res) => {
  try {
    // Verify database connection
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`SELECT 1`);
    
    res.json({ 
      ok: true, 
      env: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    logger.error({ error }, "healthcheck failed");
    res.status(503).json({ 
      ok: false, 
      error: "service_unavailable" 
    });
  }
});

// ========================================
// 9) DATABASE SEEDING (SECURE: sem senha fraca default)
// ========================================
(async () => {
  try {
    logger.info("🔍 Checking for super admin user...");
    const { db } = await import("./db");
    const { users } = await import("../shared/schema");
    const { eq } = await import("drizzle-orm");
    
    const existingAdmins = await db.select().from(users).where(eq(users.role, 'super_admin')).limit(1);
    
    if (existingAdmins.length === 0) {
      logger.warn("⚠️  No super admin found!");
      logger.warn("⚠️  Create one manually via registration or use environment variable");
      logger.warn("⚠️  For security reasons, we no longer seed default admin credentials");
      
      // OPÇÃO: Se REALMENTE precisar de admin default em dev, use env var:
      if (env.NODE_ENV === "development" && process.env.SEED_DEFAULT_ADMIN === "true") {
        const bcrypt = await import("bcrypt");
        const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || randomUUID();
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        
        await db.insert(users).values({
          email: "admin@eaas.local",
          name: "Administrador",
          passwordHash,
          userType: "employee",
          role: "super_admin",
          approvalStatus: "approved",
          requestedAt: new Date(),
          approvedAt: new Date(),
        });
        
        logger.info("✅ Development super admin created:");
        logger.info(`   📧 Email: admin@eaas.local`);
        logger.info(`   🔑 Password: ${adminPassword}`);
        logger.warn("   ⚠️  NEVER use SEED_DEFAULT_ADMIN=true in production!");
      }
    } else {
      logger.info("✓ Super admin exists");
    }
  } catch (error: any) {
    logger.error({ error: error.message }, "Error checking super admin");
  }

  // SINGLE-TENANT ENFORCEMENT
  try {
    logger.info("🔍 Ensuring single-tenant database constraint...");
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS tenants_single_primary 
      ON tenants (is_primary) 
      WHERE is_primary = true
    `);
    
    logger.info("✓ Single-tenant constraint verified");
  } catch (error: any) {
    logger.error({ error: error.message }, "Error creating single-tenant constraint");
  }

  // ========================================
  // 10) ROTAS (registra todas as rotas da aplicação)
  // ========================================
  const server = await registerRoutes(app);

  // ========================================
  // 11) ERROR HANDLER FINAL
  // ========================================
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const requestId = (req as any).id;
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error({ 
      requestId,
      error: err.message, 
      stack: err.stack,
      status 
    }, "unhandled_error");

    res.status(status).json({ error: "internal_error", requestId });
  });

  // ========================================
  // 12) VITE (development) ou STATIC (production)
  // ========================================
  if (env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ========================================
  // 13) START SERVER
  // ========================================
  const port = parseInt(env.PORT, 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    logger.info({ port, env: env.NODE_ENV }, "🚀 EAAS server up");
    
    // Start SLA Worker (runs every 5 minutes if enabled)
    if (process.env.ENABLE_SLA_WORKER === "true") {
      startSLAWorker(5);
      logger.info("✅ SLA Worker enabled");
    } else {
      logger.info("ℹ️  SLA Worker disabled (set ENABLE_SLA_WORKER=true to enable)");
    }
  });
})();
