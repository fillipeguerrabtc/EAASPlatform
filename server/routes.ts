import type { Express, Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertTenantSchema,
  insertProductSchema,
  insertProductReviewSchema,
  insertCustomerSchema,
  insertConversationSchema,
  insertMessageSchema,
  insertMessageTemplateSchema,
  insertKnowledgeBaseSchema,
  insertPaymentSchema,
  insertOrderSchema,
  insertCartSchema,
  insertCalendarEventSchema,
  insertCategorySchema,
  insertRoleSchema,
  insertRolePermissionSchema,
  insertPasswordResetTokenSchema,
  insertPipelineStageSchema,
  insertDealSchema,
  insertCustomerSegmentSchema,
  insertActivitySchema,
  insertHrLeaveRequestSchema,
  insertWishlistItemSchema,
  insertCrmWorkflowSchema,
  insertReportTemplateSchema,
} from "@shared/schema";
import {
  hashPassword,
  verifyPassword,
  generatePasswordResetToken,
  getPasswordResetTokenExpiry,
  isPasswordResetTokenValid,
  isValidEmail,
  isStrongPassword,
} from "./auth";
import { z } from "zod";
import { setupAuth, isAuthenticated, getUserIdFromSession } from "./replitAuth";
// AI Modules (EAAS Whitepaper 02 implementation)
import { runAllCritics } from "./ai/critics.js";
import { searchKnowledgeBase, getBestMatch } from "./ai/hybrid-rag.js";
import { planAction, type PlannerState } from "./ai/planner.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Replit Auth middleware
  await setupAuth(app);

  // ========================================
  // AUTHENTICATION
  // ========================================

  // Get current authenticated user with permissions (no auth guard - returns null if not authenticated)
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      const userId = getUserIdFromSession(req);
      if (!userId) {
        // Not authenticated - return null to allow frontend to show landing page
        return res.status(200).json(null);
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        // User deleted from database but session still exists
        return res.status(200).json(null);
      }
      
      // Return user with permissions metadata (single-tenant)
      res.json({
        ...user,
        permissions: {
          isSuperAdmin: user.role === 'super_admin',
        },
      });
    } catch (error: any) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ========================================
  // TENANTS
  // ========================================
  
  // List tenants (single-tenant: returns the one tenant)
  app.get("/api/tenants", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantsList = await storage.listTenants();
      res.json(tenantsList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tenants/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenant = await storage.getTenant(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tenants", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertTenantSchema.parse(req.body);
      const tenant = await storage.createTenant(data);
      res.status(201).json(tenant);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/tenants/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertTenantSchema.partial().parse(req.body);
      const tenant = await storage.updateTenant(req.params.id, data);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Brand Scanner: Full website brand extraction with Puppeteer
  app.post("/api/tenants/:id/scan-brand", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { websiteUrl } = req.body;
      
      if (!websiteUrl) {
        return res.status(400).json({ error: "websiteUrl is required" });
      }

      // Use Puppeteer to scan the full website
      const { scanWebsiteBrand } = await import("./brandScanner");
      const brandAnalysis = await scanWebsiteBrand(websiteUrl);

      // Update tenant with new brand assets
      await storage.updateTenant(req.params.id, {
        logoUrl: brandAnalysis.assets?.logo,
        faviconUrl: brandAnalysis.assets?.favicon,
      });

      res.json({ success: true, brand: brandAnalysis });
    } catch (error: any) {
      console.error("Brand scanner error:", error);
      res.status(500).json({ 
        error: "Failed to scan website brand",
        details: error.message 
      });
    }
  });

  // Brand Scanner (Legacy): Extract colors from logo using AI
  app.post("/api/tenants/:id/scan-brand-colors", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { logoUrl } = req.body;
      
      if (!logoUrl) {
        return res.status(400).json({ error: "logoUrl is required" });
      }

      // Use OpenAI Vision API to analyze the logo and extract brand colors
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `You are a brand color expert. Analyze the provided logo image and extract the main brand colors. 
            Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
            {
              "primary": "#HEXCODE",
              "secondary": "#HEXCODE",
              "accent": "#HEXCODE",
              "background": "#FFFFFF",
              "foreground": "#000000"
            }
            
            Guidelines:
            - primary: The dominant/most prominent brand color
            - secondary: A complementary or secondary brand color
            - accent: An accent color for highlights
            - background: Suggest #FFFFFF for light mode or appropriate background
            - foreground: Suggest #000000 for text or appropriate text color
            - All colors must be valid hex codes starting with #
            - Return ONLY the JSON object, nothing else`
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: logoUrl
                }
              },
              {
                type: "text",
                text: "Extract the brand color palette from this logo. Return only JSON."
              }
            ]
          }
        ],
        max_completion_tokens: 200,
      });

      const responseText = completion.choices[0]?.message?.content || "{}";
      
      // Parse the AI response to extract colors
      let colors;
      try {
        // Remove any markdown code blocks if present
        const cleanedResponse = responseText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        
        colors = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error("Failed to parse AI response:", responseText);
        return res.status(500).json({ 
          error: "Failed to extract colors from logo",
          details: "AI response was not valid JSON"
        });
      }

      // Validate that we have the required color fields
      const requiredFields = ['primary', 'secondary', 'accent', 'background', 'foreground'];
      const missingFields = requiredFields.filter(field => !colors[field]);
      
      if (missingFields.length > 0) {
        return res.status(500).json({ 
          error: "Incomplete color extraction",
          details: `Missing fields: ${missingFields.join(', ')}`
        });
      }

      res.json({ colors });
    } catch (error: any) {
      console.error("Brand scanner error:", error);
      res.status(500).json({ 
        error: "Failed to scan brand colors",
        details: error.message 
      });
    }
  });

  // ========================================
  // BRAND SCANNER 2.0 (Extract + Clone)
  // ========================================

  // Create Brand Scanner Job (Extract or Clone)
  app.post("/api/brand/jobs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { url, mode, tenantId } = req.body;
      
      if (!url || !mode || !tenantId) {
        return res.status(400).json({ error: "url, mode, and tenantId are required" });
      }

      if (!['extract', 'clone'].includes(mode)) {
        return res.status(400).json({ error: "mode must be 'extract' or 'clone'" });
      }

      // Create job in database
      const job = await storage.createBrandJob({
        tenantId,
        url,
        mode: mode as 'extract' | 'clone',
        status: 'queued',
        createdBy: (req as any).user?.id,
      });

      // Execute job asynchronously (in production this would be a queue)
      executeJob(job.id, url, mode).catch(err => {
        console.error(`Job ${job.id} failed:`, err);
      });

      res.status(201).json({ jobId: job.id, status: 'queued' });
    } catch (error: any) {
      console.error("Failed to create brand job:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Brand Job Status
  app.get("/api/brand/jobs/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const job = await storage.getBrandJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // List Brand Jobs for Tenant
  app.get("/api/brand/jobs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.query;
      if (!tenantId || typeof tenantId !== 'string') {
        return res.status(400).json({ error: "tenantId query parameter is required" });
      }
      
      const jobs = await storage.listBrandJobs(tenantId);
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // List Theme Bundles
  app.get("/api/brand/themes", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.query;
      if (!tenantId || typeof tenantId !== 'string') {
        return res.status(400).json({ error: "tenantId query parameter is required" });
      }
      
      const themes = await storage.listThemeBundles(tenantId);
      res.json(themes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Active Theme Bundle
  app.get("/api/brand/themes/active", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.query;
      if (!tenantId || typeof tenantId !== 'string') {
        return res.status(400).json({ error: "tenantId query parameter is required" });
      }
      
      const activeTheme = await storage.getActiveThemeBundle(tenantId);
      res.json(activeTheme || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Specific Theme Bundle
  app.get("/api/brand/themes/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const theme = await storage.getThemeBundle(req.params.id);
      if (!theme) {
        return res.status(404).json({ error: "Theme not found" });
      }
      res.json(theme);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Activate Theme Bundle
  app.post("/api/brand/themes/:id/activate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }

      const activated = await storage.activateThemeBundle(req.params.id, tenantId);
      if (!activated) {
        return res.status(404).json({ error: "Theme not found" });
      }

      res.json({ success: true, theme: activated });
    } catch (error: any) {
      console.error("Failed to activate theme:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // List Clone Artifacts
  app.get("/api/brand/clones", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.query;
      if (!tenantId || typeof tenantId !== 'string') {
        return res.status(400).json({ error: "tenantId query parameter is required" });
      }
      
      const clones = await storage.listCloneArtifacts(tenantId);
      res.json(clones);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Active Clone Artifact (PUBLIC - used by /shop)
  app.get("/api/brand/clones/active", async (req: Request, res: Response) => {
    try {
      // Auto-detect tenant (support multi-tenant in future)
      let tenantId = req.query.tenantId as string | undefined;
      
      if (!tenantId) {
        // Fallback to first tenant for single-tenant architecture
        const tenants = await storage.listTenants();
        tenantId = tenants[0]?.id;
      }

      if (!tenantId) {
        return res.json(null);
      }
      
      const activeClone = await storage.getActiveCloneArtifact(tenantId);
      res.json(activeClone || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Activate Clone Artifact
  app.post("/api/brand/clones/:id/activate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }

      const activated = await storage.activateCloneArtifact(req.params.id, tenantId);
      if (!activated) {
        return res.status(404).json({ error: "Clone artifact not found" });
      }

      res.json({ success: true, clone: activated });
    } catch (error: any) {
      console.error("Failed to activate clone:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper function to execute jobs asynchronously with timeout
  async function executeJob(jobId: string, url: string, mode: string) {
    const startTime = Date.now();
    const TIMEOUT_MS = 45000; // 45s max per job
    
    try {
      // Update status to running
      await storage.updateBrandJobStatus(jobId, 'running');

      // Wrap execution in timeout promise
      const executionPromise = (async () => {
        if (mode === 'extract') {
          // 🚀 BRAND SCANNER PRO - Diamond Edition with ALL improvements:
          // 1. Crawler controlado (maxDepth=2, maxPages=10)
          // 2. CIELAB K-Means (perceptually uniform)
          // 3. WCAG Contrast validation (AA/AAA)
          // 4. Image sampling from hero/backgrounds
          // 5. pHash logo detection
          // 6. Font fallback detection
          // 7. Deterministic export (CSS vars + Tailwind.config.ts)
          const { scanWebsiteBrandPro } = await import("./brandScannerPro");
          const brandAnalysis = await scanWebsiteBrandPro(url, {
            maxDepth: 2,
            maxPages: 10,
            timeout: 30000,
            respectRobots: true,  // Honor robots.txt directives (Phase 1 requirement)
          });
          return { type: 'extract', data: brandAnalysis };
        } else if (mode === 'clone') {
          const { buildStaticSnapshot } = await import("./cloneBuilder");
          const cloneBundle = await buildStaticSnapshot(url);
          return { type: 'clone', data: cloneBundle };
        }
        throw new Error('Invalid mode');
      })();

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Job timeout after 45s')), TIMEOUT_MS)
      );

      const result = await Promise.race([executionPromise, timeoutPromise]) as any;

      // Get job to find tenant
      const job = await storage.getBrandJob(jobId);
      if (!job) throw new Error("Job not found");

      if (result.type === 'extract') {
        const brandAnalysis = result.data;

        // Create theme bundle with extracted data
        const nextVersion = await storage.getNextThemeVersion(job.tenantId);
        await storage.createThemeBundle({
          tenantId: job.tenantId,
          version: nextVersion,
          tokens: brandAnalysis.tokens, // Full ThemeTokens from Phase 2
          assets: brandAnalysis.assets,
          jobId,
          sourceUrl: url,
          createdBy: job.createdBy,
          isActive: false,
        });

        // Update job as done
        const duration = Date.now() - startTime;
        await storage.updateBrandJobStatus(jobId, 'done', brandAnalysis, undefined, duration);

      } else if (result.type === 'clone') {
        const cloneBundle = result.data;

        // Create clone artifact
        const nextVersion = await storage.getNextCloneVersion(job.tenantId);
        await storage.createCloneArtifact({
          tenantId: job.tenantId,
          version: nextVersion,
          mode: 'snapshot',
          htmlBundle: cloneBundle.html,
          manifest: cloneBundle.manifest,
          jobId,
          sourceUrl: url,
          createdBy: job.createdBy,
          isActive: false,
        });

        // Update job as done
        const duration = Date.now() - startTime;
        await storage.updateBrandJobStatus(jobId, 'done', cloneBundle.manifest, undefined, duration);
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      await storage.updateBrandJobStatus(jobId, 'failed', undefined, error.message, duration);
      throw error;
    }
  }

  // ========================================
  // RBAC (Roles & Permissions)
  // ========================================

  // List roles
  app.get("/api/roles", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const rolesList = await storage.listRoles();
      res.json(rolesList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create role
  app.post("/api/roles", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(data);
      res.status(201).json(role);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Update role
  app.patch("/api/roles/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertRoleSchema.partial().parse(req.body);
      const role = await storage.updateRole(req.params.id, data);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.json(role);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Delete role
  app.delete("/api/roles/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteRole(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get role permissions
  app.get("/api/roles/:id/permissions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const role = await storage.getRole(req.params.id);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      const permissions = await storage.getRolePermissions(req.params.id);
      res.json(permissions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update role permission
  app.patch("/api/roles/:roleId/permissions/:feature", isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Verify role exists
      const role = await storage.getRole(req.params.roleId);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      
      // Validate request body with Zod schema (just accessLevel from body)
      const bodySchema = z.object({
        accessLevel: z.enum(['no_access', 'read', 'write', 'admin'])
      });
      const validatedBody = bodySchema.parse(req.body);
      
      const permission = await storage.updateRolePermission(req.params.roleId, req.params.feature as any, validatedBody.accessLevel);
      if (!permission) {
        // Create if doesn't exist
        const newPermission = await storage.createRolePermission({
          roleId: req.params.roleId,
          feature: req.params.feature as any,
          accessLevel: validatedBody.accessLevel
        });
        return res.json(newPermission);
      }
      res.json(permission);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // AI GOVERNANCE - Analytics & Policies
  // ========================================
  
  // Get AI Traces with filters
  app.get("/api/ai/governance/traces", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const tenantId = user.tenantId || "default";
      const { customerId, startDate, endDate, limit } = req.query;
      
      const filters: any = { tenantId };
      
      if (customerId) {
        filters.customerId = customerId as string;
      }
      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }
      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }
      
      let traces = await storage.listAiTraces(filters);
      
      // Limit results if requested
      if (limit) {
        traces = traces.slice(0, parseInt(limit as string));
      }
      
      res.json(traces);
    } catch (error: any) {
      console.error("Failed to fetch AI traces:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get AI Metrics Summary
  app.get("/api/ai/governance/metrics/summary", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const tenantId = user.tenantId || "default";
      const { startDate, endDate } = req.query;
      
      const filters: any = { tenantId };
      
      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }
      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }
      
      const summary = await storage.getAiMetricsSummary(filters);
      res.json(summary);
    } catch (error: any) {
      console.error("Failed to fetch AI metrics summary:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get Dashboard KPIs
  app.get("/api/dashboard/kpis", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const tenantId = user.tenantId || "default";
      const { startDate, endDate } = req.query;
      
      const filters: any = { tenantId };
      
      // Validate date parameters
      if (startDate) {
        const parsedStart = new Date(startDate as string);
        if (isNaN(parsedStart.getTime())) {
          return res.status(400).json({ error: "Invalid startDate format" });
        }
        filters.startDate = parsedStart;
      }
      if (endDate) {
        const parsedEnd = new Date(endDate as string);
        if (isNaN(parsedEnd.getTime())) {
          return res.status(400).json({ error: "Invalid endDate format" });
        }
        filters.endDate = parsedEnd;
      }
      
      const kpis = await storage.getDashboardKpis(filters);
      res.json(kpis);
    } catch (error: any) {
      console.error("Failed to fetch dashboard KPIs:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get AI Governance Policies
  app.get("/api/ai/governance/policies", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const tenantId = user.tenantId || "default";
      const { activeOnly } = req.query;
      
      const policies = activeOnly === 'true' 
        ? await storage.listActiveAiPolicies(tenantId)
        : await storage.listAiGovernance(tenantId);
      
      res.json(policies);
    } catch (error: any) {
      console.error("Failed to fetch AI governance policies:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Create AI Governance Policy
  app.post("/api/ai/governance/policies", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const tenantId = user.tenantId || "default";
      
      const policyData = {
        ...req.body,
        tenantId,
      };
      
      const policy = await storage.createAiGovernance(policyData);
      res.json(policy);
    } catch (error: any) {
      console.error("Failed to create AI governance policy:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update AI Governance Policy
  app.put("/api/ai/governance/policies/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateAiGovernance(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Policy not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update AI governance policy:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete AI Governance Policy
  app.delete("/api/ai/governance/policies/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteAiGovernance(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete AI governance policy:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // PRODUCTS
  // ========================================

  // PUBLIC ENDPOINT: Allow anonymous access to products (for marketplace)
  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const productsList = await storage.listProducts();
      // Only return active products for public access
      const activeProducts = productsList.filter(p => p.isActive);
      res.json(activeProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/products/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/products", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(data);
      res.status(201).json(product);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/products/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, data);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/products/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteProduct(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // PRODUCT REVIEWS
  // ========================================

  // List reviews (productId required, only approved reviews for public)
  app.get("/api/reviews", async (req: Request, res: Response) => {
    try {
      const { productId } = req.query;
      
      if (!productId) {
        return res.status(400).json({ error: "productId query parameter is required" });
      }
      
      const allReviews = await storage.listProductReviews(productId as string);
      
      // Filter to only approved reviews (public endpoint)
      const approvedReviews = allReviews.filter(review => review.isApproved);
      
      res.json(approvedReviews);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get product average rating
  app.get("/api/products/:productId/rating", async (req: Request, res: Response) => {
    try {
      const avgRating = await storage.getProductAverageRating(req.params.productId);
      res.json({ productId: req.params.productId, averageRating: avgRating });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create review (authenticated users only)
  app.post("/api/reviews", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const data = insertProductReviewSchema.parse({
        ...req.body,
        customerId: user.id,
      });
      
      const review = await storage.createProductReview(data);
      res.status(201).json(review);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Update review (authenticated users only)
  app.patch("/api/reviews/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertProductReviewSchema.partial().parse(req.body);
      const review = await storage.updateProductReview(req.params.id, data);
      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }
      res.json(review);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Delete review (authenticated users only)
  app.delete("/api/reviews/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteProductReview(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // CUSTOMERS
  // ========================================

  app.get("/api/customers", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const customersList = await storage.listCustomers();
      res.json(customersList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/customers/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/customers", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(data);
      res.status(201).json(customer);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/customers/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(req.params.id, data);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // CONVERSATIONS
  // ========================================

  app.get("/api/conversations", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const conversationsList = await storage.listConversations();
      
      // Enrich with customer data
      const enrichedConversations = await Promise.all(
        conversationsList.map(async (conv) => {
          const customer = await storage.getCustomer(conv.customerId);
          return {
            ...conv,
            customer: customer ? {
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              email: customer.email,
            } : null,
          };
        })
      );
      
      res.json(enrichedConversations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/conversations/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/conversations", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(data);
      res.status(201).json(conversation);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/conversations/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertConversationSchema.partial().parse(req.body);
      const conversation = await storage.updateConversation(req.params.id, data);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // MESSAGES
  // ========================================

  app.get("/api/conversations/:conversationId/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const messagesList = await storage.listMessages(req.params.conversationId);
      res.json(messagesList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(data);
      res.status(201).json(message);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // MESSAGE TEMPLATES
  // ========================================

  // List templates (optionally filtered by category)
  app.get("/api/templates", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { category } = req.query;
      const templates = await storage.listMessageTemplates(category as string | undefined);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create template
  app.post("/api/templates", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertMessageTemplateSchema.parse(req.body);
      const template = await storage.createMessageTemplate(data);
      res.status(201).json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Update template
  app.patch("/api/templates/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertMessageTemplateSchema.partial().parse(req.body);
      const template = await storage.updateMessageTemplate(req.params.id, data);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Delete template
  app.delete("/api/templates/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteMessageTemplate(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Increment template usage
  app.post("/api/templates/:id/use", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.incrementTemplateUsage(req.params.id);
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET messages by conversationId (query param for admin dashboard)
  app.get("/api/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const conversationId = req.query.conversationId as string;
      
      if (!conversationId) {
        return res.status(400).json({ error: "conversationId query parameter is required" });
      }
      
      const messages = await storage.listMessages(conversationId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // OMNICHAT ADMIN - TAKEOVER & MANAGEMENT
  // ========================================

  // Takeover conversation (assign to current user, disable AI)
  app.post("/api/conversations/:id/takeover", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).userId;
      
      const conversation = await storage.updateConversation(req.params.id, {
        assignedTo: userId,
        isAiHandled: false,
      });
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      console.log(`🎯 Takeover: Conversation ${req.params.id} assigned to user ${userId} (AI disabled)`);
      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Release conversation back to AI
  app.post("/api/conversations/:id/release", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const conversation = await storage.updateConversation(req.params.id, {
        assignedTo: null,
        isAiHandled: true,
      });
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      console.log(`🤖 Release: Conversation ${req.params.id} returned to AI control`);
      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Send manual reply via WhatsApp
  app.post("/api/conversations/:id/reply", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      
      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      // Get conversation to verify it exists and get customer info
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      // Verify conversation is in manual mode
      if (conversation.isAiHandled) {
        return res.status(403).json({ error: "Conversation is in AI mode. Take over first." });
      }
      
      // Get customer phone
      const customer = await storage.getCustomer(conversation.customerId);
      if (!customer || !customer.phone) {
        return res.status(404).json({ error: "Customer phone not found" });
      }
      
      // Send via Twilio
      if (!twilioClient) {
        return res.status(503).json({ error: "WhatsApp not configured" });
      }
      
      const twilioResponse = await twilioClient.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${customer.phone}`,
        body: message.trim(),
      });
      
      // Save message only if Twilio send was successful
      if (twilioResponse.status !== "failed") {
        await storage.createMessage({
          conversationId: req.params.id,
          senderType: "agent",
          content: message.trim(),
        });
        
        console.log(`✉️ Manual reply sent: ${req.params.id} → ${customer.phone}`);
        res.json({ success: true, messageId: twilioResponse.sid });
      } else {
        res.status(500).json({ error: "Failed to send WhatsApp message" });
      }
    } catch (error: any) {
      console.error("Manual reply error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // KNOWLEDGE BASE
  // ========================================

  app.get("/api/knowledge-base", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const items = await storage.listKnowledgeBase();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/knowledge-base/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const item = await storage.getKnowledgeBaseItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Knowledge base item not found" });
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/knowledge-base", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertKnowledgeBaseSchema.omit({ vectorId: true }).parse(req.body);
      const item = await storage.createKnowledgeBaseItem(data);
      res.status(201).json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/knowledge-base/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertKnowledgeBaseSchema.omit({ vectorId: true }).partial().parse(req.body);
      const item = await storage.updateKnowledgeBaseItem(req.params.id, data);
      if (!item) {
        return res.status(404).json({ error: "Knowledge base item not found" });
      }
      res.json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/knowledge-base/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteKnowledgeBaseItem(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // ORDERS
  // ========================================

  app.get("/api/orders", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const ordersList = await storage.listOrders();
      res.json(ordersList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/orders/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/orders", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(data);
      res.status(201).json(order);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/orders/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertOrderSchema.partial().parse(req.body);
      const order = await storage.updateOrder(req.params.id, data);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // CARTS
  // ========================================

  // PUBLIC ENDPOINT: Get or create cart (authenticated or anonymous)
  app.get("/api/carts", async (req: Request, res: Response) => {
    try {
      let customerId: string | null = null;
      let sessionId: string | null = null;
      let cart = null;
      
      try {
        customerId = getUserIdFromSession(req);
        // Find cart by customerId for authenticated users
        if (customerId) {
          cart = await storage.getActiveCart(customerId);
        }
      } catch {
        // Anonymous user
        sessionId = (req.session as any)?.id || req.headers['x-session-id'] as string;
        
        // Find cart by sessionId for anonymous users (future enhancement)
        // For now, create new cart for each anonymous session
      }
      
      // Create new cart if none exists
      if (!cart) {
        cart = await storage.createCart({
          customerId,
          sessionId,
          items: [],
          total: "0",
          metadata: {},
        });
      }
      
      res.json(cart);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/carts/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const cart = await storage.getCart(req.params.id);
      if (!cart) {
        return res.status(404).json({ error: "Cart not found" });
      }
      res.json(cart);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUBLIC ENDPOINT: Allow anonymous cart creation
  app.post("/api/carts", async (req: Request, res: Response) => {
    try {
      let customerId: string | null = null;
      let sessionId: string | null = null;
      
      try {
        customerId = getUserIdFromSession(req);
      } catch {
        // Anonymous user
        sessionId = (req.session as any)?.id || req.headers['x-session-id'] as string || Math.random().toString(36);
      }
      
      const { items } = req.body;

      // SECURITY: Validate items and recalculate total from actual product prices
      const products = await storage.listProducts();
      const validatedItems = [];
      let total = 0;

      for (const item of (items || [])) {
        const product = products.find(p => p.id === item.productId);
        if (!product) {
          return res.status(400).json({ error: `Product ${item.productId} not found` });
        }
        if (!product.isActive) {
          return res.status(400).json({ error: `Product ${product.name} is not available` });
        }

        validatedItems.push({
          productId: item.productId,
          quantity: Math.max(1, parseInt(item.quantity) || 1),
          price: product.price, // Use actual price from database
        });
        
        total += parseFloat(product.price) * validatedItems[validatedItems.length - 1].quantity;
      }

      const cart = await storage.createCart({
        customerId,
        sessionId,
        items: validatedItems,
        total: total.toFixed(2),
        metadata: {},
      });
      
      res.status(201).json(cart);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // PUBLIC ENDPOINT: Allow anonymous cart updates
  app.patch("/api/carts/:id", async (req: Request, res: Response) => {
    try {
      const { items } = req.body;

      if (!items) {
        return res.status(400).json({ error: "Items are required" });
      }

      // SECURITY: Validate items and recalculate total from actual product prices
      const products = await storage.listProducts();
      const validatedItems = [];
      let total = 0;

      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (!product) {
          return res.status(400).json({ error: `Product ${item.productId} not found` });
        }
        if (!product.isActive) {
          return res.status(400).json({ error: `Product ${product.name} is not available` });
        }

        validatedItems.push({
          productId: item.productId,
          quantity: Math.max(1, parseInt(item.quantity) || 1),
          price: product.price, // Use actual price from database
        });
        
        total += parseFloat(product.price) * validatedItems[validatedItems.length - 1].quantity;
      }

      const cart = await storage.updateCart(req.params.id, {
        items: validatedItems,
        total: total.toFixed(2),
      });
      
      if (!cart) {
        return res.status(404).json({ error: "Cart not found" });
      }
      
      res.json(cart);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // AI CHAT (Knowledge Base + OpenAI Fallback)
  // ========================================
  
  app.post("/api/ai/chat", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const customerId = (req.user as any).userId;
      
      // Validate request body with Zod
      const aiChatSchema = z.object({
        message: z.string().min(1, "Message cannot be empty"),
        conversationId: z.string().optional(),
      });
      
      const validatedData = aiChatSchema.parse(req.body);
      const { message, conversationId } = validatedData;
      
      // ====== EAAS WHITEPAPER 02: PLANNER/ToT INTEGRATION ======
      // Gather context for intelligent planning
      const products = await storage.listProducts();
      const cart = await storage.getActiveCart(customerId);
      const knowledgeBaseItems = await storage.listKnowledgeBase();
      
      // Prepare planner state
      const plannerState: PlannerState = {
        customerId,
        message,
        currentCart: cart,
        availableProducts: products,
        knowledgeBase: knowledgeBaseItems,
      };
      
      // Plan best action using ToT scoring
      const plannedAction = await planAction(plannerState);
      
      console.info(`[AI Planner] Executing action: ${plannedAction.type}`);
      console.info(`[AI Planner] Score breakdown: Q=${plannedAction.qValue.toFixed(2)}, Risk=${plannedAction.risk.toFixed(2)}, Explain=${plannedAction.explainability.toFixed(2)}`);
      
      // Execute planned action based on Planner decision
      let response: string = "";
      let source: "knowledge_base" | "openai" | "autonomous_sales" = "autonomous_sales";
      let cartAction: any = null;
      
      // === EXECUTION PHASE: Execute planned action ===
      if (plannedAction.type === "escalate_human") {
        // Human escalation
        response = "Entendo que você precisa de ajuda especializada. Vou transferir você para um de nossos atendentes humanos. Um momento, por favor.";
        source = "autonomous_sales";
        cartAction = { type: "escalate", reason: plannedAction.params.reason };
        
      } else if (plannedAction.type === "clarify_intent") {
        // Intent clarification
        response = "Olá! Como posso ajudá-lo hoje? Posso responder perguntas, mostrar produtos disponíveis, ou ajudar com sua compra. O que você gostaria de fazer?";
        source = "autonomous_sales";
        
      } else if (plannedAction.type === "search_products") {
        // Product search/browsing
        const activeProducts = products.filter(p => p.isActive);
        if (activeProducts.length > 0) {
          const suggestions = activeProducts.slice(0, 5).map(p => 
            `- ${p.name} (R$ ${p.price})`
          ).join('\n');
          response = `Aqui estão alguns produtos disponíveis:\n\n${suggestions}\n\nDeseja adicionar algum ao carrinho?`;
        } else {
          response = "No momento não temos produtos disponíveis, mas em breve teremos novidades!";
        }
        source = "autonomous_sales";
        
      } else if (plannedAction.type === "checkout") {
        // Checkout flow - show cart and initiate checkout
        const currentCart = await storage.getActiveCart(customerId);
        const cartItems = Array.isArray(currentCart?.items) ? currentCart.items as any[] : [];
        
        if (cartItems.length === 0) {
          response = "Seu carrinho está vazio. Adicione produtos antes de finalizar a compra.";
        } else {
          const itemsDesc = cartItems.map((item: any) => {
            const product = products.find(p => p.id === item.productId);
            return product ? `- ${product.name} (${item.quantity}x) - R$ ${(parseFloat(product.price) * item.quantity).toFixed(2)}` : null;
          }).filter(Boolean).join('\n');
          
          response = `Ótimo! Aqui está seu carrinho:\n\n${itemsDesc}\n\nTotal: R$ ${currentCart?.total || '0.00'}\n\n[Clique para finalizar a compra →]`;
          cartAction = { type: "checkout", url: "/cart" };
        }
        source = "autonomous_sales";
        
      } else if (plannedAction.type === "add_to_cart") {
        // Add product to cart based on intent
        const messageLower = message.toLowerCase();
        
        // Find product by name in message
        const foundProduct = products.find(p => 
          p.isActive && messageLower.includes(p.name.toLowerCase())
        );
        
        if (foundProduct) {
          // Add to cart
          let currentCart = await storage.getActiveCart(customerId);
          const cartItems = Array.isArray(currentCart?.items) ? currentCart.items as any[] : [];
          
          // Check if product already in cart
          const existingItem = cartItems.find((item: any) => item.productId === foundProduct.id);
          
          let updatedItems;
          if (existingItem) {
            // Increment quantity
            updatedItems = cartItems.map((item: any) => 
              item.productId === foundProduct.id 
                ? { ...item, quantity: item.quantity + 1 }
                : item
            );
          } else {
            // Add new item
            updatedItems = [...cartItems, { productId: foundProduct.id, quantity: 1 }];
          }
          
          // Validate and recalculate total
          const validatedItems = [];
          let total = 0;
          for (const item of updatedItems) {
            const product = products.find(p => p.id === item.productId);
            if (product && product.isActive) {
              validatedItems.push({
                productId: item.productId,
                quantity: Math.max(1, parseInt(item.quantity) || 1),
                price: product.price
              });
              total += parseFloat(product.price) * validatedItems[validatedItems.length - 1].quantity;
            }
          }
          
          // Update cart
          if (currentCart) {
            currentCart = await storage.updateCart(currentCart.id, {
              items: validatedItems,
              total: total.toFixed(2),
            });
            
            response = `✅ ${foundProduct.name} adicionado ao carrinho!\n\nPreço: R$ ${foundProduct.price}\nTotal no carrinho: R$ ${currentCart?.total || '0.00'}\n\nDeseja continuar comprando ou finalizar a compra?`;
            cartAction = { type: "added", productId: foundProduct.id, productName: foundProduct.name };
          } else {
            response = "Erro ao atualizar carrinho. Tente novamente.";
          }
          source = "autonomous_sales";
          
        } else {
          // Product not found - suggest alternatives
          const activeProducts = products.filter(p => p.isActive);
          if (activeProducts.length > 0) {
            const suggestions = activeProducts.slice(0, 3).map(p => 
              `- ${p.name} (R$ ${p.price})`
            ).join('\n');
            
            response = `Não encontrei esse produto exato. Veja algumas opções disponíveis:\n\n${suggestions}\n\nDigite o nome do produto que deseja comprar.`;
          } else {
            response = "Desculpe, não encontrei esse produto. Podemos adicionar novos produtos ao catálogo em breve!";
          }
          source = "autonomous_sales";
        }
        
      } else if (plannedAction.type === "answer_question") {
        // KNOWLEDGE BASE MODE: Hybrid RAG + OpenAI with Critics validation
        const knowledgeBaseItems = await storage.listKnowledgeBase();
        
        // Convert KB items to expected format (id should be number)
        const kbItems = knowledgeBaseItems.map(item => ({
          id: parseInt(item.id),
          title: item.title,
          content: item.content,
          category: item.category || undefined,
          tags: (item.tags as string[]) || undefined,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          isVerified: item.isActive,
        }));
        
        // Use Hybrid RAG scoring for better KB search
        const bestMatch = getBestMatch(message, kbItems, 0.3);
        
        if (bestMatch && bestMatch.score > 0.3) {
          // High confidence KB match
          response = bestMatch.item.content;
          source = "knowledge_base";
          
          // Validate with critics
          const criticResults = runAllCritics({
            message,
            response,
            source: "knowledge_base",
            customerId,
            knowledgeBaseMatch: bestMatch.item,
          });
          
          // Persist AI trace to database
          try {
            const customer = customerId ? await storage.getCustomer(customerId) : undefined;
            await storage.createAiTrace({
              tenantId: customer?.tenantId || "default",
              customerId: customerId || undefined,
              conversationId: conversationId || undefined,
              messageContent: message,
              aiResponse: response,
              responseSource: "knowledge_base",
              factualScore: criticResults.criticsResults.factual.confidence.toFixed(2),
              numericScore: criticResults.criticsResults.numeric.confidence.toFixed(2),
              ethicalScore: criticResults.criticsResults.ethical.confidence.toFixed(2),
              riskScore: criticResults.criticsResults.risk.confidence.toFixed(2),
              overallConfidence: criticResults.overallConfidence.toFixed(2),
              passed: criticResults.passed,
              shouldEscalateToHuman: criticResults.shouldEscalateToHuman,
              finalRecommendation: criticResults.finalRecommendation,
              factualViolations: criticResults.criticsResults.factual.issues,
              numericViolations: criticResults.criticsResults.numeric.issues,
              ethicalViolations: criticResults.criticsResults.ethical.issues,
              riskViolations: criticResults.criticsResults.risk.issues,
              knowledgeBaseMatchId: bestMatch.item.id?.toString(),
            });
          } catch (traceError: any) {
            console.error("[AI Trace] Failed to persist KB trace:", traceError.message);
          }
          
          // Log critic feedback
          console.info(`[AI Critics] Validation - Confidence: ${criticResults.overallConfidence.toFixed(2)}, Passed: ${criticResults.passed}`);
          console.info(`[AI Critics] Recommendation: ${criticResults.finalRecommendation}`);
          
          if (criticResults.shouldEscalateToHuman) {
            console.warn(`[AI Critics] ESCALATION RECOMMENDED: ${criticResults.finalRecommendation}`);
          }
          
          // If critical issues, fallback to OpenAI
          if (!criticResults.passed && criticResults.shouldEscalateToHuman) {
            console.warn(`[AI Critics] Critical issues detected, falling back to OpenAI`);
            source = "openai"; // Will trigger OpenAI below
          }
        } else {
          source = "openai"; // No KB match, use OpenAI
        }
        
        if (source === "openai") {
          // Fallback to OpenAI
          const OpenAI = (await import("openai")).default;
          const openai = new OpenAI({
            baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
            apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
          });
          
          const completion = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [
              { role: "system", content: "You are a helpful AI sales assistant. Help customers find and buy products. Be concise and professional." },
              { role: "user", content: message }
            ],
            max_completion_tokens: 500,
          });
          
          response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
          
          // Validate OpenAI response with critics
          const criticResults = runAllCritics({
            message,
            response,
            source: "openai",
            customerId,
          });
          
          // Persist AI trace to database
          try {
            const customer = customerId ? await storage.getCustomer(customerId) : undefined;
            await storage.createAiTrace({
              tenantId: customer?.tenantId || "default",
              customerId: customerId || undefined,
              conversationId: conversationId || undefined,
              messageContent: message,
              aiResponse: response,
              responseSource: "openai",
              factualScore: criticResults.criticsResults.factual.confidence.toFixed(2),
              numericScore: criticResults.criticsResults.numeric.confidence.toFixed(2),
              ethicalScore: criticResults.criticsResults.ethical.confidence.toFixed(2),
              riskScore: criticResults.criticsResults.risk.confidence.toFixed(2),
              overallConfidence: criticResults.overallConfidence.toFixed(2),
              passed: criticResults.passed,
              shouldEscalateToHuman: criticResults.shouldEscalateToHuman,
              finalRecommendation: criticResults.finalRecommendation,
              factualViolations: criticResults.criticsResults.factual.issues,
              numericViolations: criticResults.criticsResults.numeric.issues,
              ethicalViolations: criticResults.criticsResults.ethical.issues,
              riskViolations: criticResults.criticsResults.risk.issues,
            });
          } catch (traceError: any) {
            console.error("[AI Trace] Failed to persist OpenAI trace:", traceError.message);
          }
          
          // Log critic feedback
          console.info(`[AI Critics] OpenAI Validation - Confidence: ${criticResults.overallConfidence.toFixed(2)}, Passed: ${criticResults.passed}`);
          console.info(`[AI Critics] Recommendation: ${criticResults.finalRecommendation}`);
          
          if (criticResults.shouldEscalateToHuman) {
            console.warn(`[AI Critics] ESCALATION RECOMMENDED: ${criticResults.finalRecommendation}`);
          }
        }
        
      } else {
        // Default fallback for any other action types
        response = "Como posso ajudá-lo hoje?";
        source = "autonomous_sales";
      }
      
      // Final Critics validation for ALL autonomous_sales responses (add_to_cart, product_suggestions, etc.)
      // These responses often contain prices and totals that need validation
      if (source === "autonomous_sales" && response) {
        const criticResults = runAllCritics({
          message,
          response,
          source: "autonomous_sales",
          customerId,
          cartValue: cart ? parseFloat(cart.total) : undefined,
        });
        
        // Persist AI trace to database
        try {
          const customer = customerId ? await storage.getCustomer(customerId) : undefined;
          await storage.createAiTrace({
            tenantId: customer?.tenantId || "default",
            customerId: customerId || undefined,
            conversationId: conversationId || undefined,
            messageContent: message,
            aiResponse: response,
            responseSource: "autonomous_sales",
            factualScore: criticResults.criticsResults.factual.confidence.toFixed(2),
            numericScore: criticResults.criticsResults.numeric.confidence.toFixed(2),
            ethicalScore: criticResults.criticsResults.ethical.confidence.toFixed(2),
            riskScore: criticResults.criticsResults.risk.confidence.toFixed(2),
            overallConfidence: criticResults.overallConfidence.toFixed(2),
            passed: criticResults.passed,
            shouldEscalateToHuman: criticResults.shouldEscalateToHuman,
            finalRecommendation: criticResults.finalRecommendation,
            factualViolations: criticResults.criticsResults.factual.issues,
            numericViolations: criticResults.criticsResults.numeric.issues,
            ethicalViolations: criticResults.criticsResults.ethical.issues,
            riskViolations: criticResults.criticsResults.risk.issues,
            cartValue: cart ? parseFloat(cart.total).toFixed(2) : undefined,
          });
        } catch (traceError: any) {
          console.error("[AI Trace] Failed to persist autonomous sales trace:", traceError.message);
        }
        
        // Log critic feedback
        console.info(`[AI Critics] Autonomous Sales Validation - Confidence: ${criticResults.overallConfidence.toFixed(2)}, Passed: ${criticResults.passed}`);
        
        if (!criticResults.passed) {
          console.warn(`[AI Critics] Issues detected in autonomous response: ${criticResults.finalRecommendation}`);
        }
        
        if (criticResults.shouldEscalateToHuman) {
          console.warn(`[AI Critics] ESCALATION RECOMMENDED: ${criticResults.finalRecommendation}`);
        }
      }
      
      // Save message to conversation if conversationId provided
      if (conversationId) {
        const conversation = await storage.getConversation(conversationId);
        if (conversation) {
          await storage.createMessage({
            conversationId,
            senderType: "customer",
            content: message,
          });
          
          await storage.createMessage({
            conversationId,
            senderType: "ai",
            content: response,
          });
        }
      }
      
      res.json({ response, source, cartAction });
    } catch (error: any) {
      console.error("AI Chat error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // PAYMENTS & STRIPE INTEGRATION
  // ========================================
  
  // Initialize Stripe client (from blueprint:javascript_stripe)
  let stripe: any = null;
  if (process.env.STRIPE_SECRET_KEY) {
    const Stripe = (await import("stripe")).default;
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16" as any,
    });
  } else {
    console.warn("STRIPE_SECRET_KEY not found - payment processing disabled");
  }
  
  // Create Stripe Checkout Session from Cart (SECURE - validates server-side)
  app.post("/api/create-checkout-session", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe not configured" });
      }
      
      const customerId = (req.user as any).userId;
      
      // SECURITY: Get user's cart and recalculate total from actual product prices
      const cart = await storage.getActiveCart(customerId);
      
      if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
      }
      
      // Revalidate cart items and recalculate total
      const products = await storage.listProducts();
      let total = 0;
      const lineItems = [];
      
      for (const item of (cart.items as any[])) {
        const product = products.find(p => p.id === item.productId);
        if (!product || !product.isActive) {
          return res.status(400).json({ error: `Product not available` });
        }
        
        const price = parseFloat(product.price);
        const quantity = parseInt(item.quantity) || 1;
        total += price * quantity;
        
        lineItems.push({
          price_data: {
            currency: "brl",
            product_data: {
              name: product.name,
              description: product.description || undefined,
            },
            unit_amount: Math.round(price * 100), // Convert to cents
          },
          quantity,
        });
      }

      // Create Stripe Checkout Session (hosted payment page)
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${req.headers.origin || "http://localhost:5000"}/checkout?success=true`,
        cancel_url: `${req.headers.origin || "http://localhost:5000"}/checkout?canceled=true`,
        metadata: {
          customerId,
          cartId: cart.id,
        },
      });

      res.json({
        sessionId: session.id,
        url: session.url, // Stripe hosted checkout URL
      });
    } catch (error: any) {
      console.error("Stripe checkout error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create Stripe Checkout Session (Payment Link approach - no public key needed)
  app.post("/api/create-payment-intent", async (req: Request, res: Response) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe not configured" });
      }
      
      const { amount, customerId, description } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid amount is required" });
      }
      
      // Create Stripe Checkout Session (hosted payment page)
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: description || "EAAS Platform Service",
              },
              unit_amount: Math.round(amount * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.headers.origin || "http://localhost:5000"}/checkout?success=true`,
        cancel_url: `${req.headers.origin || "http://localhost:5000"}/checkout?canceled=true`,
        metadata: {
          customerId: customerId || "guest",
        },
      });
      
      res.json({ 
        sessionId: session.id,
        url: session.url, // Stripe hosted checkout URL
      });
    } catch (error: any) {
      console.error("Stripe checkout error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Stripe Webhook Handler (for payment confirmations)
  app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe not configured" });
      }
      
      const sig = req.headers["stripe-signature"];
      
      if (!sig) {
        return res.status(400).json({ error: "Missing stripe-signature header" });
      }
      
      // In production, set STRIPE_WEBHOOK_SECRET
      // For now, we'll process events without signature verification in dev
      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET || ""
        );
      } catch (err: any) {
        console.log("Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
      
      // Handle different event types
      switch (event.type) {
        case "payment_intent.succeeded":
          const paymentIntent = event.data.object;
          console.log("PaymentIntent succeeded:", paymentIntent.id);
          
          // Save payment to database
          await storage.createPayment({
            customerId: paymentIntent.metadata.customerId || null,
            amount: (paymentIntent.amount / 100).toFixed(2), // Convert from cents to string
            currency: paymentIntent.currency,
            status: "succeeded",
            stripePaymentIntentId: paymentIntent.id,
          });
          break;
          
        case "payment_intent.payment_failed":
          console.log("PaymentIntent failed:", event.data.object.id);
          break;
          
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
      
      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Payment CRUD routes
  app.get("/api/payments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const paymentsList = await storage.listPayments();
      res.json(paymentsList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/payments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(data);
      res.status(201).json(payment);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/payments/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      res.json(payment);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // CALENDAR EVENTS
  // ========================================

  app.get("/api/calendar-events", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const events = await storage.listCalendarEvents();
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/calendar-events", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const bodyData = insertCalendarEventSchema.parse(req.body);
      // Convert ISO strings to Date objects
      const data = {
        ...bodyData,
        startTime: new Date(bodyData.startTime as any),
        endTime: new Date(bodyData.endTime as any),
      };
      const event = await storage.createCalendarEvent(data);
      res.status(201).json(event);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/calendar-events/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const event = await storage.getCalendarEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/calendar-events/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const bodyData = insertCalendarEventSchema.partial().parse(req.body);
      // Convert ISO strings to Date objects if present
      const data: any = { ...bodyData };
      if (data.startTime) data.startTime = new Date(data.startTime);
      if (data.endTime) data.endTime = new Date(data.endTime);
      const event = await storage.updateCalendarEvent(req.params.id, data);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/calendar-events/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteCalendarEvent(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // CATEGORIES
  // ========================================

  app.get("/api/categories", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const categories = await storage.listCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/categories", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(data);
      res.status(201).json(category);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/categories/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const bodyData = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(req.params.id, bodyData);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/categories/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteCategory(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // WHATSAPP INTEGRATION (TWILIO)
  // ========================================
  
  // Initialize Twilio client
  let twilioClient: any = null;
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = await import("twilio");
    twilioClient = twilio.default(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    console.log("✅ Twilio WhatsApp client initialized");
  } else {
    console.warn("⚠️  TWILIO credentials not found - WhatsApp messaging disabled");
  }
  
  // Send WhatsApp message
  app.post("/api/whatsapp/send", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!twilioClient || !process.env.TWILIO_WHATSAPP_NUMBER) {
        return res.status(503).json({ error: "WhatsApp service not configured" });
      }
      
      const { to, message } = req.body;
      
      if (!to || !message) {
        return res.status(400).json({ error: "Phone number and message are required" });
      }
      
      // Find or create customer by phone
      let customer = (await storage.listCustomers()).find(
        c => c.phone === to
      );
      
      if (!customer) {
        customer = await storage.createCustomer({
          name: to,
          email: `${to}@whatsapp.temp`,
          phone: to,
        });
      }
      
      // Find or create WhatsApp conversation
      let conversation = (await storage.listConversations()).find(
        c => c.customerId === customer!.id && c.channel === "whatsapp"
      );
      
      if (!conversation) {
        conversation = await storage.createConversation({
          customerId: customer.id,
          channel: "whatsapp",
          status: "open",
        });
      }
      
      // Send via Twilio FIRST (fail fast if Twilio errors)
      const twilioMessage = await twilioClient.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${to}`,
        body: message,
      });
      
      // Only save message AFTER Twilio succeeds
      if (twilioMessage.status !== "failed") {
        await storage.createMessage({
          conversationId: conversation.id,
          senderType: "agent",
          content: message,
        });
      }
      
      res.json({ 
        success: true,
        messageId: twilioMessage.sid,
        status: twilioMessage.status,
        conversationId: conversation.id,
      });
    } catch (error: any) {
      console.error("WhatsApp send error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Webhook to receive incoming WhatsApp messages
  // IMPORTANT: Twilio sends application/x-www-form-urlencoded, handled by express.urlencoded()
  app.post("/api/whatsapp/webhook", express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
    try {
      const { From, Body, MessageSid, To } = req.body;
      
      // MANDATORY: Validate Twilio signature for security (BEFORE any processing)
      const twilioSignature = req.headers["x-twilio-signature"] as string;
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (!twilioSignature || !twilioAuthToken) {
        console.error("🚫 WhatsApp webhook: Missing Twilio signature or auth token - rejecting request");
        return res.status(403).send("<Response></Response>");
      }
      
      // Validate signature using Twilio SDK
      const twilio = await import("twilio");
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const isValid = twilio.default.validateRequest(
        twilioAuthToken,
        twilioSignature,
        url,
        req.body
      );
      
      if (!isValid) {
        console.error("🚫 Invalid Twilio signature - potential spoofing attempt - rejecting");
        console.error(`   Signature: ${twilioSignature}`);
        console.error(`   URL: ${url}`);
        return res.status(403).send("<Response></Response>");
      }
      
      console.log("📱 WhatsApp message received (validated):", { From, Body, MessageSid, To });
      
      if (!From || !Body) {
        return res.status(400).send("Missing required fields");
      }
      
      // Extract phone numbers (remove whatsapp: prefix)
      const phoneNumber = From.replace("whatsapp:", "");
      
      console.log(`📱 WhatsApp webhook: Incoming message from ${phoneNumber}`);
      
      // Find or create customer
      let customer = (await storage.listCustomers()).find(
        c => c.phone === phoneNumber
      );
      
      if (!customer) {
        customer = await storage.createCustomer({
          name: phoneNumber, // Use phone as name initially
          email: `${phoneNumber}@whatsapp.temp`,
          phone: phoneNumber,
        });
      }
      
      // Find or create conversation
      let conversation = (await storage.listConversations()).find(
        c => c.customerId === customer!.id && c.channel === "whatsapp"
      );
      
      if (!conversation) {
        conversation = await storage.createConversation({
          customerId: customer.id,
          channel: "whatsapp",
          status: "open",
        });
      }
      
      // Save incoming message
      await storage.createMessage({
        conversationId: conversation.id,
        senderType: "customer",
        content: Body,
      });
      
      // ========================================
      // SMART ESCALATION - Detect frustration and escalate to human
      // ========================================
      
      const frustrationKeywords = [
        "cancelar", "cancel", "não funciona", "doesn't work", "péssimo", "terrible",
        "horrível", "horrible", "ruim", "bad", "irritado", "angry", "frustrado", "frustrated",
        "desistir", "give up", "sair", "leave", "reclamar", "complain",
        "não resolve", "não ajuda", "inútil", "useless", "falar com humano", "talk to human",
        "atendente", "agent", "pessoa", "person"
      ];
      
      const needsEscalation = frustrationKeywords.some(keyword => 
        Body.toLowerCase().includes(keyword)
      );
      
      if (needsEscalation && conversation.isAiHandled) {
        // Escalate to human
        await storage.updateConversation(conversation.id, {
          isAiHandled: false,
          assignedTo: null, // Will be assigned when agent takes over
        });
        
        const escalationMessage = "Entendo sua situação. Vou transferir você para um de nossos especialistas que poderá ajudar melhor. Por favor, aguarde um momento. 👤";
        
        if (twilioClient) {
          const twilioResponse = await twilioClient.messages.create({
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: From,
            body: escalationMessage,
          });
          
          if (twilioResponse.status !== "failed") {
            await storage.createMessage({
              conversationId: conversation.id,
              senderType: "ai",
              content: escalationMessage,
            });
            
            console.log(`🚨 ESCALATION: Conversation ${conversation.id} escalated to human (frustration detected)`);
          }
        }
        
        // Don't process AI response - wait for human takeover
        res.type("text/xml");
        return res.send("<Response></Response>");
      }
      
      // ========================================
      // AI AUTO-RESPONSE via WhatsApp (only if not escalated)
      // ========================================
      
      // Skip AI response if conversation is in manual mode
      if (!conversation.isAiHandled) {
        console.log(`⏸️ Skipping AI response: Conversation ${conversation.id} is in manual mode`);
        res.type("text/xml");
        return res.send("<Response></Response>");
      }
      
      // Process message with AI (Knowledge Base + GPT-5 fallback)
      const knowledgeBaseItems = await storage.listKnowledgeBase();
      const matchedItem = knowledgeBaseItems.find(item => 
        item.title.toLowerCase().includes(Body.toLowerCase()) ||
        item.content.toLowerCase().includes(Body.toLowerCase())
      );
      
      let aiResponse: string;
      let source: "knowledge_base" | "openai";
      
      if (matchedItem) {
        aiResponse = matchedItem.content;
        source = "knowledge_base";
      } else {
        // Fallback to OpenAI GPT-5
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({
          baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
        });
        
        const completion = await openai.chat.completions.create({
          model: "gpt-5",
          messages: [
            { 
              role: "system", 
              content: "Você é a assistente virtual da EAAS, uma plataforma completa de gestão empresarial. Seja profissional, prestativa e objetiva. Ajude com dúvidas sobre produtos, serviços e vendas. Sempre mantenha um tom amigável e profissional." 
            },
            { role: "user", content: Body }
          ],
          max_completion_tokens: 300,
        });
        
        aiResponse = completion.choices[0]?.message?.content || "Desculpe, não consegui processar sua mensagem. Por favor, tente novamente.";
        source = "openai";
      }
      
      // Run Critics validation BEFORE sending response
      const criticResults = runAllCritics({
        message: Body,
        response: aiResponse,
        source,
        customerId: customer!.id,
        knowledgeBaseMatch: matchedItem,
      });
      
      // Persist AI trace to database
      try {
        await storage.createAiTrace({
          tenantId: customer!.tenantId || "default",
          customerId: customer!.id,
          conversationId: conversation.id,
          messageContent: Body,
          aiResponse,
          responseSource: source,
          factualScore: criticResults.criticsResults.factual.confidence.toFixed(2),
          numericScore: criticResults.criticsResults.numeric.confidence.toFixed(2),
          ethicalScore: criticResults.criticsResults.ethical.confidence.toFixed(2),
          riskScore: criticResults.criticsResults.risk.confidence.toFixed(2),
          overallConfidence: criticResults.overallConfidence.toFixed(2),
          passed: criticResults.passed,
          shouldEscalateToHuman: criticResults.shouldEscalateToHuman,
          finalRecommendation: criticResults.finalRecommendation,
          factualViolations: criticResults.criticsResults.factual.issues,
          numericViolations: criticResults.criticsResults.numeric.issues,
          ethicalViolations: criticResults.criticsResults.ethical.issues,
          riskViolations: criticResults.criticsResults.risk.issues,
          knowledgeBaseMatchId: matchedItem?.id?.toString(),
        });
      } catch (traceError: any) {
        console.error("[AI Trace] Failed to persist trace:", traceError.message);
      }
      
      // If Critics recommend escalation, disable AI and notify human
      if (criticResults.shouldEscalateToHuman) {
        console.log(`🚨 CRITICS ESCALATION: ${criticResults.finalRecommendation}`);
        
        // Disable AI handling
        await storage.updateConversation(conversation.id, {
          isAiHandled: false,
        });
        
        // Send escalation message
        const escalationNotice = `[Escalado para humano: ${criticResults.finalRecommendation}]`;
        
        if (twilioClient) {
          await twilioClient.messages.create({
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: From,
            body: `Estou transferindo você para um atendente humano. ${criticResults.finalRecommendation}`,
          });
        }
        
        // Save escalation to conversation
        await storage.createMessage({
          conversationId: conversation.id,
          senderType: "ai",
          content: escalationNotice,
        });
        
        res.type("text/xml");
        return res.send("<Response></Response>");
      }
      
      // Send AI response via WhatsApp FIRST (then save only if successful)
      if (twilioClient) {
        const twilioResponse = await twilioClient.messages.create({
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: From,
          body: aiResponse,
        });
        
        // Only save AI response if Twilio send was successful
        if (twilioResponse.status !== "failed") {
          await storage.createMessage({
            conversationId: conversation.id,
            senderType: "ai",
            content: aiResponse,
          });
          
          console.log(`🤖 AI responded via WhatsApp (source: ${source}, status: ${twilioResponse.status})`);
        } else {
          console.error(`❌ Failed to send WhatsApp message: ${twilioResponse.status}`);
        }
      }
      
      // Respond with TwiML (required by Twilio)
      res.type("text/xml");
      res.send("<Response></Response>");
      
    } catch (error: any) {
      console.error("WhatsApp webhook error:", error);
      res.status(500).send("<Response></Response>");
    }
  });

  // ========================================
  // FINANCIAL TRANSACTIONS
  // ========================================

  app.get("/api/financial-transactions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { type, startDate, endDate } = req.query;
      
      const filters: any = {};
      if (type) filters.type = type;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      
      const transactions = await storage.listFinancialTransactions(filters);
      res.json(transactions);
    } catch (error: any) {
      console.error("Error listing financial transactions:", error);
      res.status(500).json({ message: "Failed to list transactions" });
    }
  });

  app.get("/api/financial-transactions/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const transaction = await storage.getFinancialTransaction(req.params.id);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.json(transaction);
    } catch (error: any) {
      console.error("Error getting financial transaction:", error);
      res.status(500).json({ message: "Failed to get transaction" });
    }
  });

  app.post("/api/financial-transactions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Validate request body with Zod
      const { insertFinancialTransactionSchema } = await import("@shared/schema");
      const validatedData = insertFinancialTransactionSchema.parse({
        ...req.body,
        date: new Date(req.body.date),
      });
      
      const transaction = await storage.createFinancialTransaction(validatedData);
      res.json(transaction);
    } catch (error: any) {
      console.error("Error creating financial transaction:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  app.patch("/api/financial-transactions/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      
      // Validate update data with Zod (partial validation)
      const { insertFinancialTransactionSchema } = await import("@shared/schema");
      const updateData = { ...req.body };
      if (req.body.date) {
        updateData.date = new Date(req.body.date);
      }
      
      // Validate only provided fields (partial)
      const validatedData = insertFinancialTransactionSchema.partial().parse(updateData);
      
      const transaction = await storage.updateFinancialTransaction(req.params.id, validatedData);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.json(transaction);
    } catch (error: any) {
      console.error("Error updating financial transaction:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  app.delete("/api/financial-transactions/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteFinancialTransaction(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting financial transaction:", error);
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // Get DRE Report (Financial Statement)
  app.get("/api/finance/dre", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      
      const filters: any = {};
      
      // Validate date parameters
      if (startDate) {
        const parsedStart = new Date(startDate as string);
        if (isNaN(parsedStart.getTime())) {
          return res.status(400).json({ error: "Invalid startDate format" });
        }
        filters.startDate = parsedStart;
      }
      if (endDate) {
        const parsedEnd = new Date(endDate as string);
        if (isNaN(parsedEnd.getTime())) {
          return res.status(400).json({ error: "Invalid endDate format" });
        }
        filters.endDate = parsedEnd;
      }
      
      const dre = await storage.generateDREReport(filters);
      res.json(dre);
    } catch (error: any) {
      console.error("Error generating DRE report:", error);
      res.status(500).json({ message: "Failed to generate DRE report" });
    }
  });

  // ========================================
  // FINANCIAL ACCOUNTS
  // ========================================

  app.get("/api/financial-accounts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const accounts = await storage.listFinancialAccounts();
      res.json(accounts);
    } catch (error: any) {
      console.error("Error listing financial accounts:", error);
      res.status(500).json({ message: "Failed to list accounts" });
    }
  });

  app.post("/api/financial-accounts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Validate request body with Zod
      const { insertFinancialAccountSchema } = await import("@shared/schema");
      const validatedData = insertFinancialAccountSchema.parse(req.body);
      
      const account = await storage.createFinancialAccount(validatedData);
      res.json(account);
    } catch (error: any) {
      console.error("Error creating financial account:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // ========================================
  // LOCAL AUTH (Email/Password) - Dual-Track System
  // ========================================
  
  // Register as EMPLOYEE (requires admin approval)
  app.post("/api/auth/register-employee", async (req: Request, res: Response) => {
    try {
      const registerSchema = z.object({
        email: z.string().email({ message: "Email inválido" }),
        password: z.string().min(8, { message: "Senha deve ter pelo menos 8 caracteres" }),
        name: z.string().min(1, { message: "Nome é obrigatório" }),
      });
      
      const { email, password, name } = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Este email já está cadastrado" });
      }
      
      // Register user (will be pending approval)
      const user = await storage.registerUser({
        email,
        password,
        name,
        userType: 'employee',
      });
      
      res.status(201).json({ 
        message: "Solicitação enviada com sucesso. Aguarde aprovação de um administrador.",
        user: { id: user.id, email: user.email, name: user.name, approvalStatus: user.approvalStatus }
      });
    } catch (error: any) {
      console.error("Error registering employee:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar solicitação" });
    }
  });
  
  // Register as CUSTOMER (auto-approved)
  app.post("/api/auth/register-customer", async (req: Request, res: Response) => {
    try {
      const registerSchema = z.object({
        email: z.string().email({ message: "Email inválido" }),
        password: z.string().min(8, { message: "Senha deve ter pelo menos 8 caracteres" }),
        name: z.string().min(1, { message: "Nome é obrigatório" }),
      });
      
      const { email, password, name } = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Este email já está cadastrado" });
      }
      
      // Register user (auto-approved for customers)
      const user = await storage.registerUser({
        email,
        password,
        name,
        userType: 'customer',
      });
      
      // Auto-create customer record in CRM
      try {
        await storage.createCustomer({
          name: user.name,
          email: user.email,
          phone: null,
          userId: user.id,
          lifecycleStage: 'customer',
        });
      } catch (crmError) {
        console.error("Error creating customer record:", crmError);
        // Continue anyway - customer can be created later
      }
      
      // Create session and save it explicitly
      (req as any).session.userId = user.id;
      
      // Save session to ensure cookie is sent
      (req as any).session.save((err: any) => {
        if (err) {
          console.error("Error saving session:", err);
          return res.status(500).json({ message: "Erro ao criar sessão" });
        }
        
        res.status(201).json({ 
          message: "Conta criada com sucesso!",
          user: { id: user.id, email: user.email, name: user.name, role: user.role }
        });
      });
    } catch (error: any) {
      console.error("Error registering customer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar conta" });
    }
  });
  
  // Login with email/password
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const loginSchema = z.object({
        email: z.string().email({ message: "Email inválido" }),
        password: z.string().min(1, { message: "Senha é obrigatória" }),
      });
      
      const { email, password } = loginSchema.parse(req.body);
      
      // Authenticate user
      const user = await storage.loginUser(email, password);
      
      if (!user) {
        return res.status(401).json({ message: "Email ou senha inválidos, ou conta aguardando aprovação" });
      }
      
      // Create session and save it explicitly
      (req as any).session.userId = user.id;
      
      // Save session to ensure cookie is sent
      (req as any).session.save((err: any) => {
        if (err) {
          console.error("Error saving session:", err);
          return res.status(500).json({ message: "Erro ao criar sessão" });
        }
        
        res.json({ 
          message: "Login realizado com sucesso",
          user: { 
            id: user.id, 
            email: user.email, 
            name: user.name, 
            role: user.role,
            userType: user.userType,
            approvalStatus: user.approvalStatus
          }
        });
      });
    } catch (error: any) {
      console.error("Error logging in:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao fazer login" });
    }
  });
  
  // Logout
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      (req as any).session.destroy((err: any) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ message: "Erro ao fazer logout" });
        }
        res.json({ message: "Logout realizado com sucesso" });
      });
    } catch (error: any) {
      console.error("Error logging out:", error);
      res.status(500).json({ message: "Erro ao fazer logout" });
    }
  });

  // ========================================
  // ADMIN - USER APPROVALS
  // ========================================

  // List pending user approvals (admin only)
  app.get("/api/admin/user-approvals", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserIdFromSession(req);
      const currentUser = await storage.getUser(userId!);
      
      // Check if user is admin
      if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'tenant_admin' && currentUser.role !== 'manager')) {
        return res.status(403).json({ message: "Acesso negado. Apenas administradores podem ver solicitações." });
      }
      
      const pendingUsers = await storage.listPendingApprovals();
      res.json(pendingUsers);
    } catch (error: any) {
      console.error("Error listing pending approvals:", error);
      res.status(500).json({ message: "Erro ao listar solicitações" });
    }
  });

  // Approve user (admin only)
  app.post("/api/admin/user-approvals/:id/approve", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserIdFromSession(req);
      const currentUser = await storage.getUser(userId!);
      
      // Check if user is admin
      if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'tenant_admin' && currentUser.role !== 'manager')) {
        return res.status(403).json({ message: "Acesso negado. Apenas administradores podem aprovar usuários." });
      }
      
      const approvedUser = await storage.approveUser(req.params.id, userId!);
      
      if (!approvedUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      res.json({ message: "Usuário aprovado com sucesso", user: approvedUser });
    } catch (error: any) {
      console.error("Error approving user:", error);
      res.status(500).json({ message: "Erro ao aprovar usuário" });
    }
  });

  // Reject user (admin only)
  app.post("/api/admin/user-approvals/:id/reject", isAuthenticated, async (req: any, res: Response) => {
    try {
      const rejectSchema = z.object({
        reason: z.string().min(1, { message: "Motivo da rejeição é obrigatório" }),
      });
      
      const { reason } = rejectSchema.parse(req.body);
      const userId = getUserIdFromSession(req);
      const currentUser = await storage.getUser(userId!);
      
      // Check if user is admin
      if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'tenant_admin' && currentUser.role !== 'manager')) {
        return res.status(403).json({ message: "Acesso negado. Apenas administradores podem rejeitar usuários." });
      }
      
      const rejectedUser = await storage.rejectUser(req.params.id, userId!, reason);
      
      if (!rejectedUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      res.json({ message: "Usuário rejeitado", user: rejectedUser });
    } catch (error: any) {
      console.error("Error rejecting user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao rejeitar usuário" });
    }
  });

  // Forgot password - request reset token
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists
        return res.json({ message: "Se o email existir, um link de recuperação será enviado" });
      }
      
      // Generate reset token
      const token = generatePasswordResetToken();
      const expiresAt = getPasswordResetTokenExpiry();
      
      // Store token
      await storage.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
      });
      
      // TODO: Send email with reset link
      // For now, just return success (in production, send actual email)
      console.log(`Password reset token for ${email}: ${token}`);
      
      res.json({ message: "Se o email existir, um link de recuperação será enviado" });
    } catch (error: any) {
      console.error("Error requesting password reset:", error);
      res.status(500).json({ message: "Erro ao solicitar recuperação de senha" });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      
      // Validate password strength
      const passwordValidation = isStrongPassword(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }
      
      // Find and validate token
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Token inválido ou expirado" });
      }
      
      if (!isPasswordResetTokenValid(resetToken.expiresAt)) {
        return res.status(400).json({ message: "Token expirado" });
      }
      
      // Hash new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update user password
      await storage.updateUser(resetToken.userId, { password: hashedPassword });
      
      // Mark token as used
      await storage.markPasswordResetTokenUsed(token);
      
      res.json({ message: "Senha atualizada com sucesso" });
    } catch (error: any) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Erro ao redefinir senha" });
    }
  });

  // ========================================
  // PIPELINE STAGES
  // ========================================

  app.get("/api/pipeline-stages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const stages = await storage.listPipelineStages();
      res.json(stages);
    } catch (error: any) {
      console.error("Error listing pipeline stages:", error);
      res.status(500).json({ message: "Erro ao listar estágios do pipeline" });
    }
  });

  app.post("/api/pipeline-stages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertPipelineStageSchema.parse(req.body);
      
      const stage = await storage.createPipelineStage(validatedData);
      res.status(201).json(stage);
    } catch (error: any) {
      console.error("Error creating pipeline stage:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar estágio do pipeline" });
    }
  });

  app.patch("/api/pipeline-stages/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertPipelineStageSchema.partial().parse(req.body);
      
      const stage = await storage.updatePipelineStage(req.params.id, validatedData);
      if (!stage) {
        return res.status(404).json({ message: "Estágio não encontrado" });
      }
      
      res.json(stage);
    } catch (error: any) {
      console.error("Error updating pipeline stage:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar estágio do pipeline" });
    }
  });

  app.delete("/api/pipeline-stages/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deletePipelineStage(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting pipeline stage:", error);
      res.status(500).json({ message: "Erro ao deletar estágio do pipeline" });
    }
  });

  // ========================================
  // DEALS
  // ========================================

  app.get("/api/deals", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const deals = await storage.listDeals();
      res.json(deals);
    } catch (error: any) {
      console.error("Error listing deals:", error);
      res.status(500).json({ message: "Erro ao listar negócios" });
    }
  });

  app.get("/api/deals/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const deal = await storage.getDeal(req.params.id);
      
      if (!deal) {
        return res.status(404).json({ message: "Negócio não encontrado" });
      }
      
      res.json(deal);
    } catch (error: any) {
      console.error("Error getting deal:", error);
      res.status(500).json({ message: "Erro ao buscar negócio" });
    }
  });

  app.post("/api/deals", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertDealSchema.parse(req.body);
      
      const deal = await storage.createDeal(validatedData);
      res.status(201).json(deal);
    } catch (error: any) {
      console.error("Error creating deal:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar negócio" });
    }
  });

  app.patch("/api/deals/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertDealSchema.partial().parse(req.body);
      
      const deal = await storage.updateDeal(req.params.id, validatedData);
      if (!deal) {
        return res.status(404).json({ message: "Negócio não encontrado" });
      }
      
      res.json(deal);
    } catch (error: any) {
      console.error("Error updating deal:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar negócio" });
    }
  });

  app.delete("/api/deals/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteDeal(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting deal:", error);
      res.status(500).json({ message: "Erro ao deletar negócio" });
    }
  });

  // ========================================
  // CUSTOMER SEGMENTS
  // ========================================

  app.get("/api/customer-segments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const segments = await storage.listCustomerSegments();
      res.json(segments);
    } catch (error: any) {
      console.error("Error listing customer segments:", error);
      res.status(500).json({ message: "Erro ao listar segmentos" });
    }
  });

  app.post("/api/customer-segments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertCustomerSegmentSchema.parse(req.body);
      
      const segment = await storage.createCustomerSegment(validatedData);
      res.status(201).json(segment);
    } catch (error: any) {
      console.error("Error creating customer segment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar segmento" });
    }
  });

  app.patch("/api/customer-segments/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertCustomerSegmentSchema.partial().parse(req.body);
      
      const segment = await storage.updateCustomerSegment(req.params.id, validatedData);
      if (!segment) {
        return res.status(404).json({ message: "Segmento não encontrado" });
      }
      
      res.json(segment);
    } catch (error: any) {
      console.error("Error updating customer segment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar segmento" });
    }
  });

  app.delete("/api/customer-segments/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteCustomerSegment(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting customer segment:", error);
      res.status(500).json({ message: "Erro ao deletar segmento" });
    }
  });

  // ========================================
  // ACTIVITIES
  // ========================================

  app.get("/api/activities", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const filters = {
        customerId: req.query.customerId as string | undefined,
        dealId: req.query.dealId as string | undefined,
      };
      
      const activities = await storage.listActivities(filters);
      res.json(activities);
    } catch (error: any) {
      console.error("Error listing activities:", error);
      res.status(500).json({ message: "Erro ao listar atividades" });
    }
  });

  app.post("/api/activities", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromSession(req);
      
      const validatedData = insertActivitySchema.parse({
        ...req.body,
        createdBy: userId,
      });
      
      const activity = await storage.createActivity(validatedData);
      res.status(201).json(activity);
    } catch (error: any) {
      console.error("Error creating activity:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar atividade" });
    }
  });

  app.patch("/api/activities/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertActivitySchema.partial().parse(req.body);
      
      const activity = await storage.updateActivity(req.params.id, validatedData);
      if (!activity) {
        return res.status(404).json({ message: "Atividade não encontrada" });
      }
      
      res.json(activity);
    } catch (error: any) {
      console.error("Error updating activity:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar atividade" });
    }
  });

  app.delete("/api/activities/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteActivity(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting activity:", error);
      res.status(500).json({ message: "Erro ao deletar atividade" });
    }
  });

  // ========================================
  // INVENTORY - WAREHOUSES
  // ========================================

  app.get("/api/warehouses", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const warehouses = await storage.listWarehouses();
      res.json(warehouses);
    } catch (error: any) {
      console.error("Error listing warehouses:", error);
      res.status(500).json({ message: "Erro ao listar depósitos" });
    }
  });

  app.get("/api/warehouses/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const warehouse = await storage.getWarehouse(req.params.id);
      
      if (!warehouse) {
        return res.status(404).json({ message: "Depósito não encontrado" });
      }
      
      res.json(warehouse);
    } catch (error: any) {
      console.error("Error getting warehouse:", error);
      res.status(500).json({ message: "Erro ao buscar depósito" });
    }
  });

  app.post("/api/warehouses", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { insertWarehouseSchema } = await import("@shared/schema");
      const validatedData = insertWarehouseSchema.parse(req.body);
      
      const warehouse = await storage.createWarehouse(validatedData);
      res.json(warehouse);
    } catch (error: any) {
      console.error("Error creating warehouse:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar depósito" });
    }
  });

  app.patch("/api/warehouses/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { insertWarehouseSchema } = await import("@shared/schema");
      const validatedData = insertWarehouseSchema.partial().parse(req.body);
      
      const warehouse = await storage.updateWarehouse(req.params.id, validatedData);
      
      if (!warehouse) {
        return res.status(404).json({ message: "Depósito não encontrado" });
      }
      
      res.json(warehouse);
    } catch (error: any) {
      console.error("Error updating warehouse:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar depósito" });
    }
  });

  app.delete("/api/warehouses/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteWarehouse(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting warehouse:", error);
      res.status(500).json({ message: "Erro ao deletar depósito" });
    }
  });

  // Get low stock alerts
  app.get("/api/inventory/alerts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const alerts = await storage.getLowStockAlerts();
      res.json(alerts);
    } catch (error: any) {
      console.error("Error getting low stock alerts:", error);
      res.status(500).json({ message: "Erro ao buscar alertas de estoque baixo" });
    }
  });

  // ========================================
  // INVENTORY - PRODUCT STOCK
  // ========================================

  app.get("/api/product-stock", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const stock = await storage.listProductStock(warehouseId);
      res.json(stock);
    } catch (error: any) {
      console.error("Error listing product stock:", error);
      res.status(500).json({ message: "Erro ao listar estoque" });
    }
  });

  app.post("/api/product-stock", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { insertProductStockSchema } = await import("@shared/schema");
      const validatedData = insertProductStockSchema.parse({
        ...req.body,
        lastRestocked: req.body.lastRestocked ? new Date(req.body.lastRestocked) : undefined,
      });
      
      const stock = await storage.createProductStock(validatedData);
      res.json(stock);
    } catch (error: any) {
      console.error("Error creating product stock:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar estoque" });
    }
  });

  app.patch("/api/product-stock/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { insertProductStockSchema } = await import("@shared/schema");
      const updateData = { ...req.body };
      if (req.body.lastRestocked) {
        updateData.lastRestocked = new Date(req.body.lastRestocked);
      }
      
      const validatedData = insertProductStockSchema.partial().parse(updateData);
      const stock = await storage.updateProductStock(req.params.id, validatedData);
      
      if (!stock) {
        return res.status(404).json({ message: "Estoque não encontrado" });
      }
      
      res.json(stock);
    } catch (error: any) {
      console.error("Error updating product stock:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar estoque" });
    }
  });

  // ========================================
  // INVENTORY - STOCK MOVEMENTS
  // ========================================

  app.get("/api/stock-movements", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const filters = {
        productId: req.query.productId as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
      };
      const movements = await storage.listStockMovements(filters);
      res.json(movements);
    } catch (error: any) {
      console.error("Error listing stock movements:", error);
      res.status(500).json({ message: "Erro ao listar movimentações" });
    }
  });

  app.post("/api/stock-movements", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { insertStockMovementSchema } = await import("@shared/schema");
      const validatedData = insertStockMovementSchema.parse(req.body);
      
      const movement = await storage.createStockMovement(validatedData);
      res.json(movement);
    } catch (error: any) {
      console.error("Error creating stock movement:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar movimentação" });
    }
  });

  // ========================================
  // HR - DEPARTMENTS
  // ========================================

  app.get("/api/departments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const departments = await storage.listDepartments();
      res.json(departments);
    } catch (error: any) {
      console.error("Error listing departments:", error);
      res.status(500).json({ message: "Erro ao listar departamentos" });
    }
  });

  app.get("/api/departments/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const department = await storage.getDepartment(req.params.id);
      
      if (!department) {
        return res.status(404).json({ message: "Departamento não encontrado" });
      }
      
      res.json(department);
    } catch (error: any) {
      console.error("Error getting department:", error);
      res.status(500).json({ message: "Erro ao buscar departamento" });
    }
  });

  app.post("/api/departments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { insertDepartmentSchema } = await import("@shared/schema");
      const validatedData = insertDepartmentSchema.parse(req.body);
      
      const department = await storage.createDepartment(validatedData);
      res.json(department);
    } catch (error: any) {
      console.error("Error creating department:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar departamento" });
    }
  });

  app.patch("/api/departments/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { insertDepartmentSchema } = await import("@shared/schema");
      const validatedData = insertDepartmentSchema.partial().parse(req.body);
      
      const department = await storage.updateDepartment(req.params.id, validatedData);
      
      if (!department) {
        return res.status(404).json({ message: "Departamento não encontrado" });
      }
      
      res.json(department);
    } catch (error: any) {
      console.error("Error updating department:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar departamento" });
    }
  });

  app.delete("/api/departments/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteDepartment(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting department:", error);
      res.status(500).json({ message: "Erro ao deletar departamento" });
    }
  });

  // ========================================
  // HR - EMPLOYEES
  // ========================================

  app.get("/api/employees", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const departmentId = req.query.departmentId as string | undefined;
      const employees = await storage.listEmployees(departmentId);
      res.json(employees);
    } catch (error: any) {
      console.error("Error listing employees:", error);
      res.status(500).json({ message: "Erro ao listar funcionários" });
    }
  });

  app.get("/api/employees/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      
      if (!employee) {
        return res.status(404).json({ message: "Funcionário não encontrado" });
      }
      
      res.json(employee);
    } catch (error: any) {
      console.error("Error getting employee:", error);
      res.status(500).json({ message: "Erro ao buscar funcionário" });
    }
  });

  app.post("/api/employees", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { insertEmployeeSchema } = await import("@shared/schema");
      const validatedData = insertEmployeeSchema.parse({
        ...req.body,
        hireDate: new Date(req.body.hireDate),
        terminationDate: req.body.terminationDate ? new Date(req.body.terminationDate) : undefined,
      });
      
      const employee = await storage.createEmployee(validatedData);
      res.json(employee);
    } catch (error: any) {
      console.error("Error creating employee:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar funcionário" });
    }
  });

  app.patch("/api/employees/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { insertEmployeeSchema } = await import("@shared/schema");
      const updateData = { ...req.body };
      if (req.body.hireDate) {
        updateData.hireDate = new Date(req.body.hireDate);
      }
      if (req.body.terminationDate) {
        updateData.terminationDate = new Date(req.body.terminationDate);
      }
      
      const validatedData = insertEmployeeSchema.partial().parse(updateData);
      const employee = await storage.updateEmployee(req.params.id, validatedData);
      
      if (!employee) {
        return res.status(404).json({ message: "Funcionário não encontrado" });
      }
      
      res.json(employee);
    } catch (error: any) {
      console.error("Error updating employee:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar funcionário" });
    }
  });

  app.delete("/api/employees/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteEmployee(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting employee:", error);
      res.status(500).json({ message: "Erro ao deletar funcionário" });
    }
  });

  // ========================================
  // HR - PAYROLL RECORDS
  // ========================================

  app.get("/api/payroll-records", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const employeeId = req.query.employeeId as string | undefined;
      const records = await storage.listPayrollRecords(employeeId);
      res.json(records);
    } catch (error: any) {
      console.error("Error listing payroll records:", error);
      res.status(500).json({ message: "Erro ao listar folhas de pagamento" });
    }
  });

  app.post("/api/payroll-records", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { insertPayrollRecordSchema } = await import("@shared/schema");
      const validatedData = insertPayrollRecordSchema.parse({
        ...req.body,
        periodStart: new Date(req.body.periodStart),
        periodEnd: new Date(req.body.periodEnd),
        paymentDate: req.body.paymentDate ? new Date(req.body.paymentDate) : undefined,
      });
      
      const record = await storage.createPayrollRecord(validatedData);
      res.json(record);
    } catch (error: any) {
      console.error("Error creating payroll record:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar folha de pagamento" });
    }
  });

  app.patch("/api/payroll-records/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { insertPayrollRecordSchema } = await import("@shared/schema");
      const updateData = { ...req.body };
      if (req.body.periodStart) updateData.periodStart = new Date(req.body.periodStart);
      if (req.body.periodEnd) updateData.periodEnd = new Date(req.body.periodEnd);
      if (req.body.paymentDate) updateData.paymentDate = new Date(req.body.paymentDate);
      
      const validatedData = insertPayrollRecordSchema.partial().parse(updateData);
      const record = await storage.updatePayrollRecord(req.params.id, validatedData);
      
      if (!record) {
        return res.status(404).json({ message: "Folha de pagamento não encontrada" });
      }
      
      res.json(record);
    } catch (error: any) {
      console.error("Error updating payroll record:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar folha de pagamento" });
    }
  });

  app.delete("/api/payroll-records/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deletePayrollRecord(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting payroll record:", error);
      res.status(500).json({ message: "Erro ao deletar folha de pagamento" });
    }
  });

  // ========================================
  // HR - ATTENDANCE RECORDS
  // ========================================

  app.get("/api/attendance-records", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const employeeId = req.query.employeeId as string | undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const records = await storage.listAttendanceRecords(employeeId, startDate, endDate);
      res.json(records);
    } catch (error: any) {
      console.error("Error listing attendance records:", error);
      res.status(500).json({ message: "Erro ao listar registros de presença" });
    }
  });

  app.post("/api/attendance-records", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { insertAttendanceRecordSchema } = await import("@shared/schema");
      const validatedData = insertAttendanceRecordSchema.parse({
        ...req.body,
        date: new Date(req.body.date),
        checkIn: req.body.checkIn ? new Date(req.body.checkIn) : undefined,
        checkOut: req.body.checkOut ? new Date(req.body.checkOut) : undefined,
      });
      
      const record = await storage.createAttendanceRecord(validatedData);
      res.json(record);
    } catch (error: any) {
      console.error("Error creating attendance record:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar registro de presença" });
    }
  });

  app.patch("/api/attendance-records/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { insertAttendanceRecordSchema } = await import("@shared/schema");
      const updateData = { ...req.body };
      if (req.body.date) updateData.date = new Date(req.body.date);
      if (req.body.checkIn) updateData.checkIn = new Date(req.body.checkIn);
      if (req.body.checkOut) updateData.checkOut = new Date(req.body.checkOut);
      
      const validatedData = insertAttendanceRecordSchema.partial().parse(updateData);
      const record = await storage.updateAttendanceRecord(req.params.id, validatedData);
      
      if (!record) {
        return res.status(404).json({ message: "Registro de presença não encontrado" });
      }
      
      res.json(record);
    } catch (error: any) {
      console.error("Error updating attendance record:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar registro de presença" });
    }
  });

  app.delete("/api/attendance-records/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteAttendanceRecord(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting attendance record:", error);
      res.status(500).json({ message: "Erro ao deletar registro de presença" });
    }
  });

  // ========================================
  // HR - LEAVE REQUESTS
  // ========================================
  
  app.get("/api/leave-requests", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { employeeId, status } = req.query;
      const requests = await storage.listLeaveRequests({
        employeeId: employeeId as string,
        status: status as string
      });
      res.json(requests);
    } catch (error: any) {
      console.error("Error fetching leave requests:", error);
      res.status(500).json({ message: "Erro ao buscar solicitações de folga" });
    }
  });
  
  app.get("/api/leave-requests/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const request = await storage.getLeaveRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }
      res.json(request);
    } catch (error: any) {
      console.error("Error fetching leave request:", error);
      res.status(500).json({ message: "Erro ao buscar solicitação" });
    }
  });
  
  app.post("/api/leave-requests", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertHrLeaveRequestSchema.parse(req.body);
      const newRequest = await storage.createLeaveRequest(validatedData);
      res.status(201).json(newRequest);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error creating leave request:", error);
      res.status(500).json({ message: "Erro ao criar solicitação de folga" });
    }
  });
  
  app.patch("/api/leave-requests/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertHrLeaveRequestSchema.partial().parse(req.body);
      const updated = await storage.updateLeaveRequest(req.params.id, validatedData);
      if (!updated) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error updating leave request:", error);
      res.status(500).json({ message: "Erro ao atualizar solicitação" });
    }
  });
  
  app.post("/api/leave-requests/:id/approve", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { approvedBy } = z.object({ approvedBy: z.string().min(1) }).parse(req.body);
      const approved = await storage.approveLeaveRequest(req.params.id, approvedBy);
      if (!approved) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }
      res.json(approved);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "approvedBy é obrigatório", errors: error.errors });
      }
      console.error("Error approving leave request:", error);
      res.status(500).json({ message: "Erro ao aprovar solicitação" });
    }
  });
  
  app.post("/api/leave-requests/:id/reject", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { rejectionReason } = z.object({ rejectionReason: z.string().min(1) }).parse(req.body);
      const rejected = await storage.rejectLeaveRequest(req.params.id, rejectionReason);
      if (!rejected) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }
      res.json(rejected);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "rejectionReason é obrigatório", errors: error.errors });
      }
      console.error("Error rejecting leave request:", error);
      res.status(500).json({ message: "Erro ao rejeitar solicitação" });
    }
  });
  
  app.delete("/api/leave-requests/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteLeaveRequest(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting leave request:", error);
      res.status(500).json({ message: "Erro ao deletar solicitação" });
    }
  });

  // ========================================
  // MARKETPLACE - WISHLIST
  // ========================================
  
  app.get("/api/wishlist", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const items = await storage.listWishlistItems(customerId);
      res.json(items);
    } catch (error: any) {
      console.error("Error fetching wishlist:", error);
      res.status(500).json({ message: "Erro ao buscar lista de desejos" });
    }
  });
  
  app.post("/api/wishlist", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      const { productId } = z.object({ productId: z.string().min(1) }).parse(req.body);
      
      const existing = await storage.getWishlistItem(customerId, productId);
      if (existing) {
        return res.status(409).json({ message: "Produto já está na lista de desejos" });
      }
      
      const newItem = await storage.addToWishlist({ customerId, productId });
      res.status(201).json(newItem);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "productId inválido", errors: error.errors });
      }
      console.error("Error adding to wishlist:", error);
      res.status(500).json({ message: "Erro ao adicionar à lista de desejos" });
    }
  });
  
  app.delete("/api/wishlist/:productId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const customerId = req.user!.id;
      await storage.removeFromWishlist(customerId, req.params.productId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error removing from wishlist:", error);
      res.status(500).json({ message: "Erro ao remover da lista de desejos" });
    }
  });

  // ========================================
  // CRM - WORKFLOWS
  // ========================================
  
  app.get("/api/crm-workflows", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workflows = await storage.listCrmWorkflows();
      res.json(workflows);
    } catch (error: any) {
      console.error("Error fetching CRM workflows:", error);
      res.status(500).json({ message: "Erro ao buscar workflows" });
    }
  });
  
  app.get("/api/crm-workflows/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workflow = await storage.getCrmWorkflow(req.params.id);
      if (!workflow) {
        return res.status(404).json({ message: "Workflow não encontrado" });
      }
      res.json(workflow);
    } catch (error: any) {
      console.error("Error fetching CRM workflow:", error);
      res.status(500).json({ message: "Erro ao buscar workflow" });
    }
  });
  
  app.post("/api/crm-workflows", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertCrmWorkflowSchema.parse(req.body);
      const newWorkflow = await storage.createCrmWorkflow(validatedData);
      res.status(201).json(newWorkflow);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error creating CRM workflow:", error);
      res.status(500).json({ message: "Erro ao criar workflow" });
    }
  });
  
  app.patch("/api/crm-workflows/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertCrmWorkflowSchema.partial().parse(req.body);
      const updated = await storage.updateCrmWorkflow(req.params.id, validatedData);
      if (!updated) {
        return res.status(404).json({ message: "Workflow não encontrado" });
      }
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error updating CRM workflow:", error);
      res.status(500).json({ message: "Erro ao atualizar workflow" });
    }
  });
  
  app.post("/api/crm-workflows/:id/execute", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const executed = await storage.executeCrmWorkflow(req.params.id);
      if (!executed) {
        return res.status(404).json({ message: "Workflow não encontrado" });
      }
      res.json(executed);
    } catch (error: any) {
      console.error("Error executing CRM workflow:", error);
      res.status(500).json({ message: "Erro ao executar workflow" });
    }
  });
  
  app.delete("/api/crm-workflows/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteCrmWorkflow(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting CRM workflow:", error);
      res.status(500).json({ message: "Erro ao deletar workflow" });
    }
  });

  // ========================================
  // AI - KNOWLEDGE BASE ADVANCED
  // ========================================
  
  app.post("/api/knowledge-base/bulk-import", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { items } = z.object({ 
        items: z.array(insertKnowledgeBaseSchema).min(1, "Array vazio não é permitido") 
      }).parse(req.body);
      
      const imported = await storage.bulkImportKnowledgeBase(items);
      res.status(201).json({ 
        success: true, 
        count: imported.length, 
        items: imported 
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error bulk importing knowledge base:", error);
      res.status(500).json({ message: "Erro ao importar itens" });
    }
  });
  
  app.get("/api/knowledge-base/search", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { q, category, limit } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: "Query parameter 'q' é obrigatório" });
      }
      
      const filters: { category?: string; limit?: number } = {};
      if (category && typeof category === 'string') {
        filters.category = category;
      }
      if (limit && typeof limit === 'string') {
        const parsedLimit = parseInt(limit, 10);
        if (isNaN(parsedLimit) || parsedLimit <= 0) {
          return res.status(400).json({ message: "limit deve ser um número positivo" });
        }
        filters.limit = parsedLimit;
      }
      
      const results = await storage.searchKnowledgeBase(q, filters);
      res.json(results);
    } catch (error: any) {
      console.error("Error searching knowledge base:", error);
      res.status(500).json({ message: "Erro ao buscar itens" });
    }
  });
  
  // ========================================
  // CALENDAR - RESOURCE SCHEDULING
  // ========================================
  
  app.get("/api/calendar/conflicts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { resourceId, startTime, endTime, excludeEventId } = req.query;
      
      if (!resourceId || typeof resourceId !== 'string') {
        return res.status(400).json({ message: "resourceId é obrigatório" });
      }
      if (!startTime || typeof startTime !== 'string') {
        return res.status(400).json({ message: "startTime é obrigatório (ISO 8601)" });
      }
      if (!endTime || typeof endTime !== 'string') {
        return res.status(400).json({ message: "endTime é obrigatório (ISO 8601)" });
      }
      
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ message: "startTime inválido" });
      }
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "endTime inválido" });
      }
      if (endDate <= startDate) {
        return res.status(400).json({ message: "endTime deve ser posterior a startTime" });
      }
      
      const conflicts = await storage.checkResourceConflicts(
        resourceId, 
        startDate, 
        endDate,
        excludeEventId && typeof excludeEventId === 'string' ? excludeEventId : undefined
      );
      
      res.json({ 
        hasConflicts: conflicts.length > 0,
        conflicts 
      });
    } catch (error: any) {
      console.error("Error checking resource conflicts:", error);
      res.status(500).json({ message: "Erro ao verificar conflitos" });
    }
  });
  
  app.get("/api/calendar/availability", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { resourceId, date } = req.query;
      
      if (!resourceId || typeof resourceId !== 'string') {
        return res.status(400).json({ message: "resourceId é obrigatório" });
      }
      if (!date || typeof date !== 'string') {
        return res.status(400).json({ message: "date é obrigatório (YYYY-MM-DD)" });
      }
      
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "date inválido (use YYYY-MM-DD)" });
      }
      
      const availability = await storage.listResourceAvailability(
        resourceId,
        parsedDate
      );
      
      res.json(availability);
    } catch (error: any) {
      console.error("Error checking resource availability:", error);
      res.status(500).json({ message: "Erro ao verificar disponibilidade" });
    }
  });

  // ========================================
  // REPORTS - CUSTOM REPORT TEMPLATES
  // ========================================
  
  app.get("/api/reports/templates", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { type } = req.query;
      
      const validTypes = ["sales", "finance", "inventory", "hr", "crm", "custom"];
      let filterType: string | undefined;
      
      if (type && typeof type === 'string') {
        if (!validTypes.includes(type)) {
          return res.status(400).json({ message: `Tipo inválido. Valores aceitos: ${validTypes.join(', ')}` });
        }
        filterType = type;
      }
      
      const templates = await storage.listReportTemplates(filterType);
      res.json(templates);
    } catch (error: any) {
      console.error("Error listing report templates:", error);
      res.status(500).json({ message: "Erro ao buscar templates" });
    }
  });
  
  app.get("/api/reports/templates/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const template = await storage.getReportTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template não encontrado" });
      }
      res.json(template);
    } catch (error: any) {
      console.error("Error getting report template:", error);
      res.status(500).json({ message: "Erro ao buscar template" });
    }
  });
  
  app.post("/api/reports/templates", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertReportTemplateSchema.parse(req.body);
      const created = await storage.createReportTemplate(validatedData);
      res.status(201).json(created);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error creating report template:", error);
      res.status(500).json({ message: "Erro ao criar template" });
    }
  });
  
  app.patch("/api/reports/templates/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertReportTemplateSchema.partial().parse(req.body);
      const updated = await storage.updateReportTemplate(req.params.id, validatedData);
      if (!updated) {
        return res.status(404).json({ message: "Template não encontrado" });
      }
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error updating report template:", error);
      res.status(500).json({ message: "Erro ao atualizar template" });
    }
  });
  
  app.delete("/api/reports/templates/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteReportTemplate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting report template:", error);
      res.status(500).json({ message: "Erro ao deletar template" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
