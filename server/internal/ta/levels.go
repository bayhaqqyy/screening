// Package ta provides technical-analysis enrichment functions that read
// historical daily OHLCV data from the ohlcv_daily table and return
// computed levels that are merged into the screener_results payload JSONB.
//
// All functions are best-effort: they return a zero-value struct and a
// non-nil error when the DB has insufficient history.  Callers MUST NOT
// treat a non-nil error here as fatal for the webhook pipeline.
package ta

import (
	"database/sql"
	"errors"
	"fmt"
	"math"
)

// ──────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────

// SRLevels holds the nearest daily support and resistance levels relative
// to a reference price (typically the alert close price).
type SRLevels struct {
	Support    float64 `json:"support"`
	Resistance float64 `json:"resistance"`
}

// FVGResult describes a Fair Value Gap zone detected on the most recent
// daily candles.  A Bullish FVG occurs when candle[i-2].High < candle[i].Low
// (gap up), implying institutional order flow.
type FVGResult struct {
	Present  bool    `json:"fvg_bullish"` // true  = bullish FVG found
	GapHigh  float64 `json:"fvg_high"`
	GapLow   float64 `json:"fvg_low"`
}

// Trend3WResult is the directional bias over approximately 15 trading days
// (~3 calendar weeks).
type Trend3WResult struct {
	Direction string `json:"trend_3w"` // "UP" | "DOWN" | "SIDEWAYS"
}

// dailyCandle is a convenience struct for internal calculations.
type dailyCandle struct {
	Open   float64
	High   float64
	Low    float64
	Close  float64
	Volume float64
}

// ──────────────────────────────────────────────────────────────────────
// Public functions
// ──────────────────────────────────────────────────────────────────────

// ComputeSupportResistance queries the 60 most-recent daily candles for
// ticker and identifies the nearest swing-low (support) and swing-high
// (resistance) relative to refPrice.
//
// A swing-low is any candle whose Low is lower than both its neighbours;
// a swing-high is the dual.  The function returns the highest swing-low
// below refPrice and the lowest swing-high above refPrice.
func ComputeSupportResistance(db *sql.DB, ticker string, refPrice float64) (SRLevels, error) {
	candles, err := fetchDailyCandles(db, ticker, 60)
	if err != nil {
		return SRLevels{}, fmt.Errorf("ta: ComputeSupportResistance fetch: %w", err)
	}
	if len(candles) < 3 {
		return SRLevels{}, errors.New("ta: insufficient history for S/R (need ≥ 3 candles)")
	}

	var support, resistance float64
	support = math.MaxFloat64 * -1   // will be replaced by first valid swing low
	resistance = math.MaxFloat64     // will be replaced by first valid swing high

	for i := 1; i < len(candles)-1; i++ {
		prev, cur, next := candles[i-1], candles[i], candles[i+1]

		// Swing low
		if cur.Low < prev.Low && cur.Low < next.Low {
			if cur.Low <= refPrice && cur.Low > support {
				support = cur.Low
			}
		}

		// Swing high
		if cur.High > prev.High && cur.High > next.High {
			if cur.High >= refPrice && cur.High < resistance {
				resistance = cur.High
			}
		}
	}

	// If no swing found on the correct side, fall back to the period
	// low/high so callers always get a usable value.
	if support == math.MaxFloat64*-1 {
		support = periodLow(candles)
	}
	if resistance == math.MaxFloat64 {
		resistance = periodHigh(candles)
	}

	return SRLevels{Support: support, Resistance: resistance}, nil
}

// ComputeFVG scans the 20 most-recent daily candles for a Bullish Fair
// Value Gap: candle[i-2].High < candle[i].Low (a clean gap above the
// prior candle's high, i.e. the middle candle is entirely skipped).
//
// The most-recent FVG is returned.  If no FVG exists the Present field
// is false and Gap* fields are zero.
func ComputeFVG(db *sql.DB, ticker string) (FVGResult, error) {
	candles, err := fetchDailyCandles(db, ticker, 20)
	if err != nil {
		return FVGResult{}, fmt.Errorf("ta: ComputeFVG fetch: %w", err)
	}
	if len(candles) < 3 {
		return FVGResult{}, errors.New("ta: insufficient history for FVG (need ≥ 3 candles)")
	}

	// Iterate from newest to oldest so we return the most-recent FVG.
	// Candles are returned newest-first from fetchDailyCandles.
	for i := 0; i < len(candles)-2; i++ {
		cur := candles[i]        // most recent of the triplet
		mid := candles[i+1]      //nolint:unused — mid is the "skipped" candle
		old := candles[i+2]      // oldest of the triplet

		_ = mid // gap is between old.High and cur.Low
		if old.High < cur.Low {
			return FVGResult{
				Present: true,
				GapHigh: cur.Low,   // top of the imbalance zone
				GapLow:  old.High,  // bottom of the imbalance zone
			}, nil
		}
	}

	return FVGResult{Present: false}, nil
}

