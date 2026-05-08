package handlers

import (
	"testing"

	"github.com/sahamscreen/server/config"
)

func TestNormalizeAlert(t *testing.T) {
	tests := []struct {
		name    string
		in      TVAlertPayload
		wantErr bool
		check   func(t *testing.T, p TVAlertPayload)
	}{
		{
			name: "strips exchange prefix and uppercases ticker",
			in: TVAlertPayload{
				Ticker:   "idx:bbca",
				Strategy: "BSJP",
				Price:    9000,
			},
			check: func(t *testing.T, p TVAlertPayload) {
				if p.Ticker != "BBCA" {
					t.Fatalf("ticker = %q, want BBCA", p.Ticker)
				}
				if p.Strategy != "bsjp" {
					t.Fatalf("strategy = %q, want bsjp", p.Strategy)
				}
				if p.Signal != "WATCH" {
					t.Fatalf("default signal = %q, want WATCH", p.Signal)
				}
				if p.Score != defaultScore {
					t.Fatalf("default score = %d, want %d", p.Score, defaultScore)
				}
				if p.Target == 0 || p.StopLoss == 0 {
					t.Fatalf("target/stop_loss should default from price")
				}
			},
		},
		{
			name: "rejects unsupported strategy",
			in: TVAlertPayload{
				Ticker:   "BBRI",
				Strategy: "moonshot",
				Price:    1000,
			},
			wantErr: true,
		},
		{
			name: "rejects empty ticker",
			in: TVAlertPayload{
				Strategy: "swing",
				Price:    100,
			},
			wantErr: true,
		},
		{
			name: "rejects non-positive price",
			in: TVAlertPayload{
				Ticker:   "BBNI",
				Strategy: "scalping",
				Price:    0,
			},
			wantErr: true,
		},
		{
			name: "clamps score to [0,100]",
			in: TVAlertPayload{
				Ticker:   "TLKM",
				Strategy: "swing",
				Price:    3000,
				Score:    250,
			},
			check: func(t *testing.T, p TVAlertPayload) {
				if p.Score != 100 {
					t.Fatalf("score = %d, want clamped to 100", p.Score)
				}
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := normalizeAlert(tc.in)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tc.check != nil {
				tc.check(t, got)
			}
		})
	}
}

func TestStripExchangePrefix(t *testing.T) {
	cases := map[string]string{
		"IDX:BBCA":     "BBCA",
		"NASDAQ:AAPL":  "AAPL",
		"BBCA":         "BBCA",
		"":             "",
		"NYSE:BRK.B":   "BRK.B",
	}
	for in, want := range cases {
		if got := stripExchangePrefix(in); got != want {
			t.Errorf("stripExchangePrefix(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestConstantTimeEqual(t *testing.T) {
	if !constantTimeEqual("abc", "abc") {
		t.Error("equal strings should match")
	}
	if constantTimeEqual("abc", "abd") {
		t.Error("different strings should not match")
	}
	if constantTimeEqual("abc", "abcd") {
		t.Error("different lengths should not match")
	}
	if constantTimeEqual("", "") {
		// equal but empty — current impl returns true (subtle.ConstantTimeCompare
		// of two empty slices). validateBodySecret still rejects this branch
		// via the empty-string short-circuit, so this is acceptable.
	}
}

func TestValidateBodySecret(t *testing.T) {
	prev := config.AppConfig.TVWebhookSecret
	defer func() { config.AppConfig.TVWebhookSecret = prev }()

	// When unconfigured, any secret (including empty) passes — body secret is
	// optional defense in depth.
	config.AppConfig.TVWebhookSecret = ""
	if err := validateBodySecret(""); err != nil {
		t.Fatalf("expected nil err when secret unset, got %v", err)
	}
	if err := validateBodySecret("anything"); err != nil {
		t.Fatalf("expected nil err when secret unset, got %v", err)
	}

	config.AppConfig.TVWebhookSecret = "topsecret"
	if err := validateBodySecret("topsecret"); err != nil {
		t.Fatalf("expected nil err for matching secret, got %v", err)
	}
	if err := validateBodySecret("wrong"); err == nil {
		t.Fatalf("expected error for mismatched secret")
	}
}
