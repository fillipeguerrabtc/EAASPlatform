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
  type CalendarEvent,
  type InsertCalendarEvent,
  type Category,
  type InsertCategory,
  type FinancialTransaction,
  type InsertFinancialTransaction,
  type FinancialAccount,
  type InsertFinancialAccount,
  type Role,
  type InsertRole,
  type RolePermission,
  type InsertRolePermission,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type PipelineStage,
  type InsertPipelineStage,
  type Deal,
  type InsertDeal,
  type CustomerSegment,
  type InsertCustomerSegment,
  type Activity,
  type InsertActivity,
  type Warehouse,
  type InsertWarehouse,
  type ProductStock,
  type InsertProductStock,
  type StockMovement,
  type InsertStockMovement,
  type Department,
  type InsertDepartment,
  type Employee,
  type InsertEmployee,
  type PayrollRecord,
  type InsertPayrollRecord,
  type AttendanceRecord,
  type InsertAttendanceRecord,
  type PlanSession,
  type InsertPlanSession,
  type PlanNode,
  type InsertPlanNode,
  type BrandJob,
  type InsertBrandJob,
  type ThemeBundle,
  type InsertThemeBundle,
  type CloneArtifact,
  type InsertCloneArtifact,
  type AiGovernance,
  type InsertAiGovernance,
  type AiTrace,
  type InsertAiTrace,
  type AiMetric,
  type InsertAiMetric,
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
  calendarEvents,
  categories,
  financialTransactions,
  financialAccounts,
  roles,
  rolePermissions,
  passwordResetTokens,
  pipelineStages,
  deals,
  customerSegments,
  activities,
  warehouses,
  productStock,
  stockMovements,
  departments,
  employees,
  payrollRecords,
  attendanceRecords,
  planSessions,
  planNodes,
  brandJobs,
  themeBundles,
  cloneArtifacts,
  aiGovernance,
  aiTraces,
  aiMetrics,
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // Users & Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByReplitAuthId(replitAuthId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  
  // Local Auth (Email/Password)
  registerUser(data: { email: string; password: string; name: string; userType: 'employee' | 'customer' }): Promise<User>;
  loginUser(email: string, password: string): Promise<User | null>;
  
  // User Approvals (Admin)
  listPendingApprovals(): Promise<User[]>;
  approveUser(userId: string, adminId: string): Promise<User | undefined>;
  rejectUser(userId: string, adminId: string, reason: string): Promise<User | undefined>;
  
  // Tenants (kept for company settings management)
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined>;
  getTenantByTwilioNumber(twilioNumber: string): Promise<Tenant | undefined>;
  listTenants(): Promise<Tenant[]>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined>;
  
  // Products
  listProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<void>;
  
  // Customers
  listCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  
  // Conversations
  listConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, data: Partial<InsertConversation>): Promise<Conversation | undefined>;
  
  // Messages
  listMessages(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Knowledge Base
  listKnowledgeBase(): Promise<KnowledgeBase[]>;
  getKnowledgeBaseItem(id: string): Promise<KnowledgeBase | undefined>;
  createKnowledgeBaseItem(item: InsertKnowledgeBase): Promise<KnowledgeBase>;
  updateKnowledgeBaseItem(id: string, data: Partial<InsertKnowledgeBase>): Promise<KnowledgeBase | undefined>;
  deleteKnowledgeBaseItem(id: string): Promise<void>;
  
  // Payments
  listPayments(): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPayment(id: string): Promise<Payment | undefined>;
  updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment | undefined>;
  
  // Orders
  listOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, data: Partial<InsertOrder>): Promise<Order | undefined>;
  
  // Carts
  getCart(id: string): Promise<Cart | undefined>;
  getCartByCustomer(customerId: string): Promise<Cart | undefined>;
  getActiveCart(customerId: string): Promise<Cart | undefined>;
  createCart(cart: InsertCart): Promise<Cart>;
  updateCart(id: string, data: Partial<InsertCart>): Promise<Cart | undefined>;
  
  // Calendar Events
  listCalendarEvents(): Promise<CalendarEvent[]>;
  getCalendarEvent(id: string): Promise<CalendarEvent | undefined>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: string): Promise<void>;
  
  // Categories
  listCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<void>;
  
  // Financial Accounts
  listFinancialAccounts(): Promise<FinancialAccount[]>;
  getFinancialAccount(id: string): Promise<FinancialAccount | undefined>;
  createFinancialAccount(account: InsertFinancialAccount): Promise<FinancialAccount>;
  updateFinancialAccount(id: string, data: Partial<InsertFinancialAccount>): Promise<FinancialAccount | undefined>;
  deleteFinancialAccount(id: string): Promise<void>;
  
  // Financial Transactions
  listFinancialTransactions(filters?: { type?: string; startDate?: Date; endDate?: Date }): Promise<FinancialTransaction[]>;
  getFinancialTransaction(id: string): Promise<FinancialTransaction | undefined>;
  createFinancialTransaction(transaction: InsertFinancialTransaction): Promise<FinancialTransaction>;
  updateFinancialTransaction(id: string, data: Partial<InsertFinancialTransaction>): Promise<FinancialTransaction | undefined>;
  deleteFinancialTransaction(id: string): Promise<void>;
  
  // RBAC
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: string, role: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(id: string): Promise<boolean>;
  listRoles(): Promise<Role[]>;
  getRole(id: string): Promise<Role | undefined>;
  
  createRolePermission(permission: InsertRolePermission): Promise<RolePermission>;
  updateRolePermission(roleId: string, feature: string, accessLevel: string): Promise<RolePermission | undefined>;
  deleteRolePermission(roleId: string, feature: string): Promise<boolean>;
  getRolePermissions(roleId: string): Promise<RolePermission[]>;
  
  // Password Reset Tokens
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;
  
  // Pipeline Stages
  listPipelineStages(): Promise<PipelineStage[]>;
  getPipelineStage(id: string): Promise<PipelineStage | undefined>;
  createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage>;
  updatePipelineStage(id: string, data: Partial<InsertPipelineStage>): Promise<PipelineStage | undefined>;
  deletePipelineStage(id: string): Promise<void>;
  
  // Deals
  listDeals(): Promise<Deal[]>;
  getDeal(id: string): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: string, data: Partial<InsertDeal>): Promise<Deal | undefined>;
  deleteDeal(id: string): Promise<void>;
  
  // Customer Segments
  listCustomerSegments(): Promise<CustomerSegment[]>;
  getCustomerSegment(id: string): Promise<CustomerSegment | undefined>;
  createCustomerSegment(segment: InsertCustomerSegment): Promise<CustomerSegment>;
  updateCustomerSegment(id: string, data: Partial<InsertCustomerSegment>): Promise<CustomerSegment | undefined>;
  deleteCustomerSegment(id: string): Promise<void>;
  
  // Activities
  listActivities(filters?: { customerId?: string; dealId?: string }): Promise<Activity[]>;
  getActivity(id: string): Promise<Activity | undefined>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: string, data: Partial<InsertActivity>): Promise<Activity | undefined>;
  deleteActivity(id: string): Promise<void>;
  
  // Inventory - Warehouses
  listWarehouses(): Promise<Warehouse[]>;
  getWarehouse(id: string): Promise<Warehouse | undefined>;
  createWarehouse(warehouse: InsertWarehouse): Promise<Warehouse>;
  updateWarehouse(id: string, data: Partial<InsertWarehouse>): Promise<Warehouse | undefined>;
  deleteWarehouse(id: string): Promise<void>;
  
  // Inventory - Product Stock
  listProductStock(warehouseId?: string): Promise<ProductStock[]>;
  getProductStock(productId: string, warehouseId: string): Promise<ProductStock | undefined>;
  createProductStock(stock: InsertProductStock): Promise<ProductStock>;
  updateProductStock(id: string, data: Partial<InsertProductStock>): Promise<ProductStock | undefined>;
  
  // Inventory - Stock Movements
  listStockMovements(filters?: { productId?: string; warehouseId?: string }): Promise<StockMovement[]>;
  getStockMovement(id: string): Promise<StockMovement | undefined>;
  createStockMovement(movement: InsertStockMovement): Promise<StockMovement>;
  
  // HR - Departments
  listDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department | undefined>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  updateDepartment(id: string, data: Partial<InsertDepartment>): Promise<Department | undefined>;
  deleteDepartment(id: string): Promise<void>;
  
  // HR - Employees
  listEmployees(departmentId?: string): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, data: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<void>;
  
  // HR - Payroll Records
  listPayrollRecords(employeeId?: string): Promise<PayrollRecord[]>;
  getPayrollRecord(id: string): Promise<PayrollRecord | undefined>;
  createPayrollRecord(record: InsertPayrollRecord): Promise<PayrollRecord>;
  updatePayrollRecord(id: string, data: Partial<InsertPayrollRecord>): Promise<PayrollRecord | undefined>;
  deletePayrollRecord(id: string): Promise<void>;
  
  // HR - Attendance Records
  listAttendanceRecords(employeeId?: string, startDate?: Date, endDate?: Date): Promise<AttendanceRecord[]>;
  getAttendanceRecord(id: string): Promise<AttendanceRecord | undefined>;
  createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord>;
  updateAttendanceRecord(id: string, data: Partial<InsertAttendanceRecord>): Promise<AttendanceRecord | undefined>;
  deleteAttendanceRecord(id: string): Promise<void>;
  
  // AI Planning - Plan Sessions
  getPlanSession(id: string): Promise<PlanSession | undefined>;
  getActivePlanSession(conversationId: string): Promise<PlanSession | undefined>;
  createPlanSession(session: InsertPlanSession): Promise<PlanSession>;
  updatePlanSession(id: string, data: Partial<InsertPlanSession>): Promise<PlanSession | undefined>;
  deletePlanSession(id: string): Promise<void>;
  
  // AI Planning - Plan Nodes
  getPlanNode(id: string): Promise<PlanNode | undefined>;
  getNodesBySession(sessionId: string): Promise<PlanNode[]>;
  getChildNodes(parentId: string): Promise<PlanNode[]>;
  createPlanNode(node: InsertPlanNode): Promise<PlanNode>;
  updatePlanNode(id: string, data: Partial<InsertPlanNode>): Promise<PlanNode | undefined>;
  
  // Brand Scanner - Brand Jobs
  getBrandJob(id: string): Promise<BrandJob | undefined>;
  listBrandJobs(tenantId: string): Promise<BrandJob[]>;
  createBrandJob(job: InsertBrandJob): Promise<BrandJob>;
  updateBrandJobStatus(id: string, status: string, result?: any, error?: string, durationMs?: number): Promise<BrandJob | undefined>;
  
  // Brand Scanner - Theme Bundles
  getThemeBundle(id: string): Promise<ThemeBundle | undefined>;
  listThemeBundles(tenantId: string): Promise<ThemeBundle[]>;
  getActiveThemeBundle(tenantId: string): Promise<ThemeBundle | undefined>;
  getNextThemeVersion(tenantId: string): Promise<number>;
  createThemeBundle(bundle: InsertThemeBundle): Promise<ThemeBundle>;
  activateThemeBundle(id: string, tenantId: string): Promise<ThemeBundle | undefined>;
  
  // Brand Scanner - Clone Artifacts
  getCloneArtifact(id: string): Promise<CloneArtifact | undefined>;
  listCloneArtifacts(tenantId: string): Promise<CloneArtifact[]>;
  getActiveCloneArtifact(tenantId: string): Promise<CloneArtifact | undefined>;
  getNextCloneVersion(tenantId: string): Promise<number>;
  createCloneArtifact(artifact: InsertCloneArtifact): Promise<CloneArtifact>;
  activateCloneArtifact(id: string, tenantId: string): Promise<CloneArtifact | undefined>;
  
  // AI Governance - Policies
  getAiGovernance(id: string): Promise<AiGovernance | undefined>;
  listAiGovernance(tenantId: string): Promise<AiGovernance[]>;
  listActiveAiPolicies(tenantId: string): Promise<AiGovernance[]>;
  createAiGovernance(policy: InsertAiGovernance): Promise<AiGovernance>;
  updateAiGovernance(id: string, data: Partial<InsertAiGovernance>): Promise<AiGovernance | undefined>;
  deleteAiGovernance(id: string): Promise<void>;
  
  // AI Traces - Decision History
  getAiTrace(id: string): Promise<AiTrace | undefined>;
  listAiTraces(filters?: { tenantId?: string; customerId?: string; startDate?: Date; endDate?: Date }): Promise<AiTrace[]>;
  createAiTrace(trace: InsertAiTrace): Promise<AiTrace>;
  
  // AI Metrics - Aggregated Stats
  getAiMetric(id: string): Promise<AiMetric | undefined>;
  listAiMetrics(filters: { tenantId: string; startDate?: Date; endDate?: Date; aggregationPeriod?: string }): Promise<AiMetric[]>;
  createAiMetric(metric: InsertAiMetric): Promise<AiMetric>;
  updateAiMetric(id: string, data: Partial<InsertAiMetric>): Promise<AiMetric | undefined>;
  getAiMetricsSummary(filters: { tenantId: string; startDate?: Date; endDate?: Date }): Promise<{
    avgFactualScore: number;
    avgNumericScore: number;
    avgEthicalScore: number;
    avgRiskScore: number;
    avgOverallConfidence: number;
    totalTraces: number;
    escalationRate: number;
    passRate: number;
    topViolations: Array<{ violation: string; count: number }>;
    tracesBySource: Array<{ source: string; count: number }>;
  }>;
  
  // Dashboard KPIs
  getDashboardKpis(filters: { tenantId: string; startDate?: Date; endDate?: Date }): Promise<{
    totalRevenue: number;
    revenueGrowth: number;
    totalOrders: number;
    ordersGrowth: number;
    totalCustomers: number;
    customersGrowth: number;
    conversionRate: number;
    activeConversations: number;
    criticalAlerts: {
      lowStockProducts: number;
      pendingPayments: number;
      criticsEscalations: number;
    };
    salesTrend: Array<{ date: string; revenue: number; orders: number }>;
  }>;
}

