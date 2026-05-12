package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/sahamscreen/server/database"
)

type NewsItem struct {
	ID           int64  `json:"id"`
	Title        string `json:"title"`
	Link         string `json:"link"`
	Source       string `json:"source"`
	Sentiment    string `json:"sentiment"`
	SentimentCls string `json:"sentimentCls"`
	DotCls       string `json:"dotCls"`
	Tags         string `json:"tags"`
	Description  string `json:"description"`
	ImageURL     string `json:"image_url"`
	PublishedAt  string `json:"published_at"`
	CreatedAt    string `json:"created_at"`
}

func GetNews(w http.ResponseWriter, r *http.Request) {
	limit := r.URL.Query().Get("limit")
	if limit == "" {
		limit = "20"
	}

	sentiment := r.URL.Query().Get("sentiment")
	ticker := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("ticker")))

	// Build the query piecewise so we can layer in the optional sentiment
	// and ticker filters without duplicating the SELECT list three times.
	// The ticker filter is deliberately fuzzy — news rows do not have a
	// dedicated ticker column yet (that is the Phase 5 "emiten filter"
	// backlog item), so we match against title/description/tags using
	// word-boundary ILIKE patterns. A three-letter ticker like "BBRI"
	// would false-positive on words like "scribner" without the boundary
	// markers, so we wrap it in spaces / common punctuation via regex.
	var (
		sb      strings.Builder
		args    []interface{}
		argIdx  = 1
	)
	sb.WriteString(`
		SELECT id, title, link, COALESCE(source,''), COALESCE(sentiment,'Neutral'),
		       COALESCE(sentiment_cls,''), COALESCE(dot_cls,''), COALESCE(tags,''),
		       COALESCE(description,''), COALESCE(image_url,''),
		       COALESCE(published_at, created_at), created_at
		FROM news
		WHERE 1=1`)

	if sentiment != "" {
		sb.WriteString(fmt.Sprintf(" AND LOWER(sentiment) = LOWER($%d)", argIdx))
		args = append(args, sentiment)
		argIdx++
	}
	if ticker != "" {
		// Word-boundary match: ticker surrounded by non-alphanumeric or
		// start/end of string. Postgres uses POSIX regex with `~*` for
		// case-insensitive matching.
		pattern := fmt.Sprintf(`(^|[^A-Za-z0-9])%s([^A-Za-z0-9]|$)`, ticker)
		sb.WriteString(fmt.Sprintf(
			" AND (title ~* $%d OR description ~* $%d OR tags ~* $%d)",
			argIdx, argIdx, argIdx,
		))
		args = append(args, pattern)
		argIdx++
	}
	sb.WriteString(fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", argIdx))
	args = append(args, limit)

	newsItems := []NewsItem{}
	rows, err := database.DB.Query(sb.String(), args...)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var n NewsItem
			rows.Scan(&n.ID, &n.Title, &n.Link, &n.Source, &n.Sentiment,
				&n.SentimentCls, &n.DotCls, &n.Tags, &n.Description,
				&n.ImageURL, &n.PublishedAt, &n.CreatedAt)
			newsItems = append(newsItems, n)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(newsItems)
}

// NewsHealth is the observability endpoint for the news pipeline.
//
// Returns a structured JSON payload answering the three questions an
// operator actually asks when the dashboard's news panels look empty:
//
//   1. Do we have ANY rows in the last 24h? (total_24h)
//   2. Is new data still arriving? (count_1h + last_published_at)
//   3. Which sources have gone silent for 24h? (silent_sources)
//
// The answers together make "the fetcher died" vs "the filter is too
// strict" vs "the broker is lagging" trivially distinguishable from a
// single curl.
func NewsHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var (
		total24h         int
		countLastHour    int
		lastPublishedAt  sql.NullTime
	)

	// One round-trip for the headline counters. COUNT(*) FILTER avoids a
	// separate query for the "fresh" slice.
	err := database.DB.QueryRow(`
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour'),
			MAX(published_at)
		FROM news
		WHERE created_at > NOW() - INTERVAL '24 hours'
	`).Scan(&total24h, &countLastHour, &lastPublishedAt)

	if err != nil {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "error",
			"message":   "Failed to query news table.",
			"error":     err.Error(),
			"diagnosis": "Check database connectivity and that the news table exists.",
		})
		return
	}

	// Source roster vs the ones that actually produced in the last 24h.
	// Sources that have published historically but have gone silent for
	// 24h are the most useful single signal — that usually means the RSS
	// feed broke or the fetcher's emiten filter started rejecting
	// everything from that source.
	silentSources := []string{}
	srcRows, srcErr := database.DB.Query(`
		SELECT source
		FROM news
		WHERE source IS NOT NULL AND source <> ''
		  AND source NOT IN (
			SELECT source FROM news
			WHERE source IS NOT NULL AND source <> ''
			  AND created_at > NOW() - INTERVAL '24 hours'
		  )
		GROUP BY source
		ORDER BY source ASC
	`)
	if srcErr == nil {
		defer srcRows.Close()
		for srcRows.Next() {
			var s string
			if scanErr := srcRows.Scan(&s); scanErr == nil && s != "" {
				silentSources = append(silentSources, s)
			}
		}
	}

	// Pick a human-facing status tier so dashboards can colour-code.
	status := "healthy"
	message := "News pipeline is flowing normally."
	switch {
	case total24h == 0:
		status = "empty"
		message = "No news in the last 24h. Check engine-news-fetcher logs and the idx.news.updates Kafka topic."
	case countLastHour == 0:
		status = "stalled"
		message = "Rows exist in the last 24h but nothing in the last hour. Fetcher may be down or throttled."
	case len(silentSources) > 0:
		status = "degraded"
		message = "News arriving, but some historical sources are silent for 24h+. See silent_sources."
	}

	lastPublishedStr := ""
	if lastPublishedAt.Valid {
		lastPublishedStr = lastPublishedAt.Time.UTC().Format("2006-01-02T15:04:05Z")
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":             status,
		"message":            message,
		"total_24h":          total24h,
		"count_1h":           countLastHour,
		"last_published_at":  lastPublishedStr,
		"silent_sources":     silentSources,
		"diagnosis":          "Check Kafka topic idx.news.updates and engine-news-fetcher logs.",
	})
}

func GetFeaturedNews(w http.ResponseWriter, r *http.Request) {
	var n NewsItem
	err := database.DB.QueryRow(`
		SELECT id, title, link, COALESCE(source,''), COALESCE(sentiment,'Neutral'),
		       COALESCE(sentiment_cls,''), COALESCE(dot_cls,''), COALESCE(tags,''),
		       COALESCE(description,''), COALESCE(image_url,''),
		       COALESCE(published_at, created_at), created_at
		FROM news
		ORDER BY created_at DESC
		LIMIT 1
	`).Scan(&n.ID, &n.Title, &n.Link, &n.Source, &n.Sentiment,
		&n.SentimentCls, &n.DotCls, &n.Tags, &n.Description,
		&n.ImageURL, &n.PublishedAt, &n.CreatedAt)

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(nil)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(n)
}
