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
} from "@shared/schema";
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

  // Get current authenticated user (no auth guard - returns null if not authenticated)
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
      
      res.json(user);
    } catch (error: any) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ========================================
  // TENANTS
  // ========================================
  
  // NOTE: This endpoint returns all tenants for MVP simplicity.
  // TODO: In production, implement RBAC to restrict access based on user role:
  //   - super_admin: can list all tenants
  //   - tenant_admin: can only see their own tenant
  //   - other roles: no access
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
      const requestedTenantId = req.params.id;
      const userTenantId = getTenantId(req);
      
      if (requestedTenantId !== userTenantId) {
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
      const userTenantId = getTenantId(req);
      
      if (requestedTenantId !== userTenantId) {
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

  // ========================================
  // PRODUCTS
  // ========================================

  app.get("/api/products", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const productsList = await storage.listProducts(tenantId);
      res.json(productsList);
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
      res.json(conversationsList);
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

  // Get or create user's cart
  app.get("/api/carts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const customerId = (req.user as any).userId;
      
      // Find active cart for this user
      let cart = await storage.getActiveCart(customerId, tenantId);
      
      // Create new cart if none exists
      if (!cart) {
        cart = await storage.createCart({
          tenantId,
          customerId,
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

  app.post("/api/carts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const customerId = (req.user as any).userId;
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

  app.patch("/api/carts/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
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
      const { message, conversationId } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      // 1. Search Knowledge Base for similar content (simple text matching for MVP)
      const knowledgeBaseItems = await storage.listKnowledgeBase(tenantId);
      const matchedItem = knowledgeBaseItems.find(item => 
        item.title.toLowerCase().includes(message.toLowerCase()) ||
        item.content.toLowerCase().includes(message.toLowerCase())
      );
      
      let response: string;
      let source: "knowledge_base" | "openai";
      
      if (matchedItem) {
        // Found answer in KB
        response = matchedItem.content;
        source = "knowledge_base";
      } else {
        // Fallback to OpenAI
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({
          baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
        });
        
        // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        const completion = await openai.chat.completions.create({
          model: "gpt-5",
          messages: [
            { role: "system", content: "You are a helpful AI assistant. Provide concise, professional responses." },
            { role: "user", content: message }
          ],
          max_completion_tokens: 500,
        });
        
        response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
        source = "openai";
      }
      
      // 3. Optionally save message to conversation if conversationId provided
      if (conversationId) {
        // Validate conversation belongs to tenant
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
      
      res.json({ response, source });
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
      // AI AUTO-RESPONSE via WhatsApp
      // ========================================
      
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

  const httpServer = createServer(app);

  return httpServer;
}
