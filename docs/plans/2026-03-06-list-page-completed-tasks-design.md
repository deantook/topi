# 清单页面显示已完成任务设计文档

> 设计日期：2026-03-06

## 概述

在每个清单页面（全部、今天、明天、近期7天、收集箱、自定义清单）增加可折叠的「已完成」区块，显示该清单下对应的已完成任务。默认折叠，点击展开。采用单次请求 + `includeCompleted` 参数，后端一次返回 active + completed。

## 1. 需求约束

| 项目 | 决策 |
|------|------|
| 适用页面 | 全部、今天、明天、近期7天、收集箱、自定义清单 |
| 展示形式 | 可折叠区块「已完成 (n)」，默认折叠 |
| 排除页面 | 已完成、放弃、垃圾桶（保持现有逻辑） |
| 数据获取 | API 扩展 `includeCompleted=true`，单次请求 |

## 2. API 扩展

### 2.1 参数

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `includeCompleted` | bool | false | 为 true 时，按相同过滤条件追加返回 completed 任务 |

### 2.2 适用 filter

- `all`、`today`、`tomorrow`、`recent-seven`、`inbox`、`listId`

### 2.3 响应

- 结构不变：`{ data: [ ... ] }`
- 数组中同时包含 active 与 completed，每条任务有 `status` 字段供前端区分

### 2.4 示例

- `GET /tasks?listId=xxx` → 仅 active
- `GET /tasks?listId=xxx&includeCompleted=true` → active + 该清单的 completed
- `GET /tasks?filter=today&date=2026-03-06&includeCompleted=true` → 今日 active + 今日 completed

## 3. 前端架构

### 3.1 数据流

- 清单页请求 tasks 时携带 `includeCompleted=true`
- `useTasks` 支持 `includeCompleted` 选项，调用 API 时传递
- 返回数据按 `status` 分组：`activeTasks`、`completedTasks`

### 3.2 组件变更

- `TaskList`：主列表渲染 activeTasks；底部增加可折叠区块，展开后渲染 completedTasks
- `useTasks`：增加 `includeCompleted` 选项，返回 `activeTasks`、`completedTasks`（或内部分组后分别暴露）

### 3.3 折叠区块 UI

- 标题：「已完成」+ 数量徽章
- 点击整行展开/折叠
- 展开后行样式与「已完成」页面一致（复选框、删除线、恢复等）

## 4. 边缘情况

| 情况 | 处理 |
|------|------|
| 无已完成任务 | 不渲染「已完成」区块 |
| completed/abandoned/trash 页面 | 不传 includeCompleted |
| Owner 筛选 | active 与 completed 共用同一 owner 参数 |

## 5. 排序

- Active 列表：保持现有逻辑（优先级 + order）
- Completed 区块：按 sort_order 或完成时间倒序，与「已完成」页一致

## 6. 恢复行为

在折叠区块中点击「恢复」：任务从 completed 变为 active，从 completed 列表移除并回到主列表，折叠区块数量同步更新。
