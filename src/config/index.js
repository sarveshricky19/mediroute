require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/mediroute',
  jwtSecret: process.env.JWT_SECRET || 'mediroute-dev-secret-change-in-prod',
  jwtExpire: process.env.JWT_EXPIRE || '7d',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  wsHeartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL, 10) || 30000,

  // Subscription tiers
  subscriptionTiers: {
    basic: {
      name: 'Basic',
      maxSkus: 100,
      priceInr: 2000,
      features: ['inventory_tracking', 'basic_alerts'],
    },
    standard: {
      name: 'Standard',
      maxSkus: 500,
      priceInr: 5000,
      features: ['inventory_tracking', 'ai_forecasting', 'alerts', 'reports'],
    },
    premium: {
      name: 'Premium',
      maxSkus: 2000,
      priceInr: 8000,
      features: ['inventory_tracking', 'ai_forecasting', 'alerts', 'reports', 'erp_sync', 'priority_support'],
    },
  },

  // Alert thresholds
  alerts: {
    lowStockThreshold: 0.2,   // 20% of max stock
    overstockThreshold: 0.9,  // 90% of max stock
    expiryWarningDays: 30,    // Warn 30 days before expiry
  },
};
