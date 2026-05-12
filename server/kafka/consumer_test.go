package kafka

import (
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/sahamscreen/server/database"
)

func TestDoAggregateMarketOverview_IHSGOverwrite(t *testing.T) {
	// Setup mock DB
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("an error '%s' was not expected when opening a stub database connection", err)
	}
	defer db.Close()

	// Replace global DB with mock
	database.DB = db

	// 1. Mock first query (stock_info aggregate)
	// Query: SELECT COALESCE(SUM(volume), 0), COALESCE(SUM(market_cap), 0), COALESCE(AVG(change_pct), 0), COUNT(*) ...
	mock.ExpectQuery(`SELECT COALESCE\(SUM\(volume\), 0\), COALESCE\(SUM\(market_cap\), 0\), COALESCE\(AVG\(change_pct\), 0\), COUNT\(\*\) FROM stock_info WHERE last_price > 0 AND change_pct != 0`).
		WillReturnRows(sqlmock.NewRows([]string{"volume", "market_cap", "change_pct", "count"}).
			AddRow(1000, 5000000, 1.5, 10))

	// 2. Mock second query (existing market_overview)
	// Query: SELECT COALESCE(index_value, 0), COALESCE(change_pct, 0) FROM market_overview WHERE id = 1
	// We return existingIndex=7000, existingChangePct=-0.5.
	// We want to verify that finalChangePct becomes -0.5, not 1.5.
	mock.ExpectQuery(`SELECT COALESCE\(index_value, 0\), COALESCE\(change_pct, 0\) FROM market_overview WHERE id = 1`).
		WillReturnRows(sqlmock.NewRows([]string{"index_value", "change_pct"}).
			AddRow(7000.0, -0.5))

	// 3. Mock third query (foreign_flow)
	mock.ExpectQuery(`SELECT COALESCE\( SUM\(CASE WHEN change_pct > 0 THEN volume ELSE -volume END\), 0\) FROM stock_info WHERE change_pct != 0`).
		WillReturnRows(sqlmock.NewRows([]string{"foreign_flow"}).
			AddRow(500))

	// 4. Mock INSERT INTO market_overview
	// Expect finalChangePct (-0.5) to be used, not avgChangePct (1.5)
	mock.ExpectExec(`INSERT INTO market_overview \(id, index_value, change_pct, volume, valuation, foreign_flow, updated_at\) VALUES \(1, \$1, \$2, \$3, \$4, \$5, NOW\(\)\)`).
		WithArgs(7000.0, -0.5, int64(1000), int64(5000000), int64(500)).
		WillReturnResult(sqlmock.NewResult(1, 1))

	// 5. Mock sector performance query
	mock.ExpectQuery(`SELECT sector, AVG\(change_pct\), SUM\(volume\) FROM stock_info WHERE sector IS NOT NULL AND sector != '' AND sector != 'N/A' AND last_price > 0 GROUP BY sector ORDER BY ABS\(AVG\(change_pct\)\) DESC`).
		WillReturnRows(sqlmock.NewRows([]string{"sector", "avg_change", "sum_vol"}).
			AddRow("FINANCE", 2.0, 500))

	// 6. Mock sector performance insert
	mock.ExpectExec(`INSERT INTO sector_performance \(sector, change_pct, volume\) VALUES \(\$1, \$2, \$3\)`).
		WithArgs("FINANCE", 2.0, int64(500)).
		WillReturnResult(sqlmock.NewResult(1, 1))

	// Execute function
	DoAggregateMarketOverview()

	// Ensure all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("there were unfulfilled expectations: %s", err)
	}
}


// TestDoAggregateMarketOverview_NoIHSGFeed verifies the Sprint-7 hygiene
// fix: when the IHSG feed has not produced a price yet (existingIndex == 0),
// aggregateMarketOverview() must NOT invent a synthetic weighted-average
// number. It should only refresh volume / valuation / foreign_flow and leave
// index_value and change_pct at 0 so the frontend can render the
// "Index data unavailable" placeholder.
func TestDoAggregateMarketOverview_NoIHSGFeed(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	database.DB = db

	// 1) stock_info aggregate — something to aggregate over.
	mock.ExpectQuery(`SELECT COALESCE\(SUM\(volume\), 0\), COALESCE\(SUM\(market_cap\), 0\), COALESCE\(AVG\(change_pct\), 0\), COUNT\(\*\) FROM stock_info WHERE last_price > 0 AND change_pct != 0`).
		WillReturnRows(sqlmock.NewRows([]string{"volume", "market_cap", "change_pct", "count"}).
			AddRow(1234, 8_000_000, 0.75, 5))

	// 2) market_overview snapshot — existingIndex = 0 means IHSG feed has
	//    never written. This is the branch we are testing.
	mock.ExpectQuery(`SELECT COALESCE\(index_value, 0\), COALESCE\(change_pct, 0\) FROM market_overview WHERE id = 1`).
		WillReturnRows(sqlmock.NewRows([]string{"index_value", "change_pct"}).
			AddRow(0.0, 0.0))

	// 3) foreign_flow proxy.
	mock.ExpectQuery(`SELECT COALESCE\( SUM\(CASE WHEN change_pct > 0 THEN volume ELSE -volume END\), 0\) FROM stock_info WHERE change_pct != 0`).
		WillReturnRows(sqlmock.NewRows([]string{"foreign_flow"}).
			AddRow(-200))

	// 4) The critical assertion: we expect an UPDATE that touches only
	//    volume / valuation / foreign_flow — NOT the full INSERT UPSERT
	//    that the "real IHSG" branch runs. If this test starts failing
	//    with an "unexpected Exec" it means someone reintroduced the
	//    synthetic-index path.
	mock.ExpectExec(`UPDATE market_overview\s+SET volume = \$1,\s+valuation = \$2,\s+foreign_flow = \$3,\s+updated_at = NOW\(\)\s+WHERE id = 1`).
		WithArgs(int64(1234), int64(8_000_000), int64(-200)).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// 5) Sector aggregation proceeds as usual.
	mock.ExpectQuery(`SELECT sector, AVG\(change_pct\), SUM\(volume\) FROM stock_info WHERE sector IS NOT NULL AND sector != '' AND sector != 'N/A' AND last_price > 0 GROUP BY sector ORDER BY ABS\(AVG\(change_pct\)\) DESC`).
		WillReturnRows(sqlmock.NewRows([]string{"sector", "avg_change", "sum_vol"}).
			AddRow("ENERGY", 1.2, 700))

	mock.ExpectExec(`INSERT INTO sector_performance \(sector, change_pct, volume\) VALUES \(\$1, \$2, \$3\)`).
		WithArgs("ENERGY", 1.2, int64(700)).
		WillReturnResult(sqlmock.NewResult(1, 1))

	DoAggregateMarketOverview()

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %s", err)
	}
}


