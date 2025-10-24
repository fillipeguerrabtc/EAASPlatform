import {
  type User,
  type InsertUser,
  type Tenant,
  type InsertTenant,
  type Product,
  type InsertProduct,
  type Customer,
  type InsertCustomer,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type KnowledgeBase,
  type InsertKnowledgeBase,
  type Payment,
  type InsertPayment,
  type Order,
  type InsertOrder,
  type Cart,
  type InsertCart,
} from "@shared/schema";
import { db } from "./db";
import {
  users,
  tenants,
  products,
  customers,
  conversations,
  messages,
  knowledgeBase,
  payments,
  orders,
  carts,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string, tenantId?: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Tenants
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined>;
  listTenants(): Promise<Tenant[]>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined>;
  
  // Products
  listProducts(tenantId: string): Promise<Product[]>;
  getProduct(id: string, tenantId: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, tenantId: string, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string, tenantId: string): Promise<void>;
  
  // Customers
  listCustomers(tenantId: string): Promise<Customer[]>;
  getCustomer(id: string, tenantId: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, tenantId: string, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  
  // Conversations
  listConversations(tenantId: string): Promise<Conversation[]>;
  getConversation(id: string, tenantId: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, tenantId: string, data: Partial<InsertConversation>): Promise<Conversation | undefined>;
  
  // Messages
  listMessages(conversationId: string, tenantId: string): Promise<Message[]>;
  createMessage(message: InsertMessage, tenantId: string): Promise<Message>;
  
  // Knowledge Base
  listKnowledgeBase(tenantId: string): Promise<KnowledgeBase[]>;
  getKnowledgeBaseItem(id: string, tenantId: string): Promise<KnowledgeBase | undefined>;
  createKnowledgeBaseItem(item: InsertKnowledgeBase): Promise<KnowledgeBase>;
  updateKnowledgeBaseItem(id: string, tenantId: string, data: Partial<InsertKnowledgeBase>): Promise<KnowledgeBase | undefined>;
  deleteKnowledgeBaseItem(id: string, tenantId: string): Promise<void>;
  
  // Payments
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPayment(id: string, tenantId: string): Promise<Payment | undefined>;
  updatePayment(id: string, tenantId: string, data: Partial<InsertPayment>): Promise<Payment | undefined>;
  
  // Orders
  listOrders(tenantId: string): Promise<Order[]>;
  getOrder(id: string, tenantId: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, tenantId: string, data: Partial<InsertOrder>): Promise<Order | undefined>;
  
  // Carts
  getCart(id: string, tenantId: string): Promise<Cart | undefined>;
  getCartByCustomer(customerId: string, tenantId: string): Promise<Cart | undefined>;
  createCart(cart: InsertCart): Promise<Cart>;
  updateCart(id: string, tenantId: string, data: Partial<InsertCart>): Promise<Cart | undefined>;
}

export class DbStorage implements IStorage {
  // ========================================
  // USERS
  // ========================================
  
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string, tenantId?: string): Promise<User | undefined> {
    const conditions = tenantId
      ? and(eq(users.email, email), eq(users.tenantId, tenantId))
      : eq(users.email, email);
    
    const result = await db.select().from(users).where(conditions!).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // ========================================
  // TENANTS
  // ========================================

  async getTenant(id: string): Promise<Tenant | undefined> {
    const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return result[0];
  }

  async getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined> {
    const result = await db.select().from(tenants).where(eq(tenants.subdomain, subdomain)).limit(1);
    return result[0];
  }

  async listTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const result = await db.insert(tenants).values(insertTenant).returning();
    return result[0];
  }

  async updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const result = await db.update(tenants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return result[0];
  }

  // ========================================
  // PRODUCTS
  // ========================================

  async listProducts(tenantId: string): Promise<Product[]> {
    return await db.select().from(products)
      .where(eq(products.tenantId, tenantId))
      .orderBy(desc(products.createdAt));
  }

  async getProduct(id: string, tenantId: string): Promise<Product | undefined> {
    const result = await db.select().from(products)
      .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
      .limit(1);
    return result[0];
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(insertProduct).returning();
    return result[0];
  }

  async updateProduct(id: string, tenantId: string, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const { tenantId: _, ...updateData } = data;
    const result = await db.update(products)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
      .returning();
    return result[0];
  }

  async deleteProduct(id: string, tenantId: string): Promise<void> {
    await db.delete(products).where(and(eq(products.id, id), eq(products.tenantId, tenantId)));
  }

  // ========================================
  // CUSTOMERS
  // ========================================

  async listCustomers(tenantId: string): Promise<Customer[]> {
    return await db.select().from(customers)
      .where(eq(customers.tenantId, tenantId))
      .orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: string, tenantId: string): Promise<Customer | undefined> {
    const result = await db.select().from(customers)
      .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)))
      .limit(1);
    return result[0];
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const result = await db.insert(customers).values(insertCustomer).returning();
    return result[0];
  }

  async updateCustomer(id: string, tenantId: string, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const { tenantId: _, ...updateData } = data;
    const result = await db.update(customers)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)))
      .returning();
    return result[0];
  }

  // ========================================
  // CONVERSATIONS
  // ========================================

  async listConversations(tenantId: string): Promise<Conversation[]> {
    return await db.select().from(conversations)
      .where(eq(conversations.tenantId, tenantId))
      .orderBy(desc(conversations.updatedAt));
  }

  async getConversation(id: string, tenantId: string): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)))
      .limit(1);
    return result[0];
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const result = await db.insert(conversations).values(insertConversation).returning();
    return result[0];
  }

  async updateConversation(id: string, tenantId: string, data: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const { tenantId: _, ...updateData } = data;
    const result = await db.update(conversations)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)))
      .returning();
    return result[0];
  }

  // ========================================
  // MESSAGES
  // ========================================

  async listMessages(conversationId: string, tenantId: string): Promise<Message[]> {
    const conversation = await this.getConversation(conversationId, tenantId);
    if (!conversation) return [];
    
    return await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async createMessage(insertMessage: InsertMessage, tenantId: string): Promise<Message> {
    const conversation = await this.getConversation(insertMessage.conversationId, tenantId);
    if (!conversation) {
      throw new Error("Conversation not found or does not belong to this tenant");
    }
    
    const result = await db.insert(messages).values(insertMessage).returning();
    return result[0];
  }

  // ========================================
  // KNOWLEDGE BASE
  // ========================================

  async listKnowledgeBase(tenantId: string): Promise<KnowledgeBase[]> {
    return await db.select().from(knowledgeBase)
      .where(eq(knowledgeBase.tenantId, tenantId))
      .orderBy(desc(knowledgeBase.createdAt));
  }

  async getKnowledgeBaseItem(id: string, tenantId: string): Promise<KnowledgeBase | undefined> {
    const result = await db.select().from(knowledgeBase)
      .where(and(eq(knowledgeBase.id, id), eq(knowledgeBase.tenantId, tenantId)))
      .limit(1);
    return result[0];
  }

  async createKnowledgeBaseItem(insertItem: InsertKnowledgeBase): Promise<KnowledgeBase> {
    const result = await db.insert(knowledgeBase).values(insertItem).returning();
    return result[0];
  }

  async updateKnowledgeBaseItem(id: string, tenantId: string, data: Partial<InsertKnowledgeBase>): Promise<KnowledgeBase | undefined> {
    const { tenantId: _, ...updateData } = data;
    const result = await db.update(knowledgeBase)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(knowledgeBase.id, id), eq(knowledgeBase.tenantId, tenantId)))
      .returning();
    return result[0];
  }

  async deleteKnowledgeBaseItem(id: string, tenantId: string): Promise<void> {
    await db.delete(knowledgeBase).where(and(eq(knowledgeBase.id, id), eq(knowledgeBase.tenantId, tenantId)));
  }

  // ========================================
  // PAYMENTS
  // ========================================

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const result = await db.insert(payments).values(insertPayment).returning();
    return result[0];
  }

  async getPayment(id: string, tenantId: string): Promise<Payment | undefined> {
    const result = await db.select().from(payments)
      .where(and(eq(payments.id, id), eq(payments.tenantId, tenantId)))
      .limit(1);
    return result[0];
  }

  async updatePayment(id: string, tenantId: string, data: Partial<InsertPayment>): Promise<Payment | undefined> {
    const { tenantId: _, ...updateData } = data;
    const result = await db.update(payments)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(payments.id, id), eq(payments.tenantId, tenantId)))
      .returning();
    return result[0];
  }

  // ========================================
  // ORDERS
  // ========================================

  async listOrders(tenantId: string): Promise<Order[]> {
    return await db.select().from(orders)
      .where(eq(orders.tenantId, tenantId))
      .orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string, tenantId: string): Promise<Order | undefined> {
    const result = await db.select().from(orders)
      .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)))
      .limit(1);
    return result[0];
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const result = await db.insert(orders).values(insertOrder).returning();
    return result[0];
  }

  async updateOrder(id: string, tenantId: string, data: Partial<InsertOrder>): Promise<Order | undefined> {
    const { tenantId: _, ...updateData } = data;
    const result = await db.update(orders)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)))
      .returning();
    return result[0];
  }

  // ========================================
  // CARTS
  // ========================================

  async getCart(id: string, tenantId: string): Promise<Cart | undefined> {
    const result = await db.select().from(carts)
      .where(and(eq(carts.id, id), eq(carts.tenantId, tenantId)))
      .limit(1);
    return result[0];
  }

  async getCartByCustomer(customerId: string, tenantId: string): Promise<Cart | undefined> {
    const result = await db.select().from(carts)
      .where(and(eq(carts.customerId, customerId), eq(carts.tenantId, tenantId)))
      .limit(1);
    return result[0];
  }

  async createCart(insertCart: InsertCart): Promise<Cart> {
    const result = await db.insert(carts).values(insertCart).returning();
    return result[0];
  }

  async updateCart(id: string, tenantId: string, data: Partial<InsertCart>): Promise<Cart | undefined> {
    const { tenantId: _, ...updateData } = data;
    const result = await db.update(carts)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(carts.id, id), eq(carts.tenantId, tenantId)))
      .returning();
    return result[0];
  }
}

export const storage = new DbStorage();
