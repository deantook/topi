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
		UserID:  userID,
		Title:   title,
		ListID:  listID,
		DueDate: dueDate,
		Status:  model.TaskStatusActive,
		Order:   maxOrder + 1,
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
		if *dueDate == "" {
			t.DueDate = nil
		} else {
			t.DueDate = dueDate
		}
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
