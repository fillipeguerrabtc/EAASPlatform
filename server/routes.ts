import type { Express, Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertTenantSchema,
  insertProductSchema,
  insertCustomerSchema,
  insertConversationSchema,
  insertMessageSchema,
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
import { setupAuth, isAuthenticated, getTenantIdFromSession, getTenantIdFromSessionOrHeader, getUserIdFromSession } from "./replitAuth";

// Tenant context middleware - reads from authenticated session
function getTenantId(req: Request): string {
  try {
    return getTenantIdFromSession(req);
  } catch (error) {
    // If session missing, try header fallback (for webhooks)
    return getTenantIdFromSessionOrHeader(req);
  }
}

// Strict tenant resolution (no fallback) - for webhooks and multi-tenant enforcement
function getTenantIdStrict(req: Request): string | null {
  const tenantHeader = req.headers["x-tenant-id"] as string;
  return tenantHeader || null;
}

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
      
      // Get user's accessible tenants based on role
      let accessibleTenants = [];
      
      if (user.role === 'super_admin') {
        // Super admins can see ALL tenants
        accessibleTenants = await storage.listTenants();
      } else {
        // Other users can only see their own tenant(s)
        // Get user's tenant
        const primaryTenant = await storage.getTenant(user.tenantId);
        if (primaryTenant) {
          accessibleTenants.push(primaryTenant);
        }
        
        // TODO: If implementing multi-tenant membership via userTenants table,
        // also fetch additional tenants where user has access
      }
      
      // Return user with permissions metadata
      res.json({
        ...user,
        permissions: {
          isSuperAdmin: user.role === 'super_admin',
          canSeeAllTenants: user.role === 'super_admin',
          accessibleTenantIds: accessibleTenants.map(t => t.id),
        },
        accessibleTenants,
      });
    } catch (error: any) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ========================================
  // TENANTS
  // ========================================
  
  // List tenants based on user role (RBAC enforced)
  app.get("/api/tenants", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromSession(req);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      let tenantsList = [];
      
      if (user.role === 'super_admin') {
        // Super admins can see ALL tenants
        tenantsList = await storage.listTenants();
      } else {
        // Other users can only see their own tenant
        const tenant = await storage.getTenant(user.tenantId);
        if (tenant) {
          tenantsList = [tenant];
        }
      }
      
      res.json(tenantsList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tenants/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const requestedTenantId = req.params.id;
      const userId = getUserIdFromSession(req);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Super admins can access any tenant, others only their own
      if (user.role !== 'super_admin' && requestedTenantId !== user.tenantId) {
        return res.status(403).json({ error: "Forbidden: Cannot access other tenants' data" });
      }
      
      const tenant = await storage.getTenant(requestedTenantId);
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
      const requestedTenantId = req.params.id;
      const userId = getUserIdFromSession(req);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Super admins can modify any tenant, others only their own
      if (user.role !== 'super_admin' && requestedTenantId !== user.tenantId) {
        return res.status(403).json({ error: "Forbidden: Cannot modify other tenants' data" });
      }
      
      const data = insertTenantSchema.partial().parse(req.body);
      const tenant = await storage.updateTenant(requestedTenantId, data);
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
      const requestedTenantId = req.params.id;
      const userTenantId = getTenantId(req);
      
      if (requestedTenantId !== userTenantId) {
        return res.status(403).json({ error: "Forbidden: Cannot access other tenants' data" });
      }

      const { websiteUrl } = req.body;
      
      if (!websiteUrl) {
        return res.status(400).json({ error: "websiteUrl is required" });
      }

      // Use Puppeteer to scan the full website
      const { scanWebsiteBrand } = await import("./brandScanner");
      const brandAnalysis = await scanWebsiteBrand(websiteUrl);

      // Update tenant with new brand colors and assets
      await storage.updateTenant(requestedTenantId, {
        brandColors: brandAnalysis.colors,
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
      const requestedTenantId = req.params.id;
      const userTenantId = getTenantId(req);
      
      if (requestedTenantId !== userTenantId) {
        return res.status(403).json({ error: "Forbidden: Cannot access other tenants' data" });
      }

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
  // RBAC (Roles & Permissions)
  // ========================================

  // List roles for current tenant
  app.get("/api/roles", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const rolesList = await storage.listRoles(tenantId);
      res.json(rolesList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create role
  app.post("/api/roles", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const data = insertRoleSchema.parse({ ...req.body, tenantId });
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
      const tenantId = getTenantId(req);
      const data = insertRoleSchema.omit({ tenantId: true }).partial().parse(req.body);
      const role = await storage.updateRole(req.params.id, tenantId, data);
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
      const tenantId = getTenantId(req);
      const success = await storage.deleteRole(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const role = await storage.getRole(req.params.id);
      if (!role || role.tenantId !== tenantId) {
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
      const tenantId = getTenantId(req);
      
      // Verify role ownership
      const role = await storage.getRole(req.params.roleId);
      if (!role || role.tenantId !== tenantId) {
        return res.status(404).json({ error: "Role not found" });
      }
      
      // Validate request body with Zod
      const permissionData = insertRolePermissionSchema.omit({ id: true, createdAt: true, roleId: true }).parse({
        feature: req.params.feature,
        accessLevel: req.body.accessLevel
      });
      
      const permission = await storage.updateRolePermission(req.params.roleId, permissionData.feature, permissionData.accessLevel);
      if (!permission) {
        // Create if doesn't exist
        const newPermission = await storage.createRolePermission({
          roleId: req.params.roleId,
          feature: permissionData.feature as any,
          accessLevel: permissionData.accessLevel as any
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
  // PRODUCTS
  // ========================================

  // PUBLIC ENDPOINT: Allow anonymous access to products (for marketplace)
  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      // Try to get tenantId from session, otherwise use header
      let tenantId: string;
      try {
        tenantId = getTenantId(req);
      } catch {
        // Anonymous access - use X-Tenant-ID header or default tenant
        tenantId = getTenantIdFromSessionOrHeader(req);
      }
      
      const productsList = await storage.listProducts(tenantId);
      // Only return active products for public access
      const activeProducts = productsList.filter(p => p.isActive);
      res.json(activeProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/products/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const product = await storage.getProduct(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const bodyData = insertProductSchema.omit({ tenantId: true }).parse(req.body);
      const data = { ...bodyData, tenantId };
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
      const tenantId = getTenantId(req);
      const data = insertProductSchema.omit({ tenantId: true }).partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, tenantId, data);
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
      const tenantId = getTenantId(req);
      await storage.deleteProduct(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const customersList = await storage.listCustomers(tenantId);
      res.json(customersList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/customers/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const customer = await storage.getCustomer(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const bodyData = insertCustomerSchema.omit({ tenantId: true }).parse(req.body);
      const data = { ...bodyData, tenantId };
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
      const tenantId = getTenantId(req);
      const data = insertCustomerSchema.omit({ tenantId: true }).partial().parse(req.body);
      const customer = await storage.updateCustomer(req.params.id, tenantId, data);
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
      const tenantId = getTenantId(req);
      const conversationsList = await storage.listConversations(tenantId);
      
      // Enrich with customer data
      const enrichedConversations = await Promise.all(
        conversationsList.map(async (conv) => {
          const customer = await storage.getCustomer(conv.customerId, tenantId);
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
      const tenantId = getTenantId(req);
      const conversation = await storage.getConversation(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const bodyData = insertConversationSchema.omit({ tenantId: true }).parse(req.body);
      const data = { ...bodyData, tenantId };
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
      const tenantId = getTenantId(req);
      const data = insertConversationSchema.omit({ tenantId: true }).partial().parse(req.body);
      const conversation = await storage.updateConversation(req.params.id, tenantId, data);
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
      const tenantId = getTenantId(req);
      const messagesList = await storage.listMessages(req.params.conversationId, tenantId);
      res.json(messagesList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const data = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(data, tenantId);
      res.status(201).json(message);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // GET messages by conversationId (query param for admin dashboard)
  app.get("/api/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const conversationId = req.query.conversationId as string;
      
      if (!conversationId) {
        return res.status(400).json({ error: "conversationId query parameter is required" });
      }
      
      const messages = await storage.listMessages(conversationId, tenantId);
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
      const tenantId = getTenantId(req);
      const userId = (req.user as any).userId;
      
      const conversation = await storage.updateConversation(req.params.id, tenantId, {
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
      const tenantId = getTenantId(req);
      
      const conversation = await storage.updateConversation(req.params.id, tenantId, {
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
      const tenantId = getTenantId(req);
      const { message } = req.body;
      
      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      // Get conversation to verify it exists and get customer info
      const conversation = await storage.getConversation(req.params.id, tenantId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      // Verify conversation is in manual mode
      if (conversation.isAiHandled) {
        return res.status(403).json({ error: "Conversation is in AI mode. Take over first." });
      }
      
      // Get customer phone
      const customer = await storage.getCustomer(conversation.customerId, tenantId);
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
        }, tenantId);
        
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
      const tenantId = getTenantId(req);
      const items = await storage.listKnowledgeBase(tenantId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/knowledge-base/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const item = await storage.getKnowledgeBaseItem(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const bodyData = insertKnowledgeBaseSchema.omit({ tenantId: true, vectorId: true }).parse(req.body);
      const data = { ...bodyData, tenantId };
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
      const tenantId = getTenantId(req);
      const data = insertKnowledgeBaseSchema.omit({ tenantId: true, vectorId: true }).partial().parse(req.body);
      const item = await storage.updateKnowledgeBaseItem(req.params.id, tenantId, data);
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
      const tenantId = getTenantId(req);
      await storage.deleteKnowledgeBaseItem(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const ordersList = await storage.listOrders(tenantId);
      res.json(ordersList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/orders/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const order = await storage.getOrder(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const bodyData = insertOrderSchema.omit({ tenantId: true }).parse(req.body);
      const data = { ...bodyData, tenantId };
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
      const tenantId = getTenantId(req);
      const data = insertOrderSchema.omit({ tenantId: true }).partial().parse(req.body);
      const order = await storage.updateOrder(req.params.id, tenantId, data);
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
      let tenantId: string;
      let customerId: string | null = null;
      let sessionId: string | null = null;
      let cart = null;
      
      try {
        tenantId = getTenantId(req);
        customerId = getUserIdFromSession(req);
        // Find cart by customerId for authenticated users
        cart = await storage.getActiveCart(customerId, tenantId);
      } catch {
        // Anonymous user
        tenantId = getTenantIdFromSessionOrHeader(req);
        sessionId = (req.session as any)?.id || req.headers['x-session-id'] as string;
        
        // Find cart by sessionId for anonymous users
        if (sessionId) {
          const allCarts = await storage.listCarts(tenantId);
          cart = allCarts.find(c => c.sessionId === sessionId && !c.customerId) || null;
        }
      }
      
      // Create new cart if none exists
      if (!cart) {
        cart = await storage.createCart({
          tenantId,
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
      const tenantId = getTenantId(req);
      const cart = await storage.getCart(req.params.id, tenantId);
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
      // Try to get tenantId and user info
      let tenantId: string;
      let customerId: string | null = null;
      let sessionId: string | null = null;
      
      try {
        tenantId = getTenantId(req);
        customerId = getUserIdFromSession(req);
      } catch {
        // Anonymous user
        tenantId = getTenantIdFromSessionOrHeader(req);
        sessionId = (req.session as any)?.id || req.headers['x-session-id'] as string || Math.random().toString(36);
      }
      
      const { items } = req.body;

      // SECURITY: Validate items and recalculate total from actual product prices
      const products = await storage.listProducts(tenantId);
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
        tenantId,
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
      let tenantId: string;
      try {
        tenantId = getTenantId(req);
      } catch {
        tenantId = getTenantIdFromSessionOrHeader(req);
      }
      
      const { items } = req.body;

      if (!items) {
        return res.status(400).json({ error: "Items are required" });
      }

      // SECURITY: Validate items and recalculate total from actual product prices
      const products = await storage.listProducts(tenantId);
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

      const cart = await storage.updateCart(req.params.id, tenantId, {
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
      const tenantId = getTenantId(req);
      const customerId = (req.user as any).userId;
      
      // Validate request body with Zod
      const aiChatSchema = z.object({
        message: z.string().min(1, "Message cannot be empty"),
        conversationId: z.string().optional(),
      });
      
      const validatedData = aiChatSchema.parse(req.body);
      const { message, conversationId } = validatedData;
      
      const messageLower = message.toLowerCase();
      let response: string;
      let source: "knowledge_base" | "openai" | "autonomous_sales";
      let cartAction: any = null;
      
      // AUTONOMOUS SALES: Detect purchase intent commands
      const buyCommands = ["comprar", "adicionar ao carrinho", "add to cart", "buy", "quero", "gostaria de"];
      const checkoutCommands = ["finalizar compra", "checkout", "pagar", "concluir"];
      const cartCommands = ["ver carrinho", "meu carrinho", "show cart", "view cart"];
      
      const isBuyCommand = buyCommands.some(cmd => messageLower.includes(cmd));
      const isCheckoutCommand = checkoutCommands.some(cmd => messageLower.includes(cmd));
      const isCartCommand = cartCommands.some(cmd => messageLower.includes(cmd));
      
      if (isBuyCommand || isCheckoutCommand || isCartCommand) {
        // AUTONOMOUS SALES MODE
        const products = await storage.listProducts(tenantId);
        
        if (isCartCommand) {
          // Show cart contents
          const cart = await storage.getActiveCart(customerId, tenantId);
          const cartItems = Array.isArray(cart?.items) ? cart.items as any[] : [];
          
          if (cartItems.length === 0) {
            response = "Seu carrinho está vazio. Posso ajudá-lo a encontrar produtos?";
          } else {
            const itemsDesc = cartItems.map((item: any) => {
              const product = products.find(p => p.id === item.productId);
              return product ? `- ${product.name} (${item.quantity}x) - R$ ${parseFloat(product.price) * item.quantity}` : null;
            }).filter(Boolean).join('\n');
            
            response = `Seu carrinho:\n${itemsDesc}\n\nTotal: R$ ${cart.total}\n\nDeseja finalizar a compra?`;
          }
          source = "autonomous_sales";
          
        } else if (isCheckoutCommand) {
          // Initiate checkout
          const cart = await storage.getActiveCart(customerId, tenantId);
          const cartItems = Array.isArray(cart?.items) ? cart.items as any[] : [];
          
          if (cartItems.length === 0) {
            response = "Seu carrinho está vazio. Adicione produtos antes de finalizar a compra.";
          } else {
            response = `Ótimo! Você será redirecionado para o checkout seguro.\n\nTotal: R$ ${cart.total}\n\n[Clique aqui para pagar →]`;
            cartAction = { type: "checkout", url: "/cart" };
          }
          source = "autonomous_sales";
          
        } else if (isBuyCommand) {
          // Find product by name in message
          const foundProduct = products.find(p => 
            p.isActive && messageLower.includes(p.name.toLowerCase())
          );
          
          if (foundProduct) {
            // Add to cart
            let cart = await storage.getActiveCart(customerId, tenantId);
            const cartItems = Array.isArray(cart?.items) ? cart.items as any[] : [];
            
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
            cart = await storage.updateCart(cart.id, tenantId, {
              items: validatedItems,
              total: total.toFixed(2),
            });
            
            response = `✅ ${foundProduct.name} adicionado ao carrinho!\n\nPreço: R$ ${foundProduct.price}\nTotal no carrinho: R$ ${cart.total}\n\nDeseja continuar comprando ou finalizar a compra?`;
            cartAction = { type: "added", productId: foundProduct.id, productName: foundProduct.name };
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
        }
      } else {
        // REGULAR AI MODE: Knowledge Base + OpenAI
        const knowledgeBaseItems = await storage.listKnowledgeBase(tenantId);
        const matchedItem = knowledgeBaseItems.find(item => 
          item.title.toLowerCase().includes(messageLower) ||
          item.content.toLowerCase().includes(messageLower)
        );
        
        if (matchedItem) {
          response = matchedItem.content;
          source = "knowledge_base";
        } else {
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
          source = "openai";
        }
      }
      
      // Save message to conversation if conversationId provided
      if (conversationId) {
        const conversation = await storage.getConversation(conversationId, tenantId);
        if (conversation) {
          await storage.createMessage({
            conversationId,
            senderType: "customer",
            content: message,
          }, tenantId);
          
          await storage.createMessage({
            conversationId,
            senderType: "ai",
            content: response,
          }, tenantId);
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
      
      const tenantId = getTenantId(req);
      const customerId = (req.user as any).userId;
      
      // SECURITY: Get user's cart and recalculate total from actual product prices
      const cart = await storage.getActiveCart(customerId, tenantId);
      
      if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
      }
      
      // Revalidate cart items and recalculate total
      const products = await storage.listProducts(tenantId);
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
          tenantId,
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
      
      const tenantId = getTenantId(req);
      
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
          tenantId,
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
          const tenantId = paymentIntent.metadata.tenantId || "default";
          await storage.createPayment({
            tenantId,
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
      const tenantId = getTenantId(req);
      const paymentsList = await storage.listPayments(tenantId);
      res.json(paymentsList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/payments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const bodyData = insertPaymentSchema.omit({ tenantId: true }).parse(req.body);
      const data = { ...bodyData, tenantId };
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
      const tenantId = getTenantId(req);
      const payment = await storage.getPayment(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const events = await storage.listCalendarEvents(tenantId);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/calendar-events", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const bodyData = insertCalendarEventSchema.omit({ tenantId: true }).parse(req.body);
      // Convert ISO strings to Date objects
      const data = {
        ...bodyData,
        tenantId,
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
      const tenantId = getTenantId(req);
      const event = await storage.getCalendarEvent(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const bodyData = insertCalendarEventSchema.omit({ tenantId: true }).partial().parse(req.body);
      // Convert ISO strings to Date objects if present
      const data: any = { ...bodyData };
      if (data.startTime) data.startTime = new Date(data.startTime);
      if (data.endTime) data.endTime = new Date(data.endTime);
      const event = await storage.updateCalendarEvent(req.params.id, tenantId, data);
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
      const tenantId = getTenantId(req);
      await storage.deleteCalendarEvent(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const categories = await storage.listCategories(tenantId);
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/categories", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const bodyData = insertCategorySchema.omit({ tenantId: true }).parse(req.body);
      const data = { ...bodyData, tenantId };
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
      const tenantId = getTenantId(req);
      const bodyData = insertCategorySchema.omit({ tenantId: true }).partial().parse(req.body);
      const category = await storage.updateCategory(req.params.id, tenantId, bodyData);
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
      const tenantId = getTenantId(req);
      await storage.deleteCategory(req.params.id, tenantId);
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
      
      const tenantId = getTenantId(req);
      const { to, message } = req.body;
      
      if (!to || !message) {
        return res.status(400).json({ error: "Phone number and message are required" });
      }
      
      // Find or create customer by phone
      let customer = (await storage.listCustomers(tenantId)).find(
        c => c.phone === to
      );
      
      if (!customer) {
        customer = await storage.createCustomer({
          tenantId,
          name: to,
          email: `${to}@whatsapp.temp`,
          phone: to,
        });
      }
      
      // Find or create WhatsApp conversation
      let conversation = (await storage.listConversations(tenantId)).find(
        c => c.customerId === customer!.id && c.channel === "whatsapp"
      );
      
      if (!conversation) {
        conversation = await storage.createConversation({
          tenantId,
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
        }, tenantId);
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
      const toNumber = To?.replace("whatsapp:", "") || "";
      
      // PRODUCTION-READY: Map Twilio number → tenantId using database
      const tenant = await storage.getTenantByTwilioNumber(toNumber);
      
      if (!tenant) {
        console.error(`🚫 WhatsApp webhook: Unknown Twilio number ${toNumber} - rejecting request`);
        console.error(`   Register this Twilio number in tenant configuration`);
        console.error(`   Update tenant.twilioWhatsappNumber = "${toNumber}"`);
        return res.status(400).send("Unknown Twilio number - not mapped to any tenant");
      }
      
      const tenantId = tenant.id;
      console.log(`✅ WhatsApp webhook: Mapped ${toNumber} → Tenant ${tenant.name} (${tenantId})`);
      
      // Find or create customer
      let customer = (await storage.listCustomers(tenantId)).find(
        c => c.phone === phoneNumber
      );
      
      if (!customer) {
        customer = await storage.createCustomer({
          tenantId,
          name: phoneNumber, // Use phone as name initially
          email: `${phoneNumber}@whatsapp.temp`,
          phone: phoneNumber,
        });
      }
      
      // Find or create conversation
      let conversation = (await storage.listConversations(tenantId)).find(
        c => c.customerId === customer!.id && c.channel === "whatsapp"
      );
      
      if (!conversation) {
        conversation = await storage.createConversation({
          tenantId,
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
      }, tenantId);
      
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
        await storage.updateConversation(conversation.id, tenantId, {
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
            }, tenantId);
            
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
      const knowledgeBaseItems = await storage.listKnowledgeBase(tenantId);
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
          }, tenantId);
          
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
      const tenantId = getTenantId(req);
      const { type, startDate, endDate } = req.query;
      
      const filters: any = {};
      if (type) filters.type = type;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      
      const transactions = await storage.listFinancialTransactions(tenantId, filters);
      res.json(transactions);
    } catch (error: any) {
      console.error("Error listing financial transactions:", error);
      res.status(500).json({ message: "Failed to list transactions" });
    }
  });

  app.get("/api/financial-transactions/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const transaction = await storage.getFinancialTransaction(req.params.id, tenantId);
      
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
      const tenantId = getTenantId(req);
      
      // Validate request body with Zod
      const { insertFinancialTransactionSchema } = await import("@shared/schema");
      const validatedData = insertFinancialTransactionSchema.parse({
        ...req.body,
        tenantId,
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
      const tenantId = getTenantId(req);
      
      // Validate update data with Zod (partial validation)
      const { insertFinancialTransactionSchema } = await import("@shared/schema");
      const updateData = { ...req.body };
      if (req.body.date) {
        updateData.date = new Date(req.body.date);
      }
      
      // Validate only provided fields (partial)
      const validatedData = insertFinancialTransactionSchema.partial().parse(updateData);
      
      const transaction = await storage.updateFinancialTransaction(req.params.id, tenantId, validatedData);
      
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
      const tenantId = getTenantId(req);
      await storage.deleteFinancialTransaction(req.params.id, tenantId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting financial transaction:", error);
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // ========================================
  // FINANCIAL ACCOUNTS
  // ========================================

  app.get("/api/financial-accounts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const accounts = await storage.listFinancialAccounts(tenantId);
      res.json(accounts);
    } catch (error: any) {
      console.error("Error listing financial accounts:", error);
      res.status(500).json({ message: "Failed to list accounts" });
    }
  });

  app.post("/api/financial-accounts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      
      // Validate request body with Zod
      const { insertFinancialAccountSchema } = await import("@shared/schema");
      const validatedData = insertFinancialAccountSchema.parse({
        ...req.body,
        tenantId,
      });
      
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
  // ENHANCED AUTHENTICATION - EMAIL/PASSWORD
  // ========================================

  // Register with email/password
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name, tenantId, companyName } = req.body;
      
      // Validate email
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: "Email inválido" });
      }
      
      // Validate password strength
      const passwordValidation = isStrongPassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }
      
      // Check if user already exists GLOBALLY (email must be unique across all tenants)
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Este email já está cadastrado" });
      }
      
      // Auto-create tenant if not provided
      let finalTenantId = tenantId;
      let isNewTenant = false;
      
      if (!finalTenantId) {
        const subdomain = companyName 
          ? companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30)
          : email.split('@')[0];
        
        const newTenant = await storage.createTenant({
          name: companyName || `${name}'s Company`,
          subdomain,
          primaryColor: "#10A37F",
        });
        
        finalTenantId = newTenant.id;
        isNewTenant = true;
      }
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Create user
      // SECURITY: Only assign tenant_admin role if creating a new tenant
      // For existing tenants, default to least-privilege role (agent)
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        tenantId: finalTenantId,
        emailVerified: false,
        role: isNewTenant ? "tenant_admin" : "agent",
      });
      
      // Create session
      (req as any).session.userId = user.id;
      (req as any).session.tenantId = user.tenantId;
      
      res.status(201).json({ message: "Usuário criado com sucesso", user: { id: user.id, email: user.email, name: user.name } });
    } catch (error: any) {
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  // Login with email/password
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      // Find user (search across all tenants)
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Email ou senha inválidos" });
      }
      
      // Verify password
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Email ou senha inválidos" });
      }
      
      // Create session
      (req as any).session.userId = user.id;
      (req as any).session.tenantId = user.tenantId;
      
      res.json({ message: "Login realizado com sucesso", user: { id: user.id, email: user.email, name: user.name } });
    } catch (error: any) {
      console.error("Error logging in:", error);
      res.status(500).json({ message: "Erro ao fazer login" });
    }
  });

  // Forgot password - request reset token
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email, tenantId } = req.body;
      
      // Find user
      const user = await storage.getUserByEmail(email, tenantId);
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
      const tenantId = getTenantId(req);
      const stages = await storage.listPipelineStages(tenantId);
      res.json(stages);
    } catch (error: any) {
      console.error("Error listing pipeline stages:", error);
      res.status(500).json({ message: "Erro ao listar estágios do pipeline" });
    }
  });

  app.post("/api/pipeline-stages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const validatedData = insertPipelineStageSchema.parse({
        ...req.body,
        tenantId,
      });
      
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
      const tenantId = getTenantId(req);
      const validatedData = insertPipelineStageSchema.partial().parse(req.body);
      
      const stage = await storage.updatePipelineStage(req.params.id, tenantId, validatedData);
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
      const tenantId = getTenantId(req);
      await storage.deletePipelineStage(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const deals = await storage.listDeals(tenantId);
      res.json(deals);
    } catch (error: any) {
      console.error("Error listing deals:", error);
      res.status(500).json({ message: "Erro ao listar negócios" });
    }
  });

  app.get("/api/deals/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const deal = await storage.getDeal(req.params.id, tenantId);
      
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
      const tenantId = getTenantId(req);
      const validatedData = insertDealSchema.parse({
        ...req.body,
        tenantId,
      });
      
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
      const tenantId = getTenantId(req);
      const validatedData = insertDealSchema.partial().parse(req.body);
      
      const deal = await storage.updateDeal(req.params.id, tenantId, validatedData);
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
      const tenantId = getTenantId(req);
      await storage.deleteDeal(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const segments = await storage.listCustomerSegments(tenantId);
      res.json(segments);
    } catch (error: any) {
      console.error("Error listing customer segments:", error);
      res.status(500).json({ message: "Erro ao listar segmentos" });
    }
  });

  app.post("/api/customer-segments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const validatedData = insertCustomerSegmentSchema.parse({
        ...req.body,
        tenantId,
      });
      
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
      const tenantId = getTenantId(req);
      const validatedData = insertCustomerSegmentSchema.partial().parse(req.body);
      
      const segment = await storage.updateCustomerSegment(req.params.id, tenantId, validatedData);
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
      const tenantId = getTenantId(req);
      await storage.deleteCustomerSegment(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const filters = {
        customerId: req.query.customerId as string | undefined,
        dealId: req.query.dealId as string | undefined,
      };
      
      const activities = await storage.listActivities(tenantId, filters);
      res.json(activities);
    } catch (error: any) {
      console.error("Error listing activities:", error);
      res.status(500).json({ message: "Erro ao listar atividades" });
    }
  });

  app.post("/api/activities", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserIdFromSession(req);
      
      const validatedData = insertActivitySchema.parse({
        ...req.body,
        tenantId,
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
      const tenantId = getTenantId(req);
      const validatedData = insertActivitySchema.partial().parse(req.body);
      
      const activity = await storage.updateActivity(req.params.id, tenantId, validatedData);
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
      const tenantId = getTenantId(req);
      await storage.deleteActivity(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const warehouses = await storage.listWarehouses(tenantId);
      res.json(warehouses);
    } catch (error: any) {
      console.error("Error listing warehouses:", error);
      res.status(500).json({ message: "Erro ao listar depósitos" });
    }
  });

  app.get("/api/warehouses/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const warehouse = await storage.getWarehouse(req.params.id, tenantId);
      
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
      const tenantId = getTenantId(req);
      
      const { insertWarehouseSchema } = await import("@shared/schema");
      const validatedData = insertWarehouseSchema.parse({
        ...req.body,
        tenantId,
      });
      
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
      const tenantId = getTenantId(req);
      
      const { insertWarehouseSchema } = await import("@shared/schema");
      const validatedData = insertWarehouseSchema.partial().parse(req.body);
      
      const warehouse = await storage.updateWarehouse(req.params.id, tenantId, validatedData);
      
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
      const tenantId = getTenantId(req);
      await storage.deleteWarehouse(req.params.id, tenantId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting warehouse:", error);
      res.status(500).json({ message: "Erro ao deletar depósito" });
    }
  });

  // ========================================
  // INVENTORY - PRODUCT STOCK
  // ========================================

  app.get("/api/product-stock", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const warehouseId = req.query.warehouseId as string | undefined;
      const stock = await storage.listProductStock(tenantId, warehouseId);
      res.json(stock);
    } catch (error: any) {
      console.error("Error listing product stock:", error);
      res.status(500).json({ message: "Erro ao listar estoque" });
    }
  });

  app.post("/api/product-stock", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      
      const { insertProductStockSchema } = await import("@shared/schema");
      const validatedData = insertProductStockSchema.parse({
        ...req.body,
        tenantId,
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
      const tenantId = getTenantId(req);
      
      const { insertProductStockSchema } = await import("@shared/schema");
      const updateData = { ...req.body };
      if (req.body.lastRestocked) {
        updateData.lastRestocked = new Date(req.body.lastRestocked);
      }
      
      const validatedData = insertProductStockSchema.partial().parse(updateData);
      const stock = await storage.updateProductStock(req.params.id, tenantId, validatedData);
      
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
      const tenantId = getTenantId(req);
      const filters = {
        productId: req.query.productId as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
      };
      const movements = await storage.listStockMovements(tenantId, filters);
      res.json(movements);
    } catch (error: any) {
      console.error("Error listing stock movements:", error);
      res.status(500).json({ message: "Erro ao listar movimentações" });
    }
  });

  app.post("/api/stock-movements", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      
      const { insertStockMovementSchema } = await import("@shared/schema");
      const validatedData = insertStockMovementSchema.parse({
        ...req.body,
        tenantId,
      });
      
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
      const tenantId = getTenantId(req);
      const departments = await storage.listDepartments(tenantId);
      res.json(departments);
    } catch (error: any) {
      console.error("Error listing departments:", error);
      res.status(500).json({ message: "Erro ao listar departamentos" });
    }
  });

  app.get("/api/departments/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const department = await storage.getDepartment(req.params.id, tenantId);
      
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
      const tenantId = getTenantId(req);
      
      const { insertDepartmentSchema } = await import("@shared/schema");
      const validatedData = insertDepartmentSchema.parse({
        ...req.body,
        tenantId,
      });
      
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
      const tenantId = getTenantId(req);
      
      const { insertDepartmentSchema } = await import("@shared/schema");
      const validatedData = insertDepartmentSchema.partial().parse(req.body);
      
      const department = await storage.updateDepartment(req.params.id, tenantId, validatedData);
      
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
      const tenantId = getTenantId(req);
      await storage.deleteDepartment(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const departmentId = req.query.departmentId as string | undefined;
      const employees = await storage.listEmployees(tenantId, departmentId);
      res.json(employees);
    } catch (error: any) {
      console.error("Error listing employees:", error);
      res.status(500).json({ message: "Erro ao listar funcionários" });
    }
  });

  app.get("/api/employees/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const employee = await storage.getEmployee(req.params.id, tenantId);
      
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
      const tenantId = getTenantId(req);
      
      const { insertEmployeeSchema } = await import("@shared/schema");
      const validatedData = insertEmployeeSchema.parse({
        ...req.body,
        tenantId,
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
      const tenantId = getTenantId(req);
      
      const { insertEmployeeSchema } = await import("@shared/schema");
      const updateData = { ...req.body };
      if (req.body.hireDate) {
        updateData.hireDate = new Date(req.body.hireDate);
      }
      if (req.body.terminationDate) {
        updateData.terminationDate = new Date(req.body.terminationDate);
      }
      
      const validatedData = insertEmployeeSchema.partial().parse(updateData);
      const employee = await storage.updateEmployee(req.params.id, tenantId, validatedData);
      
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
      const tenantId = getTenantId(req);
      await storage.deleteEmployee(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const employeeId = req.query.employeeId as string | undefined;
      const records = await storage.listPayrollRecords(tenantId, employeeId);
      res.json(records);
    } catch (error: any) {
      console.error("Error listing payroll records:", error);
      res.status(500).json({ message: "Erro ao listar folhas de pagamento" });
    }
  });

  app.post("/api/payroll-records", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      
      const { insertPayrollRecordSchema } = await import("@shared/schema");
      const validatedData = insertPayrollRecordSchema.parse({
        ...req.body,
        tenantId,
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
      const tenantId = getTenantId(req);
      
      const { insertPayrollRecordSchema } = await import("@shared/schema");
      const updateData = { ...req.body };
      if (req.body.periodStart) updateData.periodStart = new Date(req.body.periodStart);
      if (req.body.periodEnd) updateData.periodEnd = new Date(req.body.periodEnd);
      if (req.body.paymentDate) updateData.paymentDate = new Date(req.body.paymentDate);
      
      const validatedData = insertPayrollRecordSchema.partial().parse(updateData);
      const record = await storage.updatePayrollRecord(req.params.id, tenantId, validatedData);
      
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
      const tenantId = getTenantId(req);
      await storage.deletePayrollRecord(req.params.id, tenantId);
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
      const tenantId = getTenantId(req);
      const employeeId = req.query.employeeId as string | undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const records = await storage.listAttendanceRecords(tenantId, employeeId, startDate, endDate);
      res.json(records);
    } catch (error: any) {
      console.error("Error listing attendance records:", error);
      res.status(500).json({ message: "Erro ao listar registros de presença" });
    }
  });

  app.post("/api/attendance-records", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      
      const { insertAttendanceRecordSchema } = await import("@shared/schema");
      const validatedData = insertAttendanceRecordSchema.parse({
        ...req.body,
        tenantId,
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
      const tenantId = getTenantId(req);
      
      const { insertAttendanceRecordSchema } = await import("@shared/schema");
      const updateData = { ...req.body };
      if (req.body.date) updateData.date = new Date(req.body.date);
      if (req.body.checkIn) updateData.checkIn = new Date(req.body.checkIn);
      if (req.body.checkOut) updateData.checkOut = new Date(req.body.checkOut);
      
      const validatedData = insertAttendanceRecordSchema.partial().parse(updateData);
      const record = await storage.updateAttendanceRecord(req.params.id, tenantId, validatedData);
      
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
      const tenantId = getTenantId(req);
      await storage.deleteAttendanceRecord(req.params.id, tenantId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting attendance record:", error);
      res.status(500).json({ message: "Erro ao deletar registro de presença" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
