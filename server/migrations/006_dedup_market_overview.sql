-- server/migrations/006_dedup_market_overview.sql
-- One-shot cleanup: earlier revisions of 002_production_tables.sql seeded
-- market_overview without specifying id, so each migrator run allocated a
-- fresh SERIAL id and stacked up empty rows. The handler's
-- ORDER BY id DESC would then surface the most recent zeros instead of the
-- single id=1 row that aggregateMarketOverview() actively maintains.
-- The handler is now ORDER BY updated_at DESC, but we still drop the
-- duplicates here so the table stays clean on existing dev volumes.

DELETE FROM market_overview WHERE id <> 1;
