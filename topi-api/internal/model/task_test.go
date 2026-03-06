package model

import (
	"testing"
)

func TestNormalizeDueDateForDB(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		expect string
	}{
		{"RFC3339 with Z", "2026-03-07T00:00:00Z", "2026-03-07 00:00:00"},
		{"RFC3339 with offset", "2026-03-07T08:00:00+08:00", "2026-03-07 00:00:00"}, // +08:00 08:00 = UTC 00:00
		{"already MySQL format", "2026-03-07 00:00:00", "2026-03-07 00:00:00"},
		{"date only", "2026-03-07", "2026-03-07 00:00:00"},
		{"empty", "", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeDueDateForDB(tt.input)
			if got != tt.expect {
				t.Errorf("NormalizeDueDateForDB(%q) = %q, want %q", tt.input, got, tt.expect)
			}
		})
	}
}
