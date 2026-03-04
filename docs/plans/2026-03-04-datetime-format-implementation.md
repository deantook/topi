# 时间字段统一格式实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 统一前后端、数据库所有时间字段为 `yyyy-MM-dd HH:mm:ss`，支持到分钟选择，秒固定 00，采用用户本地时区（DB 存 UTC）。

**Architecture:** 后端新增 Timezone 中间件解析 `X-Timezone`/`X-Timezone-Offset`；due_date 从 DATE 改为 DATETIME；service 层做本地↔UTC 转换；created_at JSON 序列化输出统一格式。前端 apiClient 添加时区 header；date input 改为 datetime-local；formatDueDate 和筛选逻辑支持 datetime 格式。

**Tech Stack:** Go (Gin, GORM), MySQL, React, TypeScript

**参考设计:** `docs/plans/2026-03-04-datetime-format-design.md`

---

## Task 1: 后端 - 时区工具与中间件

**Files:**
- Create: `topi-api/pkg/timezone/timezone.go`
- Create: `topi-api/internal/middleware/timezone.go`
- Modify: `topi-api/internal/wire/wire.go` (auth group 添加 timezone 中间件)

**Step 1: 创建时区解析工具**

```go
// topi-api/internal/pkg/timezone/timezone.go
package timezone

import (
	"strconv"
	"time"
)

const ContextKey = "timezone"

// LoadFromHeaders 从 X-Timezone (IANA) 或 X-Timezone-Offset (分钟) 解析。无效时返回 UTC。
func LoadFromHeaders(timezoneName, offsetMinutes string) *time.Location {
	if timezoneName != "" {
		if loc, err := time.LoadLocation(timezoneName); err == nil {
			return loc
		}
	}
	if offsetMinutes != "" {
		if m, err := strconv.Atoi(offsetMinutes); err == nil && m >= -720 && m <= 720 {
			return time.FixedZone("Offset", m*60)
		}
	}
	return time.UTC
}
```

**Step 2: 创建 Timezone 中间件**

```go
// topi-api/internal/middleware/timezone.go
package middleware

import (
	"github.com/deantook/topi-api/pkg/timezone"
	"github.com/gin-gonic/gin"
)

func Timezone() gin.HandlerFunc {
	return func(c *gin.Context) {
		tz := c.GetHeader("X-Timezone")
		offset := c.GetHeader("X-Timezone-Offset")
		loc := timezone.LoadFromHeaders(tz, offset)
		c.Set(timezone.ContextKey, loc)
		c.Next()
	}
}
```

**Step 3: 注册中间件**

在 `wire.go` 的 auth group 中，在 `Auth` 之后添加 `middleware.Timezone()`：

```go
auth := v1.Group("")
auth.Use(middleware.Auth(jwtHelper))
auth.Use(middleware.Timezone())
```

**Step 4: 验证**

```bash
cd topi-api && go build ./...
```

**Step 5: Commit**

```bash
git add topi-api/pkg/timezone/timezone.go topi-api/internal/middleware/timezone.go topi-api/internal/wire/wire.go
git commit -m "feat(api): add timezone middleware and parsing"
```

---

## Task 2: 后端 - due_date 改为 DATETIME，模型与转换

**Files:**
- Modify: `topi-api/internal/model/task.go` (DueDate gorm type)
- Modify: `topi-api/internal/service/task_service.go` (normalize 与 时区转换逻辑)

**Step 1: 修改 Task 模型**

```go
// task.go 中
DueDate   *string        `gorm:"type:datetime" json:"due_date"`
```

**Step 2: 新增 datetime 标准化与转换**

在 `task_service.go` 中：
- 将 `normalizeDateString` 改为 `normalizeDateTimeString`：接受 `yyyy-MM-dd`、`yyyy-MM-dd HH:mm:ss`、`yyyy-MM-ddTHH:mm` 等，输出 `yyyy-MM-dd HH:mm:ss`
- 新增 `parseLocalToUTC(localStr string, loc *time.Location) (string, error)`：将本地时间字符串转为 UTC 的 `yyyy-MM-dd HH:mm:ss`
- 新增 `formatUTCToLocal(utcStr string, loc *time.Location) string`：将 UTC 字符串转为本地 `yyyy-MM-dd HH:mm:ss`

参考实现：

