package repository

import (
	"github.com/deantook/topi-api/internal/model"
	"gorm.io/gorm"
)

type ListRepository struct {
	db *gorm.DB
}

func NewListRepository(db *gorm.DB) *ListRepository {
	return &ListRepository{db: db}
}

func (r *ListRepository) Create(l *model.List) error {
	return r.db.Create(l).Error
}

func (r *ListRepository) ListByUserID(userID string) ([]model.List, error) {
	var lists []model.List
	err := r.db.Where("user_id = ?", userID).Order("created_at").Find(&lists).Error
	return lists, err
}

func (r *ListRepository) GetByIDAndUserID(id, userID string) (*model.List, error) {
	var l model.List
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&l).Error
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func (r *ListRepository) Update(l *model.List) error {
	return r.db.Save(l).Error
}

func (r *ListRepository) Delete(id, userID string) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.List{}).Error
}
