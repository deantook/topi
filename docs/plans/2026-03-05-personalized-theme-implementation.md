# 个性化主题功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在现有浅色/深色/跟随系统基础上，增加多种预设配色（中性、蓝、绿、紫），并在同一分组下拉中展示 mode 与 accent 选择。

**Architecture:** 扩展 ThemeProvider 的 mode + 新增 accent 维度；localStorage 存 JSON `{ mode, accent }`，向后兼容旧字符串格式；CSS 通过 `data-accent` 覆盖 primary/ring/chart 等变量；ThemeToggle 改为分组下拉（外观 + 配色）。

**Tech Stack:** React, shadcn/ui, Tailwind CSS, oklch

---

参考设计：`docs/plans/2026-03-05-personalized-theme-design.md`

---

### Task 1: ThemeProvider 扩展 mode + accent 与 applyTheme

**Files:**
- Modify: `topi/app/components/theme-provider.tsx`

**Step 1: 定义 Accent 类型与存储格式**

```ts
export type Accent = "neutral" | "blue" | "green" | "purple";

export type ThemeStorage = { mode: Theme; accent: Accent };
```

**Step 2: 实现 getStoredTheme 解析逻辑（向后兼容）**

- 若 localStorage 为 `"light"` / `"dark"` / `"system"`，返回 `{ mode: 该值, accent: "neutral" }`
- 若为 JSON 且可解析，返回 `{ mode, accent }`，非法 accent 时用 `"neutral"`
- 解析失败或 undefined：返回 `{ mode: "system", accent: "neutral" }`

**Step 3: 扩展 applyTheme**

- 接收 `(mode: Theme, accent: Accent)`
- 设置 `root.classList.toggle("dark", resolved === "dark")`、`root.style.colorScheme`
- 设置 `root.setAttribute("data-accent", accent)`

**Step 4: 扩展 Context 与 Provider**

- Context 值：`{ mode, setMode, accent, setAccent, resolvedTheme }`
- `setMode(v)` / `setAccent(v)` 分别更新 state、写入 localStorage（存 JSON）、调用 `applyTheme`
- 初始化：`useEffect` 中 `const { mode, accent } = getStoredTheme()`，`setMode(mode)`、`setAccent(accent)`、`applyTheme(mode, accent)`

**Step 5: 运行应用并快速验证**

```bash
cd topi && pnpm dev
```

在浏览器中打开，侧边栏「主题」下拉应仍可切换浅/深/系统；若报错则修复。

**Step 6: Commit**

```bash
git add topi/app/components/theme-provider.tsx
git commit -m "feat(theme): extend ThemeProvider with accent and JSON storage"
```

---

### Task 2: app.css 增加 data-accent 预设变量

**Files:**
- Modify: `topi/app/app.css`

**Step 1: 在 .dark 块之后添加 accent 预设**

仅覆盖 `--primary`、`--primary-foreground`、`--ring`、`--sidebar-primary`、`--sidebar-primary-foreground`、`--chart-1` ~ `--chart-5`。neutral 无需 override（:root/.dark 已是默认）。

Blue（示例 oklch 值，可根据视觉效果微调）：
```css
[data-accent="blue"] {
  --primary: oklch(0.45 0.2 264);
  --primary-foreground: oklch(0.98 0 0);
  --ring: oklch(0.55 0.2 264);
  --sidebar-primary: oklch(0.5 0.22 264);
  --sidebar-primary-foreground: oklch(0.98 0 0);
  --chart-1: oklch(0.55 0.22 264);
  --chart-2: oklch(0.6 0.18 200);
  --chart-3: oklch(0.65 0.18 180);
  --chart-4: oklch(0.7 0.15 150);
  --chart-5: oklch(0.75 0.12 120);
}
.dark[data-accent="blue"] {
  --primary: oklch(0.65 0.2 264);
  --primary-foreground: oklch(0.15 0 0);
  --ring: oklch(0.6 0.2 264);
  --sidebar-primary: oklch(0.55 0.22 264);
  --sidebar-primary-foreground: oklch(0.98 0 0);
  --chart-1: oklch(0.6 0.22 264);
  --chart-2: oklch(0.65 0.18 200);
  --chart-3: oklch(0.7 0.18 180);
  --chart-4: oklch(0.75 0.15 150);
  --chart-5: oklch(0.8 0.12 120);
}
```

Green、Purple 同理，使用合适的 oklch 色相（green ~150，purple ~300）。

**Step 2: 验证**

