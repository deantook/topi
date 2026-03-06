package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID             string  `gorm:"type:char(36);primaryKey"`
	Username       string  `gorm:"uniqueIndex;size:64;not null"`
	PasswordHash   string  `gorm:"size:255;not null"`
	McpTokenHash   *string `gorm:"type:char(64);uniqueIndex;default:null" json:"-"`
	McpTokenPrefix string  `gorm:"size:20;default:''" json:"-"`
	CreatedAt      time.Time
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	return nil
}
