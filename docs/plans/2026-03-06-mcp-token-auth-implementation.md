# MCP Token Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 MCP 认证从 JWT 改为专用 MCP 令牌，每用户一个长期有效令牌，在设置页生成/撤销。

**Architecture:** User 表新增 McpTokenHash、McpTokenPrefix；MCP 路由使用新中间件按 token hash 查用户；REST API 新增 /mcp-token 端点；设置页新增 MCP 令牌管理区块。

**Tech Stack:** Go/Gin, GORM, React/Remix, shadcn/ui, apiClient

---

参考设计：`docs/plans/2026-03-06-mcp-token-auth-design.md`

---

### Task 1: User 模型与迁移

**Files:**
- Modify: `topi-api/internal/model/user.go`
- Test: `topi-api/cmd/server/main.go`（AutoMigrate 已含 User）

**Step 1: 添加 User 字段**

在 `topi-api/internal/model/user.go` 中，在 User struct 内添加：

```go
	McpTokenHash  *string `gorm:"type:char(64);uniqueIndex;default:null" json:"-"`
	McpTokenPrefix string `gorm:"size:20;default:''" json:"-"`
```

**Step 2: 验证迁移**

```bash
cd topi-api && go run ./cmd/server/main.go
```

启动后应无报错，DB 新增两列。Ctrl+C 退出。

**Step 3: Commit**

```bash
git add topi-api/internal/model/user.go
git commit -m "feat(model): add McpTokenHash and McpTokenPrefix to User"
```

---

### Task 2: UserRepository 按 hash 查询

**Files:**
- Modify: `topi-api/internal/repository/user_repo.go`

**Step 1: 添加 GetByMcpTokenHash**

在 `user_repo.go` 末尾添加：

```go
func (r *UserRepository) GetByMcpTokenHash(hash string) (*model.User, error) {
	var u model.User
	err := r.db.Where("mcp_token_hash = ?", hash).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}
```

**Step 2: 添加 Update（用于设置/清除 MCP token）**

```go
func (r *UserRepository) Update(u *model.User) error {
	return r.db.Save(u).Error
}
```

**Step 3: Commit**

```bash
git add topi-api/internal/repository/user_repo.go
git commit -m "feat(repo): add GetByMcpTokenHash and Update for User"
```

---

### Task 3: McpTokenService 与 token 生成逻辑

**Files:**
- Create: `topi-api/internal/service/mcp_token_service.go`

**Step 1: 实现 McpTokenService**

```go
package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/deantook/topi-api/internal/repository"
)

const tokenPrefix = "topi_"
const tokenSuffixLen = 8

var charset = []byte("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")

type McpTokenService struct {
	userRepo *repository.UserRepository
}

func NewMcpTokenService(userRepo *repository.UserRepository) *McpTokenService {
	return &McpTokenService{userRepo: userRepo}
}

func (s *McpTokenService) GetStatus(userID string) (hasToken bool, prefix string, err error) {
	u, err := s.userRepo.GetByID(userID)
	if err != nil {
		return false, "", err
	}
	if u.McpTokenHash == nil || *u.McpTokenHash == "" {
		return false, "", nil
	}
	return true, u.McpTokenPrefix, nil
}

func (s *McpTokenService) Generate(userID string) (token string, err error) {
	token = tokenPrefix + randString(tokenSuffixLen)
	hash := sha256Hash(token)
	prefix := token[:len(tokenPrefix)+4] + "..."

	u, err := s.userRepo.GetByID(userID)
	if err != nil {
		return "", err
	}
	u.McpTokenHash = &hash
	u.McpTokenPrefix = prefix
	if err := s.userRepo.Update(u); err != nil {
		return "", err
	}
	return token, nil
}

func (s *McpTokenService) Revoke(userID string) error {
	u, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}
	u.McpTokenHash = nil
	u.McpTokenPrefix = ""
	return s.userRepo.Update(u)
}

func (s *McpTokenService) ValidateToken(token string) (userID string, err error) {
	if len(token) < len(tokenPrefix)+tokenSuffixLen {
		return "", fmt.Errorf("invalid token")
	}
	if token[:len(tokenPrefix)] != tokenPrefix {
		return "", fmt.Errorf("invalid token")
	}
	hash := sha256Hash(token)
	u, err := s.userRepo.GetByMcpTokenHash(hash)
	if err != nil {
		return "", err
	}
	return u.ID, nil
}

func randString(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	for i := range b {
		b[i] = charset[int(b[i])%len(charset)]
	}
	return string(b)
}

func sha256Hash(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}
```

