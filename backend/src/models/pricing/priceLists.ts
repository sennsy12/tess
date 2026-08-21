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
   */
  update: async (id: number, data: UpdatePriceListInput): Promise<PriceList | null> => {
    const result = await query(
      `UPDATE price_list
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           valid_from = COALESCE($4, valid_from),
           valid_to = COALESCE($5, valid_to),
           priority = COALESCE($6, priority),
           is_active = COALESCE($7, is_active),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.name,
        data.description,
        data.valid_from,
        data.valid_to,
        data.priority,
        data.is_active
      ]
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
