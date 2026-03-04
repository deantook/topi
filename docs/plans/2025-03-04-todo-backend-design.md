# Topi 待办后端设计文档

> 设计日期：2025-03-04

## 概述

为 topi 待办应用提供后端 API 服务，使用 Gin、GORM、MySQL、Swagger、Wire 实现分层架构。支持用户认证（JWT）、多租户，与现有 React 前端的任务/清单模型兼容。

## 1. 项目结构

```
topi-api/
├── cmd/server/
│   └── main.go              # 入口：加载配置、Wire 注入、启动 Gin
├── internal/
│   ├── config/              # 配置加载（env）
│   ├── model/               # GORM 实体：User, Task, List
│   ├── repository/          # 数据访问实现
│   ├── service/             # 业务逻辑
│   ├── handler/             # Gin 路由与 HTTP 处理
│   ├── middleware/          # JWT 校验、CORS
│   └── wire/                # wire.go + wire_gen.go
├── pkg/
│   ├── jwt/                 # JWT 签发与解析
│   └── response/            # 统一 JSON 响应格式
├── docs/
│   └── swagger/             # swag 生成的 Swagger 注解与文档
├── go.mod
├── go.sum
└── .env.example
```

## 2. 数据模型

| 表 | 字段 | 说明 |
|----|------|------|
| users | id (UUID), username, password_hash, created_at | 用户 |
| lists | id (UUID), user_id, name, created_at | 自定义清单 |
| tasks | id (UUID), user_id, list_id (nullable), title, completed, due_date (nullable), status, `order`, created_at | 任务 |

- tasks.status: `active` | `completed` | `abandoned` | `trash`
- tasks.order: 同过滤条件下的排序
- 密码使用 bcrypt 存储
- 迁移：GORM AutoMigrate 启动时自动建表

## 3. API 设计

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/register | body: { "username", "password" } |
| POST | /api/v1/login | body: { "username", "password" }, 返回 { "token": "jwt..." } |

### 任务（需 JWT）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/tasks | query: filter, listId |
| POST | /api/v1/tasks | body: { "title", "listId?", "dueDate?" } |
| PATCH | /api/v1/tasks/:id | body: { "title?", "listId?", "dueDate?" } |
| POST | /api/v1/tasks/:id/toggle | 切换完成 |
| POST | /api/v1/tasks/:id/abandon | 放弃 |
| POST | /api/v1/tasks/:id/restore | 恢复 |
| DELETE | /api/v1/tasks/:id | 永久删除 |
| POST | /api/v1/tasks/reorder | body: { "id", "newIndex" } |

### 清单（需 JWT）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/lists | 全部清单 |
| POST | /api/v1/lists | body: { "name" } |
| PATCH | /api/v1/lists/:id | body: { "name" } |
| DELETE | /api/v1/lists/:id | 删除 |

### 约定

- 认证：`Authorization: Bearer <token>`
- 成功：`{ "data": ... }`
- 失败：`{ "error": "message" }` + 对应 HTTP 状态码

## 4. Wire 依赖注入

- 注入链：config → DB → repositories → services → handlers → Gin Engine
- JWT 依赖 config 中的 secret
- internal/wire/wire.go 定义 InitializeServer()

## 5. 认证中间件与 JWT

- 注册/登录：bcrypt 哈希，签发 JWT
- 受保护路由：解析 Bearer token，校验后写入 c.Set("userId", userId)
- 无效 token 返回 401 + { "error": "unauthorized" }
- 公开：register, login；受保护：tasks/*, lists/*
- JWT：HS256，过期时间从 config 读取（如 7 天）

## 6. Swagger

- swaggo/swag + gin-swagger
- swag init 扫描 handler 注解生成文档
- /swagger/index.html 提供 UI

## 7. 配置与启动

### .env 示例

```
PORT=8080
DB_DSN=user:password@tcp(localhost:3306)/topi?charset=utf8mb4&parseTime=True
JWT_SECRET=your-secret-key
JWT_EXPIRE_HOURS=168
GIN_MODE=debug
CORS_ORIGIN=http://localhost:5173
```

### main 流程

1. Load .env
2. 读取配置
3. Wire 生成 Server
4. DB AutoMigrate
5. 注册路由（含 Swagger）
6. 启动 Listen
