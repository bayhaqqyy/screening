package workers

// schedule_worker.go — Sprint 6 cron-based refresh scheduler.
//
// The IDX calendar has different session cutoffs on Fridays vs Mon–Thu, so
// the schedule is expressed as explicit cron entries for each weekday rather
// than a single "weekday" wildcard. Supported triggers:
//
//   Swing refresh   — 12:00 WIB Mon–Thu (end of Session 1), 11:30 WIB Friday
//                     (early close), plus 15:30 WIB every trading day.
//   BSJP refresh    — 13:30 WIB Mon–Thu (Session 2 start), 14:00 WIB Friday,
//                     plus 15:30 WIB every trading day (pre-close snapshot).
//
// Each trigger fires triggerSwingRefresh / triggerBSJPRefresh, which for the
// MVP simply publishes a small envelope to the new Kafka topic
// idx.screener.refresh. The engine (engine/streaming/screener_consumer.py,
// or whichever process we wire up later) is expected to react by running
// its fresh scan for the given strategy.
//
// Testing/QA bypass:
//   SCHEDULE_TIMES_OVERRIDE="12:00:swing,13:30:bsjp"
// skips the cron entries entirely and runs the listed triggers immediately
// on boot. This lets an integration test verify the publish path without
// waiting for wall-clock 12:00 WIB.

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/sahamscreen/server/config"
	"github.com/sahamscreen/server/internal/ai"
	"github.com/sahamscreen/server/internal/markethours"
	"github.com/segmentio/kafka-go"
)

// ScreenerRefreshTopic is the Kafka topic the scheduler publishes to. Kept
// exported so tests/tools can subscribe without copying the string literal.
const ScreenerRefreshTopic = "idx.screener.refresh"

// RefreshEnvelope is the JSON payload written to ScreenerRefreshTopic.
type RefreshEnvelope struct {
	Strategy  string    `json:"strategy"`           // "swing" | "bsjp"
	Reason    string    `json:"reason"`             // e.g. "session1_close"
	Timestamp time.Time `json:"timestamp"`          // UTC instant of the trigger
	Source    string    `json:"source"`             // always "schedule_worker"
}

// refreshPublisher is the seam we use to swap the real Kafka writer for a
// capture-only implementation in tests. Package-level `var` so tests can
// override it at init time without touching StartScheduleWorker.
var refreshPublisher refreshWriter = &kafkaRefreshWriter{}

type refreshWriter interface {
	Publish(ctx context.Context, env RefreshEnvelope) error
}

type kafkaRefreshWriter struct {
	writer *kafka.Writer
	once   bool
}

func (k *kafkaRefreshWriter) Publish(ctx context.Context, env RefreshEnvelope) error {
	if k.writer == nil {
		k.writer = &kafka.Writer{
			Addr:         kafka.TCP(config.AppConfig.KafkaBroker),
			Topic:        ScreenerRefreshTopic,
			Balancer:     &kafka.LeastBytes{},
			BatchTimeout: 10 * time.Millisecond,
			// AllowAutoTopicCreation eases first-boot experience in local
			// docker-compose stacks where the broker does not pre-create
			// the topic. Production clusters typically require the topic
			// to exist already, in which case this is a no-op.
			AllowAutoTopicCreation: true,
		}
	}
	body, err := json.Marshal(env)
	if err != nil {
		return err
	}
	return k.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(env.Strategy),
		Value: body,
	})
}

// triggerSwingRefresh publishes a "please re-run swing" envelope on the
// refresh topic. Marked as a package variable so tests can stub it.
var triggerSwingRefresh = func(reason string) {
	publishRefresh("swing", reason)
}

// triggerBSJPRefresh publishes a "please re-run BSJP" envelope.
var triggerBSJPRefresh = func(reason string) {
	publishRefresh("bsjp", reason)
}

