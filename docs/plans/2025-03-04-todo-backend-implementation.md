# Topi 待办后端实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用 Gin、GORM、MySQL、Swagger、Wire 实现 topi 待办应用的后端 API，支持 JWT 认证、任务与清单 CRUD。

**Architecture:** 分层架构，handler → service → repository，Wire 负责依赖注入，JWT 中间件保护业务 API。

**Tech Stack:** Go 1.25, Gin, GORM, MySQL, swaggo/swag, google/wire, golang-jwt/jwt-v5, godotenv, bcrypt

**设计参考:** `docs/plans/2025-03-04-todo-backend-design.md`

---

## Task 1: 项目依赖与 .env.example

**Files:**
- Modify: `topi-api/go.mod`
- Create: `topi-api/.env.example`

**Step 1: 添加依赖**

在 `topi-api/go.mod` 中添加 require（或运行 `go get`）：

```
cd topi-api
go get github.com/gin-gonic/gin
go get gorm.io/gorm gorm.io/driver/mysql
go get github.com/golang-jwt/jwt/v5
go get golang.org/x/crypto/bcrypt
go get github.com/joho/godotenv
go get github.com/google/wire/cmd/wire
go get github.com/swaggo/swag/cmd/swag
go get github.com/swaggo/gin-swagger github.com/swaggo/files
```

**Step 2: 创建 .env.example**

Create: `topi-api/.env.example`:

```
PORT=8080
DB_DSN=root:password@tcp(localhost:3306)/topi?charset=utf8mb4&parseTime=True
JWT_SECRET=change-me-in-production
JWT_EXPIRE_HOURS=168
GIN_MODE=debug
CORS_ORIGIN=http://localhost:5173
```

**Step 3: Commit**

```bash
git add topi-api/go.mod topi-api/go.sum topi-api/.env.example
git commit -m "chore: add dependencies and .env.example"
```

---

## Task 2: Config 包

**Files:**
- Create: `topi-api/internal/config/config.go`

**Step 1: 实现配置加载**

Create `topi-api/internal/config/config.go`:

```go
package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	DSN            string
	JWTSecret      string
	JWTExpireHours int
	GinMode        string
	CORSOrigin     string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	hours, _ := strconv.Atoi(getEnv("JWT_EXPIRE_HOURS", "168"))
	if hours <= 0 {
		hours = 168
	}

	cfg := &Config{
		Port:           getEnv("PORT", "8080"),
		DSN:            getEnv("DB_DSN", ""),
		JWTSecret:      getEnv("JWT_SECRET", ""),
		JWTExpireHours: hours,
		GinMode:        getEnv("GIN_MODE", "debug"),
		CORSOrigin:     getEnv("CORS_ORIGIN", "http://localhost:5173"),
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
```

**Step 2: 验证**

```bash
cd topi-api && go build ./internal/config/...
```

Expected: 无报错

**Step 3: Commit**

---

## Task 3: Model 包

**Files:**
- Create: `topi-api/internal/model/user.go`
- Create: `topi-api/internal/model/task.go`
- Create: `topi-api/internal/model/list.go`

**Step 1: 实现 User 模型**

Create `topi-api/internal/model/user.go`:

```go
package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID           string `gorm:"type:char(36);primaryKey"`
	Username     string `gorm:"uniqueIndex;size:64;not null"`
	PasswordHash string `gorm:"size:255;not null"`
	CreatedAt    time.Time
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	return nil
}
```

**Step 2: 实现 List 模型**

Create `topi-api/internal/model/list.go`:

```go
package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type List struct {
	ID        string `gorm:"type:char(36);primaryKey"`
	UserID    string `gorm:"type:char(36);index;not null"`
	Name      string `gorm:"size:128;not null"`
	CreatedAt time.Time
}

func (l *List) BeforeCreate(tx *gorm.DB) error {
	if l.ID == "" {
		l.ID = uuid.New().String()
	}
	return nil
}
```

**Step 3: 实现 Task 模型**

Create `topi-api/internal/model/task.go`:

