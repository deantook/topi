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
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
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
			// CRITICAL: POST /tasks/reorder BEFORE /tasks/:id to avoid id=reorder
			auth.POST("/tasks/reorder", taskH.Reorder)
			auth.PATCH("/tasks/:id", taskH.Update)
			auth.POST("/tasks/:id/toggle", taskH.Toggle)
			auth.POST("/tasks/:id/abandon", taskH.Abandon)
			auth.POST("/tasks/:id/restore", taskH.Restore)
			auth.POST("/tasks/:id/trash", taskH.Trash)
			auth.DELETE("/tasks/:id", taskH.Delete)

			auth.GET("/lists", listH.List)
			auth.POST("/lists", listH.Create)
			auth.PATCH("/lists/:id", listH.Update)
			auth.DELETE("/lists/:id", listH.Delete)
		}
	}

	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	return r
}