func publishRefresh(strategy, reason string) {
	env := RefreshEnvelope{
		Strategy:  strategy,
		Reason:    reason,
		Timestamp: time.Now().UTC(),
		Source:    "schedule_worker",
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := refreshPublisher.Publish(ctx, env); err != nil {
		log.Printf("schedule_worker: failed to publish %s refresh (%s): %v", strategy, reason, err)
		return
	}
	log.Printf("schedule_worker: published %s refresh trigger (%s)", strategy, reason)
}

// StartScheduleWorker registers the cron jobs that drive strategy refreshes.
// All entries are evaluated in Asia/Jakarta so DST-free IDX session boundaries
// map 1:1 onto the cron spec. The function returns immediately; the cron
// scheduler runs in its own goroutine managed by robfig/cron.
func StartScheduleWorker() {
	// Respect the test/QA bypass first so an override does not race with the
	// real cron entries.
	if override := strings.TrimSpace(config.AppConfig.ScheduleTimesOverride); override != "" {
		log.Printf("schedule_worker: SCHEDULE_TIMES_OVERRIDE active (%q) — running overrides and skipping cron", override)
		runOverrides(override)
		return
	}

	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}

	c := cron.New(cron.WithLocation(loc), cron.WithLogger(cron.DefaultLogger))

	// --- Swing ---------------------------------------------------------------
	// Mon–Thu 12:00 WIB — end of Session 1 on the standard calendar.
	if _, err := c.AddFunc("0 12 * * 1-4", func() {
		if !markethours.IsTradingDay(time.Now().In(loc)) {
			return
		}
		triggerSwingRefresh("session1_close")
	}); err != nil {
		log.Printf("schedule_worker: failed to register swing mon-thu cron: %v", err)
	}

	// Friday 11:30 WIB — IDX closes Session 1 earlier on Fridays.
	if _, err := c.AddFunc("30 11 * * 5", func() {
		if !markethours.IsTradingDay(time.Now().In(loc)) {
			return
		}
		triggerSwingRefresh("session1_close_friday")
	}); err != nil {
		log.Printf("schedule_worker: failed to register swing friday cron: %v", err)
	}

	// --- BSJP ----------------------------------------------------------------
	// Mon–Thu 13:30 WIB — start of Session 2, relevant for BSJP gap-up setups.
	if _, err := c.AddFunc("30 13 * * 1-4", func() {
		if !markethours.IsTradingDay(time.Now().In(loc)) {
			return
		}
		triggerBSJPRefresh("session2_open")
	}); err != nil {
		log.Printf("schedule_worker: failed to register bsjp mon-thu cron: %v", err)
	}

	// Friday 14:00 WIB — BEI opens Session 2 half an hour later on Fridays.
	if _, err := c.AddFunc("0 14 * * 5", func() {
		if !markethours.IsTradingDay(time.Now().In(loc)) {
			return
		}
		triggerBSJPRefresh("session2_open_friday")
	}); err != nil {
		log.Printf("schedule_worker: failed to register bsjp friday cron: %v", err)
	}

	// --- Pre-close snapshot (both strategies) --------------------------------
	// Every weekday at 15:30 WIB — captures the end-of-day state that feeds
	// both the swing performance check and the BSJP next-day ranking.
	if _, err := c.AddFunc("30 15 * * 1-5", func() {
		if !markethours.IsTradingDay(time.Now().In(loc)) {
			return
		}
		triggerSwingRefresh("pre_close")
		triggerBSJPRefresh("pre_close")
	}); err != nil {
		log.Printf("schedule_worker: failed to register pre-close cron: %v", err)
	}

	// --- AI daily report ----------------------------------------------------
	// 15:45 WIB on trading days — gives the pre-close snapshot 15 min to
	// settle, then asks the pro model to summarise the day. Wrapped in
	// withLock so a slow LLM response can never cause two generators to
	// run concurrently.
	if _, err := c.AddFunc("45 15 * * 1-5", withLock(&dailyReportMu, func() {
		if !markethours.IsTradingDay(time.Now().In(loc)) {
			return
		}
		generateDailyReport()
	})); err != nil {
		log.Printf("schedule_worker: failed to register daily-report cron: %v", err)
	}

	c.Start()
	log.Println("Schedule Worker started (WIB cron: swing 12:00/11:30, bsjp 13:30/14:00, pre-close 15:30, daily-report 15:45).")
}