```go
package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TaskStatus string

const (
	TaskStatusActive    TaskStatus = "active"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusAbandoned TaskStatus = "abandoned"
	TaskStatusTrash     TaskStatus = "trash"
)

type Task struct {
	ID        string     `gorm:"type:char(36);primaryKey"`
	UserID    string     `gorm:"type:char(36);index;not null"`
	ListID    *string    `gorm:"type:char(36);index"`
	Title     string     `gorm:"size:512;not null"`
	Completed bool       `gorm:"default:false"`
	DueDate   *string    `gorm:"type:date"`
	Status    TaskStatus `gorm:"size:16;default:active"`
	Order     int        `gorm:"column:sort_order;default:0"`
	CreatedAt time.Time
}

func (t *Task) BeforeCreate(tx *gorm.DB) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	return nil
}
```

**Step 4: 添加 uuid 依赖并验证**

```bash
cd topi-api && go get github.com/google/uuid
go build ./internal/model/...
```

**Step 5: Commit**

---

## Task 4: pkg/response

**Files:**
- Create: `topi-api/pkg/response/response.go`

**Step 1: 统一响应格式**

```go
package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func Error(c *gin.Context, code int, msg string) {
	c.JSON(code, gin.H{"error": msg})
}
```

**Step 2: Commit**

---

## Task 5: pkg/jwt

**Files:**
- Create: `topi-api/pkg/jwt/jwt.go`

**Step 1: JWT 签发与解析**

```go
package jwt

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var ErrInvalidToken = errors.New("invalid token")

type Claims struct {
	UserID string `json:"userId"`
	jwt.RegisteredClaims
}

type Helper struct {
	secret []byte
	expire time.Duration
}

func NewHelper(secret string, expireHours int) *Helper {
	return &Helper{
		secret: []byte(secret),
		expire: time.Duration(expireHours) * time.Hour,
	}
}

func (h *Helper) Sign(userID string) (string, error) {
	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(h.expire)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(h.secret)
}

func (h *Helper) Verify(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return h.secret, nil
	})
	if err != nil {
		return nil, ErrInvalidToken
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}
```

**Step 2: Commit**

---

## Task 6: Repository 层

**Files:**
- Create: `topi-api/internal/repository/user_repo.go`
- Create: `topi-api/internal/repository/list_repo.go`
- Create: `topi-api/internal/repository/task_repo.go`

**Step 1: UserRepository**

```go
package repository

import (
	"github.com/deantook/topi-api/internal/model"
	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(u *model.User) error {
	return r.db.Create(u).Error
}

func (r *UserRepository) GetByID(id string) (*model.User, error) {
	var u model.User
	err := r.db.Where("id = ?", id).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) GetByUsername(username string) (*model.User, error) {
	var u model.User
	err := r.db.Where("username = ?", username).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}
```

**Step 2: ListRepository**

```go
package repository

import (
	"github.com/deantook/topi-api/internal/model"
	"gorm.io/gorm"
)

type ListRepository struct {
	db *gorm.DB
}

func NewListRepository(db *gorm.DB) *ListRepository {
	return &ListRepository{db: db}
}

func (r *ListRepository) Create(l *model.List) error {
	return r.db.Create(l).Error
}

func (r *ListRepository) ListByUserID(userID string) ([]model.List, error) {
	var lists []model.List
	err := r.db.Where("user_id = ?", userID).Order("created_at").Find(&lists).Error
	return lists, err
}

func (r *ListRepository) GetByIDAndUserID(id, userID string) (*model.List, error) {
	var l model.List
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&l).Error
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func (r *ListRepository) Update(l *model.List) error {
	return r.db.Save(l).Error
}

func (r *ListRepository) Delete(id, userID string) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.List{}).Error
}
```

**Step 3: TaskRepository**

