"use client";

import { Moon, Sun, Monitor, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useTheme, type Theme, type Accent } from "@/components/theme-provider";

const modeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "跟随系统", icon: Monitor },
];

const accentOptions: { value: Accent; label: string; color: string }[] = [
  { value: "neutral", label: "中性", color: "oklch(0.5 0 0)" },
  { value: "blue", label: "蓝", color: "oklch(0.55 0.2 264)" },
  { value: "green", label: "绿", color: "oklch(0.6 0.18 150)" },
  { value: "purple", label: "紫", color: "oklch(0.6 0.22 300)" },
];

export function ThemeToggle() {
  const { mode, setMode, accent, setAccent } = useTheme();
  const Icon = modeOptions.find((o) => o.value === mode)?.icon ?? Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          tooltip="主题"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Icon className="size-4" />
          <span>主题</span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={4}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>外观</DropdownMenuLabel>
          {modeOptions.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className="gap-2"
            >
              <opt.icon className="size-4" />
              <span>{opt.label}</span>
              {mode === opt.value && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          <DropdownMenuLabel>配色</DropdownMenuLabel>
          {accentOptions.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => setAccent(opt.value)}
              className="gap-2"
            >
              <span
                className="size-4 shrink-0 rounded-sm border border-border"
                style={{ background: opt.color }}
              />
              <span>{opt.label}</span>
              {accent === opt.value && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
