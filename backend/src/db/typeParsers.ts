/**
 * Global node-pg type parsers.
 *
 * node-pg returns NUMERIC/DECIMAL columns as strings to avoid float precision
 * loss. Since the money migration (010_money_decimal.sql) moved all monetary
 * columns to DECIMAL(12,2)/(12,3) — values that fit comfortably within
 * float64's ~15 significant digits — we parse them back to JS numbers so the
 * rest of the app and the JSON API keep seeing numbers, not strings.
 *
 * Must be imported before any query runs; type parsers are process-global.
 *
 * @module db/typeParsers
 */
import { types } from 'pg';

// OID 1700 = NUMERIC / DECIMAL
types.setTypeParser(types.builtins.NUMERIC, (value: string) => parseFloat(value));

export {};
