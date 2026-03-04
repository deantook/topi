package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	DSN            string
	JWTSecret      string
	JWTExpireHours int
	GinMode        string
	CORSOrigin     string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	hours, _ := strconv.Atoi(getEnv("JWT_EXPIRE_HOURS", "168"))
	if hours <= 0 {
		hours = 168
	}

	cfg := &Config{
		Port:           getEnv("PORT", "8080"),
		DSN:            getEnv("DB_DSN", ""),
		JWTSecret:      getEnv("JWT_SECRET", ""),
		JWTExpireHours: hours,
		GinMode:        getEnv("GIN_MODE", "debug"),
		CORSOrigin:     getEnv("CORS_ORIGIN", "http://localhost:5173"),
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
