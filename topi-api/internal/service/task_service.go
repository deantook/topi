package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/deantook/topi-api/internal/model"
	"github.com/deantook/topi-api/internal/repository"
	"gorm.io/gorm"
)

// normalizeDateTimeString accepts yyyy-MM-dd, yyyy-MM-dd HH:mm:ss, ISO8601, etc., outputs yyyy-MM-dd HH:mm:ss.
func normalizeDateTimeString(s string) string {
	return model.NormalizeDueDateForDB(s)
}

// parseLocalToUTC parses local time string in the given location, returns UTC as "yyyy-MM-dd HH:mm:ss".
func parseLocalToUTC(localStr string, loc *time.Location) (string, error) {
	if loc == nil {
		loc = time.UTC
	}
	t, err := time.ParseInLocation("2006-01-02 15:04:05", localStr, loc)
	if err != nil {
		return "", err
	}
	return t.UTC().Format("2006-01-02 15:04:05"), nil
}

// formatUTCToLocal parses UTC string, converts to local, returns "yyyy-MM-dd HH:mm:ss".
func formatUTCToLocal(utcStr string, loc *time.Location) string {
	if loc == nil {
		loc = time.UTC
	}
	t, err := time.ParseInLocation("2006-01-02 15:04:05", utcStr, time.UTC)
	if err != nil {
		return utcStr
	}
	return t.In(loc).Format("2006-01-02 15:04:05")
}

var ErrTaskNotFound = errors.New("task not found")

// ValidateEstimatedHours returns (value, nil) if valid positive int, or (nil, error) if invalid.
func ValidateEstimatedHours(v interface{}) (*int, error) {
	if v == nil {
		return nil, nil
	}
	switch x := v.(type) {
	case float64:
		i := int(x)
		if float64(i) != x || i < 1 {
			return nil, errors.New("estimated_hours 需为正整数")
		}
		return &i, nil
	case int:
		if x < 1 {
			return nil, errors.New("estimated_hours 需为正整数")
		}
		return &x, nil
	default:
		return nil, errors.New("estimated_hours 需为正整数")
	}
}

// DashboardCounts holds task counts per filter for the dashboard API.
type DashboardCounts struct {
	All         int            `json:"all"`
	Today       int            `json:"today"`
	Tomorrow    int            `json:"tomorrow"`
	RecentSeven int            `json:"recentSeven"`
	Inbox       int            `json:"inbox"`
	Completed   int            `json:"completed"`
	Abandoned   int            `json:"abandoned"`
	Trash       int            `json:"trash"`
	List        map[string]int `json:"list"`
}

// GetCounts returns task counts for dashboard. Uses loc for today/tomorrow/recent-seven date filtering.
func (s *TaskService) GetCounts(userID string, loc *time.Location) (*DashboardCounts, error) {
	if loc == nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)
	todayStr := now.Format("2006-01-02")
	tomorrow := now.AddDate(0, 0, 1)
	tomorrowStr := tomorrow.Format("2006-01-02")
	weekEnd := now.AddDate(0, 0, 6)
	endStr := weekEnd.Format("2006-01-02")

	allTasks, err := s.repo.ListByUserID(userID, "all", nil, nil)
	if err != nil {
		return nil, err
	}
	completedTasks, err := s.repo.ListByUserID(userID, "completed", nil, nil)
	if err != nil {
		return nil, err
	}
	abandonedTasks, err := s.repo.ListByUserID(userID, "abandoned", nil, nil)
	if err != nil {
		return nil, err
	}
	trashTasks, err := s.repo.ListByUserID(userID, "trash", nil, nil)
	if err != nil {
		return nil, err
	}

	counts := &DashboardCounts{
		All:         len(allTasks),
		Completed:   len(completedTasks),
		Abandoned:   len(abandonedTasks),
		Trash:       len(trashTasks),
		List:        make(map[string]int),
	}

	for _, t := range allTasks {
		if t.ListID != nil && *t.ListID != "" {
			counts.List[*t.ListID]++
		}
		if t.ListID == nil && t.DueDate == nil {
			counts.Inbox++
		}
		if t.DueDate == nil {
			continue
		}
		localStr := formatUTCToLocal(*t.DueDate, loc)
		if len(localStr) < 10 {
			continue
		}
		d := localStr[:10]
		if d == todayStr {
			counts.Today++
		}
		if d == tomorrowStr {
			counts.Tomorrow++
		}
		if d >= todayStr && d <= endStr {
			counts.RecentSeven++
		}
	}

	return counts, nil
}

