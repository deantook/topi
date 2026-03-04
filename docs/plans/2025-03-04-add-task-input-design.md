# 添加任务输入框交互改进设计

> 设计日期：2025-03-04

## 概述

将添加任务输入框的右侧控件（日期、优先级）改为按需显示：未点击时不显示；点击后显示日期图标与优先级菜单；日期设定后才显示日期文本。抽出 `AddTaskInput` 组件以职责分离。

## 1. 架构与组件划分

- **新增组件**：`AddTaskInput`，路径 `topi/app/components/add-task-input.tsx`
- **职责**：添加任务输入框及其右侧控件（日期、优先级）的展示与逻辑
- **Props**：`filter: TaskFilter`、`onSubmit: (text, options?) => void`
- **TaskList**：移除添加任务相关状态与渲染，使用 `<AddTaskInput filter={filter} onSubmit={...} />` 替代内联表单

## 2. 交互与状态逻辑

- **右侧控件显示规则**：`showRightControls = isFocused || addDueDate || addPriority !== 'none'`
- **失焦后**：若已设置日期或优先级，继续显示；否则隐藏
- **日期显示**：未设置时仅显示日历图标；已设置时显示格式化文本（如「3月13日 21:00」）
- **控件顺序**：输入框 → 日期 → 优先级
- **失焦时机**：点击组件外、Tab 离开、提交任务后

## 3. 日期选择器

- **形式**：Popover 内嵌 shadcn Calendar + 时间输入（Input，HH:mm）
- **依赖**：新增 shadcn `Popover`、`Calendar`
- **数据格式**：沿用 `YYYY-MM-DD HH:mm:ss`
- **清空**：Popover 内提供「清除」按钮

## 4. 优先级菜单

- **形式**：DropdownMenu，与任务行内的优先级区域一致
- **内容**：标题「优先级」+ 四选项（高/中/低/无），使用 Flag 图标与 `PRIORITY_FLAG_CLASS`
- **常量**：`PRIORITY_LABEL`、`PRIORITY_FLAG_CLASS` 可抽到共享或作为 props 传入

## 5. 边界情况

- **today/tomorrow 视图**：不展示日期控件；仍展示优先级（`showRightControls = isFocused || addPriority !== 'none'`）
- **提交后**：清空 input、addDueDate、addPriority，触发失焦
- **时间校验**：HH:mm 无效时保留原值
- **无障碍**：日历/旗帜图标设置 `aria-label`，Popover/DropdownMenu 支持键盘操作

## 6. 文件清单

| 操作 | 路径 |
|------|------|
| 新建 | topi/app/components/add-task-input.tsx |
| 新建 | topi/app/components/ui/popover.tsx |
| 新建 | topi/app/components/ui/calendar.tsx |
| 修改 | topi/app/components/task-list.tsx |