// TestPersistMarketTick_PatchesPriceOnly is the regression guard for the
// Sprint-7 live-PnL fix: persistMarketTick must write the incoming
// last_price into screener_results.payload.price via jsonb_set WITHOUT
// touching entry_price / target / stop_loss (those stay pinned to what
// the screener or TradingView webhook originally wrote).
//
// We do not assert on exact SQL text — that would couple the test to
// whitespace. Instead we configure sqlmock to match the UPDATE by regex
// against key fragments and make sure the arguments are (last_price,
// ticker). The regex deliberately requires:
//   - jsonb_set with the {price} path
//   - AND screened_at > NOW() - INTERVAL '7 days'
// so that a future change that drops either fragment (and thus would
// overwrite entry_price, or rewrite ancient locked BSJP rows) trips this
// test.
func TestPersistMarketTick_PatchesPriceOnly(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	database.DB = db

	tickJSON := []byte(`{
		"ticker": "BBCA",
		"last_price": 9300,
		"change_pct": 0.5,
		"volume": 1234567,
		"close": 9300
	}`)

	// 1) stock_info UPDATE fires first — ticker is the 4th arg.
	mock.ExpectExec(`UPDATE stock_info`).
		WithArgs(9300.0, 0.5, int64(1234567), "BBCA").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// 2) THE critical assertion — screener_results UPDATE must:
	//    - set payload via jsonb_set({price})
	//    - restrict by screened_at > NOW() - INTERVAL '7 days'
	//    - take (last_price, ticker) as args in that order.
	//
	// If anyone later adds entry_price or other keys to the jsonb_set
	// path, the regex needs to be updated deliberately — which is the
	// point of this test.
	mock.ExpectExec(`UPDATE screener_results\s+SET payload = jsonb_set\([^)]+'\{price\}'[^)]+\)\s+WHERE ticker = \$2\s+AND screened_at > NOW\(\) - INTERVAL '7 days'`).
		WithArgs(9300.0, "BBCA").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// 3) ohlcv_daily upsert closes the handler. args match what the
	//    synthesiser in persistMarketTick fills in when open/high/low
	//    are zero in the payload.
	mock.ExpectExec(`INSERT INTO ohlcv_daily`).
		WithArgs("BBCA", 9300.0, 9300.0, 9300.0, 9300.0, int64(1234567)).
		WillReturnResult(sqlmock.NewResult(0, 1))

	persistMarketTick(tickJSON)

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestPersistMarketTick_DoesNotTouchEntryPriceKey is a belt-and-braces
// assertion: the UPDATE must target only the `{price}` JSONB key. The
// sqlmock regex here uses a negative-style assertion — if the future
// SQL were to add an entry_price/target/stop_loss jsonb_set chain the
// regex would fail to match (because the path list would no longer be
// a single `{price}` entry), and sqlmock will surface "unexpected Exec"
// instead of silently accepting the drift.
func TestPersistMarketTick_DoesNotTouchEntryPriceKey(t *testing.T) {
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	database.DB = db

	tickJSON := []byte(`{"ticker": "BBRI", "last_price": 5200, "volume": 100}`)

	mock.ExpectExec(`UPDATE stock_info`).WillReturnResult(sqlmock.NewResult(0, 1))
	// Anchor the SET clause tightly so a second jsonb_set wrapper (e.g.
	// one that started writing entry_price) would not satisfy this
	// expectation — the pattern allows only `'{price}'` inside the path
	// argument.
	mock.ExpectExec(`SET payload = jsonb_set\(COALESCE\(payload::jsonb, '\{\}'::jsonb\), '\{price\}', to_jsonb\(\$1::numeric\), true\)`).
		WithArgs(5200.0, "BBRI").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`INSERT INTO ohlcv_daily`).WillReturnResult(sqlmock.NewResult(0, 1))

	persistMarketTick(tickJSON)

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}
