import type { Express, Request, Response } from "express";
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
} from "@shared/schema";
import { z } from "zod";

// Tenant context middleware
function getTenantId(req: Request): string {
  const tenantHeader = req.headers["x-tenant-id"] as string;
  return tenantHeader || "default";
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ========================================
  // TENANTS
  // ========================================
  
  // NOTE: This endpoint returns all tenants for MVP simplicity.
  // TODO: In production, implement RBAC to restrict access based on user role:
  //   - super_admin: can list all tenants
  //   - tenant_admin: can only see their own tenant
  //   - other roles: no access
  app.get("/api/tenants", async (req: Request, res: Response) => {
    try {
      const tenantsList = await storage.listTenants();
      res.json(tenantsList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tenants/:id", async (req: Request, res: Response) => {
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

  app.post("/api/tenants", async (req: Request, res: Response) => {
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

  app.patch("/api/tenants/:id", async (req: Request, res: Response) => {
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

  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const productsList = await storage.listProducts(tenantId);
      res.json(productsList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/products/:id", async (req: Request, res: Response) => {
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

  app.post("/api/products", async (req: Request, res: Response) => {
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

  app.patch("/api/products/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/products/:id", async (req: Request, res: Response) => {
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

  app.get("/api/customers", async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const customersList = await storage.listCustomers(tenantId);
      res.json(customersList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/customers/:id", async (req: Request, res: Response) => {
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

  app.post("/api/customers", async (req: Request, res: Response) => {
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

  app.patch("/api/customers/:id", async (req: Request, res: Response) => {
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

  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const conversationsList = await storage.listConversations(tenantId);
      res.json(conversationsList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
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

  app.post("/api/conversations", async (req: Request, res: Response) => {
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

  app.patch("/api/conversations/:id", async (req: Request, res: Response) => {
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

  app.get("/api/conversations/:conversationId/messages", async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const messagesList = await storage.listMessages(req.params.conversationId, tenantId);
      res.json(messagesList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/messages", async (req: Request, res: Response) => {
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

  app.get("/api/knowledge-base", async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const items = await storage.listKnowledgeBase(tenantId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/knowledge-base/:id", async (req: Request, res: Response) => {
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

  app.post("/api/knowledge-base", async (req: Request, res: Response) => {
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

  app.patch("/api/knowledge-base/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/knowledge-base/:id", async (req: Request, res: Response) => {
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

  app.get("/api/orders", async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const ordersList = await storage.listOrders(tenantId);
      res.json(ordersList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/orders/:id", async (req: Request, res: Response) => {
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

  app.post("/api/orders", async (req: Request, res: Response) => {
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

  app.patch("/api/orders/:id", async (req: Request, res: Response) => {
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

  app.get("/api/carts/:id", async (req: Request, res: Response) => {
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

  app.post("/api/carts", async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const bodyData = insertCartSchema.omit({ tenantId: true }).parse(req.body);
      const data = { ...bodyData, tenantId };
      const cart = await storage.createCart(data);
      res.status(201).json(cart);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/carts/:id", async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const data = insertCartSchema.omit({ tenantId: true }).partial().parse(req.body);
      const cart = await storage.updateCart(req.params.id, tenantId, data);
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
  // PAYMENTS (Stripe Integration - will be expanded later)
  // ========================================

  app.post("/api/payments", async (req: Request, res: Response) => {
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

  app.get("/api/payments/:id", async (req: Request, res: Response) => {
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

  const httpServer = createServer(app);

  return httpServer;
}
