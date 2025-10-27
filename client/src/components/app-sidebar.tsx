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
  DollarSign,
  Shield,
  LayoutDashboard,
  Target,
  Activity,
  Tag,
  Warehouse,
  UserCog,
  Brain,
  Palette
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
      title: "Variantes de Produtos",
      url: "/admin/marketplace/variants",
      icon: Palette,
      testId: "product-variants",
    },
    {
      title: "CRM - Dashboard",
      url: "/crm",
      icon: LayoutDashboard,
      testId: "crm-dashboard",
    },
    {
      title: "CRM - Clientes",
      url: "/crm/customers",
      icon: Users,
      testId: "crm-customers",
    },
    {
      title: "CRM - Pipeline",
      url: "/crm/pipeline",
      icon: Target,
      testId: "crm-pipeline",
    },
    {
      title: "CRM - Atividades",
      url: "/crm/activities",
      icon: Activity,
      testId: "crm-activities",
    },
    {
      title: "CRM - Segmentos",
      url: "/crm/segments",
      icon: Tag,
      testId: "crm-segments",
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
    {
      title: "Estoque",
      url: "/inventory",
      icon: Warehouse,
      testId: "inventory",
    },
    {
      title: "Recursos Humanos",
      url: "/hr",
      icon: UserCog,
      testId: "hr",
    },
    {
      title: "Categorias",
      url: "/categories",
      icon: Package,
      testId: "categories",
    },
    {
      title: "Funções e Permissões",
      url: "/rbac",
      icon: Shield,
      testId: "rbac",
    },
    {
      title: "AI Governance",
      url: "/admin/ai-governance",
      icon: Brain,
      testId: "ai-governance",
    },
    {
      title: "Configurações",
      url: "/tenant-settings",
      icon: Settings,
      testId: "tenant-settings",
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
