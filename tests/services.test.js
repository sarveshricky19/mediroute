const DemandForecaster = require('../src/services/demandForecaster');

describe('DemandForecaster', () => {
  describe('analyze', () => {
    it('should return zero demand for no sales history', () => {
      const item = { quantity: 100, maxStock: 200, dailySales: [] };
      const result = DemandForecaster.analyze(item);
      expect(result.avgDailyDemand).toBe(0);
      expect(result.trend).toBe('stable');
      expect(result.confidence).toBeLessThan(0.2);
    });

    it('should calculate average demand from sales', () => {
      const sales = Array.from({ length: 14 }, (_, i) => ({
        date: new Date(Date.now() - (14 - i) * 86400000),
        quantity: 5,
      }));
      const item = { quantity: 50, maxStock: 200, dailySales: sales };
      const result = DemandForecaster.analyze(item);
      expect(result.avgDailyDemand).toBe(5);
      expect(result.daysToStockout).toBe(10);
    });

    it('should detect increasing trend', () => {
      const sales = [
        ...Array.from({ length: 20 }, () => ({ date: new Date(Date.now() - 20 * 86400000), quantity: 3 })),
        ...Array.from({ length: 7 }, () => ({ date: new Date(), quantity: 10 })),
      ];
      const item = { quantity: 50, maxStock: 200, dailySales: sales };
      const result = DemandForecaster.analyze(item);
      expect(result.trend).toBe('increasing');
    });
  });

  describe('getRestockRecommendation', () => {
    it('should recommend critical urgency for zero stock', () => {
      const item = { quantity: 0, maxStock: 200, drug: { unitPrice: 10 } };
      const forecast = { avgDailyDemand: 5, recentDailyDemand: 5, trend: 'stable', daysToStockout: 0 };
      const result = DemandForecaster.getRestockRecommendation(item, forecast);
      expect(result.urgency).toBe('critical');
      expect(result.restockQuantity).toBeGreaterThan(0);
    });

    it('should recommend medium urgency for moderate stock', () => {
      const item = { quantity: 50, maxStock: 200, drug: { unitPrice: 10 } };
      const forecast = { avgDailyDemand: 5, recentDailyDemand: 5, trend: 'stable', daysToStockout: 10 };
      const result = DemandForecaster.getRestockRecommendation(item, forecast);
      expect(result.urgency).toBe('medium');
    });

    it('should calculate estimated cost', () => {
      const item = { quantity: 0, maxStock: 100, drug: { unitPrice: 25 } };
      const forecast = { avgDailyDemand: 5, recentDailyDemand: 5, trend: 'stable', daysToStockout: 0 };
      const result = DemandForecaster.getRestockRecommendation(item, forecast);
      expect(result.estimatedCost).toBeGreaterThan(0);
    });
  });
});