// BatchTaskInput is input for a single task in batch create.
type BatchTaskInput struct {
	Title           string
	ListID          *string
	DueDate         *string
	Priority        *string
	Detail          *string
	Owner           *string
	EstimatedHours  *int
}

type TaskService struct {
	repo *repository.TaskRepository
}

func NewTaskService(repo *repository.TaskRepository) *TaskService {
	return &TaskService{repo: repo}
}

func (s *TaskService) Create(userID string, title string, listID *string, dueDate *string, priority *string, detail *string, owner *model.TaskOwner, estimatedHours *int, loc *time.Location) (*model.Task, error) {
	tasks, _ := s.repo.ListByUserID(userID, "all", nil, nil)
	maxOrder := 0
	for _, t := range tasks {
		if t.Order > maxOrder {
			maxOrder = t.Order
		}
	}
	prio := model.TaskPriorityNone
	if priority != nil {
		switch *priority {
		case "none", "low", "medium", "high":
			prio = model.TaskPriority(*priority)
		}
	}
	if owner == nil {
		owner = model.TaskOwnerHumanPtr()
	}
	if estimatedHours != nil && *estimatedHours < 1 {
		return nil, errors.New("estimated_hours 需为正整数")
	}
	var normalizedDue *string
	if dueDate != nil && *dueDate != "" {
		localStr := normalizeDateTimeString(*dueDate)
		utcStr, err := parseLocalToUTC(localStr, loc)
		if err != nil {
			return nil, err
		}
		normalizedDue = &utcStr
	}
	t := &model.Task{
		UserID:         userID,
		Title:          title,
		ListID:         listID,
		Detail:         detail,
		DueDate:        normalizedDue,
		Priority:       prio,
		Status:         model.TaskStatusActive,
		Owner:          owner,
		EstimatedHours: estimatedHours,
		Order:          maxOrder + 1,
	}
	if err := s.repo.Create(t); err != nil {
		return nil, err
	}
	return t, nil
}

