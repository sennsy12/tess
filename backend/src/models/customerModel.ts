/**
 * Customer Model
 *
 * Simple read-only data-access layer for the `kunde` table.
 *
 * @module models/customerModel
 */
import { query } from '../db/index.js';

export const customerModel = {
  /**
   * Retrieve all customers, ordered alphabetically by name.
   *
   * @returns Array of customer rows
   */
  findAll: async () => {
    const result = await query('SELECT * FROM kunde ORDER BY kundenavn');
    return result.rows;
  },

  /**
   * Look up a single customer by their customer number.
   *
   * @param kundenr - Customer number to match
   * @returns The customer row, or `undefined` if not found
   */
  findByNumber: async (kundenr: string) => {
    const result = await query('SELECT * FROM kunde WHERE kundenr = $1', [kundenr]);
    return result.rows[0];
  }
};
