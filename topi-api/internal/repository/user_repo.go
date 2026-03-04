package repository

import (
	"github.com/deantook/topi-api/internal/model"
	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(u *model.User) error {
	return r.db.Create(u).Error
}

func (r *UserRepository) GetByID(id string) (*model.User, error) {
	var u model.User
	err := r.db.Where("id = ?", id).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) GetByUsername(username string) (*model.User, error) {
	var u model.User
	err := r.db.Where("username = ?", username).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}