// BatchCreate creates multiple tasks in a transaction. Returns error on validation failure or DB error.
func (s *TaskService) BatchCreate(userID string, tasks []BatchTaskInput, defaultOwner *model.TaskOwner, loc *time.Location) ([]*model.Task, error) {
	if len(tasks) == 0 {
		return nil, errors.New("at least one task required")
	}
	if loc == nil {
		loc = time.UTC
	}

	// Pre-validate and normalize inputs
	type validatedTask struct {
		title          string
		listID         *string
		dueDate        *string
		priority       model.TaskPriority
		detail         *string
		owner          *model.TaskOwner
		estimatedHours *int
	}
	validated := make([]validatedTask, len(tasks))
	for i, inp := range tasks {
		if strings.TrimSpace(inp.Title) == "" {
			return nil, fmt.Errorf("task[%d].title: required", i)
		}
		validated[i].title = strings.TrimSpace(inp.Title)
		validated[i].listID = inp.ListID

		if inp.DueDate != nil && *inp.DueDate != "" {
			localStr := normalizeDateTimeString(*inp.DueDate)
			utcStr, err := parseLocalToUTC(localStr, loc)
			if err != nil {
				return nil, fmt.Errorf("task[%d].dueDate: invalid format", i)
			}
			validated[i].dueDate = &utcStr
		}

		validated[i].priority = model.TaskPriorityNone
		if inp.Priority != nil && *inp.Priority != "" {
			switch *inp.Priority {
			case "none", "low", "medium", "high":
				validated[i].priority = model.TaskPriority(*inp.Priority)
			default:
				return nil, fmt.Errorf("task[%d].priority: invalid value", i)
			}
		}
		validated[i].detail = inp.Detail
		// owner: "human" -> TaskOwnerHuman, "agent" -> TaskOwnerAgent, else defaultOwner
		if inp.Owner != nil && *inp.Owner == "human" {
			validated[i].owner = model.TaskOwnerHumanPtr()
		} else if inp.Owner != nil && *inp.Owner == "agent" {
			validated[i].owner = model.TaskOwnerAgentPtr()
		} else {
			validated[i].owner = defaultOwner
		}
		if inp.EstimatedHours != nil {
			if *inp.EstimatedHours < 1 {
				return nil, fmt.Errorf("task[%d].estimatedHours: invalid (must be positive integer)", i)
			}
			validated[i].estimatedHours = inp.EstimatedHours
		}
	}

	var created []*model.Task
	err := s.repo.RunInTransaction(func(tx *gorm.DB) error {
		startOrder, err := s.repo.GetMaxOrderWithTx(tx, userID)
		if err != nil {
			return err
		}
		for i, v := range validated {
			t := &model.Task{
				UserID:         userID,
				Title:          v.title,
				ListID:         v.listID,
				Detail:         v.detail,
				DueDate:        v.dueDate,
				Priority:       v.priority,
				Status:         model.TaskStatusActive,
				Owner:          v.owner,
				EstimatedHours: v.estimatedHours,
				Order:          startOrder + i,
			}
			if err := s.repo.CreateWithTx(tx, t); err != nil {
				return err
			}
			created = append(created, t)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return created, nil
}

func (s *TaskService) List(userID, filter string, listID *string, owner *string, date, startDate, endDate string, loc *time.Location, includeCompleted bool) ([]model.Task, error) {
	var ownerParam *string
	if owner != nil && *owner != "" && *owner != "all" {
		ownerParam = owner
	}
	tasks, err := s.repo.ListByUserID(userID, filter, listID, ownerParam)
	if err != nil {
		return nil, err
	}
	if loc == nil {
		loc = time.UTC
	}

	// includeCompleted: 合并 active + completed
	if includeCompleted {
		allowed := filter == "all" || filter == "today" || filter == "tomorrow" || filter == "recent-seven" || filter == "inbox"
		if allowed {
			var completed []model.Task
			switch filter {
			case "inbox":
				completed, err = s.repo.ListByUserID(userID, "completed-inbox", nil, ownerParam)
			case "all":
				// 清单页 listID!=nil 或全部页 listID=nil
				completed, err = s.repo.ListByUserID(userID, "completed", listID, ownerParam)
			case "today", "tomorrow", "recent-seven":
				completed, err = s.repo.ListByUserID(userID, "completed", nil, ownerParam)
			}
			if err != nil {
				return nil, err
			}
			tasks = append(tasks, completed...)
		}
	}

	// 日期过滤：DB 存 UTC，转为用户本地日期再与 date 比较
	if filter == "today" || filter == "tomorrow" {
		if date == "" {
			return tasks, nil
		}
		var filtered []model.Task
		for _, t := range tasks {
			if t.DueDate == nil {
				continue
			}
			localStr := formatUTCToLocal(*t.DueDate, loc)
			if len(localStr) >= 10 && localStr[:10] == date {
				filtered = append(filtered, t)
			}
		}
		return filtered, nil
	}
	if filter == "recent-seven" {
		if startDate == "" || endDate == "" {
			return tasks, nil
		}
		var filtered []model.Task
		for _, t := range tasks {
			if t.DueDate == nil {
				continue
			}
			localStr := formatUTCToLocal(*t.DueDate, loc)
			if len(localStr) >= 10 {
				d := localStr[:10]
				if d >= startDate && d <= endDate {
					filtered = append(filtered, t)
				}
			}
		}
		return filtered, nil
	}
	return tasks, nil
}

func (s *TaskService) Update(userID, id string, title *string, listID *string, dueDate *string, priority *string, detail *string, owner *string, estimatedHours *int, clearEstimatedHours bool, loc *time.Location) error {
	if _, err := s.repo.GetByIDAndUserID(id, userID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTaskNotFound
		}
		return err
	}
	fields := make(map[string]interface{})
	if title != nil {
		fields["title"] = *title
	}
	if listID != nil {
		fields["list_id"] = listID
	}
	if dueDate != nil {
		if *dueDate == "" {
			fields["due_date"] = nil
		} else {
			localStr := normalizeDateTimeString(*dueDate)
			utcStr, err := parseLocalToUTC(localStr, loc)
			if err != nil {
				return err
			}
			fields["due_date"] = utcStr
		}
	}
	if priority != nil {
		switch *priority {
		case "none", "low", "medium", "high":
			fields["priority"] = model.TaskPriority(*priority)
		}
	}
	if detail != nil {
		fields["detail"] = *detail
	}
	if owner != nil {
		switch *owner {
		case "human":
			fields["owner"] = model.TaskOwnerHuman
		case "agent":
			fields["owner"] = model.TaskOwnerAgent
		default:
			return errors.New("owner must be 'human' or 'agent'")
		}
	}
	if clearEstimatedHours {
		fields["estimated_hours"] = nil
	} else if estimatedHours != nil {
		if *estimatedHours < 1 {
			return errors.New("estimated_hours 需为正整数")
		}
		fields["estimated_hours"] = *estimatedHours
	}
	return s.repo.UpdateFields(id, userID, fields)
}

func (s *TaskService) Toggle(userID, id string) error {
	t, err := s.repo.GetByIDAndUserID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTaskNotFound
		}
		return err
	}
	completed := !t.Completed
	status := model.TaskStatusActive
	if completed {
		status = model.TaskStatusCompleted
	}
	return s.repo.UpdateFields(id, userID, map[string]interface{}{
		"completed": completed,
		"status":   status,
	})
}

