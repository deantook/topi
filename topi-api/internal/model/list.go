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
