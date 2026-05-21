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
  ): Promise<{ data: NotificationRow[]; total: number }> => {
    const { sql: audienceSql, params: audienceParams } = audienceClause(user, 1);
    const params: unknown[] = [...audienceParams, user.id];
    let paramIndex = params.length;

    let readJoin = `LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = $${paramIndex}`;
    let unreadFilter = '';
    if (unreadOnly) {
      unreadFilter = ' AND nr.notification_id IS NULL';
    }

    paramIndex += 1;
    params.push(pagination.limit, pagination.offset);

    const result = await query(
      `SELECT n.*, nr.read_at,
              COUNT(*) OVER()::int AS _total_count
       FROM notifications n
       ${readJoin}
       WHERE ${audienceSql}${unreadFilter}
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

  markRead: async (userId: number, notificationIds: number[]): Promise<number> => {
    if (notificationIds.length === 0) return 0;
    const result = await query(
      `INSERT INTO notification_reads (notification_id, user_id)
       SELECT unnest($1::bigint[]), $2
       ON CONFLICT (notification_id, user_id) DO NOTHING`,
      [notificationIds, userId],
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
