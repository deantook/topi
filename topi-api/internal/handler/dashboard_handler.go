package handler

import (
	"net/http"
	"time"

	"github.com/deantook/topi-api/internal/middleware"
	"github.com/deantook/topi-api/internal/service"
	"github.com/deantook/topi-api/pkg/response"
	"github.com/deantook/topi-api/pkg/timezone"
	"github.com/gin-gonic/gin"
)

type DashboardHandler struct {
	taskSvc *service.TaskService
	listSvc *service.ListService
}

func NewDashboardHandler(taskSvc *service.TaskService, listSvc *service.ListService) *DashboardHandler {
	return &DashboardHandler{taskSvc: taskSvc, listSvc: listSvc}
}

func (h *DashboardHandler) Dashboard(c *gin.Context) {
	userID := c.GetString(middleware.UserIDKey)
	loc := time.UTC
	if val, exists := c.Get(timezone.ContextKey); exists && val != nil {
		if l, ok := val.(*time.Location); ok {
			loc = l
		}
	}
	counts, err := h.taskSvc.GetCounts(userID, loc)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	lists, err := h.listSvc.List(userID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	listsOut := make([]map[string]interface{}, 0, len(lists))
	for _, l := range lists {
		listsOut = append(listsOut, formatListForResponse(l, loc))
	}
	out := map[string]interface{}{
		"counts": counts,
		"lists":  listsOut,
	}
	response.OK(c, out)
}