// runOverrides parses SCHEDULE_TIMES_OVERRIDE and fires each listed trigger
// immediately. The format is "HH:MM:strategy[,HH:MM:strategy...]"; the HH:MM
// portion is ignored for ordering but kept in the reason string so the log
// still reflects what the override claimed to simulate.
func runOverrides(spec string) {
	for _, raw := range strings.Split(spec, ",") {
		entry := strings.TrimSpace(raw)
		if entry == "" {
			continue
		}
		parts := strings.Split(entry, ":")
		if len(parts) < 2 {
			log.Printf("schedule_worker: skipping malformed override %q", entry)
			continue
		}
		// Accept either "HH:MM:strategy" (3 parts) or "strategy" (1 part
		// after the colon split fails for just "swing"). Be forgiving so
		// QA scripts don't need to guess the exact format.
		var strategy, label string
		if len(parts) >= 3 {
			label = parts[0] + ":" + parts[1]
			strategy = strings.ToLower(strings.TrimSpace(parts[2]))
		} else {
			label = "override"
			strategy = strings.ToLower(strings.TrimSpace(parts[len(parts)-1]))
		}
		reason := "override_" + label
		switch strategy {
		case "swing":
			triggerSwingRefresh(reason)
		case "bsjp":
			triggerBSJPRefresh(reason)
		default:
			log.Printf("schedule_worker: unknown strategy %q in override entry %q", strategy, entry)
		}
	}
}


// dailyReportMu serialises the 15:45 WIB daily-report cron firing. The Groq
// call can take 5–10s and the cron runs once per day, but if an ops person
// also invokes the HTTP endpoint in the same window we'd end up paying for
// two identical generations — withLock prevents that.
var dailyReportMu sync.Mutex

// withLock wraps a cron handler with a mutex. If the previous invocation is
// still running, the new one skips rather than queues — this matches cron
// semantics (run at time T, not "run eventually even if late") and stops a
// slow LLM from stacking up generations.
func withLock(mu *sync.Mutex, fn func()) func() {
	return func() {
		if !mu.TryLock() {
			log.Println("schedule_worker: previous run still in flight, skipping")
			return
		}
		defer mu.Unlock()
		fn()
	}
}

// generateDailyReport is the payload for the 15:45 WIB cron. It builds a
// short market-summary prompt from what's already in Postgres and asks the
// pro model to expand it into the Bahasa Indonesia EOD report. Result is
// cached by the ai.Client TTL so the frontend /api/ai/daily-report hits the
// cache for the rest of the session.
func generateDailyReport() {
	client := ai.Default()
	if !client.Enabled() {
		log.Println("schedule_worker: AI disabled, skipping daily report")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	summary := buildDailySummary()

	resp, err := client.DailyReport(ctx, summary)
	if err != nil {
		log.Printf("schedule_worker: daily report failed: %v", err)
		return
	}
	log.Printf("schedule_worker: daily report generated (%d chars, cached=%v)", len(resp.Content), resp.Cached)
}

// buildDailySummary is a deliberately small stub that returns a short string
// the pro model can expand on. The goal for this sprint is to prove the end
// to end wiring — richer summaries (top gainers, notable news, screener
// counts) will land in the follow-up sprint once the dashboard widget is
// designed and we know exactly what shape the report should take.
func buildDailySummary() string {
	now := time.Now()
	return "Tanggal: " + now.Format("2006-01-02") +
		". Ringkas kondisi pasar IDX hari ini berdasarkan data screener dan berita terakhir."
}
