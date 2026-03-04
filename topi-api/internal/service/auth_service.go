package service

import (
	"errors"

	"github.com/deantook/topi-api/internal/model"
	"github.com/deantook/topi-api/internal/repository"
	"github.com/deantook/topi-api/pkg/jwt"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrUserExists   = errors.New("username already exists")
	ErrInvalidCreds = errors.New("invalid credentials")
)

type AuthService struct {
	userRepo *repository.UserRepository
	jwt      *jwt.Helper
}

func NewAuthService(userRepo *repository.UserRepository, jwtHelper *jwt.Helper) *AuthService {
	return &AuthService{userRepo: userRepo, jwt: jwtHelper}
}

func (s *AuthService) Register(username, password string) (*model.User, error) {
	_, err := s.userRepo.GetByUsername(username)
	if err == nil {
		return nil, ErrUserExists
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	u := &model.User{
		Username:     username,
		PasswordHash: string(hash),
	}
	if err := s.userRepo.Create(u); err != nil {
		return nil, err
	}
	return u, nil
}

func (s *AuthService) Login(username, password string) (string, error) {
	u, err := s.userRepo.GetByUsername(username)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", ErrInvalidCreds
		}
		return "", err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return "", ErrInvalidCreds
	}
	return s.jwt.Sign(u.ID)
}
