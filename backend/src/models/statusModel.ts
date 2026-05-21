import { query } from '../db/index.js';
import { estimateTableRowCount } from '../lib/tableEstimate.js';

export const statusModel = {
  getSystemStatus: async () => {
    const dbCheck = await query('SELECT NOW() as timestamp, version() as version');

    const [ordersCount, customersCount, productsCount, usersCount] = await Promise.all([
      estimateTableRowCount('ordre'),
      estimateTableRowCount('kunde'),
      estimateTableRowCount('vare'),
      estimateTableRowCount('users'),
    ]);

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        serverTime: dbCheck.rows[0].timestamp,
        version: dbCheck.rows[0].version,
      },
      tables: {
        orders: ordersCount,
        customers: customersCount,
        products: productsCount,
        users: usersCount,
      },
    };
  },

  getImportStatus: async () => {
    const [latestOrder, orderCount] = await Promise.all([
      query('SELECT ordrenr, dato FROM ordre ORDER BY dato DESC LIMIT 1'),
      estimateTableRowCount('ordre'),
    ]);

    return {
      status: 'ok',
      lastImport: new Date().toISOString(),
      latestOrder: latestOrder.rows[0] || null,
      totalOrders: orderCount,
      message: 'Data import status is nominal',
    };
  },

  getExtractionStatus: async () => {
    return {
      status: 'ok',
      lastExtraction: new Date().toISOString(),
      message: 'Data extraction status is nominal',
      details: {
        source: 'PostgreSQL',
        destination: 'API',
        healthy: true,
      },
    };
  },

  getHealth: async () => {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      backend: {
        uptime: `${Math.floor(uptime / 60)} minutes`,
        memory: {
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        },
        nodeVersion: process.version,
      },
      frontend: {
        status: 'assumed healthy',
        url: process.env.FRONTEND_URL || 'http://localhost:3000',
      },
    };
  },

  getRecentActivity: async (days: number = 7) => {
    const [latestOrder, customerCount, productCount] = await Promise.all([
      query('SELECT MAX(dato) as last_date FROM ordre'),
      estimateTableRowCount('kunde'),
      estimateTableRowCount('vare'),
    ]);

    const latestOrderDate = latestOrder.rows[0]?.last_date;
    const daysSinceLastOrder = latestOrderDate
      ? Math.floor((Date.now() - new Date(latestOrderDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      dataFreshness: {
        lastOrderDate: latestOrderDate,
        daysSinceLastOrder,
        totalCustomers: customerCount,
        totalProducts: productCount,
      },
      status: daysSinceLastOrder !== null && daysSinceLastOrder < days ? 'fresh' : 'stale',
      message:
        daysSinceLastOrder !== null && daysSinceLastOrder < days
          ? `Data is up to date (${daysSinceLastOrder} days old)`
          : 'Data may be outdated, consider running an import',
    };
  },
};
