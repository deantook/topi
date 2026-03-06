# due_date MySQL 格式错误修复实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 toggle 时 MySQL 报错 `Incorrect date value: '2026-03-07T00:00:00Z' for column 'due_date'`，通过增强 normalize 能力与 Repository 安全网实现防御性修复。

**Architecture:** 导出 model.NormalizeDueDateForDB 并增加 RFC3339 解析；在 repository.UpdateFields 中对 due_date 做最后一层标准化。

**Tech Stack:** Go, GORM, MySQL

**参考设计:** `docs/plans/2026-03-06-due-date-mysql-format-fix-design.md`

---

## Task 1: model/task.go - 增强 NormalizeDueDateForDB 并导出

**Files:**
- Modify: `topi-api/internal/model/task.go`
- Create: `topi-api/internal/model/task_test.go`

**Step 1: 创建 failing test**

在 `topi-api/internal/model/` 下创建 `task_test.go`：

```go
package model

import (
	"testing"
)

func TestNormalizeDueDateForDB(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		expect string
	}{
		{"RFC3339 with Z", "2026-03-07T00:00:00Z", "2026-03-07 00:00:00"},
		{"RFC3339 with offset", "2026-03-07T08:00:00+08:00", "2026-03-07 00:00:00"}, // +08:00 08:00 = UTC 00:00
		{"already MySQL format", "2026-03-07 00:00:00", "2026-03-07 00:00:00"},
		{"date only", "2026-03-07", "2026-03-07 00:00:00"},
		{"empty", "", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeDueDateForDB(tt.input)
			if got != tt.expect {
				t.Errorf("NormalizeDueDateForDB(%q) = %q, want %q", tt.input, got, tt.expect)
			}
		})
	}
}
```

**Step 2: Run test to verify it fails**

```bash
cd topi-api && go test ./internal/model/... -run TestNormalizeDueDateForDB -v
```

Expected: FAIL — `normalizeDueDateForDB` is unexported / undefined as `NormalizeDueDateForDB`

**Step 3: 重命名并导出，增加 RFC3339 布局**

在 `task.go` 中：

- 将 `normalizeDueDateForDB` 改名为 `NormalizeDueDateForDB`（首字母大写）
- BeforeCreate、BeforeSave 中的调用改为 `NormalizeDueDateForDB`
- 在 layouts 中、`"2006-01-02"` 之后增加：
  ```go
  time.RFC3339,      // 2026-03-07T00:00:00Z, 2026-03-07T00:00:00+08:00
  time.RFC3339Nano,  // 含纳秒
  ```
- 对 RFC3339 解析出的时间使用 `t.UTC().Format("2006-01-02 15:04:05")` 以输出 UTC（保持 DB 约定）

**Step 4: Run test to verify it passes**

```bash
cd topi-api && go test ./internal/model/... -run TestNormalizeDueDateForDB -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add topi-api/internal/model/task.go topi-api/internal/model/task_test.go
git commit -m "feat(model): export NormalizeDueDateForDB, add RFC3339 support"
```

---

## Task 2: service/task_service.go - 统一使用 model.NormalizeDueDateForDB

**Files:**
- Modify: `topi-api/internal/service/task_service.go`

**Step 1: 修改 normalizeDateTimeString**

将 `normalizeDateTimeString` 改为调用 `model.NormalizeDueDateForDB`，或在其 layouts 中增加 `time.RFC3339`、`time.RFC3339Nano`。

推荐：直接调用 `model.NormalizeDueDateForDB(s)`，删除重复逻辑，保持 DRY。

```go
func normalizeDateTimeString(s string) string {
	return model.NormalizeDueDateForDB(s)
}
```

**Step 2: Verify**

```bash
cd topi-api && go build ./...
```

Expected: 无编译错误

**Step 3: Commit**

```bash
git add topi-api/internal/service/task_service.go
git commit -m "refactor(service): use model.NormalizeDueDateForDB in task_service"
```

---

## Task 3: repository/task_repo.go - UpdateFields 安全网

**Files:**
- Modify: `topi-api/internal/repository/task_repo.go`

**Step 1: 在 UpdateFields 中增加 due_date 标准化**

在 `UpdateFields` 中，执行 `Updates` 前：

```go
func (r *TaskRepository) UpdateFields(id, userID string, fields map[string]interface{}) error {
	if len(fields) == 0 {
		return nil
	}
	if v, ok := fields["due_date"]; ok && v != nil {
		if s, ok := v.(string); ok && s != "" {
			fields["due_date"] = model.NormalizeDueDateForDB(s)
		}
	}
	return r.db.Model(&model.Task{}).Where("id = ? AND user_id = ?", id, userID).Updates(fields).Error
}
```

**Step 2: Verify**

```bash
cd topi-api && go build ./...
```

Expected: 无编译错误

**Step 3: Commit**

```bash
git add topi-api/internal/repository/task_repo.go
git commit -m "fix(repo): normalize due_date in UpdateFields as safety net"
```

---

## Task 4: 手动验证

**Step 1: 启动 API 与 MySQL**

按项目常规方式启动服务。

**Step 2: 创建含 due_date 的任务，执行 toggle**

- 创建任务，due_date 为 `2026-03-07` 或 `2026-03-07T00:00:00Z`（视 API 支持）
- 调用 `POST /api/v1/tasks/{id}/toggle`
- 确认无 Error 1292

**Step 3: 若环境允许，运行全量测试**

```bash
cd topi-api && go test ./...
```

Expected: 全部通过
