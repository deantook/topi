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

type TaskPriority string

const (
	TaskPriorityNone   TaskPriority = "none"
	TaskPriorityLow    TaskPriority = "low"
	TaskPriorityMedium TaskPriority = "medium"
	TaskPriorityHigh   TaskPriority = "high"
)

type TaskOwner string

const (
	TaskOwnerHuman TaskOwner = "human"
	TaskOwnerAgent TaskOwner = "agent"
)

// TaskOwnerHumanPtr returns a pointer to TaskOwnerHuman for use when default owner is human.
func TaskOwnerHumanPtr() *TaskOwner {
	o := TaskOwnerHuman
	return &o
}

// TaskOwnerAgentPtr returns a pointer to TaskOwnerAgent for use when default owner is agent.
func TaskOwnerAgentPtr() *TaskOwner {
	o := TaskOwnerAgent
	return &o
}

type Task struct {
	ID        string         `gorm:"type:char(36);primaryKey" json:"id"`
	UserID    string         `gorm:"type:char(36);index;not null" json:"-"`
	ListID    *string        `gorm:"type:char(36);index" json:"list_id"`
	Title     string         `gorm:"size:512;not null" json:"title"`
	Detail    *string        `gorm:"type:text" json:"detail,omitempty"`
	Completed bool           `gorm:"default:false" json:"completed"`
	DueDate   *string        `gorm:"type:datetime" json:"due_date"`
	Priority  TaskPriority   `gorm:"size:6;default:none" json:"priority"`
	Status    TaskStatus     `gorm:"size:16;default:active" json:"status"`
	Owner           *TaskOwner     `gorm:"size:6" json:"owner,omitempty"`
	EstimatedHours   *int           `gorm:"column:estimated_hours" json:"estimated_hours,omitempty"`
	Order            int            `gorm:"column:sort_order;default:0" json:"sort_order"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (t *Task) BeforeCreate(tx *gorm.DB) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	return nil
}
