package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/deantook/topi-api/internal/repository"
)

const tokenPrefix = "tp_"
const tokenSuffixLen = 24

var charset = []byte("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")

type McpTokenService struct {
	userRepo *repository.UserRepository
}

func NewMcpTokenService(userRepo *repository.UserRepository) *McpTokenService {
	return &McpTokenService{userRepo: userRepo}
}

func (s *McpTokenService) GetStatus(userID string) (hasToken bool, prefix string, err error) {
	u, err := s.userRepo.GetByID(userID)
	if err != nil {
		return false, "", err
	}
	if u.McpTokenHash == nil || *u.McpTokenHash == "" {
		return false, "", nil
	}
	return true, u.McpTokenPrefix, nil
}

func (s *McpTokenService) Generate(userID string) (token string, err error) {
	token = tokenPrefix + randString(tokenSuffixLen)
	hash := sha256Hash(token)
	prefix := token[:len(tokenPrefix)+4] + "..."

	u, err := s.userRepo.GetByID(userID)
	if err != nil {
		return "", err
	}
	u.McpTokenHash = &hash
	u.McpTokenPrefix = prefix
	if err := s.userRepo.Update(u); err != nil {
		return "", err
	}
	return token, nil
}

func (s *McpTokenService) Revoke(userID string) error {
	u, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}
	u.McpTokenHash = nil
	u.McpTokenPrefix = ""
	return s.userRepo.Update(u)
}

func (s *McpTokenService) ValidateToken(token string) (userID string, err error) {
	if len(token) < len(tokenPrefix)+tokenSuffixLen {
		return "", fmt.Errorf("invalid token")
	}
	if token[:len(tokenPrefix)] != tokenPrefix {
		return "", fmt.Errorf("invalid token")
	}
	hash := sha256Hash(token)
	u, err := s.userRepo.GetByMcpTokenHash(hash)
	if err != nil {
		return "", err
	}
	return u.ID, nil
}

func randString(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	for i := range b {
		b[i] = charset[int(b[i])%len(charset)]
	}
	return string(b)
}

func sha256Hash(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}
