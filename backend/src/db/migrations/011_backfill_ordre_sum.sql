-- 011_backfill_ordre_sum.sql
-- Fikser ordrehoder som ble generert med sum = 0 av den raske bulk-generatoren
-- (generateOrdreCopyBuffers hardkodet sum 0), selv om ordrelinjene har verdi.
--
-- Berører KUN ordre der hodet sier 0/NULL mens linjene summerer til > 0.
-- Ekte nullordre og manuelt/ERP-satte summer endres aldri.

UPDATE ordre AS o
SET sum = s.linesum
FROM (
  SELECT ordrenr, SUM(linjesum) AS linesum
  FROM ordrelinje
  GROUP BY ordrenr
) AS s
WHERE o.ordrenr = s.ordrenr
  AND (o.sum IS NULL OR o.sum = 0)
  AND s.linesum > 0;
