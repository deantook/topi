# due_date MySQL 格式错误修复设计

> **问题：** `POST /tasks/:id/toggle` 触发 MySQL Error 1292: Incorrect date value: '2026-03-07T00:00:00Z' for column 'due_date' at row 1

> **背景：** Toggle 仅更新 completed 和 status，理论上不写入 due_date。但用户确认仅一次 toggle 即报错。采用防御性修复方案。

## 目标

1. 增强 `normalize*` 函数对 ISO8601/RFC3339 的解析能力，避免无法解析时原样写入
2. 在 Repository 层为 due_date 增加安全网，确保任何写入路径都经过标准化

## 架构

- **模型层**：`model.NormalizeDueDateForDB` 导出为公共函数，增加 RFC3339 布局
- **服务层**：`normalizeDateTimeString` 同步增强
- **仓储层**：`UpdateFields` 在写入前对 `fields["due_date"]` 做标准化

## 变更范围

### 1. model/task.go

- 将 `normalizeDueDateForDB` 重命名为 `NormalizeDueDateForDB` 并导出
- 在 layouts 中新增 `time.RFC3339`、`time.RFC3339Nano`（解析失败时兜底，覆盖 `+08:00` 等时区格式）
- 保持 BeforeCreate/BeforeSave 调用

### 2. service/task_service.go

- 在 `normalizeDateTimeString` 的 layouts 中新增 `time.RFC3339`、`time.RFC3339Nano`
- 或改为调用 `model.NormalizeDueDateForDB` 以统一逻辑（可选，取决于是否希望 service 保持独立解析）

### 3. repository/task_repo.go

- 在 `UpdateFields` 中，若 `fields["due_date"]` 存在且为非 nil 字符串，先调用 `model.NormalizeDueDateForDB` 再写入
- 对 `fields["due_date"] == nil`（清空）不处理

## 数据流

```
输入 (ISO8601/RFC3339/yyyy-MM-dd 等)
    → model.NormalizeDueDateForDB / normalizeDateTimeString
    → "yyyy-MM-dd HH:mm:ss" (MySQL 兼容)
    → UpdateFields 安全网再次校验
    → MySQL datetime 列
```

## 错误处理

- `NormalizeDueDateForDB` 解析失败时返回原字符串（保持现有行为）
- 若原字符串为非法格式，MySQL 仍会报错；但通过 RFC3339 扩展，可解析的格式会大幅增加

## 验证

- 单元测试：`NormalizeDueDateForDB("2026-03-07T00:00:00Z")` → `"2026-03-07 00:00:00"`
- 单元测试：`NormalizeDueDateForDB("2026-03-07T00:00:00+08:00")` → 转为 UTC 后输出 `"yyyy-MM-dd HH:mm:ss"`
- 手动：对含 due_date 的任务执行 toggle，确认无报错

## 参考

- MySQL datetime 格式：`YYYY-MM-DD HH:MM:SS`
- Go time.RFC3339：`2006-01-02T15:04:05Z07:00`
- 现有设计：`docs/plans/2026-03-04-datetime-format-design.md`