**Step 2: 修复 import**

若 `fmt` 未使用可移除；`model` 若未用可移除。

**Step 3: 运行测试**

```bash
cd topi-api && go build ./...
```

Expected: 无编译错误

**Step 4: Commit**

```bash
git add topi-api/internal/service/mcp_token_service.go
git commit -m "feat(service): add McpTokenService for token CRUD and validation"
```

---

### Task 4: McpToken API Handler 与路由

**Files:**
- Create: `topi-api/internal/handler/mcp_token_handler.go`
- Modify: `topi-api/internal/wire/wire.go`（注入 handler、注册路由）

**Step 1: 创建 McpTokenHandler**

```go
package handler

import (
	"net/http"

	"github.com/deantook/topi-api/internal/service"
	"github.com/deantook/topi-api/pkg/response"
	"github.com/gin-gonic/gin"
)

type McpTokenHandler struct {
	svc *service.McpTokenService
}

func NewMcpTokenHandler(svc *service.McpTokenService) *McpTokenHandler {
	return &McpTokenHandler{svc: svc}
}

func (h *McpTokenHandler) GetStatus(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	if userID == "" {
		response.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	hasToken, prefix, err := h.svc.GetStatus(userID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	res := gin.H{"hasToken": hasToken}
	if hasToken {
		res["prefix"] = prefix
	}
	response.OK(c, res)
}

func (h *McpTokenHandler) Generate(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	if userID == "" {
		response.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	token, err := h.svc.Generate(userID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{
		"token":   token,
		"message": "请妥善保存，此令牌仅显示一次",
	})
}

func (h *McpTokenHandler) Revoke(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	if userID == "" {
		response.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if err := h.svc.Revoke(userID); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"message": "已撤销"})
}
```

**Step 2: 添加 middleware 引用**

在 `mcp_token_handler.go` 顶部 import 中确保有：

```go
	"github.com/deantook/topi-api/internal/middleware"
```

**Step 3: Wire 注入**

在 `wire.go` 中：
- `wire.Build` 中加入 `service.NewMcpTokenService`、`handler.NewMcpTokenHandler`
- `provideRouter` 签名增加 `mcpTokenH *handler.McpTokenHandler`
- 在 `auth` 组内增加：
  - `auth.GET("/mcp-token", mcpTokenH.GetStatus)`
  - `auth.POST("/mcp-token", mcpTokenH.Generate)`
  - `auth.DELETE("/mcp-token", mcpTokenH.Revoke)`

**Step 4: 运行 wire**

```bash
cd topi-api && go generate ./internal/wire/...
go build ./...
```

**Step 5: Commit**

```bash
git add topi-api/internal/handler/mcp_token_handler.go topi-api/internal/wire/wire.go topi-api/internal/wire/wire_gen.go
git commit -m "feat(api): add MCP token GET/POST/DELETE endpoints"
```

---

### Task 5: MCP 认证中间件（替换 JWT）

**Files:**
- Create: `topi-api/internal/middleware/mcp_auth.go`
- Modify: `topi-api/internal/wire/wire.go`（MCP 路由改用 McpAuth）

**Step 1: 创建 McpAuth 中间件**

```go
package middleware

import (
	"net/http"
	"strings"

	"github.com/deantook/topi-api/internal/mcp"
	"github.com/deantook/topi-api/internal/service"
	"github.com/deantook/topi-api/pkg/response"
	"github.com/gin-gonic/gin"
)

func McpAuth(mcpTokenSvc *service.McpTokenService) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.Query("token")
		if token == "" {
			if auth := c.GetHeader("Authorization"); auth != "" && strings.HasPrefix(auth, "Bearer ") {
				token = strings.TrimPrefix(auth, "Bearer ")
			}
		}
		if token == "" {
			response.Error(c, http.StatusUnauthorized, "unauthorized")
			c.Abort()
			return
		}
		userID, err := mcpTokenSvc.ValidateToken(token)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "unauthorized")
			c.Abort()
			return
		}
		c.Set(UserIDKey, userID)
		c.Next()
	}
}
```

**Step 2: 修改 wire.go 的 MCP 路由**

将：

```go
	mcpGroup.Use(middleware.Auth(jwtHelper))
```

改为：

```go
	mcpGroup.Use(middleware.McpAuth(mcpTokenSvc))
```

