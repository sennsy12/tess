import { query } from '../db/index.js';
import { extractWindowCountPage } from '../lib/paginatedQuery.js';

export type NotificationAudience = 'admin' | 'kunde';

export interface NotificationRow {
  id: number;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  audience: NotificationAudience;
  kundenr: string | null;
  created_at: Date;
  read_at?: Date | null;
}

export interface NotificationUserContext {
  id: number;
  role: 'admin' | 'kunde' | 'analyse';
  kundenr?: string;
}

function audienceClause(user: NotificationUserContext, paramIndex: number): { sql: string; params: unknown[] } {
  if (user.role === 'admin' || user.role === 'analyse') {
    return { sql: `n.audience = 'admin'`, params: [] };
  }
  return {
    sql: `(n.audience = 'kunde' AND n.kundenr = $${paramIndex})`,
    params: [user.kundenr ?? ''],
  };
}

export const notificationModel = {
  create: async (input: {
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
    audience: NotificationAudience;
    kundenr?: string;
  }): Promise<NotificationRow> => {
    const result = await query(
      `INSERT INTO notifications (type, title, message, metadata, audience, kundenr)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.type,
        input.title,
        input.message,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.audience,
        input.kundenr ?? null,
      ],
    );
    return result.rows[0] as NotificationRow;
  },

  findForUser: async (
    user: NotificationUserContext,
    pagination: { limit: number; offset: number },
    unreadOnly = false,
    type?: string,
  ): Promise<{ data: NotificationRow[]; total: number }> => {
    const { sql: audienceSql, params: audienceParams } = audienceClause(user, 1);
    const params: unknown[] = [...audienceParams, user.id];
    let paramIndex = params.length;

    const readJoin = `LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $${paramIndex}`;
    let unreadFilter = '';
    if (unreadOnly) {
      unreadFilter = ' AND nr.notification_id IS NULL';
    }

    // Exact-match type filter (parameterised — no injection surface).
    let typeFilter = '';
    const cleanType = typeof type === 'string' ? type.trim() : '';
    if (cleanType) {
      paramIndex += 1;
      typeFilter = ` AND n.type = $${paramIndex}`;
      params.push(cleanType);
    }

    paramIndex += 1;
    params.push(pagination.limit, pagination.offset);

    const result = await query(
      `SELECT n.*, nr.read_at,
              COUNT(*) OVER()::int AS _total_count
       FROM notifications n
       ${readJoin}
       WHERE ${audienceSql}${unreadFilter}${typeFilter}
       ORDER BY n.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params,
    );

    const { data, total } = extractWindowCountPage(result.rows);
    return { data: data as NotificationRow[], total };
  },

  countUnread: async (user: NotificationUserContext): Promise<number> => {
    const { sql: audienceSql, params: audienceParams } = audienceClause(user, 1);
    const params: unknown[] = [...audienceParams, user.id];

    const result = await query(
      `SELECT COUNT(*)::int AS count
       FROM notifications n
       LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $${params.length}
       WHERE ${audienceSql} AND nr.notification_id IS NULL`,
      params,
    );
    return result.rows[0]?.count ?? 0;
  },

  /**
   * Mark notifications as read — scoped to the caller's audience.
   * Only notifications visible to `user` (same audience rule as
   * findForUser/countUnread/markAllRead) can be marked; foreign IDs are
   * silently ignored (rowCount 0, same success shape) so the endpoint
   * neither leaks existence nor pollutes other users' read state.
   */
  markRead: async (user: NotificationUserContext, notificationIds: number[]): Promise<number> => {
    if (notificationIds.length === 0) return 0;
    // $1 = ids, $2 = userId, $3+ = audience params (kunde kundenr).
    const { sql: audienceSql, params: audienceParams } = audienceClause(user, 3);
    const result = await query(
      `INSERT INTO notification_reads (notification_id, user_id)
       SELECT n.id, $2
       FROM notifications n
       WHERE n.id = ANY($1::bigint[]) AND ${audienceSql}
       ON CONFLICT (notification_id, user_id) DO NOTHING`,
      [notificationIds, user.id, ...audienceParams],
    );
    return result.rowCount ?? 0;
  },

  markAllRead: async (user: NotificationUserContext): Promise<number> => {
    const { sql: audienceSql, params: audienceParams } = audienceClause(user, 1);
    const params: unknown[] = [...audienceParams, user.id];

    const result = await query(
      `INSERT INTO notification_reads (notification_id, user_id)
       SELECT n.id, $${params.length}
       FROM notifications n
       LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $${params.length}
       WHERE ${audienceSql} AND nr.notification_id IS NULL
       ON CONFLICT (notification_id, user_id) DO NOTHING`,
      params,
    );
    return result.rowCount ?? 0;
  },
};