```go
func normalizeDateTimeString(s string) string {
	s = strings.TrimSpace(s)
	// yyyy-MM-dd
	if len(s) >= 10 && s[4] == '-' && s[7] == '-' {
		if len(s) == 10 {
			return s + " 00:00:00"
		}
		// yyyy-MM-dd HH:mm 或 yyyy-MM-dd HH:mm:ss 或 yyyy-MM-ddTHH:mm
		if len(s) >= 16 {
			base := s[:10]
			var h, m, sec int
			if strings.Contains(s, "T") {
				// ISO format
				parts := strings.Split(s, "T")
				if len(parts) == 2 && len(parts[1]) >= 5 {
					hm := strings.Split(parts[1], ":")
					if len(hm) >= 2 {
						h, _ = strconv.Atoi(hm[0])
						m, _ = strconv.Atoi(hm[1])
						if len(hm) >= 3 {
							sec, _ = strconv.Atoi(hm[2])
						}
					}
					return fmt.Sprintf("%s %02d:%02d:%02d", base, h, m, sec)
				}
			}
			if len(s) >= 19 {
				return s[:19] // yyyy-MM-dd HH:mm:ss
			}
			if len(s) >= 16 {
				return s[:16] + ":00" // yyyy-MM-dd HH:mm -> :00
			}
		}
		return s + " 00:00:00"
	}
	return s
}
```

更简洁的实现：用 `time.ParseInLocation` 解析，再 `Format` 输出。需在 service 中注入 `*time.Location`（从 context 获取，或通过 handler 传入）。

**简化方案：** handler 从 context 取 `loc`，传给 service。Service 的 Create/Update/List 接收 `loc` 参数。

**Step 3: 修改 Create 和 Update**

- Create: `dueDate` 非空时，`normalizeDateTimeString` 后，用 `parseLocalToUTC` 转为 UTC 存入
- Update: 同上

**Step 4: 修改 List 返回**

- 在 handler 层或 service 层，对返回的 tasks 中 `DueDate` 做 `formatUTCToLocal` 转回本地时间

**Step 5: 验证并 Commit**

---

## Task 3: 后端 - created_at 序列化

**Files:**
- Create: `topi-api/pkg/serializer/datetime.go` 或 在 response 包中处理
- Modify: Task/List handler 在返回前，将 `created_at` 转为 `yyyy-MM-dd HH:mm:ss`

**方案：** 在 handler 返回 tasks/lists 时，遍历并设置格式化后的 created_at。或定义 DTO 结构体，在序列化时转换。GORM 默认会序列化 time.Time 为 RFC3339。需要自定义 JSON 或返回前构建 DTO。

**简化：** 创建 `FormatTaskForResponse(task model.Task, loc *time.Location)` 返回带格式化字段的 map 或 struct。Handler 调用此函数后返回。

**Step 1: 实现 FormatTaskForResponse**

```go
// 在 handler 或新 pkg 中
func FormatTaskForResponse(t model.Task, loc *time.Location) map[string]interface{} {
	m := map[string]interface{}{ /* 复制 t 的字段 */ }
	m["created_at"] = t.CreatedAt.In(loc).Format("2006-01-02 15:04:05")
	if t.DueDate != nil {
		m["due_date"] = formatUTCToLocal(*t.DueDate, loc)
	}
	return m
}
```

或使用自定义类型实现 `json.Marshaler`，在 model 包中定义 `DateTime` 类型。

**推荐：** 在 response 层统一处理。查看 `pkg/response` 现有逻辑，在返回 `tasks` 时对每条 task 做字段替换。

---

## Task 4: Handler 注入 loc 并调用转换

**Files:**
- Modify: `topi-api/internal/handler/task_handler.go`
- 从 `c.Get(timezone.ContextKey)` 取 `*time.Location`，传入 service 的 List/Create/Update
- List 返回前对 tasks 的 due_date、created_at 做时区转换

---

## Task 5: Service 层日期过滤（today/tomorrow/recent-seven）

**Files:**
- Modify: `topi-api/internal/service/task_service.go`

**变更：** `due_date` 为 `yyyy-MM-dd HH:mm:ss` 时，与 `date`（yyyy-MM-dd）比较需用日期部分：
```go
if t.DueDate != nil {
    d := *t.DueDate
    if len(d) >= 10 {
        d = d[:10]
    }
    if d == date {
        filtered = append(filtered, t)
    }
}
```

同理 `recent-seven` 的区间比较用 `d[:10]`。

