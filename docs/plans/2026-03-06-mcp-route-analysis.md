# www.lulumia.fun /api/v1 生效但 /mcp 不生效 — 原因分析

**日期**: 2026-03-06  
**背景**: 检查 deploy.yml、nginx.conf 及 MCP 路由配置，分析 `/api/v1/**` 正常而 `/mcp/**` 不生效的原因。

---

## 1. 配置现状

### 1.1 部署流程 (deploy.yml)

- 构建 topi-web、topi-api、拉取 nginx
- 通过 SCP 将 `deploy` 目录、docker-compose、镜像等拷贝到服务器
- SSH 加载镜像并执行 `docker compose up -d`

### 1.2 Nginx 主配置 (deploy/nginx.conf)

- 定义 upstream: `topi_web` → topi-web:3000, `topi_api` → topi-api:8080
- `include /etc/nginx/servers/*.conf` 引入各站点配置
- HTTP 80 全部 301 重定向到 HTTPS

### 1.3 站点配置 (deploy/servers/lulumia.fun.conf)

```nginx
server_name *.lulumia.fun lulumia.fun;

location /api/ {
    proxy_pass http://topi_api/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    # ...
}

location /mcp/ {
    proxy_pass http://topi_api/mcp/;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
    # ...
}

location / {
    proxy_pass http://topi_web/;
    # ...
}
```

### 1.4 后端路由 (topi-api)

- REST API: `r.Group("/api/v1")` → `/api/v1/*`
- MCP: `r.Group("/mcp")` → `/mcp/sse`, `/mcp/message`, `/mcp`, `/mcp/` 等
- MCP 需通过 `McpAuth` 中间件校验 token（query 或 Authorization header）

---

## 2. 可能原因分析

### 2.1 高优先级：`location /mcp/` 不匹配 `/mcp`（无尾斜杠）

| 请求路径 | `location /mcp/` 是否匹配 |
|----------|---------------------------|
| `/mcp/sse` | ✅ 匹配 |
| `/mcp/sse?token=xxx` | ✅ 匹配 |
| `/mcp/message` | ✅ 匹配 |
| `/mcp/` | ✅ 匹配 |
| `/mcp`（无斜杠） | ❌ **不匹配** |

`location /mcp/` 要求路径以 `/mcp/` 开头，因此纯 `/mcp` 会落到 `location /`，被转发到 topi-web，返回 SPA 或 404。

Streamable HTTP 可能使用 `POST /mcp` 或 `GET /mcp`，若客户端如此请求，则不会到达 topi-api。

### 2.2 中优先级：MCP 认证失败 (401)

- MCP 路由统一经过 `McpAuth` 中间件
- Token 可通过 query 参数 `token` 或 `Authorization: Bearer <token>` 传递
- Token 缺失或无效时返回 401，可能被误认为「不生效」

### 2.3 中优先级：SSE 长连接与代理行为

- MCP 使用 SSE 长连接
- 已配置 `proxy_buffering off`、长超时，理论上可支持 SSE
- 部分 HTTP/2 + 代理组合对 SSE 可能有兼容问题，需实测

### 2.4 低优先级：MCP_BASE_URL 未配置

- MCP.md 建议远程部署时设置 `MCP_BASE_URL`
- 主要影响 endpoint 事件中的 message URL，一般不导致初始连接失败
- 若未设置，agent 可能收到错误的 base URL，影响后续 POST 请求

---

## 3. 推荐修复

### 3.1 扩展 /mcp 路由匹配（推荐）

将 `location /mcp/` 改为同时匹配 `/mcp` 和 `/mcp/*`：

```nginx
# 方案 A：用 /mcp 替代 /mcp/，同时匹配 /mcp 与 /mcp/xxx
location /mcp {
    proxy_pass http://topi_api/mcp;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

注意：`proxy_pass http://topi_api/mcp`（无尾斜杠）会原样转发完整 URI，`/mcp`、`/mcp/`、`/mcp/sse` 都能正确到达 topi-api。

### 3.2 确认 MCP 实际请求路径

- 在服务器上对 nginx 启用 access log，或对 topi-api 打日志，确认 MCP 客户端实际请求的 path
- 若客户端请求 `/mcp`（无尾斜杠），即可确认问题与 2.1 相关

### 3.3 配置 MCP_BASE_URL（生产环境）

在 topi-api 的 `.env` 或 `docker-compose` 中设置：

```
MCP_BASE_URL=https://www.lulumia.fun
```

---

## 4. 验证步骤

1. **本地验证 nginx 行为**  
   修改 nginx 配置后，在服务器上执行 `nginx -t` 并重载 `nginx -s reload`，再测试 MCP 连接。
2. **用 curl 测试 /mcp/sse**  
   `curl -N "https://www.lulumia.fun/mcp/sse?token=YOUR_TOKEN"`，应返回 SSE 流。
3. **用 curl 测试 /mcp（无斜杠）**  
   `curl -v "https://www.lulumia.fun/mcp?token=YOUR_TOKEN"`，查看是否被正确转发到 topi-api 或返回 404/HTML。

---

## 5. 小结

| 结论 | 说明 |
|------|------|
| nginx 与 deploy 流程 | 配置和流程本身无明显错误 |
| 最可能原因 | `/mcp` 无尾斜杠时未被 `/mcp/` 匹配，被转发到 topi-web |
| 建议修改 | 将 `location /mcp/` 改为 `location /mcp`，`proxy_pass` 使用 `http://topi_api/mcp`（无尾斜杠） |
| 次要排查 | 401 认证失败、MCP_BASE_URL 未配置、SSE 长连接兼容性 |
