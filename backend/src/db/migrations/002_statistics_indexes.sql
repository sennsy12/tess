-- Indexes to improve analytics query performance
CREATE INDEX IF NOT EXISTS idx_ordre_dato_kundenr
  ON ordre (dato, kundenr);

CREATE INDEX IF NOT EXISTS idx_ordre_dato_sum
  ON ordre (dato DESC) INCLUDE (sum, kundenr);

CREATE INDEX IF NOT EXISTS idx_ordrelinje_varekode_ordrenr
  ON ordrelinje (varekode, ordrenr) INCLUDE (linjesum, antall);
