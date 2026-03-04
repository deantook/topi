// @title Topi API
// @version 1.0
// @description 待办应用后端 API
// @BasePath /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization

package main

import (
	"fmt"
	"log"

	_ "github.com/deantook/topi-api/docs"

	"github.com/deantook/topi-api/internal/model"
	"github.com/deantook/topi-api/internal/wire"
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
