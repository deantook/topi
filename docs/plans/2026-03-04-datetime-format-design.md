# 时间字段统一格式设计

> 设计日期：2026-03-04

## 概述

统一前后端、数据库所有时间字段格式为 `yyyy-MM-dd HH:mm:ss`，支持到分钟级选择，秒固定为 00。采用用户本地时区，DB 存 UTC，通过请求头传递时区做转换。

## 1. 影响范围

| 字段      | 实体          | 当前                              | 变更后                                           |
|-----------|---------------|-----------------------------------|--------------------------------------------------|
| due_date  | Task          | DATE (YYYY-MM-DD)                | DATETIME，格式 `yyyy-MM-dd HH:mm:ss`             |
| created_at| Task, List, User | time.Time → RFC3339            | 序列化为 `yyyy-MM-dd HH:mm:ss`（用户本地时间）   |
| deleted_at| Task, List    | 内部用，不对外                    | 不变                                             |

## 2. 时区约定

- **请求头**：`X-Timezone: Asia/Shanghai`（IANA 时区名）或 `X-Timezone-Offset: 480`（分钟，UTC+8 = 480）
- **写入**：客户端送本地时间 → 后端转为 UTC 存入 DB
- **读取**：DB 存 UTC → 后端按请求头时区转为本地时间返回
- **无 header**：按 UTC 处理

## 3. 后端设计

### 模型

- **Task.due_date**：保持 `*string`，`gorm:"type:date"` 改为 `gorm:"type:datetime"`
- **Task / List / User.created_at**：仍 `time.Time`，JSON 序列化输出 `yyyy-MM-dd HH:mm:ss`（经时区转换）

### 中间件

- 新增 `TimezoneMiddleware`：从 `X-Timezone` 或 `X-Timezone-Offset` 解析时区，写入 `gin.Context`

### 转换逻辑

- **请求**：`dueDate: "2026-03-04 18:30:00"` + 时区 → 解析为 UTC → 存储
- **响应**：DB 中 UTC → 按请求时区转为 `yyyy-MM-dd HH:mm:ss` 写入 JSON

### Schema 变更

- `due_date`：`DATE` → `DATETIME`（GORM AutoMigrate 或启动时 ALTER）
- **不迁移历史数据**：用户清空所有历史记录

## 4. 前端设计

### 时间选择

- **due_date**：`<input type="date">` → `type="datetime-local"`
- `datetime-local` 输出 `yyyy-MM-ddTHH:mm`，秒默认 00

### 时区

- 在 `apiClient` 统一添加 header：`X-Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone`

### 展示

- API 返回本地时间，可直接显示
- `formatDueDate` 扩展为支持带时分（如「今天 18:30」）

### 筛选

- `today` / `tomorrow` / `recent-seven` 按日期部分 `yyyy-MM-dd` 比较
- 查询参数 `date`、`startDate`、`endDate` 仍为 `yyyy-MM-dd`

## 5. 边界情况

| 情况                 | 处理                     |
|----------------------|--------------------------|
| 无时区 header        | 按 UTC                   |
| 非法时区名           | 回退 UTC，不 4xx         |
| 非法时间格式         | 400，提示格式错误        |
| dueDate 空字符串     | 存 NULL                  |
| datetime-local 只到分钟 | 自动补 `:00` 作为秒      |

## 6. 向后兼容

- 旧客户端发送 `2026-03-04` 或 `2026-03-04T00:00:00Z`：`normalizeDateString` 截取日期部分，补 ` 00:00:00` 后解析
