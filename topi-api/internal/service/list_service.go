package service

import (
	"errors"

	"github.com/deantook/topi-api/internal/model"
	"github.com/deantook/topi-api/internal/repository"
	"gorm.io/gorm"
)

var ErrListNotFound = errors.New("list not found")

type ListService struct {
	repo *repository.ListRepository
}

func NewListService(repo *repository.ListRepository) *ListService {
	return &ListService{repo: repo}
}

func (s *ListService) Create(userID, name string) (*model.List, error) {
	l := &model.List{UserID: userID, Name: name}
	if err := s.repo.Create(l); err != nil {
		return nil, err
	}
	return l, nil
}

func (s *ListService) List(userID string) ([]model.List, error) {
	return s.repo.ListByUserID(userID)
}

func (s *ListService) Update(userID, id, name string) error {
	l, err := s.repo.GetByIDAndUserID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrListNotFound
		}
		return err
	}
	l.Name = name
	return s.repo.Update(l)
}

func (s *ListService) Delete(userID, id string) error {
	return s.repo.Delete(id, userID)
}
