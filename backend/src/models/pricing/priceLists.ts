import { query } from '../../db/index.js';
import {
  PriceList,
  CreatePriceListInput,
  UpdatePriceListInput
} from '../../types/pricing.js';

// ============================================
// PRICE LIST MODEL
// ============================================

export const priceListModel = {
  /**
   * Get all price lists
   */
  findAll: async (): Promise<PriceList[]> => {
    const result = await query(
      'SELECT * FROM price_list ORDER BY priority DESC, name'
    );
    return result.rows;
  },

  /**
   * Get active price lists (valid now)
   */
  findActive: async (): Promise<PriceList[]> => {
    const result = await query(
      `SELECT * FROM price_list
       WHERE is_active = TRUE
         AND (valid_from IS NULL OR valid_from <= NOW())
         AND (valid_to IS NULL OR valid_to >= NOW())
       ORDER BY priority DESC`
    );
    return result.rows;
  },

  /**
   * Get a price list by ID
   */
  findById: async (id: number): Promise<PriceList | null> => {
    const result = await query(
      'SELECT * FROM price_list WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Create a new price list
   */
  create: async (data: CreatePriceListInput): Promise<PriceList> => {
    const result = await query(
      `INSERT INTO price_list (name, description, valid_from, valid_to, priority, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.name,
        data.description || null,
        data.valid_from || null,
        data.valid_to || null,
        data.priority ?? 0,
        data.is_active ?? true
      ]
    );
    return result.rows[0];
  },

  /**
   * Update a price list
   * Dynamic SET to allow explicit null clearing (valid_from/to, description).
   */
  update: async (id: number, data: UpdatePriceListInput): Promise<PriceList | null> => {
    const setClauses: string[] = [];
    const values: unknown[] = [id];
    let paramIndex = 2;

    const fields: Array<{ key: keyof UpdatePriceListInput; column: string }> = [
      { key: 'name', column: 'name' },
      { key: 'description', column: 'description' },
      { key: 'valid_from', column: 'valid_from' },
      { key: 'valid_to', column: 'valid_to' },
      { key: 'priority', column: 'priority' },
      { key: 'is_active', column: 'is_active' },
    ];

    for (const field of fields) {
      if (field.key in data) {
        setClauses.push(`${field.column} = $${paramIndex}`);
        values.push((data as Record<string, unknown>)[field.key] ?? null);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      const existing = await query('SELECT * FROM price_list WHERE id = $1', [id]);
      return existing.rows[0] || null;
    }

    setClauses.push(`updated_at = NOW()`);
    const result = await query(
      `UPDATE price_list SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  /**
   * Delete a price list (cascades to rules)
   */
  delete: async (id: number): Promise<boolean> => {
    const result = await query('DELETE FROM price_list WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
};