// ComputeTrend3W derives a directional bias from the 15 most-recent daily
// closes (~3 calendar weeks of trading).  It fits a simple linear
// regression slope: positive → "UP", negative → "DOWN",
// near-zero (< 0.1 % per day) → "SIDEWAYS".
func ComputeTrend3W(db *sql.DB, ticker string) (Trend3WResult, error) {
	candles, err := fetchDailyCandles(db, ticker, 15)
	if err != nil {
		return Trend3WResult{}, fmt.Errorf("ta: ComputeTrend3W fetch: %w", err)
	}
	if len(candles) < 5 {
		return Trend3WResult{}, errors.New("ta: insufficient history for Trend3W (need ≥ 5 candles)")
	}

	// candles are newest-first; reverse for time-ordered regression.
	closes := make([]float64, len(candles))
	for i, c := range candles {
		closes[len(candles)-1-i] = c.Close
	}

	slope := linearSlope(closes)
	avgClose := mean(closes)

	// Express slope as daily percentage move relative to the average close.
	if avgClose == 0 {
		return Trend3WResult{Direction: "SIDEWAYS"}, nil
	}
	dailyPctSlope := (slope / avgClose) * 100

	const sidewaysThreshold = 0.10 // < 0.10 % per day = sideways
	switch {
	case dailyPctSlope > sidewaysThreshold:
		return Trend3WResult{Direction: "UP"}, nil
	case dailyPctSlope < -sidewaysThreshold:
		return Trend3WResult{Direction: "DOWN"}, nil
	default:
		return Trend3WResult{Direction: "SIDEWAYS"}, nil
	}
}

// ──────────────────────────────────────────────────────────────────────
// Private helpers
// ──────────────────────────────────────────────────────────────────────

// fetchDailyCandles retrieves the n most-recent rows from ohlcv_daily
// for the given ticker, ordered newest-first.
func fetchDailyCandles(db *sql.DB, ticker string, n int) ([]dailyCandle, error) {
	rows, err := db.Query(`
		SELECT open, high, low, close, volume
		FROM   ohlcv_daily
		WHERE  ticker = $1
		ORDER  BY trade_date DESC
		LIMIT  $2
	`, ticker, n)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var candles []dailyCandle
	for rows.Next() {
		var c dailyCandle
		if err := rows.Scan(&c.Open, &c.High, &c.Low, &c.Close, &c.Volume); err != nil {
			return nil, err
		}
		candles = append(candles, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return candles, nil
}

func periodLow(cs []dailyCandle) float64 {
	lo := cs[0].Low
	for _, c := range cs[1:] {
		if c.Low < lo {
			lo = c.Low
		}
	}
	return lo
}

func periodHigh(cs []dailyCandle) float64 {
	hi := cs[0].High
	for _, c := range cs[1:] {
		if c.High > hi {
			hi = c.High
		}
	}
	return hi
}

// linearSlope computes the OLS slope for a series of y values (x = index).
func linearSlope(y []float64) float64 {
	n := float64(len(y))
	if n < 2 {
		return 0
	}
	var sumX, sumY, sumXY, sumX2 float64
	for i, v := range y {
		x := float64(i)
		sumX += x
		sumY += v
		sumXY += x * v
		sumX2 += x * x
	}
	denom := n*sumX2 - sumX*sumX
	if denom == 0 {
		return 0
	}
	return (n*sumXY - sumX*sumY) / denom
}

func mean(y []float64) float64 {
	if len(y) == 0 {
		return 0
	}
	var sum float64
	for _, v := range y {
		sum += v
	}
	return sum / float64(len(y))
}
