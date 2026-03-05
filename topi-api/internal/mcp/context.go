package mcp

import "context"

type contextKey string

const UserIDContextKey contextKey = "user_id"

func UserIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(UserIDContextKey).(string)
	return v
}

func ContextWithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, UserIDContextKey, userID)
}