export class DbStorage implements IStorage {
  // ========================================
  // USERS
  // ========================================
  
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getUserByReplitAuthId(replitAuthId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.replitAuthId, replitAuthId)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  // ========================================
  // LOCAL AUTH (Email/Password)
  // ========================================

  async registerUser(data: { email: string; password: string; name: string; userType: 'employee' | 'customer' }): Promise<User> {
    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);
    
    // Set approval status based on user type
    const approvalStatus = data.userType === 'customer' ? 'approved' : 'pending_approval';
    
    // Create user
    const insertData: InsertUser = {
      email: data.email,
      name: data.name,
      passwordHash,
      userType: data.userType,
      approvalStatus,
      requestedAt: data.userType === 'employee' ? new Date() : undefined,
      role: data.userType === 'customer' ? 'customer' : 'agent',
    };
    
    const result = await db.insert(users).values(insertData).returning();
    return result[0];
  }

  async loginUser(email: string, password: string): Promise<User | null> {
    // Get user by email
    const user = await this.getUserByEmail(email);
    
    if (!user || !user.passwordHash) {
      return null;
    }
    
    // Check if user is approved
    if (user.approvalStatus !== 'approved') {
      return null;
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      return null;
    }
    
    return user;
  }

  // ========================================
  // USER APPROVALS (Admin)
  // ========================================

  async listPendingApprovals(): Promise<User[]> {
    return await db.select().from(users)
      .where(eq(users.approvalStatus, 'pending_approval'))
      .orderBy(desc(users.requestedAt));
  }

  async approveUser(userId: string, adminId: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({
        approvalStatus: 'approved',
        approvedAt: new Date(),
        approvedBy: adminId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async rejectUser(userId: string, adminId: string, reason: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({
        approvalStatus: 'rejected',
        approvedBy: adminId,
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  // ========================================
  // TENANTS (kept for company settings management)
  // ========================================

  async getTenant(id: string): Promise<Tenant | undefined> {
    const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return result[0];
  }

  async getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined> {
    const result = await db.select().from(tenants).where(eq(tenants.subdomain, subdomain)).limit(1);
    return result[0];
  }

  async getTenantByTwilioNumber(twilioNumber: string): Promise<Tenant | undefined> {
    const result = await db.select().from(tenants).where(eq(tenants.twilioWhatsappNumber, twilioNumber)).limit(1);
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

  async listProducts(): Promise<Product[]> {
    return await db.select().from(products)
      .orderBy(desc(products.createdAt));
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const result = await db.select().from(products)
      .where(eq(products.id, id))
      .limit(1);
    return result[0];
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(insertProduct).returning();
    return result[0];
  }

  async updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const result = await db.update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return result[0];
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // ========================================
  // CUSTOMERS
  // ========================================

  async listCustomers(): Promise<Customer[]> {
    return await db.select().from(customers)
      .orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const result = await db.select().from(customers)
      .where(eq(customers.id, id))
      .limit(1);
    return result[0];
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const result = await db.insert(customers).values(insertCustomer).returning();
    return result[0];
  }

  async updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const result = await db.update(customers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return result[0];
  }

  // ========================================
  // CONVERSATIONS
  // ========================================

  async listConversations(): Promise<Conversation[]> {
    return await db.select().from(conversations)
      .orderBy(desc(conversations.updatedAt));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    return result[0];
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const result = await db.insert(conversations).values(insertConversation).returning();
    return result[0];
  }

  async updateConversation(id: string, data: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const result = await db.update(conversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return result[0];
  }

  // ========================================
  // MESSAGES
  // ========================================

  async listMessages(conversationId: string): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(insertMessage).returning();
    return result[0];
  }

  // ========================================
  // KNOWLEDGE BASE
  // ========================================

  async listKnowledgeBase(): Promise<KnowledgeBase[]> {
    return await db.select().from(knowledgeBase)
      .orderBy(desc(knowledgeBase.createdAt));
  }

  async getKnowledgeBaseItem(id: string): Promise<KnowledgeBase | undefined> {
    const result = await db.select().from(knowledgeBase)
      .where(eq(knowledgeBase.id, id))
      .limit(1);
    return result[0];
  }

  async createKnowledgeBaseItem(insertItem: InsertKnowledgeBase): Promise<KnowledgeBase> {
    const result = await db.insert(knowledgeBase).values(insertItem).returning();
    return result[0];
  }

  async updateKnowledgeBaseItem(id: string, data: Partial<InsertKnowledgeBase>): Promise<KnowledgeBase | undefined> {
    const result = await db.update(knowledgeBase)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(knowledgeBase.id, id))
      .returning();
    return result[0];
  }

  async deleteKnowledgeBaseItem(id: string): Promise<void> {
    await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
  }

  // ========================================
  // PAYMENTS
  // ========================================

  async listPayments(): Promise<Payment[]> {
    return await db.select().from(payments)
      .orderBy(desc(payments.createdAt));
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const result = await db.insert(payments).values(insertPayment).returning();
    return result[0];
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const result = await db.select().from(payments)
      .where(eq(payments.id, id))
      .limit(1);
    return result[0];
  }

  async updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment | undefined> {
    const result = await db.update(payments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return result[0];
  }

  // ========================================
  // ORDERS
  // ========================================

  async listOrders(): Promise<Order[]> {
    return await db.select().from(orders)
      .orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const result = await db.select().from(orders)
      .where(eq(orders.id, id))
      .limit(1);
    return result[0];
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const result = await db.insert(orders).values(insertOrder).returning();
    return result[0];
  }

  async updateOrder(id: string, data: Partial<InsertOrder>): Promise<Order | undefined> {
    const result = await db.update(orders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return result[0];
  }

  // ========================================
  // CARTS
  // ========================================

  async getCart(id: string): Promise<Cart | undefined> {
    const result = await db.select().from(carts)
      .where(eq(carts.id, id))
      .limit(1);
    return result[0];
  }

  async getCartByCustomer(customerId: string): Promise<Cart | undefined> {
    const result = await db.select().from(carts)
      .where(eq(carts.customerId, customerId))
      .limit(1);
    return result[0];
  }

  async getActiveCart(customerId: string): Promise<Cart | undefined> {
    return this.getCartByCustomer(customerId);
  }

  async createCart(insertCart: InsertCart): Promise<Cart> {
    const result = await db.insert(carts).values(insertCart).returning();
    return result[0];
  }

  async updateCart(id: string, data: Partial<InsertCart>): Promise<Cart | undefined> {
    const result = await db.update(carts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(carts.id, id))
      .returning();
    return result[0];
  }

  // ========================================
  // CALENDAR EVENTS
  // ========================================

  async listCalendarEvents(): Promise<CalendarEvent[]> {
    return await db.select().from(calendarEvents)
      .orderBy(desc(calendarEvents.startTime));
  }

  async getCalendarEvent(id: string): Promise<CalendarEvent | undefined> {
    const result = await db.select().from(calendarEvents)
      .where(eq(calendarEvents.id, id))
      .limit(1);
    return result[0];
  }

  async createCalendarEvent(insertEvent: InsertCalendarEvent): Promise<CalendarEvent> {
    const result = await db.insert(calendarEvents).values(insertEvent).returning();
    return result[0];
  }

  async updateCalendarEvent(id: string, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined> {
    const result = await db.update(calendarEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(calendarEvents.id, id))
      .returning();
    return result[0];
  }

  async deleteCalendarEvent(id: string): Promise<void> {
    await db.delete(calendarEvents)
      .where(eq(calendarEvents.id, id));
  }

  // ========================================
  // CATEGORIES
  // ========================================

  async listCategories(): Promise<Category[]> {
    return await db.select().from(categories)
      .orderBy(categories.name);
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const result = await db.select().from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    return result[0];
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const result = await db.insert(categories).values(insertCategory).returning();
    return result[0];
  }

  async updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const result = await db.update(categories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return result[0];
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories)
      .where(eq(categories.id, id));
  }

  // ========================================
  // FINANCIAL ACCOUNTS
  // ========================================

  async listFinancialAccounts(): Promise<FinancialAccount[]> {
    return await db.select().from(financialAccounts)
      .orderBy(financialAccounts.name);
  }

  async getFinancialAccount(id: string): Promise<FinancialAccount | undefined> {
    const result = await db.select().from(financialAccounts)
      .where(eq(financialAccounts.id, id))
      .limit(1);
    return result[0];
  }

  async createFinancialAccount(account: InsertFinancialAccount): Promise<FinancialAccount> {
    const result = await db.insert(financialAccounts).values(account).returning();
    return result[0];
  }

  async updateFinancialAccount(id: string, data: Partial<InsertFinancialAccount>): Promise<FinancialAccount | undefined> {
    const result = await db.update(financialAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(financialAccounts.id, id))
      .returning();
    return result[0];
  }

  async deleteFinancialAccount(id: string): Promise<void> {
    await db.delete(financialAccounts)
      .where(eq(financialAccounts.id, id));
  }

  // ========================================
  // FINANCIAL TRANSACTIONS
  // ========================================

  async listFinancialTransactions(filters?: { type?: string; startDate?: Date; endDate?: Date }): Promise<FinancialTransaction[]> {
    let query = db.select().from(financialTransactions)
      .$dynamic();

    if (filters?.type) {
      query = query.where(eq(financialTransactions.type, filters.type as any));
    }

    return await query.orderBy(desc(financialTransactions.date));
  }

  async getFinancialTransaction(id: string): Promise<FinancialTransaction | undefined> {
    const result = await db.select().from(financialTransactions)
      .where(eq(financialTransactions.id, id))
      .limit(1);
    return result[0];
  }

  async createFinancialTransaction(transaction: InsertFinancialTransaction): Promise<FinancialTransaction> {
    const result = await db.insert(financialTransactions).values(transaction).returning();
    return result[0];
  }

  async updateFinancialTransaction(id: string, data: Partial<InsertFinancialTransaction>): Promise<FinancialTransaction | undefined> {
    const result = await db.update(financialTransactions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(financialTransactions.id, id))
      .returning();
    return result[0];
  }

  async deleteFinancialTransaction(id: string): Promise<void> {
    await db.delete(financialTransactions)
      .where(eq(financialTransactions.id, id));
  }

  // ========================================
  // RBAC METHODS
  // ========================================

  async createRole(role: InsertRole): Promise<Role> {
    const [newRole] = await db.insert(roles).values(role).returning();
    return newRole;
  }

  async updateRole(id: string, role: Partial<InsertRole>): Promise<Role | undefined> {
    const [updated] = await db.update(roles)
      .set({ ...role, updatedAt: new Date() })
      .where(eq(roles.id, id))
      .returning();
    return updated;
  }

  async deleteRole(id: string): Promise<boolean> {
    const result = await db.delete(roles).where(eq(roles.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async listRoles(): Promise<Role[]> {
    return db.select().from(roles);
  }

  async getRole(id: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role;
  }

  async createRolePermission(permission: InsertRolePermission): Promise<RolePermission> {
    const [newPermission] = await db.insert(rolePermissions).values(permission).returning();
    return newPermission;
  }

  async updateRolePermission(roleId: string, feature: string, accessLevel: string): Promise<RolePermission | undefined> {
    const [updated] = await db.update(rolePermissions)
      .set({ accessLevel: accessLevel as any })
      .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.feature, feature as any)))
      .returning();
    return updated;
  }

  async deleteRolePermission(roleId: string, feature: string): Promise<boolean> {
    const result = await db.delete(rolePermissions)
      .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.feature, feature as any)));
    return (result.rowCount ?? 0) > 0;
  }

  async getRolePermissions(roleId: string): Promise<RolePermission[]> {
    return db.select().from(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  }
  
  // ========================================
  // PASSWORD RESET TOKENS
  // ========================================
  
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [newToken] = await db.insert(passwordResetTokens).values(token).returning();
    return newToken;
  }
  
  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db.select().from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.token, token), eq(passwordResetTokens.usedAt, null as any)));
    return resetToken;
  }
  
  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
  }
  
  async deleteExpiredPasswordResetTokens(): Promise<void> {
    await db.delete(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.usedAt, null as any),
        desc(passwordResetTokens.expiresAt) as any
      ));
  }
  
  // ========================================
  // PIPELINE STAGES
  // ========================================
  
  async listPipelineStages(): Promise<PipelineStage[]> {
    return await db.select().from(pipelineStages)
      .orderBy(pipelineStages.order);
  }
  
  async getPipelineStage(id: string): Promise<PipelineStage | undefined> {
    const [stage] = await db.select().from(pipelineStages)
      .where(eq(pipelineStages.id, id))
      .limit(1);
    return stage;
  }
  
  async createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage> {
    const [newStage] = await db.insert(pipelineStages).values(stage).returning();
    return newStage;
  }
  
  async updatePipelineStage(id: string, data: Partial<InsertPipelineStage>): Promise<PipelineStage | undefined> {
    const [updated] = await db.update(pipelineStages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pipelineStages.id, id))
      .returning();
    return updated;
  }
  
  async deletePipelineStage(id: string): Promise<void> {
    await db.delete(pipelineStages)
      .where(eq(pipelineStages.id, id));
  }
  
  // ========================================
  // DEALS
  // ========================================
  
  async listDeals(): Promise<Deal[]> {
    return await db.select().from(deals)
      .orderBy(desc(deals.createdAt));
  }
  
  async getDeal(id: string): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals)
      .where(eq(deals.id, id))
      .limit(1);
    return deal;
  }
  
  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [newDeal] = await db.insert(deals).values(deal).returning();
    return newDeal;
  }
  
  async updateDeal(id: string, data: Partial<InsertDeal>): Promise<Deal | undefined> {
    const [updated] = await db.update(deals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(deals.id, id))
      .returning();
    return updated;
  }
  
  async deleteDeal(id: string): Promise<void> {
    await db.delete(deals)
      .where(eq(deals.id, id));
  }
  
  // ========================================
  // CUSTOMER SEGMENTS
  // ========================================
  
  async listCustomerSegments(): Promise<CustomerSegment[]> {
    return await db.select().from(customerSegments)
      .orderBy(customerSegments.name);
  }
  
  async getCustomerSegment(id: string): Promise<CustomerSegment | undefined> {
    const [segment] = await db.select().from(customerSegments)
      .where(eq(customerSegments.id, id))
      .limit(1);
    return segment;
  }
  
  async createCustomerSegment(segment: InsertCustomerSegment): Promise<CustomerSegment> {
    const [newSegment] = await db.insert(customerSegments).values(segment).returning();
    return newSegment;
  }
  
  async updateCustomerSegment(id: string, data: Partial<InsertCustomerSegment>): Promise<CustomerSegment | undefined> {
    const [updated] = await db.update(customerSegments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customerSegments.id, id))
      .returning();
    return updated;
  }
  
  async deleteCustomerSegment(id: string): Promise<void> {
    await db.delete(customerSegments)
      .where(eq(customerSegments.id, id));
  }
  
  // ========================================
  // ACTIVITIES
  // ========================================
  
  async listActivities(filters?: { customerId?: string; dealId?: string }): Promise<Activity[]> {
    let query = db.select().from(activities).$dynamic();
    
    if (filters?.customerId) {
      query = query.where(eq(activities.customerId, filters.customerId));
    }
    
    if (filters?.dealId) {
      query = query.where(eq(activities.dealId, filters.dealId));
    }
    
    return await query.orderBy(desc(activities.createdAt));
  }
  
  async getActivity(id: string): Promise<Activity | undefined> {
    const [activity] = await db.select().from(activities)
      .where(eq(activities.id, id))
      .limit(1);
    return activity;
  }
  
  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db.insert(activities).values(activity).returning();
    return newActivity;
  }
  
  async updateActivity(id: string, data: Partial<InsertActivity>): Promise<Activity | undefined> {
    const [updated] = await db.update(activities)
      .set(data)
      .where(eq(activities.id, id))
      .returning();
    return updated;
  }
  
  async deleteActivity(id: string): Promise<void> {
    await db.delete(activities)
      .where(eq(activities.id, id));
  }
  
  // ========================================
  // INVENTORY - WAREHOUSES
  // ========================================
  
  async listWarehouses(): Promise<Warehouse[]> {
    return await db.select().from(warehouses)
      .orderBy(warehouses.name);
  }
  
  async getWarehouse(id: string): Promise<Warehouse | undefined> {
    const [warehouse] = await db.select().from(warehouses)
      .where(eq(warehouses.id, id))
      .limit(1);
    return warehouse;
  }
  
  async createWarehouse(warehouse: InsertWarehouse): Promise<Warehouse> {
    const [newWarehouse] = await db.insert(warehouses).values(warehouse).returning();
    return newWarehouse;
  }
  
  async updateWarehouse(id: string, data: Partial<InsertWarehouse>): Promise<Warehouse | undefined> {
    const [updated] = await db.update(warehouses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(warehouses.id, id))
      .returning();
    return updated;
  }
  
  async deleteWarehouse(id: string): Promise<void> {
    await db.delete(warehouses)
      .where(eq(warehouses.id, id));
  }
  
  // ========================================
  // INVENTORY - PRODUCT STOCK
  // ========================================
  
  async listProductStock(warehouseId?: string): Promise<ProductStock[]> {
    const query = warehouseId
      ? db.select().from(productStock).where(eq(productStock.warehouseId, warehouseId))
      : db.select().from(productStock);
    
    return await query.orderBy(productStock.productId);
  }
  
  async getProductStock(productId: string, warehouseId: string): Promise<ProductStock | undefined> {
    const [stock] = await db.select().from(productStock)
      .where(and(
        eq(productStock.productId, productId),
        eq(productStock.warehouseId, warehouseId)
      ))
      .limit(1);
    return stock;
  }
  
  async createProductStock(stock: InsertProductStock): Promise<ProductStock> {
    const [newStock] = await db.insert(productStock).values(stock).returning();
    return newStock;
  }
  
  async updateProductStock(id: string, data: Partial<InsertProductStock>): Promise<ProductStock | undefined> {
    const [updated] = await db.update(productStock)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productStock.id, id))
      .returning();
    return updated;
  }
  
  // ========================================
  // INVENTORY - STOCK MOVEMENTS
  // ========================================
  
  async listStockMovements(filters?: { productId?: string; warehouseId?: string }): Promise<StockMovement[]> {
    let conditions: any[] = [];
    
    if (filters?.productId) {
      conditions.push(eq(stockMovements.productId, filters.productId));
    }
    if (filters?.warehouseId) {
      conditions.push(eq(stockMovements.warehouseId, filters.warehouseId));
    }
    
    const query = conditions.length > 0
      ? db.select().from(stockMovements).where(and(...conditions))
      : db.select().from(stockMovements);
    
    return await query.orderBy(desc(stockMovements.createdAt));
  }
  
  async getStockMovement(id: string): Promise<StockMovement | undefined> {
    const [movement] = await db.select().from(stockMovements)
      .where(eq(stockMovements.id, id))
      .limit(1);
    return movement;
  }
  
  async createStockMovement(movement: InsertStockMovement): Promise<StockMovement> {
    const [newMovement] = await db.insert(stockMovements).values(movement).returning();
    return newMovement;
  }
  
  // ========================================
  // HR - DEPARTMENTS
  // ========================================
  
  async listDepartments(): Promise<Department[]> {
    return await db.select().from(departments)
      .orderBy(departments.name);
  }
  
  async getDepartment(id: string): Promise<Department | undefined> {
    const [department] = await db.select().from(departments)
      .where(eq(departments.id, id))
      .limit(1);
    return department;
  }
  
  async createDepartment(department: InsertDepartment): Promise<Department> {
    const [newDepartment] = await db.insert(departments).values(department).returning();
    return newDepartment;
  }
  
  async updateDepartment(id: string, data: Partial<InsertDepartment>): Promise<Department | undefined> {
    const [updated] = await db.update(departments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning();
    return updated;
  }
  
  async deleteDepartment(id: string): Promise<void> {
    await db.delete(departments)
      .where(eq(departments.id, id));
  }
  
  // ========================================
  // HR - EMPLOYEES
  // ========================================
  
  async listEmployees(departmentId?: string): Promise<Employee[]> {
    const query = departmentId
      ? db.select().from(employees).where(eq(employees.departmentId, departmentId))
      : db.select().from(employees);
    
    return await query.orderBy(employees.lastName, employees.firstName);
  }
  
  async getEmployee(id: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees)
      .where(eq(employees.id, id))
      .limit(1);
    return employee;
  }
  
  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const [newEmployee] = await db.insert(employees).values(employee).returning();
    return newEmployee;
  }
  
  async updateEmployee(id: string, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const [updated] = await db.update(employees)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(employees.id, id))
      .returning();
    return updated;
  }
  
  async deleteEmployee(id: string): Promise<void> {
    await db.delete(employees)
      .where(eq(employees.id, id));
  }
  
  // ========================================
  // HR - PAYROLL RECORDS
  // ========================================
  
  async listPayrollRecords(employeeId?: string): Promise<PayrollRecord[]> {
    const query = employeeId
      ? db.select().from(payrollRecords).where(eq(payrollRecords.employeeId, employeeId))
      : db.select().from(payrollRecords);
    
    return await query.orderBy(desc(payrollRecords.periodEnd));
  }
  
  async getPayrollRecord(id: string): Promise<PayrollRecord | undefined> {
    const [record] = await db.select().from(payrollRecords)
      .where(eq(payrollRecords.id, id))
      .limit(1);
    return record;
  }
  
  async createPayrollRecord(record: InsertPayrollRecord): Promise<PayrollRecord> {
    const [newRecord] = await db.insert(payrollRecords).values(record).returning();
    return newRecord;
  }
  
  async updatePayrollRecord(id: string, data: Partial<InsertPayrollRecord>): Promise<PayrollRecord | undefined> {
    const [updated] = await db.update(payrollRecords)
      .set(data)
      .where(eq(payrollRecords.id, id))
      .returning();
    return updated;
  }
  
  async deletePayrollRecord(id: string): Promise<void> {
    await db.delete(payrollRecords)
      .where(eq(payrollRecords.id, id));
  }
  
  // ========================================
  // HR - ATTENDANCE RECORDS
  // ========================================
  
  async listAttendanceRecords(employeeId?: string, startDate?: Date, endDate?: Date): Promise<AttendanceRecord[]> {
    let conditions: any[] = [];
    
    if (employeeId) {
      conditions.push(eq(attendanceRecords.employeeId, employeeId));
    }
    
    const query = conditions.length > 0
      ? db.select().from(attendanceRecords).where(and(...conditions))
      : db.select().from(attendanceRecords);
    
    return await query.orderBy(desc(attendanceRecords.date));
  }
  
  async getAttendanceRecord(id: string): Promise<AttendanceRecord | undefined> {
    const [record] = await db.select().from(attendanceRecords)
      .where(eq(attendanceRecords.id, id))
      .limit(1);
    return record;
  }
  
  async createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord> {
    const [newRecord] = await db.insert(attendanceRecords).values(record).returning();
    return newRecord;
  }
  
  async updateAttendanceRecord(id: string, data: Partial<InsertAttendanceRecord>): Promise<AttendanceRecord | undefined> {
    const [updated] = await db.update(attendanceRecords)
      .set(data)
      .where(eq(attendanceRecords.id, id))
      .returning();
    return updated;
  }
  
  async deleteAttendanceRecord(id: string): Promise<void> {
    await db.delete(attendanceRecords)
      .where(eq(attendanceRecords.id, id));
  }
  
  // ========================================
  // AI PLANNING - PLAN SESSIONS
  // ========================================
  
  async getPlanSession(id: string): Promise<PlanSession | undefined> {
    const [session] = await db.select().from(planSessions)
      .where(eq(planSessions.id, id))
      .limit(1);
    return session;
  }
  
  async getActivePlanSession(conversationId: string): Promise<PlanSession | undefined> {
    const now = new Date();
    const [session] = await db.select().from(planSessions)
      .where(eq(planSessions.conversationId, conversationId))
      .orderBy(desc(planSessions.updatedAt))
      .limit(1);
    
    return (session && new Date(session.expiresAt) > now) ? session : undefined;
  }
  
  async createPlanSession(session: InsertPlanSession): Promise<PlanSession> {
    const [newSession] = await db.insert(planSessions).values(session).returning();
    return newSession;
  }
  
  async updatePlanSession(id: string, data: Partial<InsertPlanSession>): Promise<PlanSession | undefined> {
    const [updated] = await db.update(planSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(planSessions.id, id))
      .returning();
    return updated;
  }
  
  async deletePlanSession(id: string): Promise<void> {
    await db.delete(planSessions)
      .where(eq(planSessions.id, id));
  }
  
  // ========================================
  // AI PLANNING - PLAN NODES
  // ========================================
  
  async getPlanNode(id: string): Promise<PlanNode | undefined> {
    const [node] = await db.select().from(planNodes)
      .where(eq(planNodes.id, id))
      .limit(1);
    return node;
  }
  
  async getNodesBySession(sessionId: string): Promise<PlanNode[]> {
    return await db.select().from(planNodes)
      .where(eq(planNodes.sessionId, sessionId))
      .orderBy(planNodes.depth, planNodes.createdAt);
  }
  
  async getChildNodes(parentId: string): Promise<PlanNode[]> {
    return await db.select().from(planNodes)
      .where(eq(planNodes.parentId, parentId))
      .orderBy(desc(planNodes.totalScore));
  }
  
  async createPlanNode(node: InsertPlanNode): Promise<PlanNode> {
    const [newNode] = await db.insert(planNodes).values(node).returning();
    return newNode;
  }
  
  async updatePlanNode(id: string, data: Partial<InsertPlanNode>): Promise<PlanNode | undefined> {
    const [updated] = await db.update(planNodes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(planNodes.id, id))
      .returning();
    return updated;
  }
  
  // ========================================
  // BRAND SCANNER - BRAND JOBS
  // ========================================
  
  async getBrandJob(id: string): Promise<BrandJob | undefined> {
    const [job] = await db.select().from(brandJobs)
      .where(eq(brandJobs.id, id))
      .limit(1);
    return job;
  }
  
  async listBrandJobs(tenantId: string): Promise<BrandJob[]> {
    return await db.select().from(brandJobs)
      .where(eq(brandJobs.tenantId, tenantId))
      .orderBy(desc(brandJobs.createdAt));
  }
  
  async createBrandJob(job: InsertBrandJob): Promise<BrandJob> {
    const [newJob] = await db.insert(brandJobs).values(job).returning();
    return newJob;
  }
  
  async updateBrandJobStatus(id: string, status: string, result?: any, error?: string, durationMs?: number): Promise<BrandJob | undefined> {
    const updateData: any = { status };
    
    if (status === 'running') {
      updateData.startedAt = new Date();
    } else if (status === 'done' || status === 'failed') {
      updateData.completedAt = new Date();
      if (durationMs) updateData.durationMs = durationMs;
    }
    
    if (result) updateData.result = result;
    if (error) updateData.error = error;
    
    const [updated] = await db.update(brandJobs)
      .set(updateData)
      .where(eq(brandJobs.id, id))
      .returning();
    return updated;
  }
  
  // ========================================
  // BRAND SCANNER - THEME BUNDLES
  // ========================================
  
  async getThemeBundle(id: string): Promise<ThemeBundle | undefined> {
    const [bundle] = await db.select().from(themeBundles)
      .where(eq(themeBundles.id, id))
      .limit(1);
    return bundle;
  }
  
  async listThemeBundles(tenantId: string): Promise<ThemeBundle[]> {
    return await db.select().from(themeBundles)
      .where(eq(themeBundles.tenantId, tenantId))
      .orderBy(desc(themeBundles.version));
  }
  
  async getActiveThemeBundle(tenantId: string): Promise<ThemeBundle | undefined> {
    const [bundle] = await db.select().from(themeBundles)
      .where(and(
        eq(themeBundles.tenantId, tenantId),
        eq(themeBundles.isActive, true)
      ))
      .limit(1);
    return bundle;
  }
  
  async getNextThemeVersion(tenantId: string): Promise<number> {
    const bundles = await db.select().from(themeBundles)
      .where(eq(themeBundles.tenantId, tenantId))
      .orderBy(desc(themeBundles.version))
      .limit(1);
    
    return bundles.length > 0 ? bundles[0].version + 1 : 1;
  }
  
  async createThemeBundle(bundle: InsertThemeBundle): Promise<ThemeBundle> {
    const [newBundle] = await db.insert(themeBundles).values(bundle).returning();
    return newBundle;
  }
  
  async activateThemeBundle(id: string, tenantId: string): Promise<ThemeBundle | undefined> {
    // Deactivate all existing bundles for this tenant
    await db.update(themeBundles)
      .set({ isActive: false })
      .where(eq(themeBundles.tenantId, tenantId));
    
    // Activate the selected bundle
    const [activated] = await db.update(themeBundles)
      .set({ isActive: true, appliedAt: new Date() })
      .where(eq(themeBundles.id, id))
      .returning();
    
    return activated;
  }
  
  // ========================================
  // BRAND SCANNER - CLONE ARTIFACTS
  // ========================================
  
  async getCloneArtifact(id: string): Promise<CloneArtifact | undefined> {
    const [artifact] = await db.select().from(cloneArtifacts)
      .where(eq(cloneArtifacts.id, id))
      .limit(1);
    return artifact;
  }
  
  async listCloneArtifacts(tenantId: string): Promise<CloneArtifact[]> {
    return await db.select().from(cloneArtifacts)
      .where(eq(cloneArtifacts.tenantId, tenantId))
      .orderBy(desc(cloneArtifacts.version));
  }
  
  async getActiveCloneArtifact(tenantId: string): Promise<CloneArtifact | undefined> {
    const [artifact] = await db.select().from(cloneArtifacts)
      .where(and(
        eq(cloneArtifacts.tenantId, tenantId),
        eq(cloneArtifacts.isActive, true)
      ))
      .limit(1);
    return artifact;
  }
  
  async getNextCloneVersion(tenantId: string): Promise<number> {
    const artifacts = await db.select().from(cloneArtifacts)
      .where(eq(cloneArtifacts.tenantId, tenantId))
      .orderBy(desc(cloneArtifacts.version))
      .limit(1);
    
    return artifacts.length > 0 ? artifacts[0].version + 1 : 1;
  }
  
  async createCloneArtifact(artifact: InsertCloneArtifact): Promise<CloneArtifact> {
    const [newArtifact] = await db.insert(cloneArtifacts).values(artifact).returning();
    return newArtifact;
  }
  
  async activateCloneArtifact(id: string, tenantId: string): Promise<CloneArtifact | undefined> {
    // Deactivate all existing artifacts for this tenant
    await db.update(cloneArtifacts)
      .set({ isActive: false })
      .where(eq(cloneArtifacts.tenantId, tenantId));
    
    // Activate the selected artifact
    const [activated] = await db.update(cloneArtifacts)
      .set({ isActive: true, appliedAt: new Date() })
      .where(eq(cloneArtifacts.id, id))
      .returning();
    
    return activated;
  }
  
  // ========================================
  // AI GOVERNANCE - POLICIES
  // ========================================
  
  async getAiGovernance(id: string): Promise<AiGovernance | undefined> {
    const [policy] = await db.select().from(aiGovernance)
      .where(eq(aiGovernance.id, id))
      .limit(1);
    return policy;
  }
  
  async listAiGovernance(tenantId: string): Promise<AiGovernance[]> {
    return await db.select().from(aiGovernance)
      .where(eq(aiGovernance.tenantId, tenantId))
      .orderBy(desc(aiGovernance.createdAt));
  }
  
  async listActiveAiPolicies(tenantId: string): Promise<AiGovernance[]> {
    return await db.select().from(aiGovernance)
      .where(and(
        eq(aiGovernance.tenantId, tenantId),
        eq(aiGovernance.isActive, true)
      ))
      .orderBy(desc(aiGovernance.createdAt));
  }
  
  async createAiGovernance(policy: InsertAiGovernance): Promise<AiGovernance> {
    const [newPolicy] = await db.insert(aiGovernance).values(policy).returning();
    return newPolicy;
  }
  
  async updateAiGovernance(id: string, data: Partial<InsertAiGovernance>): Promise<AiGovernance | undefined> {
    const [updated] = await db.update(aiGovernance)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiGovernance.id, id))
      .returning();
    return updated;
  }
  
  async deleteAiGovernance(id: string): Promise<void> {
    await db.delete(aiGovernance).where(eq(aiGovernance.id, id));
  }
  
  // ========================================
  // AI TRACES - DECISION HISTORY
  // ========================================
  
  async getAiTrace(id: string): Promise<AiTrace | undefined> {
    const [trace] = await db.select().from(aiTraces)
      .where(eq(aiTraces.id, id))
      .limit(1);
    return trace;
  }
  
  async listAiTraces(filters?: { tenantId?: string; customerId?: string; startDate?: Date; endDate?: Date }): Promise<AiTrace[]> {
    let query = db.select().from(aiTraces);
    
    const conditions = [];
    if (filters?.tenantId) {
      conditions.push(eq(aiTraces.tenantId, filters.tenantId));
    }
    if (filters?.customerId) {
      conditions.push(eq(aiTraces.customerId, filters.customerId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(aiTraces.createdAt));
  }
  
  async createAiTrace(trace: InsertAiTrace): Promise<AiTrace> {
    const [newTrace] = await db.insert(aiTraces).values(trace).returning();
    return newTrace;
  }
  
  // ========================================
  // AI METRICS - AGGREGATED STATS
  // ========================================
  
  async getAiMetric(id: string): Promise<AiMetric | undefined> {
    const [metric] = await db.select().from(aiMetrics)
      .where(eq(aiMetrics.id, id))
      .limit(1);
    return metric;
  }
  
  async listAiMetrics(filters: { tenantId: string; startDate?: Date; endDate?: Date; aggregationPeriod?: string }): Promise<AiMetric[]> {
    const conditions = [eq(aiMetrics.tenantId, filters.tenantId)];
    
    if (filters.aggregationPeriod) {
      conditions.push(eq(aiMetrics.aggregationPeriod, filters.aggregationPeriod));
    }
    
    return await db.select().from(aiMetrics)
      .where(and(...conditions))
      .orderBy(desc(aiMetrics.metricDate));
  }
  
  async createAiMetric(metric: InsertAiMetric): Promise<AiMetric> {
    const [newMetric] = await db.insert(aiMetrics).values(metric).returning();
    return newMetric;
  }
  
  async updateAiMetric(id: string, data: Partial<InsertAiMetric>): Promise<AiMetric | undefined> {
    const [updated] = await db.update(aiMetrics)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiMetrics.id, id))
      .returning();
    return updated;
  }
  
  async getAiMetricsSummary(filters: { tenantId: string; startDate?: Date; endDate?: Date }): Promise<{
    avgFactualScore: number;
    avgNumericScore: number;
    avgEthicalScore: number;
    avgRiskScore: number;
    avgOverallConfidence: number;
    totalTraces: number;
    escalationRate: number;
    passRate: number;
    topViolations: Array<{ violation: string; count: number }>;
    tracesBySource: Array<{ source: string; count: number }>;
  }> {
    const conditions = [eq(aiTraces.tenantId, filters.tenantId)];
    
    if (filters.startDate) {
      conditions.push(gte(aiTraces.createdAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(aiTraces.createdAt, filters.endDate));
    }
    
    // Get all traces for the period
    const traces = await db.select().from(aiTraces)
      .where(and(...conditions));
    
    if (traces.length === 0) {
      return {
        avgFactualScore: 0,
        avgNumericScore: 0,
        avgEthicalScore: 0,
        avgRiskScore: 0,
        avgOverallConfidence: 0,
        totalTraces: 0,
        escalationRate: 0,
        passRate: 0,
        topViolations: [],
        tracesBySource: [],
      };
    }
    
    // Calculate averages
    const totalTraces = traces.length;
    const avgFactualScore = traces.reduce((sum, t) => sum + parseFloat(t.factualScore || '0'), 0) / totalTraces;
    const avgNumericScore = traces.reduce((sum, t) => sum + parseFloat(t.numericScore || '0'), 0) / totalTraces;
    const avgEthicalScore = traces.reduce((sum, t) => sum + parseFloat(t.ethicalScore || '0'), 0) / totalTraces;
    const avgRiskScore = traces.reduce((sum, t) => sum + parseFloat(t.riskScore || '0'), 0) / totalTraces;
    const avgOverallConfidence = traces.reduce((sum, t) => sum + parseFloat(t.overallConfidence || '0'), 0) / totalTraces;
    
    const escalationCount = traces.filter(t => t.shouldEscalateToHuman).length;
    const passCount = traces.filter(t => t.passed).length;
    
    const escalationRate = (escalationCount / totalTraces) * 100;
    const passRate = (passCount / totalTraces) * 100;
    
    // Aggregate violations
    const violationCounts = new Map<string, number>();
    
    traces.forEach(trace => {
      const allViolations = [
        ...(trace.factualViolations as string[] || []),
        ...(trace.numericViolations as string[] || []),
        ...(trace.ethicalViolations as string[] || []),
        ...(trace.riskViolations as string[] || []),
      ];
      
      allViolations.forEach(violation => {
        violationCounts.set(violation, (violationCounts.get(violation) || 0) + 1);
      });
    });
    
    const topViolations = Array.from(violationCounts.entries())
      .map(([violation, count]) => ({ violation, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Count by source
    const sourceCounts = new Map<string, number>();
    traces.forEach(trace => {
      const source = trace.responseSource || 'unknown';
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    });
    
    const tracesBySource = Array.from(sourceCounts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);
    
    return {
      avgFactualScore: Math.round(avgFactualScore * 100) / 100,
      avgNumericScore: Math.round(avgNumericScore * 100) / 100,
      avgEthicalScore: Math.round(avgEthicalScore * 100) / 100,
      avgRiskScore: Math.round(avgRiskScore * 100) / 100,
      avgOverallConfidence: Math.round(avgOverallConfidence * 100) / 100,
      totalTraces,
      escalationRate: Math.round(escalationRate * 100) / 100,
      passRate: Math.round(passRate * 100) / 100,
      topViolations,
      tracesBySource,
    };
  }
  
  // ========================================
  // DASHBOARD KPIS
  // ========================================
  
  async getDashboardKpis(filters: { tenantId: string; startDate?: Date; endDate?: Date }) {
    const { tenantId, startDate, endDate } = filters;
    const now = endDate || new Date();
    const defaultStart = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Calculate previous period for growth comparison
    const periodDuration = now.getTime() - defaultStart.getTime();
    const previousPeriodStart = new Date(defaultStart.getTime() - periodDuration);
    const previousPeriodEnd = defaultStart;
    
    // Current period - Orders with payment data
    let currentOrdersQuery = db
      .select({
        id: orders.id,
        status: orders.status,
        total: orders.total,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(
        gte(orders.createdAt, defaultStart),
        lte(orders.createdAt, now)
      ));
    
    const currentOrders = await currentOrdersQuery;
    const totalOrders = currentOrders.length;
    const totalRevenue = currentOrders.reduce((sum, order) => 
      sum + parseFloat(order.total.toString()), 0
    );
    
    // Previous period - Orders
    let previousOrdersQuery = db
      .select({
        id: orders.id,
        total: orders.total,
      })
      .from(orders)
      .where(and(
        gte(orders.createdAt, previousPeriodStart),
        lte(orders.createdAt, previousPeriodEnd)
      ));
    
    const previousOrders = await previousOrdersQuery;
    const previousTotalOrders = previousOrders.length;
    const previousRevenue = previousOrders.reduce((sum, order) => 
      sum + parseFloat(order.total.toString()), 0
    );
    
    // Calculate growth
    const ordersGrowth = previousTotalOrders > 0 
      ? ((totalOrders - previousTotalOrders) / previousTotalOrders) * 100 
      : 0;
    const revenueGrowth = previousRevenue > 0 
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
      : 0;
    
    // Customers - Current period
    const currentCustomers = await db
      .select()
      .from(customers)
      .where(and(
        gte(customers.createdAt, defaultStart),
        lte(customers.createdAt, now)
      ));
    
    // Customers - Previous period
    const previousCustomers = await db
      .select()
      .from(customers)
      .where(and(
        gte(customers.createdAt, previousPeriodStart),
        lte(customers.createdAt, previousPeriodEnd)
      ));
    
    const totalCustomers = currentCustomers.length;
    const customersGrowth = previousCustomers.length > 0 
      ? ((totalCustomers - previousCustomers.length) / previousCustomers.length) * 100 
      : 0;
    
    // Conversion Rate (orders / customers)
    const conversionRate = totalCustomers > 0 
      ? (totalOrders / totalCustomers) * 100 
      : 0;
    
    // Active Conversations
    const activeConvs = await db
      .select()
      .from(conversations)
      .where(eq(conversations.status, 'open'));
    
    const activeConversations = activeConvs.length;
    
    // Critical Alerts - Low Stock Products
    const lowStockItems = await db
      .select()
      .from(productStock)
      .where(sql`${productStock.quantity} <= ${productStock.minQuantity}`);
    
    // Critical Alerts - Pending Payments
    const pendingPaymentsResult = await db
      .select()
      .from(payments)
      .where(eq(payments.status, 'pending'));
    
    // Critical Alerts - Critics Escalations
    const escalationsResult = await db
      .select()
      .from(aiTraces)
      .where(and(
        eq(aiTraces.tenantId, tenantId),
        eq(aiTraces.shouldEscalateToHuman, true),
        gte(aiTraces.createdAt, defaultStart),
        lte(aiTraces.createdAt, now)
      ));
    
    const criticalAlerts = {
      lowStockProducts: lowStockItems.length,
      pendingPayments: pendingPaymentsResult.length,
      criticsEscalations: escalationsResult.length,
    };
    
    // Sales Trend - Last 7 days (or period duration)
    const trendDays = Math.min(7, Math.ceil(periodDuration / (1000 * 60 * 60 * 24)));
    const salesTrend = [];
    
    for (let i = trendDays - 1; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayOrders = await db
        .select({
          total: orders.total,
        })
        .from(orders)
        .where(and(
          gte(orders.createdAt, dayStart),
          lte(orders.createdAt, dayEnd)
        ));
      
      const dayRevenue = dayOrders.reduce((sum, order) => 
        sum + parseFloat(order.total.toString()), 0
      );
      
      salesTrend.push({
        date: dayStart.toISOString().split('T')[0],
        revenue: Math.round(dayRevenue * 100) / 100,
        orders: dayOrders.length,
      });
    }
    
    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      revenueGrowth: Math.round(revenueGrowth * 100) / 100,
      totalOrders,
      ordersGrowth: Math.round(ordersGrowth * 100) / 100,
      totalCustomers,
      customersGrowth: Math.round(customersGrowth * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
      activeConversations,
      criticalAlerts,
      salesTrend,
    };
  }
}

export const storage = new DbStorage();
