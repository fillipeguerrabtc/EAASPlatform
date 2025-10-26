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
  type UserTenant,
  type InsertUserTenant,
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
  userTenants,
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
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // Users & Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string, tenantId?: string): Promise<User | undefined>;
  getUserByReplitAuthId(replitAuthId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  getUserTenants(userId: string): Promise<UserTenant[]>;
  addUserToTenant(userTenant: InsertUserTenant): Promise<UserTenant>;
  
  // Tenants
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined>;
  getTenantByTwilioNumber(twilioNumber: string): Promise<Tenant | undefined>;
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
  listPayments(tenantId: string): Promise<Payment[]>;
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
  getActiveCart(customerId: string, tenantId: string): Promise<Cart | undefined>;
  createCart(cart: InsertCart): Promise<Cart>;
  updateCart(id: string, tenantId: string, data: Partial<InsertCart>): Promise<Cart | undefined>;
  
  // Calendar Events
  listCalendarEvents(tenantId: string): Promise<CalendarEvent[]>;
  getCalendarEvent(id: string, tenantId: string): Promise<CalendarEvent | undefined>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, tenantId: string, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: string, tenantId: string): Promise<void>;
  
  // Categories
  listCategories(tenantId: string): Promise<Category[]>;
  getCategory(id: string, tenantId: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, tenantId: string, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string, tenantId: string): Promise<void>;
  
  // Financial Accounts
  listFinancialAccounts(tenantId: string): Promise<FinancialAccount[]>;
  getFinancialAccount(id: string, tenantId: string): Promise<FinancialAccount | undefined>;
  createFinancialAccount(account: InsertFinancialAccount): Promise<FinancialAccount>;
  updateFinancialAccount(id: string, tenantId: string, data: Partial<InsertFinancialAccount>): Promise<FinancialAccount | undefined>;
  deleteFinancialAccount(id: string, tenantId: string): Promise<void>;
  
  // Financial Transactions
  listFinancialTransactions(tenantId: string, filters?: { type?: string; startDate?: Date; endDate?: Date }): Promise<FinancialTransaction[]>;
  getFinancialTransaction(id: string, tenantId: string): Promise<FinancialTransaction | undefined>;
  createFinancialTransaction(transaction: InsertFinancialTransaction): Promise<FinancialTransaction>;
  updateFinancialTransaction(id: string, tenantId: string, data: Partial<InsertFinancialTransaction>): Promise<FinancialTransaction | undefined>;
  deleteFinancialTransaction(id: string, tenantId: string): Promise<void>;
  
  // RBAC
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: string, tenantId: string, role: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(id: string, tenantId: string): Promise<boolean>;
  listRoles(tenantId: string): Promise<Role[]>;
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
  listPipelineStages(tenantId: string): Promise<PipelineStage[]>;
  getPipelineStage(id: string, tenantId: string): Promise<PipelineStage | undefined>;
  createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage>;
  updatePipelineStage(id: string, tenantId: string, data: Partial<InsertPipelineStage>): Promise<PipelineStage | undefined>;
  deletePipelineStage(id: string, tenantId: string): Promise<void>;
  
  // Deals
  listDeals(tenantId: string): Promise<Deal[]>;
  getDeal(id: string, tenantId: string): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: string, tenantId: string, data: Partial<InsertDeal>): Promise<Deal | undefined>;
  deleteDeal(id: string, tenantId: string): Promise<void>;
  
  // Customer Segments
  listCustomerSegments(tenantId: string): Promise<CustomerSegment[]>;
  getCustomerSegment(id: string, tenantId: string): Promise<CustomerSegment | undefined>;
  createCustomerSegment(segment: InsertCustomerSegment): Promise<CustomerSegment>;
  updateCustomerSegment(id: string, tenantId: string, data: Partial<InsertCustomerSegment>): Promise<CustomerSegment | undefined>;
  deleteCustomerSegment(id: string, tenantId: string): Promise<void>;
  
  // Activities
  listActivities(tenantId: string, filters?: { customerId?: string; dealId?: string }): Promise<Activity[]>;
  getActivity(id: string, tenantId: string): Promise<Activity | undefined>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: string, tenantId: string, data: Partial<InsertActivity>): Promise<Activity | undefined>;
  deleteActivity(id: string, tenantId: string): Promise<void>;
  
  // Inventory - Warehouses
  listWarehouses(tenantId: string): Promise<Warehouse[]>;
  getWarehouse(id: string, tenantId: string): Promise<Warehouse | undefined>;
  createWarehouse(warehouse: InsertWarehouse): Promise<Warehouse>;
  updateWarehouse(id: string, tenantId: string, data: Partial<InsertWarehouse>): Promise<Warehouse | undefined>;
  deleteWarehouse(id: string, tenantId: string): Promise<void>;
  
  // Inventory - Product Stock
  listProductStock(tenantId: string, warehouseId?: string): Promise<ProductStock[]>;
  getProductStock(productId: string, warehouseId: string, tenantId: string): Promise<ProductStock | undefined>;
  createProductStock(stock: InsertProductStock): Promise<ProductStock>;
  updateProductStock(id: string, tenantId: string, data: Partial<InsertProductStock>): Promise<ProductStock | undefined>;
  
  // Inventory - Stock Movements
  listStockMovements(tenantId: string, filters?: { productId?: string; warehouseId?: string }): Promise<StockMovement[]>;
  getStockMovement(id: string, tenantId: string): Promise<StockMovement | undefined>;
  createStockMovement(movement: InsertStockMovement): Promise<StockMovement>;
  
  // HR - Departments
  listDepartments(tenantId: string): Promise<Department[]>;
  getDepartment(id: string, tenantId: string): Promise<Department | undefined>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  updateDepartment(id: string, tenantId: string, data: Partial<InsertDepartment>): Promise<Department | undefined>;
  deleteDepartment(id: string, tenantId: string): Promise<void>;
  
  // HR - Employees
  listEmployees(tenantId: string, departmentId?: string): Promise<Employee[]>;
  getEmployee(id: string, tenantId: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, tenantId: string, data: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string, tenantId: string): Promise<void>;
  
  // HR - Payroll Records
  listPayrollRecords(tenantId: string, employeeId?: string): Promise<PayrollRecord[]>;
  getPayrollRecord(id: string, tenantId: string): Promise<PayrollRecord | undefined>;
  createPayrollRecord(record: InsertPayrollRecord): Promise<PayrollRecord>;
  updatePayrollRecord(id: string, tenantId: string, data: Partial<InsertPayrollRecord>): Promise<PayrollRecord | undefined>;
  deletePayrollRecord(id: string, tenantId: string): Promise<void>;
  
  // HR - Attendance Records
  listAttendanceRecords(tenantId: string, employeeId?: string, startDate?: Date, endDate?: Date): Promise<AttendanceRecord[]>;
  getAttendanceRecord(id: string, tenantId: string): Promise<AttendanceRecord | undefined>;
  createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord>;
  updateAttendanceRecord(id: string, tenantId: string, data: Partial<InsertAttendanceRecord>): Promise<AttendanceRecord | undefined>;
  deleteAttendanceRecord(id: string, tenantId: string): Promise<void>;
  
  // AI Planning - Plan Sessions
  getPlanSession(id: string, tenantId: string): Promise<PlanSession | undefined>;
  getActivePlanSession(conversationId: string, tenantId: string): Promise<PlanSession | undefined>;
  createPlanSession(session: InsertPlanSession): Promise<PlanSession>;
  updatePlanSession(id: string, tenantId: string, data: Partial<InsertPlanSession>): Promise<PlanSession | undefined>;
  deletePlanSession(id: string, tenantId: string): Promise<void>;
  
  // AI Planning - Plan Nodes
  getPlanNode(id: string): Promise<PlanNode | undefined>;
  getNodesBySession(sessionId: string): Promise<PlanNode[]>;
  getChildNodes(parentId: string): Promise<PlanNode[]>;
  createPlanNode(node: InsertPlanNode): Promise<PlanNode>;
  updatePlanNode(id: string, data: Partial<InsertPlanNode>): Promise<PlanNode | undefined>;
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

  async getUserTenants(userId: string): Promise<UserTenant[]> {
    return await db.select().from(userTenants)
      .where(eq(userTenants.userId, userId))
      .orderBy(desc(userTenants.createdAt));
  }

  async addUserToTenant(userTenant: InsertUserTenant): Promise<UserTenant> {
    const result = await db.insert(userTenants).values(userTenant).returning();
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

  async listPayments(tenantId: string): Promise<Payment[]> {
    return await db.select().from(payments)
      .where(eq(payments.tenantId, tenantId))
      .orderBy(desc(payments.createdAt));
  }

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

  async getActiveCart(customerId: string, tenantId: string): Promise<Cart | undefined> {
    // Alias for getCartByCustomer for semantic clarity
    return this.getCartByCustomer(customerId, tenantId);
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

  // ========================================
  // CALENDAR EVENTS
  // ========================================

  async listCalendarEvents(tenantId: string): Promise<CalendarEvent[]> {
    return await db.select().from(calendarEvents)
      .where(eq(calendarEvents.tenantId, tenantId))
      .orderBy(desc(calendarEvents.startTime));
  }

  async getCalendarEvent(id: string, tenantId: string): Promise<CalendarEvent | undefined> {
    const result = await db.select().from(calendarEvents)
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.tenantId, tenantId)))
      .limit(1);
    return result[0];
  }

  async createCalendarEvent(insertEvent: InsertCalendarEvent): Promise<CalendarEvent> {
    const result = await db.insert(calendarEvents).values(insertEvent).returning();
    return result[0];
  }

  async updateCalendarEvent(id: string, tenantId: string, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined> {
    const { tenantId: _, ...updateData } = data;
    const result = await db.update(calendarEvents)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.tenantId, tenantId)))
      .returning();
    return result[0];
  }

  async deleteCalendarEvent(id: string, tenantId: string): Promise<void> {
    await db.delete(calendarEvents)
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.tenantId, tenantId)));
  }

  // ========================================
  // CATEGORIES
  // ========================================

  async listCategories(tenantId: string): Promise<Category[]> {
    return await db.select().from(categories)
      .where(eq(categories.tenantId, tenantId))
      .orderBy(categories.name);
  }

  async getCategory(id: string, tenantId: string): Promise<Category | undefined> {
    const result = await db.select().from(categories)
      .where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)))
      .limit(1);
    return result[0];
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const result = await db.insert(categories).values(insertCategory).returning();
    return result[0];
  }

  async updateCategory(id: string, tenantId: string, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const { tenantId: _, ...updateData } = data;
    const result = await db.update(categories)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)))
      .returning();
    return result[0];
  }

  async deleteCategory(id: string, tenantId: string): Promise<void> {
    await db.delete(categories)
      .where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)));
  }

  // ========================================
  // FINANCIAL ACCOUNTS
  // ========================================

  async listFinancialAccounts(tenantId: string): Promise<FinancialAccount[]> {
    return await db.select().from(financialAccounts)
      .where(eq(financialAccounts.tenantId, tenantId))
      .orderBy(financialAccounts.name);
  }

  async getFinancialAccount(id: string, tenantId: string): Promise<FinancialAccount | undefined> {
    const result = await db.select().from(financialAccounts)
      .where(and(eq(financialAccounts.id, id), eq(financialAccounts.tenantId, tenantId)))
      .limit(1);
    return result[0];
  }

  async createFinancialAccount(account: InsertFinancialAccount): Promise<FinancialAccount> {
    const result = await db.insert(financialAccounts).values(account).returning();
    return result[0];
  }

  async updateFinancialAccount(id: string, tenantId: string, data: Partial<InsertFinancialAccount>): Promise<FinancialAccount | undefined> {
    const { tenantId: _, ...updateData } = data;
    const result = await db.update(financialAccounts)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(financialAccounts.id, id), eq(financialAccounts.tenantId, tenantId)))
      .returning();
    return result[0];
  }

  async deleteFinancialAccount(id: string, tenantId: string): Promise<void> {
    await db.delete(financialAccounts)
      .where(and(eq(financialAccounts.id, id), eq(financialAccounts.tenantId, tenantId)));
  }

  // ========================================
  // FINANCIAL TRANSACTIONS
  // ========================================

  async listFinancialTransactions(tenantId: string, filters?: { type?: string; startDate?: Date; endDate?: Date }): Promise<FinancialTransaction[]> {
    let query = db.select().from(financialTransactions)
      .where(eq(financialTransactions.tenantId, tenantId))
      .$dynamic();

    // Apply filters if provided
    if (filters?.type) {
      query = query.where(eq(financialTransactions.type, filters.type as any));
    }

    return await query.orderBy(desc(financialTransactions.date));
  }

  async getFinancialTransaction(id: string, tenantId: string): Promise<FinancialTransaction | undefined> {
    const result = await db.select().from(financialTransactions)
      .where(and(eq(financialTransactions.id, id), eq(financialTransactions.tenantId, tenantId)))
      .limit(1);
    return result[0];
  }

  async createFinancialTransaction(transaction: InsertFinancialTransaction): Promise<FinancialTransaction> {
    const result = await db.insert(financialTransactions).values(transaction).returning();
    return result[0];
  }

  async updateFinancialTransaction(id: string, tenantId: string, data: Partial<InsertFinancialTransaction>): Promise<FinancialTransaction | undefined> {
    const { tenantId: _, ...updateData } = data;
    const result = await db.update(financialTransactions)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(financialTransactions.id, id), eq(financialTransactions.tenantId, tenantId)))
      .returning();
    return result[0];
  }

  async deleteFinancialTransaction(id: string, tenantId: string): Promise<void> {
    await db.delete(financialTransactions)
      .where(and(eq(financialTransactions.id, id), eq(financialTransactions.tenantId, tenantId)));
  }

  // ========================================
  // RBAC METHODS
  // ========================================

  async createRole(role: InsertRole): Promise<Role> {
    const [newRole] = await db.insert(roles).values(role).returning();
    return newRole;
  }

  async updateRole(id: string, tenantId: string, role: Partial<InsertRole>): Promise<Role | undefined> {
    const { tenantId: _, ...updateData } = role;
    const [updated] = await db.update(roles)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(roles.id, id), eq(roles.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteRole(id: string, tenantId: string): Promise<boolean> {
    const result = await db.delete(roles).where(and(eq(roles.id, id), eq(roles.tenantId, tenantId)));
    return (result.rowCount ?? 0) > 0;
  }

  async listRoles(tenantId: string): Promise<Role[]> {
    return db.select().from(roles).where(eq(roles.tenantId, tenantId));
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
  
  async listPipelineStages(tenantId: string): Promise<PipelineStage[]> {
    return await db.select().from(pipelineStages)
      .where(eq(pipelineStages.tenantId, tenantId))
      .orderBy(pipelineStages.order);
  }
  
  async getPipelineStage(id: string, tenantId: string): Promise<PipelineStage | undefined> {
    const [stage] = await db.select().from(pipelineStages)
      .where(and(eq(pipelineStages.id, id), eq(pipelineStages.tenantId, tenantId)))
      .limit(1);
    return stage;
  }
  
  async createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage> {
    const [newStage] = await db.insert(pipelineStages).values(stage).returning();
    return newStage;
  }
  
  async updatePipelineStage(id: string, tenantId: string, data: Partial<InsertPipelineStage>): Promise<PipelineStage | undefined> {
    const { tenantId: _, ...updateData } = data;
    const [updated] = await db.update(pipelineStages)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(pipelineStages.id, id), eq(pipelineStages.tenantId, tenantId)))
      .returning();
    return updated;
  }
  
  async deletePipelineStage(id: string, tenantId: string): Promise<void> {
    await db.delete(pipelineStages)
      .where(and(eq(pipelineStages.id, id), eq(pipelineStages.tenantId, tenantId)));
  }
  
  // ========================================
  // DEALS
  // ========================================
  
  async listDeals(tenantId: string): Promise<Deal[]> {
    return await db.select().from(deals)
      .where(eq(deals.tenantId, tenantId))
      .orderBy(desc(deals.createdAt));
  }
  
  async getDeal(id: string, tenantId: string): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals)
      .where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)))
      .limit(1);
    return deal;
  }
  
  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [newDeal] = await db.insert(deals).values(deal).returning();
    return newDeal;
  }
  
  async updateDeal(id: string, tenantId: string, data: Partial<InsertDeal>): Promise<Deal | undefined> {
    const { tenantId: _, ...updateData } = data;
    const [updated] = await db.update(deals)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)))
      .returning();
    return updated;
  }
  
  async deleteDeal(id: string, tenantId: string): Promise<void> {
    await db.delete(deals)
      .where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)));
  }
  
  // ========================================
  // CUSTOMER SEGMENTS
  // ========================================
  
  async listCustomerSegments(tenantId: string): Promise<CustomerSegment[]> {
    return await db.select().from(customerSegments)
      .where(eq(customerSegments.tenantId, tenantId))
      .orderBy(customerSegments.name);
  }
  
  async getCustomerSegment(id: string, tenantId: string): Promise<CustomerSegment | undefined> {
    const [segment] = await db.select().from(customerSegments)
      .where(and(eq(customerSegments.id, id), eq(customerSegments.tenantId, tenantId)))
      .limit(1);
    return segment;
  }
  
  async createCustomerSegment(segment: InsertCustomerSegment): Promise<CustomerSegment> {
    const [newSegment] = await db.insert(customerSegments).values(segment).returning();
    return newSegment;
  }
  
  async updateCustomerSegment(id: string, tenantId: string, data: Partial<InsertCustomerSegment>): Promise<CustomerSegment | undefined> {
    const { tenantId: _, ...updateData } = data;
    const [updated] = await db.update(customerSegments)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(customerSegments.id, id), eq(customerSegments.tenantId, tenantId)))
      .returning();
    return updated;
  }
  
  async deleteCustomerSegment(id: string, tenantId: string): Promise<void> {
    await db.delete(customerSegments)
      .where(and(eq(customerSegments.id, id), eq(customerSegments.tenantId, tenantId)));
  }
  
  // ========================================
  // ACTIVITIES
  // ========================================
  
  async listActivities(tenantId: string, filters?: { customerId?: string; dealId?: string }): Promise<Activity[]> {
    let query = db.select().from(activities)
      .where(eq(activities.tenantId, tenantId))
      .$dynamic();
    
    if (filters?.customerId) {
      query = query.where(eq(activities.customerId, filters.customerId));
    }
    
    if (filters?.dealId) {
      query = query.where(eq(activities.dealId, filters.dealId));
    }
    
    return await query.orderBy(desc(activities.createdAt));
  }
  
  async getActivity(id: string, tenantId: string): Promise<Activity | undefined> {
    const [activity] = await db.select().from(activities)
      .where(and(eq(activities.id, id), eq(activities.tenantId, tenantId)))
      .limit(1);
    return activity;
  }
  
  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db.insert(activities).values(activity).returning();
    return newActivity;
  }
  
  async updateActivity(id: string, tenantId: string, data: Partial<InsertActivity>): Promise<Activity | undefined> {
    const { tenantId: _, ...updateData } = data;
    const [updated] = await db.update(activities)
      .set(updateData)
      .where(and(eq(activities.id, id), eq(activities.tenantId, tenantId)))
      .returning();
    return updated;
  }
  
  async deleteActivity(id: string, tenantId: string): Promise<void> {
    await db.delete(activities)
      .where(and(eq(activities.id, id), eq(activities.tenantId, tenantId)));
  }
  
  // ========================================
  // INVENTORY - WAREHOUSES
  // ========================================
  
  async listWarehouses(tenantId: string): Promise<Warehouse[]> {
    return await db.select().from(warehouses)
      .where(eq(warehouses.tenantId, tenantId))
      .orderBy(warehouses.name);
  }
  
  async getWarehouse(id: string, tenantId: string): Promise<Warehouse | undefined> {
    const [warehouse] = await db.select().from(warehouses)
      .where(and(eq(warehouses.id, id), eq(warehouses.tenantId, tenantId)))
      .limit(1);
    return warehouse;
  }
  
  async createWarehouse(warehouse: InsertWarehouse): Promise<Warehouse> {
    const [newWarehouse] = await db.insert(warehouses).values(warehouse).returning();
    return newWarehouse;
  }
  
  async updateWarehouse(id: string, tenantId: string, data: Partial<InsertWarehouse>): Promise<Warehouse | undefined> {
    const { tenantId: _, ...updateData } = data;
    const [updated] = await db.update(warehouses)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(warehouses.id, id), eq(warehouses.tenantId, tenantId)))
      .returning();
    return updated;
  }
  
  async deleteWarehouse(id: string, tenantId: string): Promise<void> {
    await db.delete(warehouses)
      .where(and(eq(warehouses.id, id), eq(warehouses.tenantId, tenantId)));
  }
  
  // ========================================
  // INVENTORY - PRODUCT STOCK
  // ========================================
  
  async listProductStock(tenantId: string, warehouseId?: string): Promise<ProductStock[]> {
    const conditions = warehouseId
      ? and(eq(productStock.tenantId, tenantId), eq(productStock.warehouseId, warehouseId))
      : eq(productStock.tenantId, tenantId);
    
    return await db.select().from(productStock)
      .where(conditions!)
      .orderBy(productStock.productId);
  }
  
  async getProductStock(productId: string, warehouseId: string, tenantId: string): Promise<ProductStock | undefined> {
    const [stock] = await db.select().from(productStock)
      .where(and(
        eq(productStock.productId, productId),
        eq(productStock.warehouseId, warehouseId),
        eq(productStock.tenantId, tenantId)
      ))
      .limit(1);
    return stock;
  }
  
  async createProductStock(stock: InsertProductStock): Promise<ProductStock> {
    const [newStock] = await db.insert(productStock).values(stock).returning();
    return newStock;
  }
  
  async updateProductStock(id: string, tenantId: string, data: Partial<InsertProductStock>): Promise<ProductStock | undefined> {
    const { tenantId: _, ...updateData } = data;
    const [updated] = await db.update(productStock)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(productStock.id, id), eq(productStock.tenantId, tenantId)))
      .returning();
    return updated;
  }
  
  // ========================================
  // INVENTORY - STOCK MOVEMENTS
  // ========================================
  
  async listStockMovements(tenantId: string, filters?: { productId?: string; warehouseId?: string }): Promise<StockMovement[]> {
    let conditions = [eq(stockMovements.tenantId, tenantId)];
    
    if (filters?.productId) {
      conditions.push(eq(stockMovements.productId, filters.productId));
    }
    if (filters?.warehouseId) {
      conditions.push(eq(stockMovements.warehouseId, filters.warehouseId));
    }
    
    return await db.select().from(stockMovements)
      .where(and(...conditions))
      .orderBy(desc(stockMovements.createdAt));
  }
  
  async getStockMovement(id: string, tenantId: string): Promise<StockMovement | undefined> {
    const [movement] = await db.select().from(stockMovements)
      .where(and(eq(stockMovements.id, id), eq(stockMovements.tenantId, tenantId)))
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
  
  async listDepartments(tenantId: string): Promise<Department[]> {
    return await db.select().from(departments)
      .where(eq(departments.tenantId, tenantId))
      .orderBy(departments.name);
  }
  
  async getDepartment(id: string, tenantId: string): Promise<Department | undefined> {
    const [department] = await db.select().from(departments)
      .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId)))
      .limit(1);
    return department;
  }
  
  async createDepartment(department: InsertDepartment): Promise<Department> {
    const [newDepartment] = await db.insert(departments).values(department).returning();
    return newDepartment;
  }
  
  async updateDepartment(id: string, tenantId: string, data: Partial<InsertDepartment>): Promise<Department | undefined> {
    const { tenantId: _, ...updateData } = data;
    const [updated] = await db.update(departments)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId)))
      .returning();
    return updated;
  }
  
  async deleteDepartment(id: string, tenantId: string): Promise<void> {
    await db.delete(departments)
      .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId)));
  }
  
  // ========================================
  // HR - EMPLOYEES
  // ========================================
  
  async listEmployees(tenantId: string, departmentId?: string): Promise<Employee[]> {
    const conditions = departmentId
      ? and(eq(employees.tenantId, tenantId), eq(employees.departmentId, departmentId))
      : eq(employees.tenantId, tenantId);
    
    return await db.select().from(employees)
      .where(conditions!)
      .orderBy(employees.lastName, employees.firstName);
  }
  
  async getEmployee(id: string, tenantId: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees)
      .where(and(eq(employees.id, id), eq(employees.tenantId, tenantId)))
      .limit(1);
    return employee;
  }
  
  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const [newEmployee] = await db.insert(employees).values(employee).returning();
    return newEmployee;
  }
  
  async updateEmployee(id: string, tenantId: string, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const { tenantId: _, ...updateData } = data;
    const [updated] = await db.update(employees)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(employees.id, id), eq(employees.tenantId, tenantId)))
      .returning();
    return updated;
  }
  
  async deleteEmployee(id: string, tenantId: string): Promise<void> {
    await db.delete(employees)
      .where(and(eq(employees.id, id), eq(employees.tenantId, tenantId)));
  }
  
  // ========================================
  // HR - PAYROLL RECORDS
  // ========================================
  
  async listPayrollRecords(tenantId: string, employeeId?: string): Promise<PayrollRecord[]> {
    const conditions = employeeId
      ? and(eq(payrollRecords.tenantId, tenantId), eq(payrollRecords.employeeId, employeeId))
      : eq(payrollRecords.tenantId, tenantId);
    
    return await db.select().from(payrollRecords)
      .where(conditions!)
      .orderBy(desc(payrollRecords.periodEnd));
  }
  
  async getPayrollRecord(id: string, tenantId: string): Promise<PayrollRecord | undefined> {
    const [record] = await db.select().from(payrollRecords)
      .where(and(eq(payrollRecords.id, id), eq(payrollRecords.tenantId, tenantId)))
      .limit(1);
    return record;
  }
  
  async createPayrollRecord(record: InsertPayrollRecord): Promise<PayrollRecord> {
    const [newRecord] = await db.insert(payrollRecords).values(record).returning();
    return newRecord;
  }
  
  async updatePayrollRecord(id: string, tenantId: string, data: Partial<InsertPayrollRecord>): Promise<PayrollRecord | undefined> {
    const { tenantId: _, ...updateData } = data;
    const [updated] = await db.update(payrollRecords)
      .set(updateData)
      .where(and(eq(payrollRecords.id, id), eq(payrollRecords.tenantId, tenantId)))
      .returning();
    return updated;
  }
  
  async deletePayrollRecord(id: string, tenantId: string): Promise<void> {
    await db.delete(payrollRecords)
      .where(and(eq(payrollRecords.id, id), eq(payrollRecords.tenantId, tenantId)));
  }
  
  // ========================================
  // HR - ATTENDANCE RECORDS
  // ========================================
  
  async listAttendanceRecords(tenantId: string, employeeId?: string, startDate?: Date, endDate?: Date): Promise<AttendanceRecord[]> {
    let conditions = [eq(attendanceRecords.tenantId, tenantId)];
    
    if (employeeId) {
      conditions.push(eq(attendanceRecords.employeeId, employeeId));
    }
    // Note: For date filtering, we'd need to import gte/lte from drizzle-orm
    // and add: if (startDate) conditions.push(gte(attendanceRecords.date, startDate));
    // if (endDate) conditions.push(lte(attendanceRecords.date, endDate));
    
    return await db.select().from(attendanceRecords)
      .where(and(...conditions))
      .orderBy(desc(attendanceRecords.date));
  }
  
  async getAttendanceRecord(id: string, tenantId: string): Promise<AttendanceRecord | undefined> {
    const [record] = await db.select().from(attendanceRecords)
      .where(and(eq(attendanceRecords.id, id), eq(attendanceRecords.tenantId, tenantId)))
      .limit(1);
    return record;
  }
  
  async createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord> {
    const [newRecord] = await db.insert(attendanceRecords).values(record).returning();
    return newRecord;
  }
  
  async updateAttendanceRecord(id: string, tenantId: string, data: Partial<InsertAttendanceRecord>): Promise<AttendanceRecord | undefined> {
    const { tenantId: _, ...updateData } = data;
    const [updated] = await db.update(attendanceRecords)
      .set(updateData)
      .where(and(eq(attendanceRecords.id, id), eq(attendanceRecords.tenantId, tenantId)))
      .returning();
    return updated;
  }
  
  async deleteAttendanceRecord(id: string, tenantId: string): Promise<void> {
    await db.delete(attendanceRecords)
      .where(and(eq(attendanceRecords.id, id), eq(attendanceRecords.tenantId, tenantId)));
  }
  
  // ========================================
  // AI PLANNING - PLAN SESSIONS
  // ========================================
  
  async getPlanSession(id: string, tenantId: string): Promise<PlanSession | undefined> {
    const [session] = await db.select().from(planSessions)
      .where(and(eq(planSessions.id, id), eq(planSessions.tenantId, tenantId)))
      .limit(1);
    return session;
  }
  
  async getActivePlanSession(conversationId: string, tenantId: string): Promise<PlanSession | undefined> {
    const now = new Date();
    const [session] = await db.select().from(planSessions)
      .where(and(
        eq(planSessions.conversationId, conversationId),
        eq(planSessions.tenantId, tenantId)
      ))
      .orderBy(desc(planSessions.updatedAt))
      .limit(1);
    
    return (session && new Date(session.expiresAt) > now) ? session : undefined;
  }
  
  async createPlanSession(session: InsertPlanSession): Promise<PlanSession> {
    const [newSession] = await db.insert(planSessions).values(session).returning();
    return newSession;
  }
  
  async updatePlanSession(id: string, tenantId: string, data: Partial<InsertPlanSession>): Promise<PlanSession | undefined> {
    const { tenantId: _, ...updateData } = data;
    const [updated] = await db.update(planSessions)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(planSessions.id, id), eq(planSessions.tenantId, tenantId)))
      .returning();
    return updated;
  }
  
  async deletePlanSession(id: string, tenantId: string): Promise<void> {
    await db.delete(planSessions)
      .where(and(eq(planSessions.id, id), eq(planSessions.tenantId, tenantId)));
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
}

export const storage = new DbStorage();
