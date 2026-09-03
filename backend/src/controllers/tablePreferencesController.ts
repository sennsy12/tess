import { Response } from 'express';
import { tablePreferencesModel } from '../models/tablePreferencesModel.js';
import { AuthRequest } from '../middleware/auth.js';
import { UnauthorizedError } from '../middleware/errorHandler.js';

function toResponse(row: {
  table_key: string;
  visible_columns: string[] | null;
  column_labels: Record<string, string>;
  updated_at: Date;
}) {
  return {
    tableKey: row.table_key,
    visibleColumns: row.visible_columns,
    columnLabels: row.column_labels,
    updatedAt: row.updated_at,
  };
}

export const tablePreferencesController = {
  getPreferences: async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    const tableKey = String(req.params.tableKey);
    const row = await tablePreferencesModel.get(userId, tableKey);
    if (!row) {
      // Ingen preferanse lagret: null felter = «bruk codedefaults».
      res.json({ tableKey, visibleColumns: null, columnLabels: {}, updatedAt: null });
      return;
    }
    res.json(toResponse(row));
  },

  savePreferences: async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    const tableKey = String(req.params.tableKey);
    // req.body er allerede validert/normalisert av validate(tablePreferencesBodySchema).
    // Utelatte felt = «behold eksisterende» (første gang: defaults).
    const { visibleColumns, columnLabels } = req.body as {
      visibleColumns?: string[] | null | undefined;
      columnLabels?: Record<string, string> | undefined;
    };

    const existing = await tablePreferencesModel.get(userId, tableKey);
    const row = await tablePreferencesModel.upsert(userId, tableKey, {
      visibleColumns: visibleColumns ?? existing?.visible_columns ?? null,
      columnLabels: columnLabels ?? existing?.column_labels ?? {},
    });
    res.json(toResponse(row));
  },
};
