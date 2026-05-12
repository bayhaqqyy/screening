package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/golang-jwt/jwt/v5"
	"github.com/sahamscreen/server/config"
	"github.com/sahamscreen/server/database"
)

// signedToken produces a valid JWT for the given subject using the test-time
// JWTSecret so we can exercise the handler's auth path without reaching into
// its internals.
func signedToken(t *testing.T, sub string) string {
	t.Helper()
	claims := jwt.MapClaims{"sub": sub, "exp": time.Now().Add(time.Hour).Unix()}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString([]byte(config.AppConfig.JWTSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

func withAuth(r *http.Request, token string) *http.Request {
	r.Header.Set("Authorization", "Bearer "+token)
	return r
}

// TestWatchlistCountersSnapshot validates that WatchlistCounters() returns a
// map with all expected keys even at process start. This is a quick
// regression guard against the atomic type drift — if someone accidentally
// changes the type signature, the map will miss a key.
func TestWatchlistCountersSnapshot(t *testing.T) {
	got := WatchlistCounters()
	for _, key := range []string{"get", "add", "remove", "sell_patch", "errors"} {
		if _, ok := got[key]; !ok {
			t.Errorf("WatchlistCounters() missing key %q", key)
		}
	}
}

// TestAddToWatchlist_SeedsEntryPrice drives the AddToWatchlist handler with a
// sqlmock DB and verifies that (a) it looks up last_price from stock_info,
// (b) the INSERT receives the snapshot price as the entry_price argument,
// and (c) the counter increments on success.
func TestAddToWatchlist_SeedsEntryPrice(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	database.DB = db
	config.AppConfig.JWTSecret = "test-secret-watchlist"

	before := WatchlistCounters()["add"]

	// 1) price lookup
	mock.ExpectQuery(`SELECT COALESCE\(last_price, 0\) FROM stock_info WHERE ticker = \$1`).
		WithArgs("BBCA").
		WillReturnRows(sqlmock.NewRows([]string{"last_price"}).AddRow(9250.0))

	// 2) INSERT into watchlists — we assert on the (user_id, ticker, category,
	//    entry_price, ...) arg order so a future schema drift trips the test.
	mock.ExpectExec(`INSERT INTO watchlists`).
		WithArgs("user-123", "BBCA", "WATCHLIST", 9250.0, sqlmock.AnyArg(), 0.0, "").
		WillReturnResult(sqlmock.NewResult(1, 1))

	body, _ := json.Marshal(map[string]any{"ticker": "BBCA"})
	req := httptest.NewRequest(http.MethodPost, "/api/watchlist", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, signedToken(t, "user-123"))
	w := httptest.NewRecorder()

	AddToWatchlist(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200. body=%s", w.Code, w.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("json: %v", err)
	}
	if resp["entry_price"].(float64) != 9250.0 {
		t.Errorf("entry_price in response = %v, want 9250", resp["entry_price"])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}

	after := WatchlistCounters()["add"]
	if after-before < 1 {
		t.Errorf("add counter did not advance: %d -> %d", before, after)
	}
}

// TestUpdateWatchlistSellPrice_RejectsNegative checks that the PATCH handler
// does not reach the DB when given a negative sell price — a regression
// guard against accidental schema violations.
func TestUpdateWatchlistSellPrice_RejectsNegative(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	database.DB = db
	config.AppConfig.JWTSecret = "test-secret-watchlist"

	body, _ := json.Marshal(map[string]any{"ticker": "BBCA", "sell_price": -10})
	req := httptest.NewRequest(http.MethodPatch, "/api/watchlist", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, signedToken(t, "user-123"))
	w := httptest.NewRecorder()

	UpdateWatchlistSellPrice(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
}

// TestUpdateWatchlistSellPrice_ComputesGain exercises the happy path and
// checks the gain_pct math surfaces in the response.
func TestUpdateWatchlistSellPrice_ComputesGain(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	database.DB = db
	config.AppConfig.JWTSecret = "test-secret-watchlist"

	// UPDATE watchlists returns 1 row affected.
	mock.ExpectExec(`UPDATE watchlists`).
		WithArgs(9900.0, "user-123", "BBCA").
		WillReturnResult(sqlmock.NewResult(0, 1))
	// SELECT entry_price returns 9000 so gain = ((9900-9000)/9000)*100 = 10%.
	mock.ExpectQuery(`SELECT COALESCE\(entry_price, 0\) FROM watchlists`).
		WithArgs("user-123", "BBCA").
		WillReturnRows(sqlmock.NewRows([]string{"entry_price"}).AddRow(9000.0))

	body, _ := json.Marshal(map[string]any{"ticker": "BBCA", "sell_price": 9900})
	req := httptest.NewRequest(http.MethodPatch, "/api/watchlist", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, signedToken(t, "user-123"))
	w := httptest.NewRecorder()

	UpdateWatchlistSellPrice(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("json: %v", err)
	}
	gain, _ := resp["gain_pct"].(float64)
	if gain < 9.99 || gain > 10.01 {
		t.Errorf("gain_pct = %v, want ~10", gain)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestUpdateWatchlistSellPrice_MissingAuth confirms the handler short-circuits
// before touching the DB when the Authorization header is absent.
func TestUpdateWatchlistSellPrice_MissingAuth(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	database.DB = db

	body, _ := json.Marshal(map[string]any{"ticker": "BBCA", "sell_price": 1})
	req := httptest.NewRequest(http.MethodPatch, "/api/watchlist", bytes.NewReader(body))
	w := httptest.NewRecorder()

	UpdateWatchlistSellPrice(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", w.Code)
	}
}

// errReadCloser is kept here so future negative-path tests can inject a body
// that fails on Read (e.g. simulating a truncated upload).
var _ = errors.New // silence import when tests above don't use errors