```go
package repository

import (
	"github.com/deantook/topi-api/internal/model"
	"gorm.io/gorm"
)

type TaskRepository struct {
	db *gorm.DB
}

func NewTaskRepository(db *gorm.DB) *TaskRepository {
	return &TaskRepository{db: db}
}

func (r *TaskRepository) Create(t *model.Task) error {
	return r.db.Create(t).Error
}

func (r *TaskRepository) ListByUserID(userID string, filter string, listID *string) ([]model.Task, error) {
	q := r.db.Where("user_id = ?", userID)

	switch filter {
	case "all":
		q = q.Where("status = ?", model.TaskStatusActive)
	case "today", "tomorrow", "recent-seven":
		q = q.Where("status = ?", model.TaskStatusActive)
		if filter == "today" || filter == "tomorrow" {
			// 日期过滤由 service 层处理，或在此用 RAW
			// 为简化，先返回 active，service 可再过滤
		}
	case "inbox":
		q = q.Where("status = ? AND list_id IS NULL AND due_date IS NULL", model.TaskStatusActive)
	case "completed":
		q = q.Where("status = ?", model.TaskStatusCompleted)
	case "abandoned":
		q = q.Where("status = ?", model.TaskStatusAbandoned)
	case "trash":
		q = q.Where("status = ?", model.TaskStatusTrash)
	default:
		if listID != nil && *listID != "" {
			q = q.Where("status = ? AND list_id = ?", model.TaskStatusActive, *listID)
		} else {
			q = q.Where("status = ?", model.TaskStatusActive)
		}
	}

	var tasks []model.Task
	err := q.Order("sort_order").Find(&tasks).Error
	return tasks, err
}

func (r *TaskRepository) GetByIDAndUserID(id, userID string) (*model.Task, error) {
	var t model.Task
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&t).Error
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TaskRepository) Update(t *model.Task) error {
	return r.db.Save(t).Error
}

func (r *TaskRepository) Delete(id, userID string) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.Task{}).Error
}
```

注意：GORM 中 `order` 为保留字，需用 `Order("\"order\"")` 或字段映射。可改用 `sort_order` 列名避免问题，设计 doc 中为 `order`，此处保持，若 MySQL 报错再改为 `sort_order`。

**Step 4: 修正 Task 列名**

若 `order` 与保留字冲突，在 model 中加 tag：`Order int gorm:"column:sort_order"` 并修改 repository 的 Order 调用。为简化，建议 model 中改为 `SortOrder` 字段，DB 列 `sort_order`。

**设计变更**：task.order 在表中用 `sort_order`，model 字段 `Order` 对应 `sort_order`：

```go
Order int `gorm:"column:sort_order;default:0"`
```

Repository 中：`q.Order("sort_order")`

**Step 5: Commit**

---

## Task 7: Service 层 - Auth

**Files:**
- Create: `topi-api/internal/service/auth_service.go`

**Step 1: AuthService**

```go
package service

import (
	"errors"

	"github.com/deantook/topi-api/internal/model"
	"github.com/deantook/topi-api/internal/repository"
	"github.com/deantook/topi-api/pkg/jwt"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrUserExists   = errors.New("username already exists")
	ErrInvalidCreds = errors.New("invalid credentials")
)

type AuthService struct {
	userRepo *repository.UserRepository
	jwt      *jwt.Helper
}

func NewAuthService(userRepo *repository.UserRepository, jwtHelper *jwt.Helper) *AuthService {
	return &AuthService{userRepo: userRepo, jwt: jwtHelper}
}

func (s *AuthService) Register(username, password string) (*model.User, error) {
	_, err := s.userRepo.GetByUsername(username)
	if err == nil {
		return nil, ErrUserExists
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	u := &model.User{
		Username:     username,
		PasswordHash: string(hash),
	}
	if err := s.userRepo.Create(u); err != nil {
		return nil, err
	}
	return u, nil
}

func (s *AuthService) Login(username, password string) (string, error) {
	u, err := s.userRepo.GetByUsername(username)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", ErrInvalidCreds
		}
		return "", err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return "", ErrInvalidCreds
	}
	return s.jwt.Sign(u.ID)
}
```

**Step 2: Commit**

---

## Task 8: Service 层 - List & Task

**Files:**
- Create: `topi-api/internal/service/list_service.go`
- Create: `topi-api/internal/service/task_service.go`

**Step 1: ListService**

