-- 010_money_decimal.sql
-- Move all monetary and quantity columns from floating-point to DECIMAL.
--
-- Floats cannot represent decimal fractions exactly; sums drift over time in
-- an order/invoicing system (e.g. 0.1 + 0.2 !== 0.3). The pricing engine's
-- tables already use DECIMAL — this aligns the fact tables with them.
--
-- PostgreSQL refuses ALTER COLUMN TYPE on columns referenced by materialized
-- views, so the stats MVs are dropped first and recreated after (same DDL as
-- migration 005; their data is a cache — REFRESH rebuilds it).

DROP MATERIALIZED VIEW IF EXISTS mv_stats_by_varegruppe;
DROP MATERIALIZED VIEW IF EXISTS mv_stats_by_kunde;

-- Money: 12 digits total, 2 decimals — matches fixed_price/discount columns.
ALTER TABLE vare       ALTER COLUMN base_price TYPE DECIMAL(12, 2);
ALTER TABLE ordre      ALTER COLUMN sum        TYPE DECIMAL(12, 2);
ALTER TABLE ordrelinje ALTER COLUMN nettpris   TYPE DECIMAL(12, 2);
ALTER TABLE ordrelinje ALTER COLUMN linjesum   TYPE DECIMAL(12, 2);

-- Quantities can legitimately have up to 3 decimals (e.g. 2.5 kg).
ALTER TABLE ordrelinje ALTER COLUMN antall     TYPE DECIMAL(12, 3);

-- Recreate the stats MVs (identical to migration 005).
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_stats_by_kunde AS
SELECT
  k.kundenr,
  k.kundenavn,
  COUNT(DISTINCT o.ordrenr)::bigint AS order_count,
  COALESCE(SUM(o.sum), 0)::numeric AS total_sum,
  COALESCE(AVG(o.sum), 0)::numeric AS avg_order_value
FROM kunde k
LEFT JOIN ordre o ON k.kundenr = o.kundenr
GROUP BY k.kundenr, k.kundenavn
HAVING COALESCE(SUM(o.sum), 0) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_stats_by_kunde_kundenr
  ON mv_stats_by_kunde (kundenr);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_stats_by_varegruppe AS
SELECT
  v.varegruppe,
  COUNT(DISTINCT ol.ordrenr)::bigint AS order_count,
  COALESCE(SUM(ol.antall), 0)::numeric AS total_quantity,
  COALESCE(SUM(ol.linjesum), 0)::numeric AS total_sum
FROM vare v
LEFT JOIN ordrelinje ol ON v.varekode = ol.varekode
GROUP BY v.varegruppe
HAVING v.varegruppe IS NOT NULL AND COALESCE(SUM(ol.linjesum), 0) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_stats_by_varegruppe
  ON mv_stats_by_varegruppe (varegruppe);
