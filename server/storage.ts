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
  type HrLeaveRequest,
  type InsertHrLeaveRequest,
  type WishlistItem,
  type InsertWishlistItem,
  type CrmWorkflow,
  type InsertCrmWorkflow,
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
  type ReportTemplate,
  type InsertReportTemplate,
  type Budget,
  type InsertBudget,
  type ProductReview,
  type InsertProductReview,
  type MessageTemplate,
  type InsertMessageTemplate,
  type PerformanceReview,
  type InsertPerformanceReview,
  type ProductBundle,
  type InsertProductBundle,
  type ProductBundleItem,
  type InsertProductBundleItem,
  type ProductVariantOption,
  type InsertProductVariantOption,
  type ProductVariantValue,
  type InsertProductVariantValue,
  type ProductVariant,
  type InsertProductVariant,
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
  hrLeaveRequests,
  wishlistItems,
  crmWorkflows,
  planSessions,
  planNodes,
  brandJobs,
  themeBundles,
  cloneArtifacts,
  aiGovernance,
  aiTraces,
  aiMetrics,
  reportTemplates,
  budgets,
  interactions,
  performanceReviews,
  productBundles,
  productBundleItems,
  productReviews,
  messageTemplates,
  productVariantOptions,
  productVariantValues,
  productVariants,
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
  
  // Product Variant Options
  listProductVariantOptions(productId: string): Promise<ProductVariantOption[]>;
  getProductVariantOption(id: string): Promise<ProductVariantOption | undefined>;
  createProductVariantOption(option: InsertProductVariantOption): Promise<ProductVariantOption>;
  updateProductVariantOption(id: string, data: Partial<InsertProductVariantOption>): Promise<ProductVariantOption | undefined>;
  deleteProductVariantOption(id: string): Promise<void>;
  
  // Product Variant Values
  listProductVariantValues(optionId: string): Promise<ProductVariantValue[]>;
  getProductVariantValue(id: string): Promise<ProductVariantValue | undefined>;
  createProductVariantValue(value: InsertProductVariantValue): Promise<ProductVariantValue>;
  updateProductVariantValue(id: string, data: Partial<InsertProductVariantValue>): Promise<ProductVariantValue | undefined>;
  deleteProductVariantValue(id: string): Promise<void>;
  
  // Product Variants
  listProductVariants(productId: string): Promise<ProductVariant[]>;
  getProductVariant(id: string): Promise<ProductVariant | undefined>;
  getProductVariantBySku(sku: string): Promise<ProductVariant | undefined>;
  createProductVariant(variant: InsertProductVariant): Promise<ProductVariant>;
  updateProductVariant(id: string, data: Partial<InsertProductVariant>): Promise<ProductVariant | undefined>;
  deleteProductVariant(id: string): Promise<void>;
  
  // Product Reviews
  listProductReviews(productId?: string): Promise<ProductReview[]>;
  getProductReview(id: string): Promise<ProductReview | undefined>;
  createProductReview(review: InsertProductReview): Promise<ProductReview>;
  updateProductReview(id: string, data: Partial<InsertProductReview>): Promise<ProductReview | undefined>;
  deleteProductReview(id: string): Promise<void>;
  getProductAverageRating(productId: string): Promise<number>;
  
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
  
  // Message Templates
  listMessageTemplates(category?: string): Promise<MessageTemplate[]>;
  getMessageTemplate(id: string): Promise<MessageTemplate | undefined>;
  createMessageTemplate(template: InsertMessageTemplate): Promise<MessageTemplate>;
  updateMessageTemplate(id: string, data: Partial<InsertMessageTemplate>): Promise<MessageTemplate | undefined>;
  deleteMessageTemplate(id: string): Promise<void>;
  incrementTemplateUsage(id: string): Promise<void>;
  
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
  generateDREReport(filters?: { startDate?: Date; endDate?: Date }): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    revenueByCategory: Record<string, number>;
    expensesByCategory: Record<string, number>;
  }>;
  
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
  getLowStockAlerts(): Promise<ProductStock[]>;
  
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
  
  // HR - Leave Requests
  listLeaveRequests(filters?: { employeeId?: string; status?: string }): Promise<HrLeaveRequest[]>;
  getLeaveRequest(id: string): Promise<HrLeaveRequest | undefined>;
  createLeaveRequest(request: InsertHrLeaveRequest): Promise<HrLeaveRequest>;
  updateLeaveRequest(id: string, data: Partial<InsertHrLeaveRequest>): Promise<HrLeaveRequest | undefined>;
  approveLeaveRequest(id: string, approvedBy: string): Promise<HrLeaveRequest | undefined>;
  rejectLeaveRequest(id: string, rejectionReason: string): Promise<HrLeaveRequest | undefined>;
  deleteLeaveRequest(id: string): Promise<void>;
  
  // Marketplace - Wishlist
  listWishlistItems(customerId: string): Promise<WishlistItem[]>;
  getWishlistItem(customerId: string, productId: string): Promise<WishlistItem | undefined>;
  addToWishlist(item: InsertWishlistItem): Promise<WishlistItem>;
  removeFromWishlist(customerId: string, productId: string): Promise<void>;
  getAllWishlistsWithDetails(): Promise<any[]>;
  
  // CRM - Workflows
  listCrmWorkflows(): Promise<CrmWorkflow[]>;
  getCrmWorkflow(id: string): Promise<CrmWorkflow | undefined>;
  createCrmWorkflow(workflow: InsertCrmWorkflow): Promise<CrmWorkflow>;
  updateCrmWorkflow(id: string, data: Partial<InsertCrmWorkflow>): Promise<CrmWorkflow | undefined>;
  deleteCrmWorkflow(id: string): Promise<void>;
  executeCrmWorkflow(id: string): Promise<CrmWorkflow | undefined>;
  
  // AI - Knowledge Base Advanced
  bulkImportKnowledgeBase(items: InsertKnowledgeBase[]): Promise<KnowledgeBase[]>;
  searchKnowledgeBase(query: string, filters?: { category?: string; limit?: number }): Promise<KnowledgeBase[]>;
  
  // Calendar - Resource Scheduling
  checkResourceConflicts(resourceId: string, startTime: Date, endTime: Date, excludeEventId?: string): Promise<CalendarEvent[]>;
  listResourceAvailability(resourceId: string, date: Date): Promise<{ busy: CalendarEvent[]; available: boolean }>;
  
  // Reports - Custom Report Templates
  listReportTemplates(type?: string): Promise<ReportTemplate[]>;
  getReportTemplate(id: string): Promise<ReportTemplate | undefined>;
  createReportTemplate(template: InsertReportTemplate): Promise<ReportTemplate>;
  updateReportTemplate(id: string, data: Partial<InsertReportTemplate>): Promise<ReportTemplate | undefined>;
  deleteReportTemplate(id: string): Promise<void>;
  
  // Inventory - Stock Transfers
  createStockTransfer(productId: string, fromWarehouseId: string, toWarehouseId: string, quantity: number, userId: string, notes?: string): Promise<{ success: true; movements: StockMovement[] }>;
  
  // Finance - Budget Tracking
  listBudgets(filters?: { period?: string; category?: string; startDate?: Date; endDate?: Date }): Promise<Budget[]>;
  getBudget(id: string): Promise<Budget | undefined>;
  createBudget(budget: InsertBudget): Promise<Budget>;
  updateBudget(id: string, data: Partial<InsertBudget>): Promise<Budget | undefined>;
  deleteBudget(id: string): Promise<void>;
  updateBudgetActual(id: string, actualAmount: number): Promise<Budget | undefined>;
  
  // CRM - Lead Scoring Automation
  calculateLeadScore(customerId: string): Promise<Customer>;
  listTopLeads(limit?: number): Promise<Customer[]>;
  
  // HR - Performance Reviews
  listPerformanceReviews(filters?: { employeeId?: string; reviewerId?: string; status?: string; reviewCycle?: string }): Promise<PerformanceReview[]>;
  getPerformanceReview(id: string): Promise<PerformanceReview | undefined>;
  createPerformanceReview(review: InsertPerformanceReview): Promise<PerformanceReview>;
  updatePerformanceReview(id: string, data: Partial<InsertPerformanceReview>): Promise<PerformanceReview | undefined>;
  updatePerformanceReviewStatus(id: string, status: string, completedDate?: Date): Promise<PerformanceReview | undefined>;
  deletePerformanceReview(id: string): Promise<void>;
  
  // Marketplace - Product Bundles
  listProductBundles(filters?: { isActive?: boolean }): Promise<ProductBundle[]>;
  getProductBundle(id: string): Promise<ProductBundle | undefined>;
  getProductBundleWithItems(id: string): Promise<{ bundle: ProductBundle; items: (ProductBundleItem & { product?: any })[] } | undefined>;
  createProductBundle(bundle: InsertProductBundle, items: InsertProductBundleItem[]): Promise<ProductBundle>;
  updateProductBundle(id: string, data: Partial<InsertProductBundle>): Promise<ProductBundle | undefined>;
  addItemToBundle(bundleId: string, productId: string, quantity: number): Promise<ProductBundleItem>;
  removeItemFromBundle(bundleId: string, itemId: string): Promise<void>;
  deleteProductBundle(id: string): Promise<void>;
  
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

  // Product Variant Options
  async listProductVariantOptions(productId: string): Promise<ProductVariantOption[]> {
    return await db.select().from(productVariantOptions)
      .where(eq(productVariantOptions.productId, productId))
      .orderBy(productVariantOptions.displayOrder);
  }

  async getProductVariantOption(id: string): Promise<ProductVariantOption | undefined> {
    const result = await db.select().from(productVariantOptions)
      .where(eq(productVariantOptions.id, id))
      .limit(1);
    return result[0];
  }

  async createProductVariantOption(option: InsertProductVariantOption): Promise<ProductVariantOption> {
    const result = await db.insert(productVariantOptions).values(option).returning();
    return result[0];
  }

  async updateProductVariantOption(id: string, data: Partial<InsertProductVariantOption>): Promise<ProductVariantOption | undefined> {
    const result = await db.update(productVariantOptions)
      .set(data)
      .where(eq(productVariantOptions.id, id))
      .returning();
    return result[0];
  }

  async deleteProductVariantOption(id: string): Promise<void> {
    await db.delete(productVariantOptions).where(eq(productVariantOptions.id, id));
  }

  // Product Variant Values
  async listProductVariantValues(optionId: string): Promise<ProductVariantValue[]> {
    return await db.select().from(productVariantValues)
      .where(eq(productVariantValues.optionId, optionId))
      .orderBy(productVariantValues.displayOrder);
  }

  async getProductVariantValue(id: string): Promise<ProductVariantValue | undefined> {
    const result = await db.select().from(productVariantValues)
      .where(eq(productVariantValues.id, id))
      .limit(1);
    return result[0];
  }

  async createProductVariantValue(value: InsertProductVariantValue): Promise<ProductVariantValue> {
    const result = await db.insert(productVariantValues).values(value).returning();
    return result[0];
  }

  async updateProductVariantValue(id: string, data: Partial<InsertProductVariantValue>): Promise<ProductVariantValue | undefined> {
    const result = await db.update(productVariantValues)
      .set(data)
      .where(eq(productVariantValues.id, id))
      .returning();
    return result[0];
  }

  async deleteProductVariantValue(id: string): Promise<void> {
    await db.delete(productVariantValues).where(eq(productVariantValues.id, id));
  }

  // Product Variants
  async listProductVariants(productId: string): Promise<ProductVariant[]> {
    return await db.select().from(productVariants)
      .where(eq(productVariants.productId, productId))
      .orderBy(productVariants.createdAt);
  }

  async getProductVariant(id: string): Promise<ProductVariant | undefined> {
    const result = await db.select().from(productVariants)
      .where(eq(productVariants.id, id))
      .limit(1);
    return result[0];
  }

  async getProductVariantBySku(sku: string): Promise<ProductVariant | undefined> {
    const result = await db.select().from(productVariants)
      .where(eq(productVariants.sku, sku))
      .limit(1);
    return result[0];
  }

  async createProductVariant(variant: InsertProductVariant): Promise<ProductVariant> {
    const result = await db.insert(productVariants).values(variant).returning();
    return result[0];
  }

  async updateProductVariant(id: string, data: Partial<InsertProductVariant>): Promise<ProductVariant | undefined> {
    const result = await db.update(productVariants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productVariants.id, id))
      .returning();
    return result[0];
  }

  async deleteProductVariant(id: string): Promise<void> {
    await db.delete(productVariants).where(eq(productVariants.id, id));
  }

  // Product Reviews
  async listProductReviews(productId?: string): Promise<ProductReview[]> {
    if (productId) {
      return await db.select().from(productReviews)
        .where(eq(productReviews.productId, productId))
        .orderBy(desc(productReviews.createdAt));
    }
    return await db.select().from(productReviews)
      .orderBy(desc(productReviews.createdAt));
  }

  async getProductReview(id: string): Promise<ProductReview | undefined> {
    const result = await db.select().from(productReviews)
      .where(eq(productReviews.id, id));
    return result[0];
  }

  async createProductReview(review: InsertProductReview): Promise<ProductReview> {
    const result = await db.insert(productReviews).values(review).returning();
    return result[0];
  }

  async updateProductReview(id: string, data: Partial<InsertProductReview>): Promise<ProductReview | undefined> {
    const result = await db.update(productReviews)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productReviews.id, id))
      .returning();
    return result[0];
  }

  async deleteProductReview(id: string): Promise<void> {
    await db.delete(productReviews).where(eq(productReviews.id, id));
  }

  async getProductAverageRating(productId: string): Promise<number> {
    const reviews = await db.select().from(productReviews)
      .where(and(
        eq(productReviews.productId, productId),
        eq(productReviews.isApproved, true)
      ));
    
    if (reviews.length === 0) return 0;
    
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / reviews.length;
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

  // Message Templates
  async listMessageTemplates(category?: string): Promise<MessageTemplate[]> {
    if (category) {
      return await db.select().from(messageTemplates)
        .where(and(eq(messageTemplates.category, category), eq(messageTemplates.isActive, true)))
        .orderBy(desc(messageTemplates.usageCount));
    }
    return await db.select().from(messageTemplates)
      .where(eq(messageTemplates.isActive, true))
      .orderBy(desc(messageTemplates.usageCount));
  }

  async getMessageTemplate(id: string): Promise<MessageTemplate | undefined> {
    const result = await db.select().from(messageTemplates)
      .where(eq(messageTemplates.id, id));
    return result[0];
  }

  async createMessageTemplate(template: InsertMessageTemplate): Promise<MessageTemplate> {
    const result = await db.insert(messageTemplates).values(template).returning();
    return result[0];
  }

  async updateMessageTemplate(id: string, data: Partial<InsertMessageTemplate>): Promise<MessageTemplate | undefined> {
    const result = await db.update(messageTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(messageTemplates.id, id))
      .returning();
    return result[0];
  }

  async deleteMessageTemplate(id: string): Promise<void> {
    await db.delete(messageTemplates).where(eq(messageTemplates.id, id));
  }

  async incrementTemplateUsage(id: string): Promise<void> {
    await db.update(messageTemplates)
      .set({ usageCount: sql`${messageTemplates.usageCount} + 1` })
      .where(eq(messageTemplates.id, id));
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

  async generateDREReport(filters?: { startDate?: Date; endDate?: Date }): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    revenueByCategory: Record<string, number>;
    expensesByCategory: Record<string, number>;
  }> {
    let conditions: any[] = [];
    
    if (filters?.startDate) {
      conditions.push(gte(financialTransactions.date, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(financialTransactions.date, filters.endDate));
    }

    const transactions = conditions.length > 0
      ? await db.select().from(financialTransactions).where(and(...conditions))
      : await db.select().from(financialTransactions);

    let totalRevenue = 0;
    let totalExpenses = 0;
    const revenueByCategory: Record<string, number> = {};
    const expensesByCategory: Record<string, number> = {};

    for (const transaction of transactions) {
      const amount = parseFloat(transaction.amount);
      const category = transaction.category || 'Sem Categoria';

      if (transaction.type === 'revenue') {
        totalRevenue += amount;
        revenueByCategory[category] = (revenueByCategory[category] || 0) + amount;
      } else if (transaction.type === 'expense') {
        totalExpenses += amount;
        expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
      }
    }

    return {
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
      revenueByCategory,
      expensesByCategory,
    };
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

  async getLowStockAlerts(): Promise<ProductStock[]> {
    // Return all stock where quantity is below minQuantity
    return await db.select().from(productStock)
      .where(sql`${productStock.quantity} < ${productStock.minQuantity}`)
      .orderBy(desc(productStock.updatedAt));
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
  // HR - LEAVE REQUESTS
  // ========================================
  
  async listLeaveRequests(filters?: { employeeId?: string; status?: string }): Promise<HrLeaveRequest[]> {
    let conditions: any[] = [];
    
    if (filters?.employeeId) {
      conditions.push(eq(hrLeaveRequests.employeeId, filters.employeeId));
    }
    if (filters?.status) {
      conditions.push(eq(hrLeaveRequests.status, filters.status as any));
    }
    
    const query = conditions.length > 0
      ? db.select().from(hrLeaveRequests).where(and(...conditions))
      : db.select().from(hrLeaveRequests);
    
    return await query.orderBy(desc(hrLeaveRequests.createdAt));
  }
  
  async getLeaveRequest(id: string): Promise<HrLeaveRequest | undefined> {
    const [request] = await db.select().from(hrLeaveRequests)
      .where(eq(hrLeaveRequests.id, id));
    return request;
  }
  
  async createLeaveRequest(request: InsertHrLeaveRequest): Promise<HrLeaveRequest> {
    const [newRequest] = await db.insert(hrLeaveRequests).values(request).returning();
    return newRequest;
  }
  
  async updateLeaveRequest(id: string, data: Partial<InsertHrLeaveRequest>): Promise<HrLeaveRequest | undefined> {
    const [updated] = await db.update(hrLeaveRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(hrLeaveRequests.id, id))
      .returning();
    return updated;
  }
  
  async approveLeaveRequest(id: string, approvedBy: string): Promise<HrLeaveRequest | undefined> {
    const [approved] = await db.update(hrLeaveRequests)
      .set({ 
        status: 'approved' as any,
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(hrLeaveRequests.id, id))
      .returning();
    return approved;
  }
  
  async rejectLeaveRequest(id: string, rejectionReason: string): Promise<HrLeaveRequest | undefined> {
    const [rejected] = await db.update(hrLeaveRequests)
      .set({ 
        status: 'rejected' as any,
        rejectionReason,
        updatedAt: new Date()
      })
      .where(eq(hrLeaveRequests.id, id))
      .returning();
    return rejected;
  }
  
  async deleteLeaveRequest(id: string): Promise<void> {
    await db.delete(hrLeaveRequests)
      .where(eq(hrLeaveRequests.id, id));
  }
  
  // ========================================
  // MARKETPLACE - WISHLIST
  // ========================================
  
  async listWishlistItems(customerId: string): Promise<WishlistItem[]> {
    return await db.select().from(wishlistItems)
      .where(eq(wishlistItems.customerId, customerId))
      .orderBy(desc(wishlistItems.addedAt));
  }
  
  async getWishlistItem(customerId: string, productId: string): Promise<WishlistItem | undefined> {
    const [item] = await db.select().from(wishlistItems)
      .where(and(
        eq(wishlistItems.customerId, customerId),
        eq(wishlistItems.productId, productId)
      ));
    return item;
  }
  
  async addToWishlist(item: InsertWishlistItem): Promise<WishlistItem> {
    const [newItem] = await db.insert(wishlistItems).values(item).returning();
    return newItem;
  }
  
  async removeFromWishlist(customerId: string, productId: string): Promise<void> {
    await db.delete(wishlistItems)
      .where(and(
        eq(wishlistItems.customerId, customerId),
        eq(wishlistItems.productId, productId)
      ));
  }

  async getAllWishlistsWithDetails(): Promise<any[]> {
    const items = await db
      .select({
        id: wishlistItems.id,
        customerId: wishlistItems.customerId,
        productId: wishlistItems.productId,
        addedAt: wishlistItems.addedAt,
        customerName: users.name,
        customerEmail: users.email,
        productName: products.name,
        productPrice: products.price,
        productImage: products.imageUrl,
      })
      .from(wishlistItems)
      .leftJoin(users, eq(wishlistItems.customerId, users.id))
      .leftJoin(products, eq(wishlistItems.productId, products.id))
      .orderBy(desc(wishlistItems.addedAt));
    
    return items;
  }
  
  // ========================================
  // CRM - WORKFLOWS
  // ========================================
  
  async listCrmWorkflows(): Promise<CrmWorkflow[]> {
    return await db.select().from(crmWorkflows)
      .orderBy(desc(crmWorkflows.createdAt));
  }
  
  async getCrmWorkflow(id: string): Promise<CrmWorkflow | undefined> {
    const [workflow] = await db.select().from(crmWorkflows)
      .where(eq(crmWorkflows.id, id));
    return workflow;
  }
  
  async createCrmWorkflow(workflow: InsertCrmWorkflow): Promise<CrmWorkflow> {
    const [newWorkflow] = await db.insert(crmWorkflows).values(workflow).returning();
    return newWorkflow;
  }
  
  async updateCrmWorkflow(id: string, data: Partial<InsertCrmWorkflow>): Promise<CrmWorkflow | undefined> {
    const [updated] = await db.update(crmWorkflows)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crmWorkflows.id, id))
      .returning();
    return updated;
  }
  
  async deleteCrmWorkflow(id: string): Promise<void> {
    await db.delete(crmWorkflows)
      .where(eq(crmWorkflows.id, id));
  }
  
  async executeCrmWorkflow(id: string): Promise<CrmWorkflow | undefined> {
    const [executed] = await db.update(crmWorkflows)
      .set({ 
        lastExecutedAt: new Date(),
        executionCount: sql`${crmWorkflows.executionCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(crmWorkflows.id, id))
      .returning();
    return executed;
  }
  
  // ========================================
  // AI - KNOWLEDGE BASE ADVANCED
  // ========================================
  
  async bulkImportKnowledgeBase(items: InsertKnowledgeBase[]): Promise<KnowledgeBase[]> {
    if (items.length === 0) return [];
    const inserted = await db.insert(knowledgeBase).values(items).returning();
    return inserted;
  }
  
  async searchKnowledgeBase(query: string, filters?: { category?: string; limit?: number }): Promise<KnowledgeBase[]> {
    const lowerQuery = query.toLowerCase();
    let results = await db.select().from(knowledgeBase);
    
    results = results.filter(item => 
      item.question.toLowerCase().includes(lowerQuery) ||
      item.answer.toLowerCase().includes(lowerQuery) ||
      (item.tags && item.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
    );
    
    if (filters?.category) {
      results = results.filter(item => item.category === filters.category);
    }
    
    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }
    
    return results;
  }
  
  // ========================================
  // CALENDAR - RESOURCE SCHEDULING
  // ========================================
  
  async checkResourceConflicts(resourceId: string, startTime: Date, endTime: Date, excludeEventId?: string): Promise<CalendarEvent[]> {
    let query = db.select().from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.resourceId, resourceId),
          sql`${calendarEvents.startTime} < ${endTime}`,
          sql`${calendarEvents.endTime} > ${startTime}`
        )
      );
    
    const events = await query;
    
    if (excludeEventId) {
      return events.filter(event => event.id !== excludeEventId);
    }
    
    return events;
  }
  
  async listResourceAvailability(resourceId: string, date: Date): Promise<{ busy: CalendarEvent[]; available: boolean }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const busy = await db.select().from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.resourceId, resourceId),
          sql`${calendarEvents.startTime} < ${endOfDay}`,
          sql`${calendarEvents.endTime} > ${startOfDay}`
        )
      )
      .orderBy(calendarEvents.startTime);
    
    return {
      busy,
      available: busy.length === 0
    };
  }
  
  // ========================================
  // REPORTS - CUSTOM REPORT TEMPLATES
  // ========================================
  
  async listReportTemplates(type?: string): Promise<ReportTemplate[]> {
    if (type) {
      return await db.select().from(reportTemplates)
        .where(eq(reportTemplates.reportType, type as any))
        .orderBy(desc(reportTemplates.createdAt));
    }
    return await db.select().from(reportTemplates)
      .orderBy(desc(reportTemplates.createdAt));
  }
  
  async getReportTemplate(id: string): Promise<ReportTemplate | undefined> {
    const [template] = await db.select().from(reportTemplates)
      .where(eq(reportTemplates.id, id))
      .limit(1);
    return template;
  }
  
  async createReportTemplate(template: InsertReportTemplate): Promise<ReportTemplate> {
    const [created] = await db.insert(reportTemplates)
      .values(template)
      .returning();
    return created;
  }
  
  async updateReportTemplate(id: string, data: Partial<InsertReportTemplate>): Promise<ReportTemplate | undefined> {
    const [updated] = await db.update(reportTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(reportTemplates.id, id))
      .returning();
    return updated;
  }
  
  async deleteReportTemplate(id: string): Promise<void> {
    await db.delete(reportTemplates)
      .where(eq(reportTemplates.id, id));
  }
  
  // ========================================
  // INVENTORY - STOCK TRANSFERS
  // ========================================
  
  async createStockTransfer(
    productId: string, 
    fromWarehouseId: string, 
    toWarehouseId: string, 
    quantity: number, 
    userId: string, 
    notes?: string
  ): Promise<{ success: true; movements: StockMovement[] }> {
    // Validate warehouses exist (outside transaction for early fail)
    const [fromWarehouse] = await db.select().from(warehouses)
      .where(eq(warehouses.id, fromWarehouseId))
      .limit(1);
    const [toWarehouse] = await db.select().from(warehouses)
      .where(eq(warehouses.id, toWarehouseId))
      .limit(1);
    
    if (!fromWarehouse) {
      throw new Error("Warehouse de origem não encontrado");
    }
    if (!toWarehouse) {
      throw new Error("Warehouse de destino não encontrado");
    }
    
    // Execute transfer in transaction for atomicity
    return await db.transaction(async (tx) => {
      // Get current stock at source warehouse
      const [sourceStock] = await tx.select().from(productStock)
        .where(and(
          eq(productStock.productId, productId),
          eq(productStock.warehouseId, fromWarehouseId)
        ))
        .limit(1);
      
      if (!sourceStock || sourceStock.quantity < quantity) {
        throw new Error(`Estoque insuficiente no warehouse de origem. Disponível: ${sourceStock?.quantity || 0}, Solicitado: ${quantity}`);
      }
      
      // Get or create destination stock
      let [destStock] = await tx.select().from(productStock)
        .where(and(
          eq(productStock.productId, productId),
          eq(productStock.warehouseId, toWarehouseId)
        ))
        .limit(1);
      
      if (!destStock) {
        [destStock] = await tx.insert(productStock)
          .values({
            productId,
            warehouseId: toWarehouseId,
            quantity: 0,
            minQuantity: 0
          })
          .returning();
      }
      
      // Calculate new quantities
      const newSourceQty = sourceStock.quantity - quantity;
      const newDestQty = destStock.quantity + quantity;
      
      // Movement OUT from source
      const [movementOut] = await tx.insert(stockMovements)
        .values({
          productId,
          warehouseId: fromWarehouseId,
          type: "transfer",
          quantity: -quantity,
          previousQuantity: sourceStock.quantity,
          newQuantity: newSourceQty,
          userId,
          notes: notes || `Transferência para ${toWarehouse.name}`,
          relatedWarehouseId: toWarehouseId,
        })
        .returning();
      
      // Movement IN to destination
      const [movementIn] = await tx.insert(stockMovements)
        .values({
          productId,
          warehouseId: toWarehouseId,
          type: "transfer",
          quantity: quantity,
          previousQuantity: destStock.quantity,
          newQuantity: newDestQty,
          userId,
          notes: notes || `Transferência de ${fromWarehouse.name}`,
          relatedWarehouseId: fromWarehouseId,
        })
        .returning();
      
      // Update stock quantities
      await tx.update(productStock)
        .set({ quantity: newSourceQty, updatedAt: new Date() })
        .where(eq(productStock.id, sourceStock.id));
      
      await tx.update(productStock)
        .set({ quantity: newDestQty, updatedAt: new Date() })
        .where(eq(productStock.id, destStock.id));
      
      return {
        success: true,
        movements: [movementOut, movementIn]
      };
    });
  }
  
  // ========================================
  // FINANCE - BUDGET TRACKING
  // ========================================
  
  async listBudgets(filters?: { period?: string; category?: string; startDate?: Date; endDate?: Date }): Promise<Budget[]> {
    let query = db.select().from(budgets);
    const conditions: any[] = [];
    
    if (filters?.period) {
      conditions.push(eq(budgets.period, filters.period as any));
    }
    if (filters?.category) {
      conditions.push(eq(budgets.category, filters.category as any));
    }
    if (filters?.startDate) {
      conditions.push(gte(budgets.startDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(budgets.endDate, filters.endDate));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(budgets.createdAt));
  }
  
  async getBudget(id: string): Promise<Budget | undefined> {
    const [budget] = await db.select().from(budgets)
      .where(eq(budgets.id, id))
      .limit(1);
    return budget;
  }
  
  async createBudget(budget: InsertBudget): Promise<Budget> {
    const [created] = await db.insert(budgets)
      .values(budget)
      .returning();
    return created;
  }
  
  async updateBudget(id: string, data: Partial<InsertBudget>): Promise<Budget | undefined> {
    const [updated] = await db.update(budgets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(budgets.id, id))
      .returning();
    return updated;
  }
  
  async deleteBudget(id: string): Promise<void> {
    await db.delete(budgets)
      .where(eq(budgets.id, id));
  }
  
  async updateBudgetActual(id: string, actualAmount: number): Promise<Budget | undefined> {
    const [updated] = await db.update(budgets)
      .set({ actualAmount: actualAmount.toString(), updatedAt: new Date() })
      .where(eq(budgets.id, id))
      .returning();
    return updated;
  }
  
  // ========================================
  // CRM - LEAD SCORING AUTOMATION
  // ========================================
  
  async calculateLeadScore(customerId: string): Promise<Customer> {
    const [customer] = await db.select().from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    
    if (!customer) {
      throw new Error("Customer não encontrado");
    }
    
    // Calculate Engagement Score (0-100) based on interactions
    const customerInteractions = await db.select().from(interactions)
      .where(eq(interactions.customerId, customerId));
    
    let engagementScore = 0;
    
    // Base score from interaction count (max 40 points)
    const interactionCount = customerInteractions.length;
    engagementScore += Math.min(interactionCount * 5, 40);
    
    // Recency bonus (max 30 points)
    if (customerInteractions.length > 0) {
      const latestInteraction = customerInteractions.reduce((latest, current) => {
        return current.createdAt > latest.createdAt ? current : latest;
      });
      
      const daysSinceLastInteraction = Math.floor(
        (Date.now() - latestInteraction.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastInteraction <= 7) {
        engagementScore += 30;
      } else if (daysSinceLastInteraction <= 30) {
        engagementScore += 20;
      } else if (daysSinceLastInteraction <= 90) {
        engagementScore += 10;
      }
    }
    
    // Diversity bonus (different channels, max 30 points)
    const uniqueChannels = new Set(customerInteractions.map(i => i.channel).filter(Boolean));
    engagementScore += Math.min(uniqueChannels.size * 10, 30);
    
    engagementScore = Math.min(engagementScore, 100);
    
    // Calculate Demographic Score (0-100) based on metadata
    let demographicScore = 0;
    const metadata = customer.metadata as any || {};
    
    // Has email (20 points)
    if (customer.email) demographicScore += 20;
    
    // Has phone/whatsapp (20 points)
    if (customer.phone || customer.whatsapp) demographicScore += 20;
    
    // Has location/company data in metadata (20 points each)
    if (metadata.location || metadata.city || metadata.country) demographicScore += 20;
    if (metadata.company || metadata.companySize) demographicScore += 20;
    
    // Has tags (20 points)
    if (customer.tags && customer.tags.length > 0) demographicScore += 20;
    
    demographicScore = Math.min(demographicScore, 100);
    
    // Combined Lead Score (weighted average: 60% engagement, 40% demographic)
    const leadScore = Math.round((engagementScore * 0.6) + (demographicScore * 0.4));
    
    // Update customer
    const [updated] = await db.update(customers)
      .set({
        leadScore,
        engagementScore,
        demographicScore,
        lastScoreUpdate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId))
      .returning();
    
    return updated;
  }
  
  async listTopLeads(limit: number = 10): Promise<Customer[]> {
    return await db.select().from(customers)
      .where(eq(customers.lifecycleStage, "lead"))
      .orderBy(desc(customers.leadScore))
      .limit(limit);
  }
  
  // ========================================
  // HR - PERFORMANCE REVIEWS
  // ========================================
  
  async listPerformanceReviews(filters?: { 
    employeeId?: string; 
    reviewerId?: string; 
    status?: string; 
    reviewCycle?: string;
  }): Promise<PerformanceReview[]> {
    const conditions = [];
    
    if (filters?.employeeId) {
      conditions.push(eq(performanceReviews.employeeId, filters.employeeId));
    }
    if (filters?.reviewerId) {
      conditions.push(eq(performanceReviews.reviewerId, filters.reviewerId));
    }
    if (filters?.status) {
      conditions.push(sql`${performanceReviews.status}::text = ${filters.status}`);
    }
    if (filters?.reviewCycle) {
      conditions.push(eq(performanceReviews.reviewCycle, filters.reviewCycle));
    }
    
    const query = conditions.length > 0
      ? db.select().from(performanceReviews).where(and(...conditions))
      : db.select().from(performanceReviews);
    
    return await query.orderBy(desc(performanceReviews.createdAt));
  }
  
  async getPerformanceReview(id: string): Promise<PerformanceReview | undefined> {
    const [review] = await db.select().from(performanceReviews)
      .where(eq(performanceReviews.id, id))
      .limit(1);
    return review;
  }
  
  async createPerformanceReview(review: InsertPerformanceReview): Promise<PerformanceReview> {
    const [created] = await db.insert(performanceReviews)
      .values(review)
      .returning();
    return created;
  }
  
  async updatePerformanceReview(
    id: string, 
    data: Partial<InsertPerformanceReview>
  ): Promise<PerformanceReview | undefined> {
    const [updated] = await db.update(performanceReviews)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(performanceReviews.id, id))
      .returning();
    return updated;
  }
  
  async updatePerformanceReviewStatus(
    id: string, 
    status: string, 
    completedDate?: Date
  ): Promise<PerformanceReview | undefined> {
    const updateData: any = {
      status: sql`${status}::performance_review_status`,
      updatedAt: new Date(),
    };
    
    if (status === 'completed' && completedDate) {
      updateData.completedDate = completedDate;
    }
    
    const [updated] = await db.update(performanceReviews)
      .set(updateData)
      .where(eq(performanceReviews.id, id))
      .returning();
    return updated;
  }
  
  async deletePerformanceReview(id: string): Promise<void> {
    await db.delete(performanceReviews)
      .where(eq(performanceReviews.id, id));
  }
  
  // ========================================
  // MARKETPLACE - PRODUCT BUNDLES
  // ========================================
  
  async listProductBundles(filters?: { isActive?: boolean }): Promise<ProductBundle[]> {
    const conditions = [];
    
    if (filters?.isActive !== undefined) {
      conditions.push(eq(productBundles.isActive, filters.isActive));
    }
    
    const query = conditions.length > 0
      ? db.select().from(productBundles).where(and(...conditions))
      : db.select().from(productBundles);
    
    return await query.orderBy(desc(productBundles.createdAt));
  }
  
  async getProductBundle(id: string): Promise<ProductBundle | undefined> {
    const [bundle] = await db.select().from(productBundles)
      .where(eq(productBundles.id, id))
      .limit(1);
    return bundle;
  }
  
  async getProductBundleWithItems(id: string): Promise<{ bundle: ProductBundle; items: (ProductBundleItem & { product?: any })[] } | undefined> {
    const [bundle] = await db.select().from(productBundles)
      .where(eq(productBundles.id, id))
      .limit(1);
    
    if (!bundle) {
      return undefined;
    }
    
    // Get all items for this bundle with product details
    const items = await db.select({
      id: productBundleItems.id,
      bundleId: productBundleItems.bundleId,
      productId: productBundleItems.productId,
      quantity: productBundleItems.quantity,
      createdAt: productBundleItems.createdAt,
      product: products,
    })
    .from(productBundleItems)
    .leftJoin(products, eq(productBundleItems.productId, products.id))
    .where(eq(productBundleItems.bundleId, id));
    
    return { bundle, items };
  }
  
  async createProductBundle(
    bundle: InsertProductBundle, 
    items: InsertProductBundleItem[]
  ): Promise<ProductBundle> {
    // Validate all products exist before creating bundle
    const productIds = items.map(item => item.productId);
    const uniqueProductIds = [...new Set(productIds)];
    
    const existingProducts = await db.select({ id: products.id })
      .from(products)
      .where(sql`${products.id} = ANY(${uniqueProductIds})`);
    
    const existingProductIds = new Set(existingProducts.map(p => p.id));
    const missingProductIds = uniqueProductIds.filter(id => !existingProductIds.has(id));
    
    if (missingProductIds.length > 0) {
      throw new Error(`Products não encontrados: ${missingProductIds.join(', ')}`);
    }
    
    // Use transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      // Create bundle
      const [createdBundle] = await tx.insert(productBundles)
        .values(bundle)
        .returning();
      
      // Create all bundle items
      if (items.length > 0) {
        const itemsWithBundleId = items.map(item => ({
          ...item,
          bundleId: createdBundle.id,
        }));
        
        await tx.insert(productBundleItems)
          .values(itemsWithBundleId);
      }
      
      return createdBundle;
    });
  }
  
  async updateProductBundle(
    id: string, 
    data: Partial<InsertProductBundle>
  ): Promise<ProductBundle | undefined> {
    const [updated] = await db.update(productBundles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productBundles.id, id))
      .returning();
    return updated;
  }
  
  async addItemToBundle(
    bundleId: string, 
    productId: string, 
    quantity: number
  ): Promise<ProductBundleItem> {
    // Validate bundle exists
    const bundle = await this.getProductBundle(bundleId);
    if (!bundle) {
      throw new Error("Bundle não encontrado");
    }
    
    // Validate product exists
    const [product] = await db.select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    
    if (!product) {
      throw new Error("Product não encontrado");
    }
    
    const [item] = await db.insert(productBundleItems)
      .values({
        bundleId,
        productId,
        quantity,
      })
      .returning();
    return item;
  }
  
  async removeItemFromBundle(bundleId: string, itemId: string): Promise<void> {
    await db.delete(productBundleItems)
      .where(
        and(
          eq(productBundleItems.id, itemId),
          eq(productBundleItems.bundleId, bundleId)
        )
      );
  }
  
  async deleteProductBundle(id: string): Promise<void> {
    await db.delete(productBundles)
      .where(eq(productBundles.id, id));
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
