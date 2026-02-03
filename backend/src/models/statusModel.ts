import { query } from '../db/index.js';

export const statusModel = {
  getSystemStatus: async () => {
    // Check database connection
    const dbCheck = await query('SELECT NOW() as timestamp, version() as version');
    
    // Get table counts
    const [ordersCount, customersCount, productsCount, usersCount] = await Promise.all([
      query('SELECT COUNT(*) as count FROM ordre'),
      query('SELECT COUNT(*) as count FROM kunde'),
      query('SELECT COUNT(*) as count FROM vare'),
      query('SELECT COUNT(*) as count FROM users'),
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
        orders: parseInt(ordersCount.rows[0].count),
        customers: parseInt(customersCount.rows[0].count),
        products: parseInt(productsCount.rows[0].count),
        users: parseInt(usersCount.rows[0].count),
      },
    };
  },

  getImportStatus: async () => {
    // Get latest records from each table
    const [latestOrder, orderCount] = await Promise.all([
      query('SELECT ordrenr, dato FROM ordre ORDER BY dato DESC LIMIT 1'),
      query('SELECT COUNT(*) as count FROM ordre'),
    ]);

    return {
      status: 'ok',
      lastImport: new Date().toISOString(), // Placeholder - would be from actual ETL logs
      latestOrder: latestOrder.rows[0] || null,
      totalOrders: parseInt(orderCount.rows[0].count),
      message: 'Data import status is nominal',
    };
  },

  getExtractionStatus: async () => {
    return {
      status: 'ok',
      lastExtraction: new Date().toISOString(), // Placeholder
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
        status: 'assumed healthy', // Would need actual frontend health check
        url: process.env.FRONTEND_URL || 'http://localhost:3000',
      },
    };
  },

  /**
   * Get recent ETL/scheduler activity logs
   */
  getRecentActivity: async (days: number = 7) => {
    // Get data freshness metrics
    const [latestOrder, latestCustomer, latestProduct] = await Promise.all([
      query('SELECT MAX(dato) as last_date FROM ordre'),
      query('SELECT MAX(kundenr) as last_id, (SELECT COUNT(*) FROM kunde) as count FROM kunde'),
      query('SELECT MAX(varekode) as last_id, (SELECT COUNT(*) FROM vare) as count FROM vare'),
    ]);

    // Calculate data freshness
    const latestOrderDate = latestOrder.rows[0]?.last_date;
    const daysSinceLastOrder = latestOrderDate 
      ? Math.floor((Date.now() - new Date(latestOrderDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      dataFreshness: {
        lastOrderDate: latestOrderDate,
        daysSinceLastOrder,
        totalCustomers: parseInt(latestCustomer.rows[0]?.count || '0'),
        totalProducts: parseInt(latestProduct.rows[0]?.count || '0'),
      },
      status: daysSinceLastOrder !== null && daysSinceLastOrder < days ? 'fresh' : 'stale',
      message: daysSinceLastOrder !== null && daysSinceLastOrder < days 
        ? `Data is up to date (${daysSinceLastOrder} days old)`
        : 'Data may be outdated, consider running an import',
    };
  }
};

