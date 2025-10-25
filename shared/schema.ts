import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, decimal, pgEnum, index, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ========================================
// ENUMS
// ========================================

export const userRoleEnum = pgEnum("user_role", ["super_admin", "tenant_admin", "manager", "agent", "customer"]);
export const conversationChannelEnum = pgEnum("conversation_channel", ["web", "whatsapp", "facebook", "instagram"]);
export const conversationStatusEnum = pgEnum("conversation_status", ["open", "in_progress", "resolved", "closed"]);
export const productTypeEnum = pgEnum("product_type", ["product", "service", "experience", "real_estate", "vehicle"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "processing", "succeeded", "failed", "refunded"]);
export const orderStatusEnum = pgEnum("order_status", ["draft", "pending", "confirmed", "processing", "completed", "cancelled"]);
export const accessLevelEnum = pgEnum("access_level", ["no_access", "read", "write", "admin"]);
export const featureEnum = pgEnum("feature", [
  "finance",        // Financial Management (revenues/expenses/reports)
  "products",       // Marketplace Products
  "customers",      // CRM 360
  "conversations",  // Omnichat
  "calendar",       // Smart Calendar
  "ai",             // AI Knowledge Base
  "payments",       // Payment Management
  "settings"        // Tenant Settings (branding, etc)
]);

// ========================================
// AUTHENTICATION (Replit Auth)
// ========================================

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// ========================================
// MULTI-TENANT CORE
// ========================================

// Tenants (Companies/Organizations)
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subdomain: text("subdomain").notNull().unique(),
  logo: text("logo"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  primaryColor: text("primary_color").default("#2563EB"),
  customTheme: jsonb("custom_theme"),
  twilioWhatsappNumber: text("twilio_whatsapp_number"),
  status: text("status").default("active"),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// RBAC Tables Forward Declaration (needed for users table reference)
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Users (Multi-tenant aware)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  avatar: text("avatar"),
  role: userRoleEnum("role").default("customer").notNull(),
  customRoleId: varchar("custom_role_id").references(() => roles.id, { onDelete: "set null" }),
  password: text("password"),
  replitAuthId: text("replit_auth_id").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User-Tenant Membership (for multi-tenant access)
export const userTenants = pgTable("user_tenants", {
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  role: userRoleEnum("role").default("agent").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.tenantId] }),
}));

// ========================================
// MARKETPLACE UNIVERSAL
// ========================================

