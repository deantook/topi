# Topi MCP Tasks Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create Agent Skill `topi-mcp-tasks` that guides Cursor agent to use Topi MCP tools when user expresses task management intent.

**Architecture:** Layered structure with SKILL.md (triggers, intent mapping, core workflows) and reference.md (full tool params, enums). Project skill at `topi/.cursor/skills/topi-mcp-tasks/`.

**Tech Stack:** Markdown, Cursor Agent Skills format (YAML frontmatter)

**Design Reference:** `docs/plans/2026-03-06-topi-mcp-tasks-skill-design.md`

---

## Task 1: Create skill directory and SKILL.md

**Files:**
- Create: `topi/.cursor/skills/topi-mcp-tasks/SKILL.md`

**Step 1: Create directory**

```bash
mkdir -p topi/.cursor/skills/topi-mcp-tasks
```

**Step 2: Write SKILL.md**

Create `topi/.cursor/skills/topi-mcp-tasks/SKILL.md` with YAML frontmatter, prerequisite, intent→tool mapping table, core workflows, and link to reference.md. Content per design doc section 3.

**Step 3: Verify**

- SKILL.md exists and has valid YAML
- Total lines < 500
- Description includes trigger phrases (记下来, 加到待办, 今天有什么任务)

**Step 4: Commit**

```bash
git add topi/.cursor/skills/topi-mcp-tasks/SKILL.md
git commit -m "feat: add topi-mcp-tasks skill (SKILL.md)"
```

---

## Task 2: Create reference.md

**Files:**
- Create: `topi/.cursor/skills/topi-mcp-tasks/reference.md`

**Step 1: Write reference.md**

Create `topi/.cursor/skills/topi-mcp-tasks/reference.md` with:
- Task tools full params (topi_list_tasks, topi_create_task, topi_create_tasks, topi_update_task, etc.)
- List tools params
- filter enum (all, today, tomorrow, recentSeven, inbox, completed, abandoned, trash)
- Date format (ISO 8601)
- priority enum (none, low, medium, high)

Content per design doc section 4.

**Step 2: Verify**

- SKILL.md links correctly to [reference.md](reference.md)
- All 14 MCP tools documented

**Step 3: Commit**

```bash
git add topi/.cursor/skills/topi-mcp-tasks/reference.md
git commit -m "feat: add topi-mcp-tasks skill reference.md"
```

---

## Summary Checklist

- [ ] `topi/.cursor/skills/topi-mcp-tasks/SKILL.md` exists, < 500 lines
- [ ] `topi/.cursor/skills/topi-mcp-tasks/reference.md` exists
- [ ] Description triggers on 记下来, 加到待办, 今天有什么任务
- [ ] Intent mapping table complete
- [ ] Core workflows (create with list, list tasks, batch create) documented
- [ ] reference.md has full tool params, filter/priority enums, date format
