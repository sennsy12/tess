import { query } from '../db/index.js';

export interface AuditLogEntry {
  id: number;
  timestamp: Date;
  user_id: number | null;
  username: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  changes: Record<string, { old: any; new: any }> | null;
  metadata: Record<string, any> | null;
  ip_address: string | null;
}

export interface CreateAuditLogInput {
  user_id?: number | null;
  username: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity_type: string;
  entity_id: string;
  entity_name?: string | null;
  changes?: Record<string, { old: any; new: any }> | null;
  metadata?: Record<string, any> | null;
  ip_address?: string | null;
}

export interface AuditLogFilters {
  entity_type?: string;
  action?: string;
  user_id?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const auditModel = {
  /**
   * Insert a new audit log entry
   */
  create: async (entry: CreateAuditLogInput): Promise<AuditLogEntry> => {
    const result = await query(
      `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, entity_name, changes, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        entry.user_id ?? null,
        entry.username,
        entry.action,
        entry.entity_type,
        entry.entity_id,
        entry.entity_name ?? null,
        entry.changes ? JSON.stringify(entry.changes) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.ip_address ?? null,
      ]
    );
    return result.rows[0];
  },

  /**
   * Get audit log entries with filtering and pagination
   */
  findAll: async (filters: AuditLogFilters = {}): Promise<{ data: AuditLogEntry[]; total: number }> => {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.entity_type) {
      conditions.push(`entity_type = $${paramIndex++}`);
      values.push(filters.entity_type);
    }
    if (filters.action) {
      conditions.push(`action = $${paramIndex++}`);
      values.push(filters.action);
    }
    if (filters.user_id) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(filters.user_id);
    }
    if (filters.startDate) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      values.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      values.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    const countResult = await query(
      `SELECT COUNT(*) as total FROM audit_log ${whereClause}`,
      values
    );

    const dataResult = await query(
      `SELECT * FROM audit_log ${whereClause}
       ORDER BY timestamp DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    return {
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].total),
    };
  },

  /**
   * Get audit history for a specific entity
   */
  findByEntity: async (entityType: string, entityId: string): Promise<AuditLogEntry[]> => {
    const result = await query(
      `SELECT * FROM audit_log
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY timestamp DESC`,
      [entityType, entityId]
    );
    return result.rows;
  },
};