```go
package service

import (
	"errors"

	"github.com/deantook/topi-api/internal/model"
	"github.com/deantook/topi-api/internal/repository"
	"gorm.io/gorm"
)

var ErrListNotFound = errors.New("list not found")

type ListService struct {
	repo *repository.ListRepository
}

func NewListService(repo *repository.ListRepository) *ListService {
	return &ListService{repo: repo}
}

func (s *ListService) Create(userID, name string) (*model.List, error) {
	l := &model.List{UserID: userID, Name: name}
	if err := s.repo.Create(l); err != nil {
		return nil, err
	}
	return l, nil
}

func (s *ListService) List(userID string) ([]model.List, error) {
	return s.repo.ListByUserID(userID)
}

func (s *ListService) Update(userID, id, name string) error {
	l, err := s.repo.GetByIDAndUserID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrListNotFound
		}
		return err
	}
	l.Name = name
	return s.repo.Update(l)
}

func (s *ListService) Delete(userID, id string) error {
	return s.repo.Delete(id, userID)
}
```

**Step 2: TaskService**

```go
package service

import (
	"errors"
	"time"

	"github.com/deantook/topi-api/internal/model"
	"github.com/deantook/topi-api/internal/repository"
	"gorm.io/gorm"
)

var ErrTaskNotFound = errors.New("task not found")

type TaskService struct {
	repo *repository.TaskRepository
}

func NewTaskService(repo *repository.TaskRepository) *TaskService {
	return &TaskService{repo: repo}
}

func (s *TaskService) Create(userID string, title string, listID *string, dueDate *string) (*model.Task, error) {
	tasks, _ := s.repo.ListByUserID(userID, "all", nil)
	maxOrder := 0
	for _, t := range tasks {
		if t.Order > maxOrder {
			maxOrder = t.Order
		}
	}
	t := &model.Task{
		UserID:    userID,
		Title:     title,
		ListID:    listID,
		DueDate:   dueDate,
		Status:    model.TaskStatusActive,
		Order:     maxOrder + 1,
	}
	if err := s.repo.Create(t); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *TaskService) List(userID, filter string, listID *string) ([]model.Task, error) {
	tasks, err := s.repo.ListByUserID(userID, filter, listID)
	if err != nil {
		return nil, err
	}
	// 日期过滤：today, tomorrow, recent-seven
	if filter == "today" || filter == "tomorrow" || filter == "recent-seven" {
		now := time.Now()
		today := now.Format("2006-01-02")
		tomorrow := now.AddDate(0, 0, 1).Format("2006-01-02")
		weekEnd := now.AddDate(0, 0, 7)

		var filtered []model.Task
		for _, t := range tasks {
			if t.DueDate == nil {
				continue
			}
			d := *t.DueDate
			switch filter {
			case "today":
				if d == today {
					filtered = append(filtered, t)
				}
			case "tomorrow":
				if d == tomorrow {
					filtered = append(filtered, t)
				}
			case "recent-seven":
				td, _ := time.Parse("2006-01-02", d)
				if td.After(now) && td.Before(weekEnd) {
					filtered = append(filtered, t)
				}
			}
		}
		return filtered, nil
	}
	return tasks, nil
}

func (s *TaskService) Update(userID, id string, title *string, listID *string, dueDate *string) error {
	t, err := s.repo.GetByIDAndUserID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTaskNotFound
		}
		return err
	}
	if title != nil {
		t.Title = *title
	}
	if listID != nil {
		t.ListID = listID
	}
	if dueDate != nil {
		t.DueDate = dueDate
	}
	return s.repo.Update(t)
}

func (s *TaskService) Toggle(userID, id string) error {
	t, err := s.repo.GetByIDAndUserID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTaskNotFound
		}
		return err
	}
	t.Completed = !t.Completed
	if t.Completed {
		t.Status = model.TaskStatusCompleted
	} else {
		t.Status = model.TaskStatusActive
	}
	return s.repo.Update(t)
}

func (s *TaskService) Abandon(userID, id string) error {
	t, err := s.repo.GetByIDAndUserID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTaskNotFound
		}
		return err
	}
	t.Status = model.TaskStatusAbandoned
	t.Completed = false
	return s.repo.Update(t)
}

func (s *TaskService) Restore(userID, id string) error {
	t, err := s.repo.GetByIDAndUserID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTaskNotFound
		}
		return err
	}
	t.Status = model.TaskStatusActive
	t.Completed = false
	return s.repo.Update(t)
}

func (s *TaskService) Delete(userID, id string) error {
	return s.repo.Delete(id, userID)
}

func (s *TaskService) Reorder(userID, id string, newIndex int) error {
	tasks, err := s.repo.ListByUserID(userID, "all", nil)
	if err != nil {
		return err
	}
	idx := -1
	for i, t := range tasks {
		if t.ID == id {
			idx = i
			break
		}
	}
	if idx < 0 || idx == newIndex {
		return nil
	}
	// 移动并重排 order
	item := tasks[idx]
	tasks = append(tasks[:idx], tasks[idx+1:]...)
	tasks = append(tasks[:newIndex], append([]model.Task{item}, tasks[newIndex:]...)...)
	for i, t := range tasks {
		t.Order = i
		if err := s.repo.Update(&t); err != nil {
			return err
		}
	}
	return nil
}
```

