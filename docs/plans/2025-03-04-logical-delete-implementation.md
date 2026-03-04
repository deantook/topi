# 任务与清单逻辑删除实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 任务与清单均改为逻辑删除：添加 `DeletedAt` 字段，删除时不再物理删除，仅标记。

**Architecture:** 使用 GORM `gorm.DeletedAt`，`Delete()` 自动变成 UPDATE，`Find()` 自动过滤已删除记录。

**Tech Stack:** Go, GORM, React Router

---

## Task 1: Task 模型添加 DeletedAt

**Files:**
- Modify: `topi-api/internal/model/task.go`

**Step 1: 添加 DeletedAt 字段**

在 `Task` 结构体中添加：

```go
DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
```

需在 struct 内、`CreatedAt` 之后添加。需导入 `gorm.io/gorm`（已存在）。

**Step 2: 验证编译**

```bash
cd topi-api && go build ./...
```

Expected: 成功

**Step 3: Commit**

```bash
git add topi-api/internal/model/task.go
git commit -m "feat(model): add DeletedAt for task soft delete"
```

---

## Task 2: List 模型添加 DeletedAt

**Files:**
- Modify: `topi-api/internal/model/list.go`

**Step 1: 添加 DeletedAt 字段**

在 `List` 结构体中添加：

```go
DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
```

**Step 2: 验证编译**

```bash
cd topi-api && go build ./...
```

Expected: 成功

**Step 3: Commit**

```bash
git add topi-api/internal/model/list.go
git commit -m "feat(model): add DeletedAt for list soft delete"
```

---

## Task 3: 修改 Task Repository Delete 为软删除

**Files:**
- Modify: `topi-api/internal/repository/task_repo.go`

**Step 1: 确认行为**

当前 `Delete` 使用 `r.db.Where(...).Delete(&model.Task{})`。添加 `DeletedAt` 后，GORM 会自动将 `Delete` 变为 UPDATE `deleted_at`，无需修改代码。

**Step 2: 验证**

启动 API，从前端垃圾桶删除一个任务，检查数据库 `deleted_at` 已设置而非记录被删除。

（如无自动化测试，可手动验证。）

**Step 3: Commit**

如确认无需改代码，可跳过或与 Task 1 合并提交。若需调整，则单独提交。

---

## Task 4: 修改 List Repository Delete 为软删除

**Files:**
- Modify: `topi-api/internal/repository/list_repo.go`

**Step 1: 确认行为**

同上，GORM 在模型有 `DeletedAt` 时会自动软删除。`ListByUserID`、`GetByIDAndUserID` 的 `Find`/`First` 会自动排除已删除记录。

**Step 2: 验证**

启动 API，删除一个清单，确认数据库中记录仍然存在且 `deleted_at` 已设置；侧边栏不再显示该清单。

**Step 3: Commit**

同上。

---

## Task 5: 验证 ListByUserID 排除已删除任务

**Files:**
- `topi-api/internal/repository/task_repo.go`

**Step 1: 检查逻辑**

`ListByUserID` 中 `filter=trash` 时查询 `status=trash`。GORM 的 `Find` 会对带 `DeletedAt` 的模型自动加 `deleted_at IS NULL`，因此已软删除的任务不会出现在垃圾桶列表。

**Step 2: 无需代码修改**

仅确认行为正确即可。

---

## Task 6: 端到端验证

**Step 1: 任务逻辑删除**

1. 创建任务 → 移至垃圾桶
2. 在垃圾桶中删除该任务
3. 在数据库中确认：记录仍在，`deleted_at` 已设置
4. 重启 API，确认任务不再出现在任何列表

**Step 2: 清单逻辑删除**

1. 创建清单
2. 删除该清单
3. 在数据库中确认：记录仍在，`deleted_at` 已设置
4. 侧边栏「我的清单」不再显示该清单

**Step 3: Commit**

```bash
git add docs/plans/
git commit -m "docs: add logical delete design and implementation plan"
```
