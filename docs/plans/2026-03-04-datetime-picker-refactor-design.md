# 日期时间选择器重构设计

> 设计日期：2026-03-04

## 概述

抽取共享的 DateTimePicker 组件，支持日期 + 时间选择，提供今天、明天、下周一三个快捷按钮（时间统一 09:00），应用于任务添加与任务编辑。

## 1. 架构与组件划分

| 组件 | 路径 | 职责 |
|------|------|------|
| `DateTimePicker` | `topi/app/components/datetime-picker.tsx` | 日期+时间选择、快捷按钮，纯受控 |
| `DateTimePickerPopover` | 同文件或作为包装 | Popover + DateTimePicker 组合，处理 open/close、清除 |

**使用点**：
- **AddTaskInput**：用 DateTimePickerPopover 替换现有 Popover+Calendar+time
- **TaskList 编辑**：用 DateTimePickerPopover 替换内联 `datetime-local`，Trigger 为日期文案或图标

**数据格式**：`YYYY-MM-DD HH:mm:ss`（沿用）
**Props**：`value: string \| null`、`onChange: (value: string \| null) => void`、`onClear?: () => void`
**快捷时间**：统一 09:00

## 2. 快捷按钮

| 按钮 | 图标 | 结果 |
|------|------|------|
| 今天 | Sun | 今天 09:00 |
| 明天 | ArrowRight | 明天 09:00 |
| 下周 | Calendar + 文案「下周」 | 下周一 09:00 |

- 下周一：固定取「下一个周一」（无论今天周几）
- 样式：与优先级按钮类似，支持 hover、选中态

## 3. UI 布局（Popover 内，自上而下）

1. 顶部：当前选中展示（如「3月13日, 21:00」）
2. 快捷按钮：今日 / 明天 / 下周
3. 日历：shadcn Calendar
4. 时间输入：`<input type="time">` HH:mm
5. 底部：清除、确定

编辑场景需要「确定」步骤以显式提交。

## 4. 边界情况

- **today/tomorrow 视图**：AddTaskInput 不展示日期控件
- **空值**：日历/时间显示占位，不提交
- **时间校验**：沿用 `isValidTime`
- **下周一**：today.getDay() === 1 时为「下周一」，否则取「下一个周一」

## 5. 无障碍

快捷按钮、日历、时间设置 aria-label；Popover 键盘支持由 Radix 提供。

## 6. 整合细节

### AddTaskInput
- 用 DateTimePickerPopover 替换现有 Popover
- addDueDate 作为 value，onChange → setAddDueDate

### TaskList 编辑
- 移除内联 datetime-local
- Trigger：点击日期文案或「设置截止日期」
- value={task.dueDate}，onChange → updateTask
- 右键「截止日期」可打开对应 Popover
