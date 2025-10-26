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
export const activityTypeEnum = pgEnum("activity_type", ["call", "email", "meeting", "note", "task", "other"]);
export const employmentTypeEnum = pgEnum("employment_type", ["full_time", "part_time", "contractor", "intern", "temporary"]);
export const employmentStatusEnum = pgEnum("employment_status", ["active", "on_leave", "terminated", "suspended"]);
export const payrollFrequencyEnum = pgEnum("payroll_frequency", ["weekly", "biweekly", "monthly"]);
export const leaveStatusEnum = pgEnum("leave_status", ["pending", "approved", "rejected", "cancelled"]);
export const leaveTypeEnum = pgEnum("leave_type", ["vacation", "sick", "personal", "bereavement", "parental", "other"]);
export const reportTypeEnum = pgEnum("report_type", ["sales", "finance", "inventory", "hr", "crm", "custom"]);

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

// Password Reset Tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  settings: jsonb("settings"),
  
  // AI Governance (EAAS Whitepaper 02 - Chapter 9)
  aiPersona: text("ai_persona").default("professional"), // Tone: professional, friendly, casual, technical
  maxPersuasionLevel: decimal("max_persuasion_level", { precision: 3, scale: 2 }).default("0.70"), // P̄ (max persuasion limit)
  aiEthicalPolicies: jsonb("ai_ethical_policies"), // LTL+D policies as JSON
  enabledAITools: jsonb("enabled_ai_tools").default(['crm', 'marketplace', 'knowledge_base']), // Allowed tools
  riskThreshold: decimal("risk_threshold", { precision: 3, scale: 2 }).default("0.70"), // τ (risk threshold for human escalation)
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// RBAC Tables Forward Declaration (needed for users table reference)
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Users (Single-tenant)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  name: text("name").notNull(),
  avatar: text("avatar"),
  role: userRoleEnum("role").default("customer").notNull(),
  customRoleId: varchar("custom_role_id").references(() => roles.id, { onDelete: "set null" }),
  
  // Authentication
  password: text("password"), // Legacy bcrypt hash (deprecated, use passwordHash)
  passwordHash: text("password_hash"), // New field for local auth
  replitAuthId: text("replit_auth_id").unique(), // OAuth via Replit Auth
  
  // User Type & Approval System
  userType: text("user_type").default("customer").notNull(), // 'employee' | 'customer'
  approvalStatus: text("approval_status").default("approved").notNull(), // 'pending_approval' | 'approved' | 'rejected'
  requestedAt: timestamp("requested_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references((): any => users.id, { onDelete: "set null" }),
  rejectionReason: text("rejection_reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ========================================
// MARKETPLACE UNIVERSAL
// ========================================

// Products/Services/Experiences
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: productTypeEnum("type").default("product").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  images: text("images").array(),
  category: text("category"),
  tags: text("tags").array(),
  inventory: integer("inventory"),
  metadata: jsonb("metadata"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Categories (for products/services organization)
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  parentId: varchar("parent_id"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Product Reviews
export const productReviews = pgTable("product_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  customerId: varchar("customer_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  title: text("title"),
  comment: text("comment"),
  isVerifiedPurchase: boolean("is_verified_purchase").default(false).notNull(),
  isApproved: boolean("is_approved").default(true).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Wishlist Items
export const wishlistItems = pgTable("wishlist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// Shopping Cart (supports anonymous + authenticated users)
export const carts = pgTable("carts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => users.id, { onDelete: "cascade" }), // Nullable for anonymous carts
  sessionId: text("session_id"), // For anonymous users (session-based)
  items: jsonb("items").default([]).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).default("0").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Orders
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  items: jsonb("items").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum("status").default("pending").notNull(),
  paymentId: varchar("payment_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ========================================
// CRM 360°
// ========================================

// Customers (extended from users)
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  tags: text("tags").array(),
  segment: text("segment"),
  lifecycleStage: text("lifecycle_stage").default("lead").notNull(),
  lifetimeValue: decimal("lifetime_value", { precision: 10, scale: 2 }).default("0").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Customer Interactions (Timeline)
export const interactions = pgTable("interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  channel: conversationChannelEnum("channel"),
  content: text("content"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ========================================
// CRM ADVANCED - PIPELINE & DEALS
// ========================================

// Pipeline Stages
export const pipelineStages = pgTable("pipeline_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  color: text("color").default("#3B82F6"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Deals/Opportunities
export const deals = pgTable("deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  stageId: varchar("stage_id").references(() => pipelineStages.id).notNull(),
  probability: integer("probability").default(50).notNull(),
  expectedCloseDate: timestamp("expected_close_date"),
  actualCloseDate: timestamp("actual_close_date"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  notes: text("notes"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Customer Segments
export const customerSegments = pgTable("customer_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  filters: jsonb("filters").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Activities
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "cascade" }),
  type: activityTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// CRM Workflows (Automation)
export const crmWorkflows = pgTable("crm_workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  trigger: text("trigger").notNull(),
  conditions: jsonb("conditions").default({}),
  actions: jsonb("actions").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastExecutedAt: timestamp("last_executed_at"),
  executionCount: integer("execution_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ========================================
// OMNICHAT
// ========================================

// Conversations
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  channel: conversationChannelEnum("channel").notNull(),
  status: conversationStatusEnum("status").default("open").notNull(),
  assignedTo: varchar("assigned_to").references(() => users.id),
  isAiHandled: boolean("is_ai_handled").default(true).notNull(),
  metadata: jsonb("metadata"),
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
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Message Templates (Quick Replies for Omnichat)
export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  content: text("content").notNull(),
  category: text("category"), // e.g., "greeting", "support", "sales", "faq"
  shortcuts: text("shortcuts").array(), // Quick access shortcuts like "/welcome"
  isActive: boolean("is_active").default(true).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ========================================
// AI AUTÔNOMA - KNOWLEDGE BASE
// ========================================

// Knowledge Base Documents (RAG)
export const knowledgeBase = pgTable("knowledge_base", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  tags: text("tags").array(),
  vectorId: text("vector_id"),
  isActive: boolean("is_active").default(true).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Learning Log (Successful conversations)
export const aiLearningLog = pgTable("ai_learning_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  query: text("query").notNull(),
  response: text("response").notNull(),
  source: text("source"),
  wasSuccessful: boolean("was_successful").default(true),
  feedback: text("feedback"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ========================================
// PAYMENT MANAGEMENT (STRIPE)
// ========================================

// Payments
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd").notNull(),
  status: paymentStatusEnum("status").default("pending").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ========================================
// CALENDAR & SCHEDULING
// ========================================

// Calendar Events
export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  resourceId: varchar("resource_id"),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  orderId: varchar("order_id").references(() => orders.id),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ========================================
// ERP - FINANCIAL MODULE
// ========================================

// Financial Accounts (Bank Accounts, Cash, etc.)
export const financialAccounts = pgTable("financial_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // checking, savings, cash, credit_card
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0").notNull(),
  currency: text("currency").default("BRL").notNull(),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Financial Transactions (Simplified for MVP - flexible fields)
export const financialTransactions = pgTable("financial_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").references(() => financialAccounts.id, { onDelete: "cascade" }), // optional for MVP
  type: text("type").notNull(), // revenue, expense, transfer
  category: text("category"), // flexible category
  amount: text("amount").notNull(), // stored as text to preserve precision
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  paymentMethod: text("payment_method"), // cash, credit_card, pix, etc
  reference: text("reference"),
  notes: text("notes"),
  metadata: jsonb("metadata"),
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

// Product Reviews
export const insertProductReviewSchema = createInsertSchema(productReviews).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  rating: z.number().int().min(1).max(5),
});
export type InsertProductReview = z.infer<typeof insertProductReviewSchema>;
export type ProductReview = typeof productReviews.$inferSelect;

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

// Message Templates
export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;
export type MessageTemplate = typeof messageTemplates.$inferSelect;

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

// Roles
export const insertRoleSchema = createInsertSchema(roles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

// Role Permissions
export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({ createdAt: true });
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

// Password Reset Tokens
export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({ id: true, createdAt: true });
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Pipeline Stages
export const insertPipelineStageSchema = createInsertSchema(pipelineStages).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;

// Deals
export const insertDealSchema = createInsertSchema(deals).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;

// Customer Segments
export const insertCustomerSegmentSchema = createInsertSchema(customerSegments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomerSegment = z.infer<typeof insertCustomerSegmentSchema>;
export type CustomerSegment = typeof customerSegments.$inferSelect;

// Activities
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

// ========================================
// INVENTORY MANAGEMENT (ERP)
// ========================================

// Stock Movement Types
export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "purchase",      // Compra de estoque
  "sale",          // Venda
  "adjustment",    // Ajuste manual
  "transfer",      // Transferência entre depósitos
  "return",        // Devolução
  "loss",          // Perda/Quebra
  "production"     // Produção interna
]);

// Warehouses/Depósitos
export const warehouses = pgTable("warehouses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  location: text("location"),
  address: text("address"),
  isActive: boolean("is_active").default(true).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Product Stock (per warehouse)
export const productStock = pgTable("product_stock", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  warehouseId: varchar("warehouse_id").references(() => warehouses.id, { onDelete: "cascade" }).notNull(),
  quantity: integer("quantity").default(0).notNull(),
  minQuantity: integer("min_quantity").default(0).notNull(), // Low stock alert threshold
  maxQuantity: integer("max_quantity"),
  lastRestocked: timestamp("last_restocked"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Stock Movements History
export const stockMovements = pgTable("stock_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  warehouseId: varchar("warehouse_id").references(() => warehouses.id, { onDelete: "cascade" }).notNull(),
  type: stockMovementTypeEnum("type").notNull(),
  quantity: integer("quantity").notNull(), // Positive = entrada, Negative = saída
  previousQuantity: integer("previous_quantity").notNull(),
  newQuantity: integer("new_quantity").notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }), // Quem fez a movimentação
  referenceId: varchar("reference_id"), // ID da ordem/venda relacionada
  relatedWarehouseId: varchar("related_warehouse_id").references(() => warehouses.id, { onDelete: "set null" }), // Para transfers: warehouse destino/origem
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ========================================
// HR MANAGEMENT (ERP)
// ========================================

// Departments
export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  managerId: varchar("manager_id").references(() => users.id, { onDelete: "set null" }),
  parentDepartmentId: varchar("parent_department_id"), // For hierarchical departments
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Employees
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }), // Link to user account (optional)
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  departmentId: varchar("department_id").references(() => departments.id, { onDelete: "set null" }),
  position: text("position"),
  employmentType: employmentTypeEnum("employment_type").default("full_time").notNull(),
  status: employmentStatusEnum("status").default("active").notNull(),
  hireDate: timestamp("hire_date").notNull(),
  terminationDate: timestamp("termination_date"),
  salary: decimal("salary", { precision: 10, scale: 2 }),
  payrollFrequency: payrollFrequencyEnum("payroll_frequency").default("monthly").notNull(),
  address: text("address"),
  emergencyContact: jsonb("emergency_contact"),
  documents: jsonb("documents"), // IDs, contracts, etc
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Payroll Records
export const payrollRecords = pgTable("payroll_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  grossPay: decimal("gross_pay", { precision: 10, scale: 2 }).notNull(),
  deductions: decimal("deductions", { precision: 10, scale: 2 }).default("0").notNull(),
  netPay: decimal("net_pay", { precision: 10, scale: 2 }).notNull(),
  hoursWorked: decimal("hours_worked", { precision: 10, scale: 2 }),
  overtimeHours: decimal("overtime_hours", { precision: 10, scale: 2 }),
  bonuses: decimal("bonuses", { precision: 10, scale: 2 }).default("0"),
  taxes: decimal("taxes", { precision: 10, scale: 2 }).default("0"),
  paymentDate: timestamp("payment_date"),
  paymentMethod: text("payment_method"), // bank_transfer, cash, check
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Attendance Records
export const attendanceRecords = pgTable("attendance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  date: timestamp("date").notNull(),
  checkIn: timestamp("check_in"),
  checkOut: timestamp("check_out"),
  hoursWorked: decimal("hours_worked", { precision: 5, scale: 2 }),
  isAbsent: boolean("is_absent").default(false).notNull(),
  isLate: boolean("is_late").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Leave Requests (Vacation/Time Off Management)
export const hrLeaveRequests = pgTable("hr_leave_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  type: leaveTypeEnum("type").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  totalDays: decimal("total_days", { precision: 5, scale: 1 }).notNull(),
  reason: text("reason"),
  status: leaveStatusEnum("status").default("pending").notNull(),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Warehouses
export const insertWarehouseSchema = createInsertSchema(warehouses).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;
export type Warehouse = typeof warehouses.$inferSelect;

// Product Stock
export const insertProductStockSchema = createInsertSchema(productStock).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProductStock = z.infer<typeof insertProductStockSchema>;
export type ProductStock = typeof productStock.$inferSelect;

// Stock Movements
export const insertStockMovementSchema = createInsertSchema(stockMovements).omit({ id: true, createdAt: true });
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type StockMovement = typeof stockMovements.$inferSelect;

// Departments
export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

// Employees
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

// Payroll Records
export const insertPayrollRecordSchema = createInsertSchema(payrollRecords).omit({ id: true, createdAt: true });
export type InsertPayrollRecord = z.infer<typeof insertPayrollRecordSchema>;
export type PayrollRecord = typeof payrollRecords.$inferSelect;

// Attendance Records
export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({ id: true, createdAt: true });
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;

// HR Leave Requests
export const insertHrLeaveRequestSchema = createInsertSchema(hrLeaveRequests).omit({ id: true, createdAt: true, updatedAt: true, approvedAt: true });
export type InsertHrLeaveRequest = z.infer<typeof insertHrLeaveRequestSchema>;
export type HrLeaveRequest = typeof hrLeaveRequests.$inferSelect;

// Wishlist Items
export const insertWishlistItemSchema = createInsertSchema(wishlistItems).omit({ id: true, addedAt: true });
export type InsertWishlistItem = z.infer<typeof insertWishlistItemSchema>;
export type WishlistItem = typeof wishlistItems.$inferSelect;

// CRM Workflows
export const insertCrmWorkflowSchema = createInsertSchema(crmWorkflows).omit({ id: true, createdAt: true, updatedAt: true, lastExecutedAt: true, executionCount: true });
export type InsertCrmWorkflow = z.infer<typeof insertCrmWorkflowSchema>;
export type CrmWorkflow = typeof crmWorkflows.$inferSelect;

// ========================================
// AI PLANNING SESSIONS (EAAS Whitepaper 02 - POMDP + ToT)
// ========================================

// Plan Sessions: Persistent planning state for multi-turn POMDP
export const planSessions = pgTable("plan_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  
  // POMDP State
  beliefState: jsonb("belief_state").notNull(), // b(s) - probability distribution over states
  currentState: jsonb("current_state").notNull(), // Current world state representation
  
  // ToT Tree Structure
  rootNodeId: varchar("root_node_id"), // Reference to root PlanNode
  currentNodeId: varchar("current_node_id"), // Currently executing node
  
  // Planning Metadata
  maxDepth: integer("max_depth").default(3).notNull(),
  exploredPaths: integer("explored_paths").default(0).notNull(),
  completedActions: integer("completed_actions").default(0).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // Auto-cleanup old sessions
});

// Plan Nodes: Tree-of-Thought nodes (ToT/GoT structure)
export const planNodes = pgTable("plan_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => planSessions.id, { onDelete: "cascade" }).notNull(),
  parentId: varchar("parent_id"), // Self-reference for tree structure
  
  // Node Content
  depth: integer("depth").default(0).notNull(),
  actionType: text("action_type").notNull(), // answer_question, add_to_cart, checkout, etc
  actionParams: jsonb("action_params").notNull(),
  description: text("description").notNull(),
  
  // POMDP Scoring (score(a|s) = λ₁Q̂ - λ₂risk + λ₃explain)
  qValue: decimal("q_value", { precision: 5, scale: 3 }).notNull(), // Q̂(s,a) - expected utility
  riskScore: decimal("risk_score", { precision: 5, scale: 3 }).notNull(), // risk(s,a)
  explainScore: decimal("explain_score", { precision: 5, scale: 3 }).notNull(), // explain(s,a)
  totalScore: decimal("total_score", { precision: 6, scale: 3 }).notNull(), // Final score
  
  // GoT Dependencies (for multi_step_plan)
  dependencies: text("dependencies").array().default([]), // Node IDs that must execute first
  
  // Execution State
  status: text("status").default("pending").notNull(), // pending, executing, completed, failed, pruned
  executionResult: jsonb("execution_result"), // Result after execution
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Plan Sessions Schema
export const insertPlanSessionSchema = createInsertSchema(planSessions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlanSession = z.infer<typeof insertPlanSessionSchema>;
export type PlanSession = typeof planSessions.$inferSelect;

// Plan Nodes Schema
export const insertPlanNodeSchema = createInsertSchema(planNodes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlanNode = z.infer<typeof insertPlanNodeSchema>;
export type PlanNode = typeof planNodes.$inferSelect;

// ========================================
// LTL+D ETHICAL POLICIES (EAAS Whitepaper 02 - Chapter 12)
// ========================================

// Ethical Policies: LTL+D formulas for formal verification
export const ethicalPolicies = pgTable("ethical_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Policy Identity
  policyId: text("policy_id").notNull().unique(), // e.g. "risk-escalation", "kb-citation"
  name: text("name").notNull(),
  description: text("description").notNull(),
  
  // LTL+D Formula (stored as JSON AST)
  formula: jsonb("formula").notNull(), // LTLFormula AST
  
  // Configuration
  enabled: boolean("enabled").default(true).notNull(),
  severity: text("severity").default("warning").notNull(), // info, warning, critical
  
  // Metadata
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Execution Traces: Store AI execution traces for audit/verification
export const executionTraces = pgTable("execution_traces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  
  // Trace Data (π = ⟨s₀,a₀,s₁,a₁,...⟩)
  states: jsonb("states").notNull(), // Array of State objects
  actions: jsonb("actions").notNull(), // Array of Action objects
  
  // Verification Results
  policiesChecked: jsonb("policies_checked").default([]), // Array of policy IDs
  violations: jsonb("violations").default([]), // Array of VerificationResult objects
  isSafe: boolean("is_safe").default(true).notNull(), // No critical violations
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Ethical Policies Schema
export const insertEthicalPolicySchema = createInsertSchema(ethicalPolicies).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEthicalPolicy = z.infer<typeof insertEthicalPolicySchema>;
export type EthicalPolicy = typeof ethicalPolicies.$inferSelect;

// Execution Traces Schema
export const insertExecutionTraceSchema = createInsertSchema(executionTraces).omit({ id: true, createdAt: true });
export type InsertExecutionTrace = z.infer<typeof insertExecutionTraceSchema>;
export type ExecutionTrace = typeof executionTraces.$inferSelect;

// ========================================
// BRAND SCANNER 2.0 (Extract + Clone)
// ========================================

// Brand Scanner Job Status Enum
export const brandJobStatusEnum = pgEnum("brand_job_status", ["queued", "running", "done", "failed"]);
export const brandJobModeEnum = pgEnum("brand_job_mode", ["extract", "clone"]);
export const cloneModeEnum = pgEnum("clone_mode", ["snapshot", "proxy"]);

// Brand Jobs: Track scanning jobs (Extract or Clone)
export const brandJobs = pgTable("brand_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  
  // Job Configuration
  url: text("url").notNull(),
  mode: brandJobModeEnum("mode").notNull(), // 'extract' | 'clone'
  
  // Job Status & Results
  status: brandJobStatusEnum("status").default("queued").notNull(),
  result: jsonb("result"), // BrandAnalysis or CloneManifest
  error: text("error"),
  
  // Performance Metrics
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Theme Bundles: Versioned design tokens extracted from websites
export const themeBundles = pgTable("theme_bundles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  
  // Version Control
  version: integer("version").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  
  // Theme Data (ThemeTokens structure)
  tokens: jsonb("tokens").notNull(), // { color, font, radius, spacing, shadow, border }
  assets: jsonb("assets"), // { logo, favicon }
  
  // Provenance
  jobId: varchar("job_id").references(() => brandJobs.id, { onDelete: "set null" }),
  sourceUrl: text("source_url"),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  appliedAt: timestamp("applied_at"),
});

// Clone Artifacts: Static snapshots or proxy configs for cloned websites
export const cloneArtifacts = pgTable("clone_artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  
  // Version Control
  version: integer("version").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  
  // Clone Configuration
  mode: cloneModeEnum("mode").notNull(), // 'snapshot' | 'proxy'
  
  // Snapshot Data (for 'snapshot' mode)
  htmlBundle: text("html_bundle"), // Complete rewritten HTML
  manifest: jsonb("manifest").notNull(), // { routes, assets, rewrites, originalUrl }
  
  // Proxy Configuration (for 'proxy' mode - future)
  proxyConfig: jsonb("proxy_config"), // { targetUrl, headers, rewrites }
  
  // Provenance
  jobId: varchar("job_id").references(() => brandJobs.id, { onDelete: "set null" }),
  sourceUrl: text("source_url"),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  appliedAt: timestamp("applied_at"),
});

// Brand Jobs Schema
export const insertBrandJobSchema = createInsertSchema(brandJobs).omit({ id: true, createdAt: true });
export type InsertBrandJob = z.infer<typeof insertBrandJobSchema>;
export type BrandJob = typeof brandJobs.$inferSelect;

// Theme Bundles Schema
export const insertThemeBundleSchema = createInsertSchema(themeBundles).omit({ id: true, createdAt: true });
export type InsertThemeBundle = z.infer<typeof insertThemeBundleSchema>;
export type ThemeBundle = typeof themeBundles.$inferSelect;

// Clone Artifacts Schema
export const insertCloneArtifactSchema = createInsertSchema(cloneArtifacts).omit({ id: true, createdAt: true });
export type InsertCloneArtifact = z.infer<typeof insertCloneArtifactSchema>;
export type CloneArtifact = typeof cloneArtifacts.$inferSelect;

// ========================================
// AI GOVERNANCE & TRACES (EAAS Whitepaper 02)
// ========================================

// AI Governance Policies (LTL+D Rules, Ethical Constraints)
export const aiGovernance = pgTable("ai_governance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  policyName: text("policy_name").notNull(), // Human-readable name
  policyType: text("policy_type").notNull(), // "ltl", "ethical", "risk", "persuasion"
  ltlFormula: text("ltl_formula"), // LTL+D formula (e.g., "G(request_refund -> F[0,24h] process_refund)")
  maxPersuasionLevel: decimal("max_persuasion_level", { precision: 3, scale: 2 }), // Override tenant default
  riskThreshold: decimal("risk_threshold", { precision: 3, scale: 2 }), // Max acceptable risk score
  enforcementMode: text("enforcement_mode").default("enforce"), // "enforce" | "warn" | "log"
  isActive: boolean("is_active").default(true).notNull(),
  metadata: jsonb("metadata"), // Additional policy config
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Decision Traces (Critics System History)
export const aiTraces = pgTable("ai_traces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: "set null" }),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  messageContent: text("message_content").notNull(), // User input
  aiResponse: text("ai_response").notNull(), // AI output
  responseSource: text("response_source").notNull(), // "knowledge_base" | "openai" | "autonomous_sales"
  
  // Critics Scores (from runAllCritics)
  factualScore: decimal("factual_score", { precision: 3, scale: 2 }).notNull(),
  numericScore: decimal("numeric_score", { precision: 3, scale: 2 }).notNull(),
  ethicalScore: decimal("ethical_score", { precision: 3, scale: 2 }).notNull(),
  riskScore: decimal("risk_score", { precision: 3, scale: 2 }).notNull(),
  overallConfidence: decimal("overall_confidence", { precision: 3, scale: 2 }).notNull(),
  
  // Decision Outcomes
  passed: boolean("passed").notNull(), // All critics passed
  shouldEscalateToHuman: boolean("should_escalate_to_human").notNull(),
  finalRecommendation: text("final_recommendation"), // Human-readable explanation
  
  // Violations
  factualViolations: jsonb("factual_violations"), // Array of violation details
  numericViolations: jsonb("numeric_violations"),
  ethicalViolations: jsonb("ethical_violations"),
  riskViolations: jsonb("risk_violations"),
  
  // Context
  cartValue: decimal("cart_value", { precision: 10, scale: 2 }), // If applicable
  knowledgeBaseMatchId: varchar("knowledge_base_match_id"), // If KB was used
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Metrics (Aggregated Daily/Weekly Stats)
export const aiMetrics = pgTable("ai_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  metricDate: timestamp("metric_date").notNull(), // Date being measured
  aggregationPeriod: text("aggregation_period").notNull(), // "day" | "week" | "month"
  
  // Volume Metrics
  totalInteractions: integer("total_interactions").default(0).notNull(),
  totalEscalations: integer("total_escalations").default(0).notNull(),
  escalationRate: decimal("escalation_rate", { precision: 5, scale: 2 }), // Percentage
  
  // Average Scores
  avgFactualScore: decimal("avg_factual_score", { precision: 3, scale: 2 }),
  avgNumericScore: decimal("avg_numeric_score", { precision: 3, scale: 2 }),
  avgEthicalScore: decimal("avg_ethical_score", { precision: 3, scale: 2 }),
  avgRiskScore: decimal("avg_risk_score", { precision: 3, scale: 2 }),
  avgOverallConfidence: decimal("avg_overall_confidence", { precision: 3, scale: 2 }),
  
  // Violation Counts
  factualViolationCount: integer("factual_violation_count").default(0),
  numericViolationCount: integer("numeric_violation_count").default(0),
  ethicalViolationCount: integer("ethical_violation_count").default(0),
  riskViolationCount: integer("risk_violation_count").default(0),
  
  // Response Source Distribution
  knowledgeBaseResponseCount: integer("knowledge_base_response_count").default(0),
  openaiResponseCount: integer("openai_response_count").default(0),
  autonomousSalesResponseCount: integer("autonomous_sales_response_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Governance Schemas
export const insertAiGovernanceSchema = createInsertSchema(aiGovernance).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiGovernance = z.infer<typeof insertAiGovernanceSchema>;
export type AiGovernance = typeof aiGovernance.$inferSelect;

// AI Traces Schemas
export const insertAiTraceSchema = createInsertSchema(aiTraces).omit({ id: true, createdAt: true });
export type InsertAiTrace = z.infer<typeof insertAiTraceSchema>;
export type AiTrace = typeof aiTraces.$inferSelect;

// AI Metrics Schemas
export const insertAiMetricSchema = createInsertSchema(aiMetrics).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiMetric = z.infer<typeof insertAiMetricSchema>;
export type AiMetric = typeof aiMetrics.$inferSelect;

// ========================================
// REPORTS - CUSTOM REPORT TEMPLATES
// ========================================

export const reportTemplates = pgTable("report_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  reportType: reportTypeEnum("report_type").notNull(),
  
  // Report Configuration (JSONB)
  aggregations: jsonb("aggregations").notNull(), // { fields: [], groupBy: [], metrics: [] }
  filters: jsonb("filters"), // { dateRange, status, etc }
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Report Templates Schemas
export const insertReportTemplateSchema = createInsertSchema(reportTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReportTemplate = z.infer<typeof insertReportTemplateSchema>;
export type ReportTemplate = typeof reportTemplates.$inferSelect;

// ========================================
// THEME TOKENS INTERFACE (Design System)
// ========================================

export interface TypographyConfig {
  family: string;
  fallbacks: string[];
  weight?: number;
  style?: 'normal' | 'italic';
}

export interface ThemeTokens {
  color: {
    primary: string;
    secondary: string;
    accent: string;
    neutral?: string;
    bg: string;
    fg: string;
    link?: string;
    success?: string;
    warning?: string;
    danger?: string;
    surface?: string;
    subtle?: string;
  };
  font: {
    body: TypographyConfig;
    heading: TypographyConfig;
    mono?: TypographyConfig;
    cta?: TypographyConfig;
    scale?: {
      basePx: number;
      ratio: 1.125 | 1.2 | 1.25 | 1.333;
    };
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl?: number;
  };
  spacing: {
    base: number;
    steps: number[];
  };
  shadow?: {
    sm: string;
    md: string;
    lg: string;
  };
  border?: {
    width: number;
    style: 'solid' | 'dashed' | 'dotted';
    color?: string;
  };
}
