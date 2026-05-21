-- Pre-aggregated statistics for fast dashboard queries (refreshed hourly by scheduler)
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
