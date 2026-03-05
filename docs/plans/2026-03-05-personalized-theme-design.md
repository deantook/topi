# 个性化主题功能设计文档

> 设计日期：2026-03-05

## 概述

在现有浅色/深色/跟随系统的基础上，增加多种预设配色（中性、蓝、绿、紫），并重构 ThemeProvider 以支持 mode 与 accent 两个独立维度。主题选择器统一在一个分组下拉中展示。

## 1. 架构与数据模型

**状态结构**

- `mode`: `"light" | "dark" | "system"`（沿用现有）
- `accent`: `"neutral" | "blue" | "green" | "purple"`（新增）

两者独立存储，Context 提供 `{ mode, setMode, accent, setAccent, resolvedTheme }`。

**持久化**

- 扩展 localStorage 键 `topi-theme` 为 JSON：`{ "mode": "system", "accent": "blue" }`
- 向后兼容：若读取到旧字符串 `"light"` / `"dark"` / `"system"`，解析为 `{ mode: 该值, accent: "neutral" }`

**预设配色映射**

- 每种 accent 定义一组 override 变量，仅覆盖 primary、ring、chart 等强调色
- 通过 `html[data-accent="blue"]` 等 data 属性在 CSS 中应用，与 `.dark` 叠加

## 2. UI 组件

**ThemeToggle 重构**

- 保持 `DropdownMenu`，单一下拉
- 用 `DropdownMenuGroup` + `DropdownMenuLabel` 分为两块：
  - **外观**：浅色、深色、跟随系统（图标 Sun / Moon / Monitor）
  - **配色**：中性、蓝、绿、紫（每项旁有对应色块）
- 当前选中项显示 ✓
- 触发按钮：当前 mode 图标 +「主题」文案

**accent 选项展示**

- 每个 accent 旁有色块（圆点或小方块），使用该 preset 的 primary 色
- neutral 为默认，沿用现有灰阶

**依赖**

- 使用既有 shadcn `DropdownMenu`，无新增依赖

## 3. CSS 与主题应用

**应用机制**

- `document.documentElement` 设置 `data-accent="neutral" | "blue" | "green" | "purple"`
- 与 `class="dark"`、`style.colorScheme` 并列

**变量覆盖范围**

- 仅覆盖：`--primary`、`--primary-foreground`、`--ring`、`--sidebar-primary`、`--chart-1` ~ `--chart-5`
- 不覆盖：`--background`、`--foreground`、`--border`、`--muted` 等

**预设定义**

- 在 `app.css` 中用 `[data-accent="blue"]`、`[data-accent="blue"].dark` 等选择器
- 每个 preset 定义 light/dark 两套 override
- 使用 oklch 与现有风格一致

**root 内联脚本**

- 扩展 `themeScript`：从 localStorage 读取 JSON，同时设置 `class` 和 `data-accent`，避免首屏闪烁

## 4. ThemeProvider 重构与错误处理

**重构要点**

- Context 扩展为 `{ mode, setMode, accent, setAccent, resolvedTheme }`
- `setMode` / `setAccent` 写入 localStorage 并调用 `applyTheme()`
- `applyTheme()` 同时设置 `classList`、`colorScheme`、`data-accent`
- 初始化时从 localStorage 读取 JSON，做向后兼容解析

**错误与边界**

- localStorage 解析失败：回退 `{ mode: "system", accent: "neutral" }`
- 非法 accent：忽略，使用 `"neutral"`
- SSR：`resolvedTheme` 的 `getServerSnapshot` 返回 `"light"`
- `data-accent` 未设置时视为 `"neutral"`

**破坏性变更**

- `useTheme()` 返回类型扩展；若有消费 `theme`/`setTheme` 的调用，改为 `mode`/`setMode`

## 5. 测试与验证

**人工验证**

- 切换 mode：浅/深/跟随系统，界面正确
- 切换 accent：中性/蓝/绿/紫，primary、ring、chart 正确
- 组合：各 mode × accent 无错乱
- 刷新：主题与 accent 从 localStorage 正确恢复
- 旧数据：localStorage 为 `"light"` 等旧格式时，解析为 `accent: "neutral"`

**可选自动化**

- E2E：切换主题后校验主要元素颜色
- 无需单元测试，逻辑简单
