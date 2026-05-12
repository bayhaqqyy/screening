package workers

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/sahamscreen/server/config"
)

// fakeRefreshPublisher records every envelope it receives so tests can assert
// on what the schedule worker published without a live Kafka broker.
type fakeRefreshPublisher struct {
	mu       sync.Mutex
	received []RefreshEnvelope
}

func (f *fakeRefreshPublisher) Publish(_ context.Context, env RefreshEnvelope) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.received = append(f.received, env)
	return nil
}

func (f *fakeRefreshPublisher) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.received)
}

func (f *fakeRefreshPublisher) strategies() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]string, 0, len(f.received))
	for _, e := range f.received {
		out = append(out, e.Strategy)
	}
	return out
}

// swapPublisher replaces the package-level publisher for the duration of a
// test and returns a cleanup closure. Doing it via a helper keeps each test
// from fighting over the same global.
func swapPublisher(t *testing.T, p refreshWriter) func() {
	t.Helper()
	prev := refreshPublisher
	refreshPublisher = p
	return func() { refreshPublisher = prev }
}

// TestTriggerSwingRefresh_PublishesEnvelope — the minimal happy path: calling
// the package-level trigger yields exactly one envelope on the fake
// publisher with the expected strategy and reason.
func TestTriggerSwingRefresh_PublishesEnvelope(t *testing.T) {
	fp := &fakeRefreshPublisher{}
	defer swapPublisher(t, fp)()

	triggerSwingRefresh("unit_test")

	if fp.count() != 1 {
		t.Fatalf("publish count = %d, want 1", fp.count())
	}
	got := fp.received[0]
	if got.Strategy != "swing" {
		t.Errorf("strategy = %q, want swing", got.Strategy)
	}
	if got.Reason != "unit_test" {
		t.Errorf("reason = %q, want unit_test", got.Reason)
	}
	if got.Source != "schedule_worker" {
		t.Errorf("source = %q, want schedule_worker", got.Source)
	}
	if time.Since(got.Timestamp) > 5*time.Second {
		t.Errorf("timestamp looks stale: %v", got.Timestamp)
	}
}

// TestRunOverrides_ParsesCommaSeparatedSpec ensures the
// SCHEDULE_TIMES_OVERRIDE path publishes one envelope per listed entry and
// maps the strategy portion correctly.
func TestRunOverrides_ParsesCommaSeparatedSpec(t *testing.T) {
	fp := &fakeRefreshPublisher{}
	defer swapPublisher(t, fp)()

	runOverrides("12:00:swing, 13:30:bsjp , 15:30:swing")

	gotStrats := fp.strategies()
	want := []string{"swing", "bsjp", "swing"}
	if len(gotStrats) != len(want) {
		t.Fatalf("strategies = %v, want %v", gotStrats, want)
	}
	for i := range want {
		if gotStrats[i] != want[i] {
			t.Errorf("strategies[%d] = %q, want %q", i, gotStrats[i], want[i])
		}
	}
}

// TestRunOverrides_IgnoresUnknownStrategy — a typo in the override spec
// should be logged and skipped, never publish an envelope.
func TestRunOverrides_IgnoresUnknownStrategy(t *testing.T) {
	fp := &fakeRefreshPublisher{}
	defer swapPublisher(t, fp)()

	runOverrides("12:00:moonshot,13:30:bsjp")

	if fp.count() != 1 {
		t.Fatalf("publish count = %d, want 1 (only bsjp)", fp.count())
	}
	if fp.received[0].Strategy != "bsjp" {
		t.Errorf("strategy = %q, want bsjp", fp.received[0].Strategy)
	}
}

// TestStartScheduleWorker_HonorsOverrideBypass — when SCHEDULE_TIMES_OVERRIDE
// is set, StartScheduleWorker should fire the triggers immediately and
// return without registering any cron entries (we assert via the publisher).
func TestStartScheduleWorker_HonorsOverrideBypass(t *testing.T) {
	fp := &fakeRefreshPublisher{}
	defer swapPublisher(t, fp)()

	prev := config.AppConfig.ScheduleTimesOverride
	config.AppConfig.ScheduleTimesOverride = "12:00:swing"
	defer func() { config.AppConfig.ScheduleTimesOverride = prev }()

	StartScheduleWorker()

	if fp.count() < 1 {
		t.Fatalf("expected at least 1 published envelope, got 0")
	}
	if fp.received[0].Strategy != "swing" {
		t.Errorf("strategy = %q, want swing", fp.received[0].Strategy)
	}
}
