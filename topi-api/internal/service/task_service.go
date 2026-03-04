package service

import (
	"errors"
	"strings"

	"github.com/deantook/topi-api/internal/model"
	"github.com/deantook/topi-api/internal/repository"
	"gorm.io/gorm"
)

// normalizeDateString ensures YYYY-MM-DD for MySQL DATE column (rejects ISO datetimes).
func normalizeDateString(s string) string {
	s = strings.TrimSpace(s)
	if len(s) >= 10 && s[4] == '-' && s[7] == '-' {
		return s[:10]
	}
	return s
}

var ErrTaskNotFound = errors.New("task not found")

type TaskService struct {
	repo *repository.TaskRepository
}

func NewTaskService(repo *repository.TaskRepository) *TaskService {
	return &TaskService{repo: repo}
}

func (s *TaskService) Create(userID string, title string, listID *string, dueDate *string, priority *string) (*model.Task, error) {
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
		d := normalizeDateString(*dueDate)
		normalizedDue = &d
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

func (s *TaskService) List(userID, filter string, listID *string, date, startDate, endDate string) ([]model.Task, error) {
	tasks, err := s.repo.ListByUserID(userID, filter, listID)
	if err != nil {
		return nil, err
	}
	// 日期过滤：使用前端传入的日期（用户本地时区），today/tomorrow 传 date，recent-seven 传 startDate+endDate
	if filter == "today" || filter == "tomorrow" {
		if date == "" {
			return tasks, nil
		}
		var filtered []model.Task
		for _, t := range tasks {
			if t.DueDate != nil && *t.DueDate == date {
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
			d := *t.DueDate
			if d >= startDate && d <= endDate {
				filtered = append(filtered, t)
			}
		}
		return filtered, nil
	}
	return tasks, nil
}

func (s *TaskService) Update(userID, id string, title *string, listID *string, dueDate *string, priority *string) error {
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
			fields["due_date"] = normalizeDateString(*dueDate)
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
