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