func (s *TaskService) Abandon(userID, id string) error {
	if _, err := s.repo.GetByIDAndUserID(id, userID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTaskNotFound
		}
		return err
	}
	return s.repo.UpdateFields(id, userID, map[string]interface{}{
		"status":    model.TaskStatusAbandoned,
		"completed": false,
	})
}

func (s *TaskService) Restore(userID, id string) error {
	if _, err := s.repo.GetByIDAndUserID(id, userID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTaskNotFound
		}
		return err
	}
	return s.repo.UpdateFields(id, userID, map[string]interface{}{
		"status":    model.TaskStatusActive,
		"completed": false,
	})
}

func (s *TaskService) MoveToTrash(userID, id string) error {
	if _, err := s.repo.GetByIDAndUserID(id, userID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTaskNotFound
		}
		return err
	}
	return s.repo.UpdateFields(id, userID, map[string]interface{}{
		"status":    model.TaskStatusTrash,
		"completed": false,
	})
}

func (s *TaskService) Delete(userID, id string) error {
	return s.repo.Delete(id, userID)
}

func (s *TaskService) Reorder(userID, id string, newIndex int) error {
	tasks, err := s.repo.ListByUserID(userID, "all", nil, nil)
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
	// clamp newIndex to valid range [0, len(tasks)-1]
	if newIndex >= len(tasks) {
		newIndex = len(tasks) - 1
	}
	if newIndex < 0 {
		newIndex = 0
	}
	// 移动并重排 order
	item := tasks[idx]
	tasks = append(tasks[:idx], tasks[idx+1:]...)
	tasks = append(tasks[:newIndex], append([]model.Task{item}, tasks[newIndex:]...)...)
	for i, t := range tasks {
		if err := s.repo.UpdateFields(t.ID, userID, map[string]interface{}{"sort_order": i}); err != nil {
			return err
		}
	}
	return nil
}