**Step 3: 修正 Task.List 的 filter 逻辑**

Repository 的 ListByUserID 在 filter 为 today/tomorrow/recent-seven 时，应返回所有 active 任务，由 Service 做日期过滤。当前 ListByUserID 对这三种情况未加 status 条件，需补充：`q = q.Where("status = ?", model.TaskStatusActive)`。已在 TaskService.List 中做日期过滤，Repository 需确保返回 active。回看 Task 6 的 ListByUserID：today/tomorrow/recent-seven 已有 `q = q.Where("status = ?", model.TaskStatusActive)`，但未加日期条件，正确——日期在 service 过滤。

**Step 4: Reorder 简化**

Reorder 需在同 filter 结果内重排。当前用 "all" 取任务，若前端在 list 内 reorder，应传 listId。设计 doc 中 reorder body 为 `{ "id", "newIndex" }`，可扩展为 `listId?`。为简化先按 "all" 实现。

**Step 5: Commit**

---

## Task 9: Middleware - JWT & CORS

**Files:**
- Create: `topi-api/internal/middleware/auth.go`
- Create: `topi-api/internal/middleware/cors.go`

**Step 1: Auth 中间件**

```go
package middleware

import (
	"net/http"
	"strings"

	"github.com/deantook/topi-api/pkg/jwt"
	"github.com/deantook/topi-api/pkg/response"
	"github.com/gin-gonic/gin"
)

const UserIDKey = "userId"

func Auth(jwtHelper *jwt.Helper) gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			response.Error(c, http.StatusUnauthorized, "unauthorized")
			c.Abort()
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		claims, err := jwtHelper.Verify(token)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "unauthorized")
			c.Abort()
			return
		}
		c.Set(UserIDKey, claims.UserID)
		c.Next()
	}
}
```

**Step 2: CORS 中间件**

```go
package middleware

import (
	"github.com/gin-gonic/gin"
)

func CORS(origin string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
```

**Step 3: Commit**

---

## Task 10: Handler - Auth

**Files:**
- Create: `topi-api/internal/handler/auth_handler.go`

**Step 1: AuthHandler**

```go
package handler

import (
	"net/http"

	"github.com/deantook/topi-api/internal/service"
	"github.com/deantook/topi-api/pkg/response"
	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	auth *service.AuthService
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

type RegisterReq struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginReq struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	u, err := h.auth.Register(req.Username, req.Password)
	if err != nil {
		if err == service.ErrUserExists {
			response.Error(c, http.StatusConflict, "username already exists")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"id": u.ID, "username": u.Username})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	token, err := h.auth.Login(req.Username, req.Password)
	if err != nil {
		if err == service.ErrInvalidCreds {
			response.Error(c, http.StatusUnauthorized, "invalid credentials")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"token": token})
}
```

**Step 2: Commit**

---

## Task 11: Handler - List & Task

**Files:**
- Create: `topi-api/internal/handler/list_handler.go`
- Create: `topi-api/internal/handler/task_handler.go`

**Step 1: ListHandler**

