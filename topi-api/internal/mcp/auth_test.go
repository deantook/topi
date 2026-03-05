package mcp

import (
	"context"
	"testing"
)

func TestUserIDFromContext(t *testing.T) {
	ctx := context.Background()
	if UserIDFromContext(ctx) != "" {
		t.Error("expected empty for missing userID")
	}
	ctx = ContextWithUserID(ctx, "user-123")
	if UserIDFromContext(ctx) != "user-123" {
		t.Error("expected user-123")
	}
}
