const Inventory = require('../models/Inventory');
const logger = require('../utils/logger');

/**
 * Demand forecasting engine using statistical methods.
 * Falls back when AI service is unavailable.
 */
const DemandForecaster = {
  /**
   * Calculate forecast stats from sales history
   */
  analyze(inventoryItem) {
    const sales = inventoryItem.dailySales || [];
    const recentSales = sales.slice(-30); // Last 30 days

    if (recentSales.length === 0) {
      return {
        avgDailyDemand: 0,
        trend: 'stable',
        daysToStockout: Infinity,
        confidence: 0.1,
      };
    }

    // Calculate moving averages
    const quantities = recentSales.map(s => s.quantity);
    const avg = quantities.reduce((a, b) => a + b, 0) / quantities.length;

    // 7-day vs 30-day trend
    const recent7 = quantities.slice(-7);
    const avg7 = recent7.length > 0 ? recent7.reduce((a, b) => a + b, 0) / recent7.length : avg;

    let trend = 'stable';
    if (avg7 > avg * 1.2) trend = 'increasing';
    else if (avg7 < avg * 0.8) trend = 'decreasing';

    // Days to stockout
    const demandRate = trend === 'increasing' ? avg7 : avg;
    const daysToStockout = demandRate > 0 ? Math.round(inventoryItem.quantity / demandRate) : Infinity;

    const confidence = Math.min(0.9, 0.2 + recentSales.length * 0.023);

    return {
      avgDailyDemand: Math.round(avg * 10) / 10,
      recentDailyDemand: Math.round(avg7 * 10) / 10,
      trend,
      daysToStockout,
      confidence,
      sampleSize: recentSales.length,
    };
  },

  /**
   * Get restock recommendation
   */
  getRestockRecommendation(inventoryItem, forecastData) {
    const targetDays = 14; // Stock for 2 weeks
    const demandRate = forecastData.trend === 'increasing'
      ? forecastData.recentDailyDemand
      : forecastData.avgDailyDemand;

    const idealStock = Math.ceil(demandRate * targetDays);
    const restockQuantity = Math.max(0, idealStock - inventoryItem.quantity);

    let urgency = 'low';
    if (inventoryItem.quantity === 0) urgency = 'critical';
    else if (forecastData.daysToStockout <= 3) urgency = 'critical';
    else if (forecastData.daysToStockout <= 7) urgency = 'high';
    else if (forecastData.daysToStockout <= 14) urgency = 'medium';

    return {
      restockQuantity,
      urgency,
      targetDays,
      estimatedCost: restockQuantity * (inventoryItem.drug?.unitPrice || 0),
    };
  },
};

module.exports = DemandForecaster;
