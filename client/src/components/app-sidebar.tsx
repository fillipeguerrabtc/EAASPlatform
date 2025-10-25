import { 
  Home, 
  ShoppingCart, 
  Users, 
  MessageSquare, 
  Book, 
  Building2,
  CreditCard,
  Settings,
  Calendar,
  Package,
  DollarSign
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { EaasLogo } from "@/components/eaas-logo";

export function AppSidebar() {
  const [location] = useLocation();
  const { t } = useTranslation();

  const menuItems = [
    {
      title: t('nav.dashboard'),
      url: "/",
      icon: Home,
      testId: "dashboard",
    },
    {
      title: t('nav.tenants'),
      url: "/tenants",
      icon: Building2,
      testId: "tenants",
    },
    {
      title: t('nav.marketplace'),
      url: "/marketplace",
      icon: ShoppingCart,
      testId: "marketplace",
    },
    {
      title: t('nav.crm'),
      url: "/crm",
      icon: Users,
      testId: "crm",
    },
    {
      title: "Omnichat Admin",
      url: "/omnichat-admin",
      icon: MessageSquare,
      testId: "omnichat-admin",
    },
    {
      title: t('nav.knowledgeBase'),
      url: "/knowledge-base",
      icon: Book,
      testId: "knowledge-base",
    },
    {
      title: "Pedidos",
      url: "/orders",
      icon: Package,
      testId: "orders",
    },
    {
      title: "Calendário",
      url: "/calendar",
      icon: Calendar,
      testId: "calendar",
    },
    {
      title: t('nav.payments'),
      url: "/payments",
      icon: CreditCard,
      testId: "payments",
    },
    {
      title: "Finanças",
      url: "/finance",
      icon: DollarSign,
      testId: "finance",
    },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <Link href="/">
          <EaasLogo size="md" variant="full" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground px-4">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.testId}>
                    <SidebarMenuButton asChild isActive={isActive} data-testid={`link-${item.testId}`}>
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
