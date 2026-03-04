# 任务与清单逻辑删除设计

> **Goal:** 任务：垃圾桶内「删除」改为逻辑删除；清单：删除改为逻辑删除
>
> **Approach:** 使用 GORM 内置 `gorm.DeletedAt` 实现软删除，AutoMigrate 自动添加字段。

## 1. 背景

- **任务**：已有「移至垃圾桶」(status=trash)，从垃圾桶「删除」当前为物理删除，改为逻辑删除
- **清单**：当前删除为物理删除，改为逻辑删除

## 2. 方案

### Task（任务）

1. 在 `model.Task` 中增加 `DeletedAt gorm.DeletedAt`
2. `Delete` 从物理删除改为软删除：`db.Delete()` 在存在 `DeletedAt` 时会自动执行 `UPDATE deleted_at = NOW()`
3. 查询时 GORM 自动加上 `deleted_at IS NULL`，无需改动 repo 查询逻辑
4. 前端仍调用 `DELETE /tasks/:id`，行为从「物理删除」变为「逻辑删除」

### List（清单）

1. 在 `model.List` 中增加 `DeletedAt gorm.DeletedAt`
2. `Delete` 改为软删除，同样通过 `db.Delete()` 自动实现
3. `ListByUserID`、`GetByIDAndUserID` 会自动排除已软删除记录
4. 前端仍调用 `DELETE /lists/:id`，行为变为逻辑删除

## 3. 数据流

| 操作 | 变更前 | 变更后 |
|------|--------|--------|
| 任务：移至垃圾桶 | status=trash | 不变 |
| 任务：从垃圾桶删除 | 物理 DELETE | 设置 deleted_at |
| 任务：列表/垃圾桶查询 | - | 自动排除 deleted_at 非空 |
| 清单：删除 | 物理 DELETE | 设置 deleted_at |
| 清单：列表查询 | - | 自动排除 deleted_at 非空 |

## 4. 不做的功能（YAGNI）

- 恢复已逻辑删除的清单（后续可加）
- 恢复已逻辑删除的任务（后续可加）
- 物理删除接口（管理员 / 数据清理）

## 5. 迁移

使用现有 GORM `AutoMigrate`，新增 `deleted_at` 列，对已有数据无影响（默认 NULL，视为未删除）。