```go
package handler

import (
	"net/http"

	"github.com/deantook/topi-api/internal/middleware"
	"github.com/deantook/topi-api/internal/service"
	"github.com/deantook/topi-api/pkg/response"
	"github.com/gin-gonic/gin"
)

type ListHandler struct {
	svc *service.ListService
}

func NewListHandler(svc *service.ListService) *ListHandler {
	return &ListHandler{svc: svc}
}

func (h *ListHandler) List(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	lists, err := h.svc.List(userID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, lists)
}

type CreateListReq struct {
	Name string `json:"name" binding:"required"`
}

func (h *ListHandler) Create(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	var req CreateListReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	l, err := h.svc.Create(userID, req.Name)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, l)
}

type UpdateListReq struct {
	Name string `json:"name" binding:"required"`
}

func (h *ListHandler) Update(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	id := c.Param("id")
	var req UpdateListReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.svc.Update(userID, id, req.Name); err != nil {
		if err == service.ErrListNotFound {
			response.Error(c, http.StatusNotFound, "list not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *ListHandler) Delete(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	id := c.Param("id")
	if err := h.svc.Delete(userID, id); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}
```

**Step 2: TaskHandler**

```go
package handler

import (
	"net/http"

	"github.com/deantook/topi-api/internal/middleware"
	"github.com/deantook/topi-api/internal/service"
	"github.com/deantook/topi-api/pkg/response"
	"github.com/gin-gonic/gin"
)

type TaskHandler struct {
	svc *service.TaskService
}

func NewTaskHandler(svc *service.TaskService) *TaskHandler {
	return &TaskHandler{svc: svc}
}

func (h *TaskHandler) List(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	filter := c.DefaultQuery("filter", "all")
	listID := c.Query("listId")
	var lp *string
	if listID != "" {
		lp = &listID
	}
	tasks, err := h.svc.List(userID, filter, lp)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, tasks)
}

type CreateTaskReq struct {
	Title   string  `json:"title" binding:"required"`
	ListID  *string `json:"listId"`
	DueDate *string `json:"dueDate"`
}

func (h *TaskHandler) Create(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	var req CreateTaskReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	t, err := h.svc.Create(userID, req.Title, req.ListID, req.DueDate)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, t)
}

type UpdateTaskReq struct {
	Title   *string `json:"title"`
	ListID  *string `json:"listId"`
	DueDate *string `json:"dueDate"`
}

func (h *TaskHandler) Update(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	id := c.Param("id")
	var req UpdateTaskReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.svc.Update(userID, id, req.Title, req.ListID, req.DueDate); err != nil {
		if err == service.ErrTaskNotFound {
			response.Error(c, http.StatusNotFound, "task not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *TaskHandler) Toggle(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	id := c.Param("id")
	if err := h.svc.Toggle(userID, id); err != nil {
		if err == service.ErrTaskNotFound {
			response.Error(c, http.StatusNotFound, "task not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *TaskHandler) Abandon(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	id := c.Param("id")
	if err := h.svc.Abandon(userID, id); err != nil {
		if err == service.ErrTaskNotFound {
			response.Error(c, http.StatusNotFound, "task not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *TaskHandler) Restore(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	id := c.Param("id")
	if err := h.svc.Restore(userID, id); err != nil {
		if err == service.ErrTaskNotFound {
			response.Error(c, http.StatusNotFound, "task not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

func (h *TaskHandler) Delete(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	id := c.Param("id")
	if err := h.svc.Delete(userID, id); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}

type ReorderTaskReq struct {
	ID       string `json:"id" binding:"required"`
	NewIndex int    `json:"newIndex" binding:"gte=0"`
}

func (h *TaskHandler) Reorder(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	var req ReorderTaskReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.svc.Reorder(userID, req.ID, req.NewIndex); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, gin.H{"ok": true})
}
```

**Step 3: Commit**

---

## Task 12: Wire 依赖注入

**Files:**
- Create: `topi-api/internal/wire/wire.go`
- Create: `topi-api/internal/wire/wire_gen.go` (通过 `wire` 生成)

**Step 1: wire.go**

