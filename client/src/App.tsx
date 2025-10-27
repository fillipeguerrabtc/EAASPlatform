import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { UserMenu } from "@/components/user-menu";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { BrandThemeProvider } from "@/components/brand-theme-provider";
import { TenantLogo } from "@/components/tenant-logo";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Marketplace from "@/pages/marketplace";
import CRM from "@/pages/crm";
import CRMDashboard from "@/pages/crm-dashboard";
import CRMPipeline from "@/pages/crm-pipeline";
import CRMActivities from "@/pages/crm-activities";
import CRMSegments from "@/pages/crm-segments";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import RegisterEmployeePage from "@/pages/register-employee";
import RegisterCustomerPage from "@/pages/register-customer";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import Omnichat from "@/pages/omnichat";
import OmnichatAdmin from "@/pages/omnichat-admin";
import KnowledgeBasePage from "@/pages/knowledge-base";
import Tenants from "@/pages/tenants";
import Checkout from "@/pages/checkout";
import Payments from "@/pages/payments";
import CalendarPage from "@/pages/calendar";
import Shop from "@/pages/shop";
import CartPage from "@/pages/cart";
import CustomerArea from "@/pages/customer-area";
import CentralMarketplace from "@/pages/central-marketplace";
import OrdersPage from "@/pages/orders";
import { useTenantContext } from "@/hooks/useTenantContext";
import Finance from "@/pages/finance";
import FinanceRevenues from "@/pages/finance-revenues";
import FinanceExpenses from "@/pages/finance-expenses";
import FinanceReports from "@/pages/finance-reports";
import CategoriesPage from "@/pages/categories";
import TenantSettings from "@/pages/tenant-settings";
import RBAC from "@/pages/rbac";
import InventoryPage from "@/pages/inventory";
import HRPage from "@/pages/hr";
import UserApprovals from "@/pages/admin/user-approvals";
import AiGovernance from "@/pages/admin/ai-governance";
import CrmWorkflowsPage from "@/pages/admin/crm-workflows";
import HrLeaveRequestsPage from "@/pages/admin/hr-leave-requests";
import HrPerformanceReviewsPage from "@/pages/admin/hr-performance-reviews";
import AiKnowledgeBasePage from "@/pages/admin/ai-knowledge-base";
import CalendarSchedulingPage from "@/pages/admin/calendar-scheduling";
import InventoryTransfersPage from "@/pages/admin/inventory-transfers";
import BudgetTrackingPage from "@/pages/admin/budget-tracking";
import WishlistsPage from "@/pages/admin/wishlists";
import ProductBundlesPage from "@/pages/admin/product-bundles";
import ReportTemplatesPage from "@/pages/admin/report-templates";
import NotFound from "@/pages/not-found";
import { Skeleton } from "@/components/ui/skeleton";

