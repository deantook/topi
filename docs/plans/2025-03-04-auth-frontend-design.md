# Topi 前端登录注册与 API 接入设计

> 设计日期：2025-03-04

## 概述

为 topi 待办前端实现登录、注册功能，并接入 topi-api 后端。采用独立页面、loader 保护、全部路由需登录；数据层从 localStorage 迁移到 API。

## 1. 路由与布局结构

- **公开路由**：`/login`、`/register`，无侧栏
- **受保护路由**：所有业务路由（`/`、`/today`、`/inbox` 等），含侧栏
- **保护逻辑**：layout loader 中检查 `localStorage.getItem("token")`，无则 `redirect("/login")`

## 2. API 客户端与 Token

- Token 存 `localStorage`，键 `token`
- `lib/api.ts`：getApiUrl()、apiClient()，自动附加 `Authorization: Bearer ${token}`
- `VITE_API_URL` 默认 `http://localhost:8080`

## 3. 数据层迁移

- `use-tasks`、`use-custom-lists` 改为调用 API
- 字段映射：listId ↔ list_id，dueDate ↔ due_date，order ↔ sort_order
- API 返回 `{ data: T }`，从 `res.data` 取数据

## 4. 登录/注册 UI

- shadcn Form + React Hook Form + Zod
- 登录：username、password；注册：username、password、confirmPassword
- 校验：密码至少 6 位，confirmPassword 需匹配
- 支持 `?redirect=` 跳转

## 5. 错误、加载与登出

- 401：清除 token，跳转 /login
- 加载：Skeleton 或 loading
- 侧栏底部增加「退出」按钮

## 6. 文件清单

| 操作 | 路径 |
|------|------|
| 新建 | topi/lib/api.ts |
| 新建 | topi/lib/auth.ts |
| 新建 | topi/app/routes/login.tsx |
| 新建 | topi/app/routes/register.tsx |
| 修改 | topi/app/routes/layout.tsx |
| 修改 | topi/app/routes.ts |
| 修改 | topi/app/hooks/use-tasks.ts |
| 修改 | topi/app/hooks/use-custom-lists.ts |
| 修改 | topi/app/components/app-layout.tsx |
| 新建 | topi/.env.example |
