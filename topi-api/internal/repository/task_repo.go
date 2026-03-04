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
		// 日期过滤由 service 层处理
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

// UpdateFields updates only the given fields by ID and userID. Use for partial updates
// so values (e.g. due_date) can be normalized before write.
func (r *TaskRepository) UpdateFields(id, userID string, fields map[string]interface{}) error {
	if len(fields) == 0 {
		return nil
	}
	return r.db.Model(&model.Task{}).Where("id = ? AND user_id = ?", id, userID).Updates(fields).Error
}

func (r *TaskRepository) Delete(id, userID string) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.Task{}).Error
}