```go
//go:build wireinject
// +build wireinject

package wire

import (
	"errors"

	"github.com/deantook/topi-api/internal/config"
	"github.com/deantook/topi-api/internal/handler"
	"github.com/deantook/topi-api/internal/middleware"
	"github.com/deantook/topi-api/internal/repository"
	"github.com/deantook/topi-api/internal/service"
	"github.com/deantook/topi-api/pkg/jwt"
	"github.com/gin-gonic/gin"
	"github.com/google/wire"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type Server struct {
	Engine *gin.Engine
	Config *config.Config
	DB     *gorm.DB
}

func InitializeServer() (*Server, error) {
	wire.Build(
		config.Load,
		provideDB,
		provideJWT,
		repository.NewUserRepository,
		repository.NewListRepository,
		repository.NewTaskRepository,
		service.NewAuthService,
		service.NewListService,
		service.NewTaskService,
		handler.NewAuthHandler,
		handler.NewListHandler,
		handler.NewTaskHandler,
		provideRouter,
		wire.Struct(new(Server), "Engine", "Config", "DB"),
	)
	return nil, nil
}

func provideDB(cfg *config.Config) (*gorm.DB, error) {
	return gorm.Open(mysql.Open(cfg.DSN), &gorm.Config{})
}

func provideJWT(cfg *config.Config) (*jwt.Helper, error) {
	if cfg.JWTSecret == "" {
		return nil, errors.New("JWT_SECRET is required")
	}
	return jwt.NewHelper(cfg.JWTSecret, cfg.JWTExpireHours), nil
}

func provideRouter(
	cfg *config.Config,
	authH *handler.AuthHandler,
	listH *handler.ListHandler,
	taskH *handler.TaskHandler,
	jwtHelper *jwt.Helper,
) *gin.Engine {
	gin.SetMode(cfg.GinMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.CORS(cfg.CORSOrigin))

	v1 := r.Group("/api/v1")
	{
		v1.POST("/register", authH.Register)
		v1.POST("/login", authH.Login)

		auth := v1.Group("")
		auth.Use(middleware.Auth(jwtHelper))
		{
			auth.GET("/tasks", taskH.List)
			auth.POST("/tasks", taskH.Create)
			auth.PATCH("/tasks/:id", taskH.Update)
			auth.POST("/tasks/:id/toggle", taskH.Toggle)
			auth.POST("/tasks/:id/abandon", taskH.Abandon)
			auth.POST("/tasks/:id/restore", taskH.Restore)
			auth.DELETE("/tasks/:id", taskH.Delete)
			auth.POST("/tasks/reorder", taskH.Reorder)

			auth.GET("/lists", listH.List)
			auth.POST("/lists", listH.Create)
			auth.PATCH("/lists/:id", listH.Update)
			auth.DELETE("/lists/:id", listH.Delete)
		}
	}

	return r
}
```

**Step 2: 运行 wire**

```bash
cd topi-api
go install github.com/google/wire/cmd/wire@latest
wire ./internal/wire/
```

Expected: 生成 `wire_gen.go`

**Step 3: 修正 provideJWT 返回类型**

wire 需无 error 的 provider。将 `provideJWT` 改为返回 `*jwt.Helper` 不返回 error，或拆成单纯构造。当前 `NewHelper` 无 error，可：

```go
func provideJWT(cfg *config.Config) *jwt.Helper {
	if cfg.JWTSecret == "" {
		panic("JWT_SECRET is required")
	}
	return jwt.NewHelper(cfg.JWTSecret, cfg.JWTExpireHours)
}
```

**Step 4: Commit**

---

## Task 13: main.go 与 AutoMigrate

**Files:**
- Create: `topi-api/cmd/server/main.go`

**Step 1: main.go**

```go
package main

import (
	"fmt"
	"log"

	"github.com/deantook/topi-api/internal/model"
	"github.com/deantook/topi-api/internal/wire"
	"gorm.io/gorm"
)

func main() {
	server, err := wire.InitializeServer()
	if err != nil {
		log.Fatal(err)
	}

	if err := server.DB.AutoMigrate(&model.User{}, &model.List{}, &model.Task{}); err != nil {
		log.Fatal(err)
	}

	addr := ":" + server.Config.Port
	fmt.Println("Server starting at", addr)
	if err := server.Engine.Run(addr); err != nil {
		log.Fatal(err)
	}
}
```

问题：Server 结构体没有 DB。Wire 的 provideRouter 不注入 DB 到 Server。需要把 DB 也放入 Server，或在 main 里单独创建 DB。

调整：在 wire 中增加一个 ProvideServer 的依赖，使 Server 包含 DB，或在 main 中从 config 再开一次 DB 连接用于 migrate。为简化，在 wire 的 provideRouter 之前加一步，将 db 传入某个 Migrate 函数；更好的方式是在 wire 中提供一个 App 结构体，包含 Engine、Config、DB。修改 wire：