`pnpm dev`，在 DevTools 中给 `html` 设置 `data-accent="blue"`，观察 primary/button 等颜色是否变化。

**Step 3: Commit**

```bash
git add topi/app/app.css
git commit -m "feat(theme): add accent presets (blue, green, purple) in app.css"
```

---

### Task 3: root.tsx 扩展 themeScript

**Files:**
- Modify: `topi/app/root.tsx`

**Step 1: 更新 themeScript**

从 localStorage 读取 `topi-theme`：
- 若为 JSON：解析 `mode`、`accent`，设置 `classList`、`colorScheme`、`data-accent`
- 若为旧字符串：同上，accent 默认 `"neutral"`
- 无值：`mode="system"`，`accent="neutral"`，根据 `prefers-color-scheme` 决定 dark

```js
const themeScript = `
(function() {
  const k = 'topi-theme';
  const raw = localStorage.getItem(k);
  let mode = 'system', accent = 'neutral';
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.mode === 'light' || parsed.mode === 'dark' || parsed.mode === 'system')) {
        mode = parsed.mode;
        if (['neutral','blue','green','purple'].includes(parsed.accent)) accent = parsed.accent;
      }
    } catch (_) {
      if (raw === 'light' || raw === 'dark' || raw === 'system') mode = raw;
    }
  }
  const dark = mode === 'dark' || (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-accent', accent);
})();
`;
```

**Step 2: 验证首屏**

清除 localStorage，刷新页面，确认无闪烁；设置 `{ "mode": "dark", "accent": "blue" }` 后刷新，确认首屏已是深色+蓝 accents。

**Step 3: Commit**

```bash
git add topi/app/root.tsx
git commit -m "feat(theme): extend themeScript for accent and JSON storage"
```

---

### Task 4: ThemeToggle 分组下拉（外观 + 配色）

**Files:**
- Modify: `topi/app/components/theme-toggle.tsx`

**Step 1: 导入 DropdownMenuGroup、DropdownMenuLabel**

```ts
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type Theme, type Accent } from "@/components/theme-provider";
```

**Step 2: 定义 accent 选项（含色块颜色）**

```ts
const accentOptions: { value: Accent; label: string; color: string }[] = [
  { value: "neutral", label: "中性", color: "oklch(0.5 0 0)" },
  { value: "blue", label: "蓝", color: "oklch(0.55 0.2 264)" },
  { value: "green", label: "绿", color: "oklch(0.6 0.18 150)" },
  { value: "purple", label: "紫", color: "oklch(0.6 0.22 300)" },
];
```

**Step 3: 重构下拉结构**

- 使用 `{ mode, setMode, accent, setAccent }` 替代原来的 `theme` / `setTheme`
- 第一组：`DropdownMenuLabel`「外观」，三个 DropdownMenuItem：浅色、深色、跟随系统
- 第二组：`DropdownMenuLabel`「配色」，四个 DropdownMenuItem：中性、蓝、绿、紫，每项前有 `span` 色块（style background）
- 当前选中项加 Check 图标

**Step 4: 验证**

下拉中可分别选择外观与配色，切换后界面立即更新，刷新后保持。

**Step 5: Commit**

```bash
git add topi/app/components/theme-toggle.tsx
git commit -m "feat(theme): ThemeToggle grouped dropdown (mode + accent)"
```

---

### Task 5: 人工验证与收尾

**Step 1: 完整人工验证**

- [ ] 切换 mode：浅/深/跟随系统，界面正确
- [ ] 切换 accent：中性/蓝/绿/紫，primary、ring、chart 正确
- [ ] 任意 mode × accent 组合无错乱
- [ ] 刷新后主题与 accent 正确恢复
- [ ] 清空 localStorage，手动设 `localStorage.setItem('topi-theme','light')`，刷新后解析为 `{ mode: "light", accent: "neutral" }`

**Step 2: 微调 oklch 值（可选）**

若某预设观感不佳，在 app.css 中微调对应 `--primary`、`--ring`、`--chart-*`。

**Step 3: 最终 Commit**

```bash
git add -A
git status  # 确认无多余文件
git commit -m "chore(theme): verify personalized theme implementation"  # 如有改动
```

---

## 执行方式

计划已保存至 `docs/plans/2026-03-05-personalized-theme-implementation.md`。可选两种执行方式：

**1. 本会话内子代理驱动**：按任务逐个派发子代理，每步完成后审查再继续。

**2. 并行会话**：在单独会话中打开，使用 executing-plans 技能按检查点批量执行。

你想用哪种方式？