// Products/Services/Experiences
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  type: productTypeEnum("type").default("product").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  images: text("images").array(),
  category: text("category"),
  tags: text("tags").array(),
  inventory: integer("inventory"),
  metadata: jsonb("metadata").default({}),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Categories (for products/services organization)
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  parentId: varchar("parent_id"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Shopping Cart
export const carts = pgTable("carts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  customerId: varchar("customer_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  items: jsonb("items").default([]).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).default("0").notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Orders
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  customerId: varchar("customer_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  items: jsonb("items").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum("status").default("pending").notNull(),
  paymentId: varchar("payment_id"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ========================================
// CRM 360°
// ========================================

// Customers (extended from users)
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  tags: text("tags").array(),
  segment: text("segment"),
  lifetimeValue: decimal("lifetime_value", { precision: 10, scale: 2 }).default("0").notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Customer Interactions (Timeline)
export const interactions = pgTable("interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  channel: conversationChannelEnum("channel"),
  content: text("content"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ========================================
// OMNICHAT
// ========================================

// Conversations
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  channel: conversationChannelEnum("channel").notNull(),
  status: conversationStatusEnum("status").default("open").notNull(),
  assignedTo: varchar("assigned_to").references(() => users.id),
  isAiHandled: boolean("is_ai_handled").default(true).notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Messages
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  senderId: varchar("sender_id"),
  senderType: text("sender_type").notNull(),
  content: text("content").notNull(),
  attachments: text("attachments").array(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ========================================
// AI AUTÔNOMA - KNOWLEDGE BASE
// ========================================

// Knowledge Base Documents (RAG)
export const knowledgeBase = pgTable("knowledge_base", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  tags: text("tags").array(),
  vectorId: text("vector_id"),
  isActive: boolean("is_active").default(true).notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Learning Log (Successful conversations)
export const aiLearningLog = pgTable("ai_learning_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  query: text("query").notNull(),
  response: text("response").notNull(),
  source: text("source"),
  wasSuccessful: boolean("was_successful").default(true),
  feedback: text("feedback"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ========================================
// PAYMENT MANAGEMENT (STRIPE)
// ========================================

// Payments
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd").notNull(),
  status: paymentStatusEnum("status").default("pending").notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ========================================
// CALENDAR & SCHEDULING
// ========================================

// Calendar Events
export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  resourceId: varchar("resource_id"),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  orderId: varchar("order_id").references(() => orders.id),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ========================================
// ERP - FINANCIAL MODULE
// ========================================

// Financial Accounts (Bank Accounts, Cash, etc.)
export const financialAccounts = pgTable("financial_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // checking, savings, cash, credit_card
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0").notNull(),
  currency: text("currency").default("BRL").notNull(),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Financial Transactions (Simplified for MVP - flexible fields)
export const financialTransactions = pgTable("financial_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  accountId: varchar("account_id").references(() => financialAccounts.id, { onDelete: "cascade" }), // optional for MVP
  type: text("type").notNull(), // revenue, expense, transfer
  category: text("category"), // flexible category
  amount: text("amount").notNull(), // stored as text to preserve precision
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  paymentMethod: text("payment_method"), // cash, credit_card, pix, etc
  reference: text("reference"),
  notes: text("notes"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ========================================
// RBAC - ROLE-BASED ACCESS CONTROL
// ========================================

// Role Permissions (feature-level access control)
export const rolePermissions = pgTable("role_permissions", {
  roleId: varchar("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  feature: featureEnum("feature").notNull(),
  accessLevel: accessLevelEnum("access_level").default("no_access").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.feature] }),
}));

// ========================================
// CUSTOM TYPES
// ========================================

// Custom Theme Structure for Tenant Branding
export interface CustomTheme {
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    foreground?: string;
    muted?: string;
    mutedForeground?: string;
    card?: string;
    cardForeground?: string;
    border?: string;
  };
  typography?: {
    fontFamily?: string;
    headings?: {
      h1?: { fontSize?: string; fontWeight?: string; lineHeight?: string };
      h2?: { fontSize?: string; fontWeight?: string; lineHeight?: string };
      h3?: { fontSize?: string; fontWeight?: string; lineHeight?: string };
    };
    body?: { fontSize?: string; fontWeight?: string; lineHeight?: string };
  };
  spacing?: {
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
  };
  shadows?: {
    sm?: string;
    md?: string;
    lg?: string;
  };
  borderRadius?: {
    sm?: string;
    md?: string;
    lg?: string;
  };
}

// ========================================
// ZOD SCHEMAS & TYPES
// ========================================

// Tenants
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// Users
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Products
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Categories
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Carts
export const insertCartSchema = createInsertSchema(carts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCart = z.infer<typeof insertCartSchema>;
export type Cart = typeof carts.$inferSelect;

// Orders
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Customers
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Interactions
export const insertInteractionSchema = createInsertSchema(interactions).omit({ id: true, createdAt: true });
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;
export type Interaction = typeof interactions.$inferSelect;

// Conversations
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Messages
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Knowledge Base
export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBase).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;
export type KnowledgeBase = typeof knowledgeBase.$inferSelect;

// AI Learning Log
export const insertAiLearningLogSchema = createInsertSchema(aiLearningLog).omit({ id: true, createdAt: true });
export type InsertAiLearningLog = z.infer<typeof insertAiLearningLogSchema>;
export type AiLearningLog = typeof aiLearningLog.$inferSelect;

// Payments
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// Calendar Events
export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

// Financial Accounts
export const insertFinancialAccountSchema = createInsertSchema(financialAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinancialAccount = z.infer<typeof insertFinancialAccountSchema>;
export type FinancialAccount = typeof financialAccounts.$inferSelect;

// Financial Transactions
export const insertFinancialTransactionSchema = createInsertSchema(financialTransactions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinancialTransaction = z.infer<typeof insertFinancialTransactionSchema>;
export type FinancialTransaction = typeof financialTransactions.$inferSelect;

// User-Tenant Membership
export const insertUserTenantSchema = createInsertSchema(userTenants).omit({ createdAt: true });
export type InsertUserTenant = z.infer<typeof insertUserTenantSchema>;
export type UserTenant = typeof userTenants.$inferSelect;

// Roles
export const insertRoleSchema = createInsertSchema(roles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

// Role Permissions
export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({ createdAt: true });
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;
