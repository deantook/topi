# 删除清单时迁移任务到收集箱 - 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 删除清单时，先将该清单下所有任务的 `list_id` 设为 null（迁移到收集箱），再软删除清单。

**Architecture:** ListService 注入 TaskRepository；Delete 时先 ClearListIDByListID，再 listRepo.Delete。

**Tech Stack:** Go, GORM, Wire

---

## Task 1: TaskRepository 新增 ClearListIDByListID

**Files:**
- Modify: `topi-api/internal/repository/task_repo.go`

**Step 1: 添加 ClearListIDByListID 方法**

在 `Delete` 方法之后添加：

```go
// ClearListIDByListID sets list_id to NULL for all tasks with the given listID and userID.
func (r *TaskRepository) ClearListIDByListID(userID, listID string) error {
	return r.db.Model(&model.Task{}).
		Where("user_id = ? AND list_id = ?", userID, listID).
		Update("list_id", nil).Error
}
```

**Step 2: 验证编译**

```bash
cd topi-api && go build ./...
```

Expected: 成功

**Step 3: Commit**

```bash
git add topi-api/internal/repository/task_repo.go
git commit -m "feat(repo): add ClearListIDByListID for moving tasks to inbox"
```

---

## Task 2: ListService Delete 迁移任务后再删除清单

**Files:**
- Modify: `topi-api/internal/service/list_service.go`

**Step 1: 修改 ListService 结构体与构造函数**

将：

```go
type ListService struct {
	repo *repository.ListRepository
}

func NewListService(repo *repository.ListRepository) *ListService {
	return &ListService{repo: repo}
}
```

改为：

```go
type ListService struct {
	listRepo *repository.ListRepository
	taskRepo *repository.TaskRepository
}

func NewListService(listRepo *repository.ListRepository, taskRepo *repository.TaskRepository) *ListService {
	return &ListService{listRepo: listRepo, taskRepo: taskRepo}
}
```

**Step 2: 修改 Create、List、Update 中的 repo 引用**

将所有 `s.repo` 改为 `s.listRepo`。

**Step 3: 修改 Delete 方法**

将：

```go
func (s *ListService) Delete(userID, id string) error {
	return s.repo.Delete(id, userID)
}
```

改为：

```go
func (s *ListService) Delete(userID, id string) error {
	if _, err := s.listRepo.GetByIDAndUserID(id, userID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrListNotFound
		}
		return err
	}
	if err := s.taskRepo.ClearListIDByListID(userID, id); err != nil {
		return err
	}
	return s.listRepo.Delete(id, userID)
}
```

**Step 4: 验证编译**

```bash
cd topi-api && go build ./...
```

Expected: 失败（NewListService 签名变化，wire 未更新）

---

## Task 3: 重新生成 Wire 依赖注入

**Files:**
- `topi-api/internal/wire/wire_gen.go`（自动生成）

**Step 1: 执行 wire 生成**

```bash
make wire
```

或：

```bash
cd topi-api && go generate ./internal/wire/...
```

Expected: 成功，wire_gen.go 中 `listService := service.NewListService(listRepository)` 变为 `listService := service.NewListService(listRepository, taskRepository)`

**Step 2: 验证编译**

```bash
cd topi-api && go build ./...
```

Expected: 成功

**Step 3: Commit**

```bash
git add topi-api/internal/service/list_service.go topi-api/internal/wire/wire_gen.go
git commit -m "feat(service): move tasks to inbox when deleting list"
```

---

## Task 4: 端到端验证

**Step 1: 删除含任务的清单**

1. 启动 API 和前端：`make up` 或分别 `make api` 与 `make web`
2. 登录后创建清单 A，在其中添加若干任务
3. 删除清单 A
4. 检查：侧边栏不再显示清单 A；收集箱中应出现原清单中的任务；任务 `list_id` 为 null

**Step 2: 删除空清单**

1. 创建空清单 B，直接删除
2. 检查：删除成功，侧边栏不再显示 B

**Step 3: Commit（可选）**

```bash
git add docs/plans/
git commit -m "docs: add list-delete-move-tasks-to-inbox design and implementation plan"
```
