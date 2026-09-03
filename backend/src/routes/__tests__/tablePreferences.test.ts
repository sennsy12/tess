jest.mock('../../models/tablePreferencesModel.js', () => ({
  tablePreferencesModel: {
    get: jest.fn(),
    upsert: jest.fn(),
  },
}));

jest.mock('../../middleware/auth.js', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = req.headers['x-test-user']
      ? JSON.parse(String(req.headers['x-test-user']))
      : undefined;
    next();
  },
}));

import request from 'supertest';
import express from 'express';
import { tablePreferencesRouter } from '../tablePreferences.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { tablePreferencesModel } from '../../models/tablePreferencesModel.js';

const mockGet = tablePreferencesModel.get as jest.Mock;
const mockUpsert = tablePreferencesModel.upsert as jest.Mock;

const adminUser = { id: 1, username: 'admin', role: 'admin' };
const otherUser = { id: 2, username: 'K000001', role: 'kunde', kundenr: 'K000001' };

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/table-preferences', tablePreferencesRouter);
  app.use(errorHandler);
  return app;
}

function authHeader(user: unknown) {
  return { 'x-test-user': JSON.stringify(user) };
}

describe('table-preferences routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/table-preferences/:tableKey', () => {
    it('returnerer defaults når brukeren ikke har lagret noe', async () => {
      mockGet.mockResolvedValueOnce(null);
      const app = buildApp();

      const res = await request(app).get('/api/table-preferences/admin-orders').set(authHeader(adminUser));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        tableKey: 'admin-orders',
        visibleColumns: null,
        columnLabels: {},
        updatedAt: null,
      });
      expect(mockGet).toHaveBeenCalledWith(1, 'admin-orders');
    });

    it('returnerer lagret rad for egen bruker', async () => {
      mockGet.mockResolvedValueOnce({
        user_id: 1,
        table_key: 'admin-orders',
        visible_columns: ['ordrenr', 'dato'],
        column_labels: { kunderef: 'Deres ref' },
        updated_at: '2026-01-01T00:00:00.000Z',
      });
      const app = buildApp();

      const res = await request(app).get('/api/table-preferences/admin-orders').set(authHeader(adminUser));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        tableKey: 'admin-orders',
        visibleColumns: ['ordrenr', 'dato'],
        columnLabels: { kunderef: 'Deres ref' },
      });
    });

    it('krever autentisering', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/table-preferences/admin-orders');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/table-preferences/:tableKey', () => {
    it('lagrer synlige kolonner og returnerer raden', async () => {
      mockGet.mockResolvedValueOnce(null);
      mockUpsert.mockImplementationOnce(async (_userId: number, tableKey: string, input: unknown) => ({
        user_id: 1,
        table_key: tableKey,
        visible_columns: (input as { visibleColumns: string[] }).visibleColumns,
        column_labels: {},
        updated_at: '2026-01-01T00:00:00.000Z',
      }));
      const app = buildApp();

      const res = await request(app)
        .put('/api/table-preferences/admin-orders')
        .set(authHeader(adminUser))
        .send({ visibleColumns: ['ordrenr', 'dato', 'kunderef'] });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        tableKey: 'admin-orders',
        visibleColumns: ['ordrenr', 'dato', 'kunderef'],
      });
      // user_id kommer fra JWT, aldri fra body
      expect(mockUpsert).toHaveBeenCalledWith(1, 'admin-orders', expect.objectContaining({
        visibleColumns: ['ordrenr', 'dato', 'kunderef'],
      }));
    });

    it('beholder eksisterende labels ved delvis oppdatering (kun synlighet)', async () => {
      mockGet.mockResolvedValueOnce({
        user_id: 1,
        table_key: 'admin-orders',
        visible_columns: ['ordrenr'],
        column_labels: { kunderef: 'Deres ref' },
        updated_at: '2026-01-01T00:00:00.000Z',
      });
      mockUpsert.mockImplementationOnce(async (_u: number, t: string, input: any) => ({
        user_id: 1,
        table_key: t,
        visible_columns: input.visibleColumns,
        column_labels: input.columnLabels,
        updated_at: '2026-01-01T00:00:00.000Z',
      }));
      const app = buildApp();

      await request(app)
        .put('/api/table-preferences/admin-orders')
        .set(authHeader(adminUser))
        .send({ visibleColumns: ['ordrenr', 'dato'] });

      expect(mockUpsert).toHaveBeenCalledWith(1, 'admin-orders', {
        visibleColumns: ['ordrenr', 'dato'],
        columnLabels: { kunderef: 'Deres ref' },
      });
    });

    it('normaliserer bort tom label (tilbakestill til default)', async () => {
      mockGet.mockResolvedValueOnce(null);
      mockUpsert.mockImplementationOnce(async (_u: number, t: string, input: any) => ({
        user_id: 1,
        table_key: t,
        visible_columns: null,
        column_labels: input.columnLabels,
        updated_at: '2026-01-01T00:00:00.000Z',
      }));
      const app = buildApp();

      const res = await request(app)
        .put('/api/table-preferences/admin-orders')
        .set(authHeader(adminUser))
        .send({ columnLabels: { kunderef: '   ' } });

      expect(res.status).toBe(200);
      expect(mockUpsert).toHaveBeenCalledWith(1, 'admin-orders', {
        visibleColumns: null,
        columnLabels: {},
      });
    });

    it('avviser tom body og tom kolonneliste', async () => {
      const app = buildApp();

      const empty = await request(app)
        .put('/api/table-preferences/admin-orders')
        .set(authHeader(adminUser))
        .send({});
      expect(empty.status).toBe(400);

      const noColumns = await request(app)
        .put('/api/table-preferences/admin-orders')
        .set(authHeader(adminUser))
        .send({ visibleColumns: [] });
      expect(noColumns.status).toBe(400);
    });

    it('isolerer brukere fra hverandre (user_id fra token)', async () => {
      mockGet.mockResolvedValueOnce(null);
      mockUpsert.mockImplementationOnce(async (userId: number, tableKey: string) => ({
        user_id: userId,
        table_key: tableKey,
        visible_columns: null,
        column_labels: {},
        updated_at: '2026-01-01T00:00:00.000Z',
      }));
      const app = buildApp();

      // Prøv å sende fremmed user_id i body – skal ignoreres
      const res = await request(app)
        .put('/api/table-preferences/admin-orders')
        .set(authHeader(otherUser))
        .send({ visibleColumns: ['ordrenr'], user_id: 1, userId: 1 });

      expect(res.status).toBe(200);
      expect(mockUpsert).toHaveBeenCalledWith(2, 'admin-orders', expect.anything());
      expect(res.body).toMatchObject({ tableKey: 'admin-orders' });
    });
  });
});
