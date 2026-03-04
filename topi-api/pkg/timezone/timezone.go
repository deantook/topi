package timezone

import (
	"strconv"
	"time"
)

const ContextKey = "timezone"
const Layout = "2006-01-02 15:04:05"

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

// FormatUTCToLocal 解析 UTC 字符串，转为用户本地时间，返回 yyyy-MM-dd HH:mm:ss。
func FormatUTCToLocal(utcStr string, loc *time.Location) string {
	if loc == nil {
		loc = time.UTC
	}
	t, err := time.ParseInLocation(Layout, utcStr, time.UTC)
	if err != nil {
		return utcStr
	}
	return t.In(loc).Format(Layout)
}
