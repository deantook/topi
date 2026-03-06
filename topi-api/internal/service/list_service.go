package service

import (
	"errors"

	"github.com/deantook/topi-api/internal/model"
	"github.com/deantook/topi-api/internal/repository"
	"gorm.io/gorm"
)

var ErrListNotFound = errors.New("list not found")

type ListService struct {
	listRepo *repository.ListRepository
	taskRepo *repository.TaskRepository
}

func NewListService(listRepo *repository.ListRepository, taskRepo *repository.TaskRepository) *ListService {
	return &ListService{listRepo: listRepo, taskRepo: taskRepo}
}

func (s *ListService) Create(userID, name string) (*model.List, error) {
	l := &model.List{UserID: userID, Name: name}
	if err := s.listRepo.Create(l); err != nil {
		return nil, err
	}
	return l, nil
}

func (s *ListService) List(userID string) ([]model.List, error) {
	return s.listRepo.ListByUserID(userID)
}

func (s *ListService) Update(userID, id, name string) error {
	l, err := s.listRepo.GetByIDAndUserID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrListNotFound
		}
		return err
	}
	l.Name = name
	return s.listRepo.Update(l)
}

func (s *ListService) Delete(userID, id string) error {
	if _, err := s.listRepo.GetByIDAndUserID(id, userID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrListNotFound
		}
		return err
	}
	if err := s.taskRepo.ClearListIDByListID(userID, id); err != nil {
		return err
	}
	return s.listRepo.Delete(id, userID)
}