```go
type Server struct {
	Engine *gin.Engine
	Config *config.Config
	DB     *gorm.DB
}

func InitializeServer() (*Server, error) {
	wire.Build(
		...
		wire.Struct(new(Server), "Engine", "Config", "DB"),
	)
	return nil, nil
}
```

但 provideRouter 不返回 DB，需要在 wire.Build 里加一个 bind 或把 DB 也作为 Server 的字段。wire.Struct 会注入所有已提供的依赖，所以只要 provideDB 在 Build 里，Server 的 DB 字段会被注入。需要给 Server 加 DB 字段，并在 provideRouter 的依赖里去掉 DB（如果 router 不需要）。实际上 provideRouter 不需要 DB，所以不改。Server 结构体加 DB 字段，wire.Struct 会尝试注入，但 wire 需要显式把 *gorm.DB 提供给 Struct。wire.Struct(new(Server), "Engine", "Config", "DB") 会查找 Engine, Config, DB 的 provider。Engine 来自 provideRouter，Config 来自 config.Load，DB 来自 provideDB。这样可行。

更新 wire.go 中 Server 和 wire.Struct。
</think>
---

## Task 14: Swagger 集成

**Files:**
- Modify: `topi-api/cmd/server/main.go` (添加 swag 注解)
- Create: `topi-api/docs/docs.go` (swag init 生成)

**Step 1: 在 main.go 添加包级注解**

```go
// @title           Topi API
// @version         1.0
// @description     待办应用后端 API
// @BasePath        /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
package main
```

**Step 2: 在 handler 方法上添加 swag 注解**（示例：Login）

```go
// Login godoc
// @Summary      用户登录
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body body LoginReq true "登录信息"
// @Success      200 {object} map[string]interface{}
// @Failure      401 {object} map[string]string
// @Router       /login [post]
func (h *AuthHandler) Login(c *gin.Context) {
```

**Step 3: 安装 swag 并生成文档**

```bash
go install github.com/swaggo/swag/cmd/swag@latest
swag init -g cmd/server/main.go -o docs
```

**Step 4: 在路由中挂载 Swagger**

在 wire 的 provideRouter 中（或 main 中在 Engine 上）添加：

```go
import (
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// 在 provideRouter 末尾，return r 之前：
r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
```

但 docs 包会 import 到 main，swag 会生成 docs/docs.go。需确保 docs 在 topi-api 下。`swag init -g cmd/server/main.go -o docs` 会在 topi-api/docs 生成。

在 main 或 router 中 import：
`_ "github.com/deantook/topi-api/docs"`

这样 swagger 会加载 docs 包。在 provideRouter 中 import 需修改 wire。把 Swagger 路由放到 provideRouter 中，需 imports。加一行即可。

**Step 5: Commit**

---

## Task 15: 修复与验证

**Step 1: 修复 model.Task 中 order 保留字**

MySQL 中 `order` 是保留字。在 Task 结构体：`Order int gorm:"column:sort_order;default:0"`，Repository 中 `Order("sort_order")`。

**Step 2: 修复 TaskService.Reorder**

Reorder 中应对同一过滤条件下的任务重排。当前按 "all" 取任务。若 newIndex 超出范围需处理。检查 TaskRepository.ListByUserID 的 Order 子句，MySQL 用反引号 `` `sort_order` `` 或列名 sort_order。

**Step 3: 端到端验证**

```bash
cd topi-api
cp .env.example .env
# 编辑 .env 填入真实 DB_DSN
go run ./cmd/server/
```

1. POST /api/v1/register
2. POST /api/v1/login 获取 token
3. GET /api/v1/tasks (带 Authorization)
4. POST /api/v1/tasks 创建任务

**Step 4: Commit**

---

## 执行选择

计划已保存至 `docs/plans/2025-03-04-todo-backend-implementation.md`。两种执行方式：

**1. Subagent-Driven（本会话）** — 按任务调度子 agent，逐项实现并评审，快速迭代。

**2. Parallel Session（独立会话）** — 在新会话中用 executing-plans，按检查点批量执行。

请选择一种方式。
