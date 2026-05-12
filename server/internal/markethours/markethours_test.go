package markethours

import (
	"testing"
	"time"
)

func TestGetMarketStatus(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Jakarta")

	tests := []struct {
		name        string
		time        time.Time
		wantSession string
		wantMessage string
	}{
		{
			name:        "Weekend",
			time:        time.Date(2026, 5, 16, 10, 0, 0, 0, loc), // Saturday
			wantSession: "closed",
			wantMessage: "Weekend",
		},
		{
			name:        "Holiday",
			time:        time.Date(2026, 8, 17, 10, 0, 0, 0, loc), // Monday, Independence Day
			wantSession: "closed",
			wantMessage: "Holiday",
		},
		{
			name:        "Sess1 Mon-Thu",
			time:        time.Date(2026, 5, 11, 10, 0, 0, 0, loc), // Monday
			wantSession: "live",
			wantMessage: "Session 1",
		},
		{
			name:        "Sess1 Friday",
			time:        time.Date(2026, 5, 15, 10, 0, 0, 0, loc), // Friday
			wantSession: "live",
			wantMessage: "Session 1",
		},
		{
			name:        "Break Mon-Thu",
			time:        time.Date(2026, 5, 11, 12, 30, 0, 0, loc), // Monday
			wantSession: "break",
			wantMessage: "Break",
		},
		{
			name:        "Break Friday",
			time:        time.Date(2026, 5, 15, 11, 45, 0, 0, loc), // Friday
			wantSession: "break",
			wantMessage: "Break",
		},
		{
			name:        "Sess2 Mon-Thu",
			time:        time.Date(2026, 5, 11, 14, 0, 0, 0, loc), // Monday
			wantSession: "live",
			wantMessage: "Session 2",
		},
		{
			name:        "Sess2 Friday",
			time:        time.Date(2026, 5, 15, 14, 30, 0, 0, loc), // Friday
			wantSession: "live",
			wantMessage: "Session 2",
		},
		{
			name:        "Pre-Close",
			time:        time.Date(2026, 5, 11, 16, 5, 0, 0, loc), // Monday
			wantSession: "pre-close",
			wantMessage: "Pre-Close",
		},
		{
			name:        "Market Closed After Hours",
			time:        time.Date(2026, 5, 11, 17, 0, 0, 0, loc), // Monday
			wantSession: "closed",
			wantMessage: "Market Closed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotSession, gotMessage := GetMarketStatus(tt.time)
			if gotSession != tt.wantSession || gotMessage != tt.wantMessage {
				t.Errorf("GetMarketStatus() = (%v, %v), want (%v, %v)", gotSession, gotMessage, tt.wantSession, tt.wantMessage)
			}
		})
	}
}
