import { auditModel, CreateAuditLogInput } from '../models/auditModel.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('audit');

interface AuditUser {
  id?: number;
  username: string;
}

interface AuditLogParams {
  user: AuditUser;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string | number;
  entityName?: string;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string;
}

/**
 * Compute a diff between old and new data objects.
 * Only includes fields that actually changed.
 */
function computeChanges(
  oldData: Record<string, any>,
  newData: Record<string, any>
): Record<string, { old: any; new: any }> | null {
  const changes: Record<string, { old: any; new: any }> = {};

  // Skip internal/metadata fields
  const skipFields = new Set(['created_at', 'updated_at', 'id', 'price_list_name', 'customer_group_name', 'list_priority']);

  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  for (const key of allKeys) {
    if (skipFields.has(key)) continue;

    const oldVal = oldData[key] ?? null;
    const newVal = newData[key] ?? null;

    // Normalize for comparison
    const oldStr = JSON.stringify(oldVal);
    const newStr = JSON.stringify(newVal);

    if (oldStr !== newStr) {
      changes[key] = { old: oldVal, new: newVal };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Audit Service
 * Never throws - failures are logged but don't break the original operation.
 */
export const auditService = {
  /**
   * Log an audit event
   */
  log: async (params: AuditLogParams): Promise<void> => {
    try {
      let changes: Record<string, { old: any; new: any }> | null = null;

      if (params.action === 'UPDATE' && params.oldData && params.newData) {
        changes = computeChanges(params.oldData, params.newData);
      }

      const entry: CreateAuditLogInput = {
        user_id: params.user.id ?? null,
        username: params.user.username,
        action: params.action,
        entity_type: params.entityType,
        entity_id: String(params.entityId),
        entity_name: params.entityName ?? null,
        changes,
        metadata: params.action === 'DELETE' && params.oldData
          ? { snapshot: params.oldData, ...params.metadata }
          : params.metadata ?? null,
        ip_address: params.ipAddress ?? null,
      };

      await auditModel.create(entry);

      logger.debug(
        { action: params.action, entityType: params.entityType, entityId: params.entityId },
        'Audit log entry created'
      );
    } catch (error) {
      // Never let audit failures break the main operation
      logger.error({ error, params: { action: params.action, entityType: params.entityType } }, 'Failed to write audit log');
    }
  },
};
