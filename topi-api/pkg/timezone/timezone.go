package timezone

import (
	"strconv"
	"time"
)

const ContextKey = "timezone"

// LoadFromHeaders 从 X-Timezone (IANA) 或 X-Timezone-Offset (分钟) 解析。无效时返回 UTC。
func LoadFromHeaders(timezoneName, offsetMinutes string) *time.Location {
	if timezoneName != "" {
		if loc, err := time.LoadLocation(timezoneName); err == nil {
			return loc
		}
	}
	if offsetMinutes != "" {
		if m, err := strconv.Atoi(offsetMinutes); err == nil && m >= -720 && m <= 720 {
			return time.FixedZone("Offset", m*60)
		}
	}
	return time.UTC
}
