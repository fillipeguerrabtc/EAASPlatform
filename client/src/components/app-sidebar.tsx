import { 
  Home, 
  ShoppingCart, 
  Users, 
  MessageSquare, 
  Book, 
  Building2,
  CreditCard,
  Settings
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
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";

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
      title: t('nav.omnichat'),
      url: "/omnichat",
      icon: MessageSquare,
      testId: "omnichat",
    },
    {
      title: t('nav.knowledgeBase'),
      url: "/knowledge-base",
      icon: Book,
      testId: "knowledge-base",
    },
    {
      title: t('nav.payments'),
      url: "/checkout",
      icon: CreditCard,
      testId: "checkout",
    },
  ];

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold px-4">
            EAAS
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
