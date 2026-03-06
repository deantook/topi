# 删除清单时将任务迁移到收集箱

> **Goal:** 删除清单时，将该清单下的所有任务的 `list_id` 设为 null，使其归入收集箱；再软删除清单。

## 1. 背景

- **当前行为：** 清单软删除后，任务仍保留 `list_id` 指向已删清单，成为「孤儿」任务，仅在「全部」和搜索中可见，显示「已删除的清单」。
- **目标行为：** 删除清单时，先把该清单下所有任务迁移到收集箱（`list_id = null`），再软删除清单，任务可继续在收集箱中管理。

## 2. 方案

采用 **ListService 注入 TaskRepository**：在 `ListService.Delete` 中，先调用 `taskRepo.ClearListIDByListID` 批量清空 `list_id`，再调用 `listRepo.Delete` 软删除清单。

## 3. 范围

- 迁移**所有状态**的任务：active、completed、abandoned、trash，只要 `list_id = 清单ID` 即迁移。
- 收集箱定义：`list_id IS NULL`。

## 4. 后端改动

| 组件 | 改动 |
|------|------|
| `task_repo` | 新增 `ClearListIDByListID(userID, listID string) error`：`UPDATE tasks SET list_id = NULL WHERE user_id = ? AND list_id = ?` |
| `list_service` | `Delete` 中：1）校验清单存在；2）调用 `taskRepo.ClearListIDByListID`；3）调用 `listRepo.Delete` |
| `wire` | `NewListService` 增加 `*repository.TaskRepository` 参数 |

## 5. 前端

- 无需改动，仍调用 `DELETE /lists/:id`。

## 6. 异常与边界

- `ClearListIDByListID` 失败：不执行 `listRepo.Delete`，返回错误；用户可重试。
- `listRepo.Delete` 失败：任务已迁移，清单仍存在；用户再次删除会成功。
- 空清单：`ClearListID` 影响 0 行，然后正常软删除清单。

## 7. 不做的功能（YAGNI）

- 事务：暂不实现。
- 恢复清单时回迁任务：当前设计不包含。
- UI 提示「任务已迁移到收集箱」：不额外提示。
