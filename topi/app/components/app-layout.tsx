import { useEffect, useState } from "react";
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
  Search,
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { TaskSearchCommand } from "@/components/task-search-command";
import { useDashboard } from "@/hooks/use-dashboard";

const navItems = [
  { to: "/", label: "所有", icon: LayoutList, title: "所有", countKey: "all" as const },
  { to: "/today", label: "今天", icon: Calendar, title: "今天", countKey: "today" as const },
  { to: "/tomorrow", label: "明天", icon: CalendarClock, title: "明天", countKey: "tomorrow" as const },
  { to: "/recent-seven", label: "最近七天", icon: CalendarRange, title: "最近七天", countKey: "recentSeven" as const },
  { to: "/inbox", label: "收集箱", icon: Inbox, title: "收集箱", countKey: "inbox" as const },
];

const bottomNavItems = [
  { to: "/completed", label: "已完成", icon: CheckCircle, title: "已完成", countKey: "completed" as const },
  { to: "/abandoned", label: "已放弃", icon: XCircle, title: "已放弃", countKey: "abandoned" as const },
  { to: "/trash", label: "垃圾桶", icon: Trash2, title: "垃圾桶", countKey: "trash" as const },
];

const footerItems = [
  { to: "/settings", label: "设置", icon: Settings, title: "设置" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const { data } = useDashboard();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const counts = data?.counts ?? {
    all: 0,
    today: 0,
    tomorrow: 0,
    recentSeven: 0,
    inbox: 0,
    completed: 0,
    abandoned: 0,
    trash: 0,
    list: {},
  };

  return (
    <SidebarProvider>
      <TaskSearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
      <Sidebar side="left" collapsible="icon">
        <SidebarContent>
          <SidebarGroup className="pt-2">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setSearchOpen(true)}
                    tooltip="搜索任务 (⌘K)"
                  >
                    <Search className="size-4" />
                    <span>搜索</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="pt-2">
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const count = counts[item.countKey];
                  return (
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
                      {count > 0 && <SidebarMenuBadge>{count}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
          <CustomListsSidebar listCounts={counts.list} />
          <SidebarSeparator />
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {bottomNavItems.map((item) => {
                  const count = counts[item.countKey];
                  return (
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
                      {count > 0 && <SidebarMenuBadge>{count}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  );
                })}
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
              <ThemeToggle />
            </SidebarMenuItem>
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
