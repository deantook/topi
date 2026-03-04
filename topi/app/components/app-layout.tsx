import { Link, useLocation } from "react-router";
import {
  LayoutList,
  Calendar,
  CalendarClock,
  CalendarRange,
  Inbox,
  CheckCircle,
  XCircle,
  Trash2,
  Settings,
  Menu,
  LogOut,
} from "lucide-react";
import { logout } from "@/lib/auth";
import { CustomListsSidebar } from "@/components/custom-lists-sidebar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";

const navItems = [
  { to: "/", label: "所有", icon: LayoutList, title: "所有" },
  { to: "/today", label: "今天", icon: Calendar, title: "今天" },
  { to: "/tomorrow", label: "明天", icon: CalendarClock, title: "明天" },
  { to: "/recent-seven", label: "最近七天", icon: CalendarRange, title: "最近七天" },
  { to: "/inbox", label: "收集箱", icon: Inbox, title: "收集箱" },
];

const bottomNavItems = [
  { to: "/completed", label: "已完成", icon: CheckCircle, title: "已完成" },
  { to: "/abandoned", label: "已放弃", icon: XCircle, title: "已放弃" },
  { to: "/trash", label: "垃圾桶", icon: Trash2, title: "垃圾桶" },
];

const footerItems = [
  { to: "/settings", label: "设置", icon: Settings, title: "设置" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <SidebarProvider>
      <Sidebar side="left" collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.to}
                      tooltip={item.label}
                    >
                      <Link to={item.to}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
          <CustomListsSidebar />
          <SidebarSeparator />
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {bottomNavItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.to}
                      tooltip={item.label}
                    >
                      <Link to={item.to}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            {footerItems.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === item.to}
                  tooltip={item.label}
                >
                  <Link to={item.to}>
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => logout()}
                tooltip="退出登录"
              >
                <LogOut className="size-4" />
                <span>退出</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-1 overflow-auto gap-2 p-4 md:p-6">
          <SidebarTrigger
            className="-ml-1 shrink-0 self-start"
            aria-label="最小化侧边栏"
            title="最小化侧边栏 (⌘B)"
          >
            <Menu className="size-4" />
          </SidebarTrigger>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