需要将 `McpTokenService` 注入到 `provideRouter` 参数中，并在 wire.Build 中提供。

**Step 3: 更新 wire 依赖**

确保 provideRouter 接收 `mcpTokenSvc *service.McpTokenService`，替换 jwtHelper 用于 mcpGroup。

**Step 4: 运行**

```bash
cd topi-api && go generate ./internal/wire/... && go build ./...
```

**Step 5: Commit**

```bash
git add topi-api/internal/middleware/mcp_auth.go topi-api/internal/wire/wire.go topi-api/internal/wire/wire_gen.go
git commit -m "feat(mcp): use MCP token auth instead of JWT for MCP routes"
```

---

### Task 6: 设置页 MCP 令牌 UI - 后端集成

**Files:**
- Create: `topi/app/lib/mcp-token.ts`（API 封装）
- Modify: `topi/app/routes/settings.tsx`

**Step 1: 创建 mcp-token API 封装**

```ts
// topi/app/lib/mcp-token.ts
import { apiClient } from "./api";

export type McpTokenStatus = {
  hasToken: boolean;
  prefix?: string;
};

export type McpTokenGenerateResult = {
  token: string;
  message: string;
};

export async function getMcpTokenStatus(): Promise<McpTokenStatus> {
  return apiClient.get<McpTokenStatus>("/mcp-token");
}

export async function generateMcpToken(): Promise<McpTokenGenerateResult> {
  return apiClient.post<McpTokenGenerateResult>("/mcp-token");
}

export async function revokeMcpToken(): Promise<void> {
  return apiClient.delete("/mcp-token");
}
```

**Step 2: 在 settings 页添加 MCP 令牌区块骨架**

在 `topi/app/routes/settings.tsx` 中，在 `TaskList` 上方添加卡片区块，包含：
- 标题「MCP 令牌」
- 说明文案：用于 agent MCP 连接，长期有效
- 使用 `useLoaderData` 或 `useFetcher` 获取状态
- 占位按钮（下一 Task 实现逻辑）

**Step 3: Commit**

```bash
git add topi/app/lib/mcp-token.ts topi/app/routes/settings.tsx
git commit -m "feat(settings): add MCP token section skeleton"
```

---

### Task 7: 设置页 MCP 令牌 UI - 完整交互

**Files:**
- Modify: `topi/app/routes/settings.tsx`

**Step 1: 实现完整逻辑**

- 无令牌：显示「生成令牌」按钮，点击调用 `generateMcpToken()`，弹窗展示 token + 复制按钮 + agent 配置示例
- 有令牌：显示 prefix，提供「重新生成」「撤销」；重新生成同生成流程
- 使用 `useFetcher` 或 state 管理加载/错误
- 使用 shadcn `Card`、`Button`、`AlertDialog` 或 `Dialog`

**Step 2: agent 配置示例文案**

在弹窗中显示：
```
在 agent Settings → MCP 中配置：
{
  "mcpServers": {
    "topi": {
      "url": "http://localhost:8080/mcp/sse?token=YOUR_TOKEN"
    }
  }
}
```

将 YOUR_TOKEN 替换为实际 token。

**Step 3: 手动测试**

登录 → 进入设置页 → 生成令牌 → 复制 → 更新 agent MCP 配置 → 验证 MCP 工具可用 → 撤销 → 验证 401

**Step 4: Commit**

```bash
git add topi/app/routes/settings.tsx
git commit -m "feat(settings): complete MCP token generate/revoke UI"
```

---

### Task 8: 文档更新

**Files:**
- Modify: `topi-api/docs/MCP.md`
- Modify: `README.md`（若含 MCP 配置说明）

**Step 1: 更新 MCP.md**

- 移除「从 Local Storage 获取 JWT」的说明
- 改为：在设置页生成 MCP 令牌，复制到 agent 配置
- 更新「认证说明」：MCP 仅接受 MCP 令牌，不再接受 JWT

**Step 2: 更新 README（如有）**

若 README 含 MCP 配置步骤，同步更新。

**Step 3: Commit**

```bash
git add topi-api/docs/MCP.md README.md
git commit -m "docs: update MCP auth to token-based, settings page"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-03-06-mcp-token-auth-implementation.md`. Two execution options:

1. **Subagent-Driven (this session)** — 按 task 依次执行，每完成一个 task 做一次检查
2. **Parallel Session (separate)** — 在新建 worktree/session 中，用 executing-plans 批量执行

你希望用哪种方式？
