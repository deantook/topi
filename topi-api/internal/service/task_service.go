package service

import (
	"errors"
	"strings"
	"time"

	"github.com/deantook/topi-api/internal/model"
	"github.com/deantook/topi-api/internal/repository"
	"gorm.io/gorm"
)

// normalizeDateTimeString accepts yyyy-MM-dd, yyyy-MM-dd HH:mm:ss, yyyy-MM-ddTHH:mm etc., outputs yyyy-MM-dd HH:mm:ss.
func normalizeDateTimeString(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return s
	}
	layouts := []string{
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02T15:04:05",
		"2006-01-02T15:04",
		"2006-01-02",
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t.Format("2006-01-02 15:04:05")
		}
	}
	return s
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

type TaskService struct {
	repo *repository.TaskRepository
}

func NewTaskService(repo *repository.TaskRepository) *TaskService {
	return &TaskService{repo: repo}
}

func (s *TaskService) Create(userID string, title string, listID *string, dueDate *string, priority *string, loc *time.Location) (*model.Task, error) {
	tasks, _ := s.repo.ListByUserID(userID, "all", nil)
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
		UserID:   userID,
		Title:    title,
		ListID:   listID,
		DueDate:  normalizedDue,
		Priority: prio,
		Status:   model.TaskStatusActive,
		Order:    maxOrder + 1,
	}
	if err := s.repo.Create(t); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *TaskService) List(userID, filter string, listID *string, date, startDate, endDate string, loc *time.Location) ([]model.Task, error) {
	tasks, err := s.repo.ListByUserID(userID, filter, listID)
	if err != nil {
		return nil, err
	}
	if loc == nil {
		loc = time.UTC
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

func (s *TaskService) Update(userID, id string, title *string, listID *string, dueDate *string, priority *string, loc *time.Location) error {
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

func (s *TaskService) MoveToTrash(userID, id string) error {
	t, err := s.repo.GetByIDAndUserID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTaskNotFound
		}
		return err
	}
	t.Status = model.TaskStatusTrash
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
		t.Order = i
		if err := s.repo.Update(&t); err != nil {
			return err
		}
	}
	return nil
}
