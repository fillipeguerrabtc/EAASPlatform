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
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Marketplace from "@/pages/marketplace";
import CRM from "@/pages/crm";
import Omnichat from "@/pages/omnichat";
import OmnichatAdmin from "@/pages/omnichat-admin";
import KnowledgeBasePage from "@/pages/knowledge-base";
import Tenants from "@/pages/tenants";
import Checkout from "@/pages/checkout";
import Payments from "@/pages/payments";
import CalendarPage from "@/pages/calendar";
import Shop from "@/pages/shop";
import CartPage from "@/pages/cart";
import OrdersPage from "@/pages/orders";
import Finance from "@/pages/finance";
import NotFound from "@/pages/not-found";
import { Skeleton } from "@/components/ui/skeleton";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/shop" component={Shop} />
          <Route path="/cart" component={CartPage} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/tenants" component={Tenants} />
          <Route path="/marketplace" component={Marketplace} />
          <Route path="/customers" component={CRM} />
          <Route path="/crm" component={CRM} />
          <Route path="/omnichat" component={Omnichat} />
          <Route path="/omnichat-admin" component={OmnichatAdmin} />
          <Route path="/knowledge-base" component={KnowledgeBasePage} />
          <Route path="/checkout" component={Checkout} />
          <Route path="/payments" component={Payments} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/orders" component={OrdersPage} />
          <Route path="/finance" component={Finance} />
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
      <TooltipProvider>
        <ThemeProvider defaultTheme="light" storageKey="eaas-theme">
          <AuthenticatedLayout style={style as React.CSSProperties}>
            <Router />
          </AuthenticatedLayout>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
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
            <SidebarTrigger data-testid="button-sidebar-toggle" className="min-h-11 min-w-11" />
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