**注意：** 此时 DB 存的是 UTC，比较时应用 UTC 的日期部分，还是应用本地？设计说「日期过滤按 yyyy-MM-dd」。前端传的 date 是用户本地 yyyy-MM-dd。后端拿到的 tasks 的 DueDate 在 DB 里是 UTC。例如用户在北京选 2026-03-05 00:00:00 本地，存成 2026-03-04 16:00:00 UTC。today 传 date=2026-03-05，我们应匹配这条。所以不能直接用 UTC 字符串的 date 部分。正确做法：把 DB 的 UTC 转为用户本地，取日期部分再比较。即过滤时也要用 loc。

---

## Task 6: 前端 - apiClient 添加时区 header

**Files:**
- Modify: `topi/app/lib/api.ts`

**Step 1: 在 request 函数中，构建 headers 后添加：**

```typescript
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
headers.set("X-Timezone", tz);
```

**Step 2: 验证**

浏览器 Network 检查请求是否带上 X-Timezone。

**Step 3: Commit**

---

## Task 7: 前端 - due_date 改为 datetime-local

**Files:**
- Modify: `topi/app/components/task-list.tsx`
- Modify: `topi/app/hooks/use-tasks.ts`

**Step 1: task-list 中 date input 改为 datetime-local**

- `type="date"` → `type="datetime-local"`
- `value` 和 `onChange` 需兼容 `yyyy-MM-dd HH:mm:ss`。`datetime-local` 的 value 格式为 `yyyy-MM-ddTHH:mm`，需转换：
  - 显示：`task.dueDate ?? ""` 若为 `yyyy-MM-dd HH:mm:ss`，改为 `task.dueDate?.replace(" ", "T").slice(0, 16) ?? ""`
  - 回传：`e.target.value` 为 `yyyy-MM-ddTHH:mm`，改为 `e.target.value.replace("T", " ") + ":00"`

**Step 2: 添加任务时 today/tomorrow 的 options.dueDate**

当前为 `d.toISOString().slice(0, 10)`，改为包含时间，如 `yyyy-MM-dd 00:00:00`（本地）。

```typescript
const now = new Date();
const y = now.getFullYear();
const m = String(now.getMonth() + 1).padStart(2, "0");
const d = String(now.getDate()).padStart(2, "0");
const h = String(now.getHours()).padStart(2, "0");
const min = String(now.getMinutes()).padStart(2, "0");
options = { dueDate: `${y}-${m}-${d} ${h}:${min}:00` };
```

**Step 3: use-tasks 中 updateTask 的 dueDate**

当前 `d.slice(0, 10)` 只取日期。改为支持完整 `yyyy-MM-dd HH:mm:ss` 或 `yyyy-MM-ddTHH:mm`，统一为 `yyyy-MM-dd HH:mm:ss` 后发送。

**Step 4: Commit**

---

## Task 8: 前端 - formatDueDate 与筛选

**Files:**
- Modify: `topi/app/components/task-list.tsx` (formatDueDate)
- Modify: `topi/app/hooks/use-tasks.ts` (isSameDay, isInNext7Days)

**Step 1: formatDueDate**

`dueDate` 现为 `yyyy-MM-dd HH:mm:ss`。日期部分 `dateStr.slice(0, 10)`。今天/明天/日期展示不变，可追加时间展示如 `今天 18:30`。

**Step 2: isSameDay / isInNext7Days**

`dueDate` 为 `yyyy-MM-dd HH:mm:ss` 时，取 `dateStr.slice(0, 10)` 做日期比较；或 `new Date(dateStr)` 若解析正确。

**Step 3: filterToQuery**

`date`、`startDate`、`endDate` 保持 `yyyy-MM-dd`，无需改。

**Step 4: Commit**

---

## Task 9: 后端 - GORM AutoMigrate 与清理

**Files:**
- 确认 `topi-api` 启动时执行 AutoMigrate
- `due_date` 从 DATE 改为 DATETIME 时，GORM 可能会先 DROP 再 ADD（取决于 MySQL 行为）。用户已确认清空历史数据，无迁移脚本。

**Step 1: 验证**

启动 API，检查 tasks 表 `due_date` 类型为 `datetime`。

**Step 2: Commit**

---

## 执行选项

计划已保存到 `docs/plans/2026-03-04-datetime-format-implementation.md`。

**执行方式：**

**1. Subagent-Driven（本次对话）** - 按任务分派子 agent，逐任务执行并 review

**2. 独立会话（Parallel Session）** - 新开对话，使用 executing-plans 在 worktree 中批量执行

选哪种？