function Router() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { tenantContext, isLoading: contextLoading } = useTenantContext();

  if (authLoading || contextLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
    );
  }

  // ROUTE 1: eaas.com (Central Marketplace - selling EAAS platform)
  if (tenantContext?.isCentralMarketplace) {
    return (
      <Switch>
        <Route path="/" component={CentralMarketplace} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/register/employee" component={RegisterEmployeePage} />
        <Route path="/register/customer" component={RegisterCustomerPage} />
        <Route component={CentralMarketplace} />
      </Switch>
    );
  }

  // ROUTE 2: admin.eaas.com (Super Admin Dashboard) - SECURITY: Check role
  if (tenantContext?.isSuperAdminRoute) {
    if (!isAuthenticated) {
      return (
        <Switch>
          <Route path="/" component={LoginPage} />
          <Route component={LoginPage} />
        </Switch>
      );
    }

    // TODO: Add user.permissions.isSuperAdmin check here for extra security
    return (
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/tenants" component={Tenants} />
        <Route component={Dashboard} />
      </Switch>
    );
  }

  // ROUTE 3: tenant.eaas.com (Tenant Marketplace or Admin)
  if (tenantContext?.detectedTenant) {
    return (
      <Switch>
        {!isAuthenticated ? (
          <>
            <Route path="/" component={Shop} />
            <Route path="/shop" component={Shop} />
            <Route path="/cart" component={CartPage} />
            <Route path="/login" component={LoginPage} />
            <Route path="/register" component={RegisterPage} />
            <Route path="/register/employee" component={RegisterEmployeePage} />
            <Route path="/register/customer" component={RegisterCustomerPage} />
          </>
        ) : (
          <>
            <Route path="/admin" component={Dashboard} />
            <Route path="/admin/marketplace" component={Marketplace} />
            <Route path="/admin/customers" component={CRM} />
            <Route path="/admin/crm" component={CRMDashboard} />
            <Route path="/admin/crm/customers" component={CRM} />
            <Route path="/admin/crm/pipeline" component={CRMPipeline} />
            <Route path="/admin/crm/activities" component={CRMActivities} />
            <Route path="/admin/crm/segments" component={CRMSegments} />
            <Route path="/admin/crm/workflows" component={CrmWorkflowsPage} />
            <Route path="/admin/omnichat" component={Omnichat} />
            <Route path="/admin/omnichat-admin" component={OmnichatAdmin} />
            <Route path="/admin/knowledge-base" component={KnowledgeBasePage} />
            <Route path="/admin/checkout" component={Checkout} />
            <Route path="/admin/payments" component={Payments} />
            <Route path="/admin/calendar" component={CalendarPage} />
            <Route path="/admin/orders" component={OrdersPage} />
            <Route path="/admin/finance" component={Finance} />
            <Route path="/admin/finance/revenues" component={FinanceRevenues} />
            <Route path="/admin/finance/expenses" component={FinanceExpenses} />
            <Route path="/admin/finance/reports" component={FinanceReports} />
            <Route path="/admin/categories" component={CategoriesPage} />
            <Route path="/admin/tenant-settings" component={TenantSettings} />
            <Route path="/admin/rbac" component={RBAC} />
            <Route path="/admin/inventory" component={InventoryPage} />
            <Route path="/admin/hr" component={HRPage} />
            <Route path="/admin/hr/leave-requests" component={HrLeaveRequestsPage} />
            <Route path="/admin/hr/performance-reviews" component={HrPerformanceReviewsPage} />
            <Route path="/admin/calendar/scheduling" component={CalendarSchedulingPage} />
            <Route path="/admin/inventory/transfers" component={InventoryTransfersPage} />
            <Route path="/admin/finance/budget" component={BudgetTrackingPage} />
            <Route path="/admin/marketplace/wishlists" component={WishlistsPage} />
            <Route path="/admin/marketplace/bundles" component={ProductBundlesPage} />
            <Route path="/admin/reports/templates" component={ReportTemplatesPage} />
            <Route path="/admin/user-approvals" component={UserApprovals} />
            <Route path="/admin/ai-governance" component={AiGovernance} />
            <Route path="/admin/ai/knowledge-base" component={AiKnowledgeBasePage} />
            <Route path="/" component={Shop} />
            <Route path="/shop" component={Shop} />
            <Route path="/cart" component={CartPage} />
            <Route path="/my-account" component={CustomerArea} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
    );
  }

  // ROUTE 4: Default/Development (localhost)
  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={RegisterPage} />
          <Route path="/register/employee" component={RegisterEmployeePage} />
          <Route path="/register/customer" component={RegisterCustomerPage} />
          <Route path="/forgot-password" component={ForgotPasswordPage} />
          <Route path="/reset-password" component={ResetPasswordPage} />
          <Route path="/shop" component={Shop} />
          <Route path="/cart" component={CartPage} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/my-account" component={CustomerArea} />
          <Route path="/tenants" component={Tenants} />
          <Route path="/marketplace" component={Marketplace} />
          <Route path="/customers" component={CRM} />
          <Route path="/crm" component={CRMDashboard} />
          <Route path="/crm/customers" component={CRM} />
          <Route path="/crm/pipeline" component={CRMPipeline} />
          <Route path="/crm/activities" component={CRMActivities} />
          <Route path="/crm/segments" component={CRMSegments} />
          <Route path="/crm/workflows" component={CrmWorkflowsPage} />
          <Route path="/omnichat" component={Omnichat} />
          <Route path="/omnichat-admin" component={OmnichatAdmin} />
          <Route path="/knowledge-base" component={KnowledgeBasePage} />
          <Route path="/checkout" component={Checkout} />
          <Route path="/payments" component={Payments} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/orders" component={OrdersPage} />
          <Route path="/finance" component={Finance} />
          <Route path="/finance/revenues" component={FinanceRevenues} />
          <Route path="/finance/expenses" component={FinanceExpenses} />
          <Route path="/finance/reports" component={FinanceReports} />
          <Route path="/categories" component={CategoriesPage} />
          <Route path="/tenant-settings" component={TenantSettings} />
          <Route path="/rbac" component={RBAC} />
          <Route path="/inventory" component={InventoryPage} />
          <Route path="/hr" component={HRPage} />
          <Route path="/hr/leave-requests" component={HrLeaveRequestsPage} />
          <Route path="/admin/user-approvals" component={UserApprovals} />
          <Route path="/admin/ai-governance" component={AiGovernance} />
          <Route path="/shop" component={Shop} />
          <Route path="/cart" component={CartPage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <BrandThemeProvider>
        <TooltipProvider>
          <ThemeProvider defaultTheme="light" storageKey="eaas-theme">
            <DynamicFavicon />
            <AuthenticatedLayout style={style as React.CSSProperties}>
              <Router />
            </AuthenticatedLayout>
            <Toaster />
          </ThemeProvider>
        </TooltipProvider>
      </BrandThemeProvider>
    </QueryClientProvider>
  );
}

function AuthenticatedLayout({ style, children }: { style: React.CSSProperties; children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  // Show Landing page without sidebar for non-authenticated users
  if (isLoading || !isAuthenticated) {
    return <>{children}</>;
  }

  // Show authenticated layout with sidebar
  return (
    <SidebarProvider style={style}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="min-h-11 min-w-11" />
              <TenantLogo className="h-8" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-gradient-to-br from-background via-background to-muted/10">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
