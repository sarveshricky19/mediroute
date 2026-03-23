const Inventory = require('../models/Inventory');
const Drug = require('../models/Drug');
const Alert = require('../models/Alert');
const config = require('../config');
const logger = require('../utils/logger');

const AlertEngine = {
  /**
   * Run alert checks for a pharmacy. Called periodically or after inventory updates.
   */
  async checkAlerts(pharmacyId, wsEmit) {
    const alerts = [];

    // Check low stock / stockout
    const lowStockItems = await this.checkLowStock(pharmacyId);
    alerts.push(...lowStockItems);

    // Check overstock
    const overstockItems = await this.checkOverstock(pharmacyId);
    alerts.push(...overstockItems);

    // Check expiry
    const expiryItems = await this.checkExpiry(pharmacyId);
    alerts.push(...expiryItems);

    // Save alerts and emit via WebSocket
    for (const alertData of alerts) {
      try {
        // Avoid duplicate alerts (same type, drug, within 24 hours)
        const recent = await Alert.findOne({
          pharmacyId,
          drugId: alertData.drugId,
          type: alertData.type,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        });

        if (!recent) {
          const alert = await Alert.create({ pharmacyId, ...alertData });
          logger.info('Alert created', { pharmacyId, type: alertData.type, drugId: alertData.drugId });

          if (wsEmit) {
            wsEmit(pharmacyId.toString(), {
              type: 'alert',
              alert: {
                id: alert._id,
                type: alert.type,
                severity: alert.severity,
                title: alert.title,
                message: alert.message,
              },
            });
          }
        }
      } catch (error) {
        logger.error('Error creating alert', { error: error.message });
      }
    }

    return alerts;
  },

  async checkLowStock(pharmacyId) {
    const alerts = [];
    const items = await Inventory.aggregate([
      { $match: { pharmacyId } },
      { $lookup: { from: 'drugs', localField: 'drugId', foreignField: '_id', as: 'drug' } },
      { $unwind: '$drug' },
      { $match: { $expr: { $lte: ['$quantity', { $multiply: ['$maxStock', config.alerts.lowStockThreshold] }] } } },
    ]);

    for (const item of items) {
      const isStockout = item.quantity === 0;
      alerts.push({
        drugId: item.drugId,
        type: isStockout ? 'stockout' : 'low_stock',
        severity: isStockout ? 'critical' : 'warning',
        title: isStockout ? `STOCKOUT: ${item.drug.name}` : `Low Stock: ${item.drug.name}`,
        message: isStockout
          ? `${item.drug.name} is completely out of stock. Immediate restocking required.`
          : `${item.drug.name} is at ${item.quantity}/${item.maxStock} (${Math.round((item.quantity / item.maxStock) * 100)}%). Consider restocking.`,
        data: { quantity: item.quantity, maxStock: item.maxStock, drugName: item.drug.name },
      });
    }
    return alerts;
  },

  async checkOverstock(pharmacyId) {
    const alerts = [];
    const items = await Inventory.aggregate([
      { $match: { pharmacyId } },
      { $lookup: { from: 'drugs', localField: 'drugId', foreignField: '_id', as: 'drug' } },
      { $unwind: '$drug' },
      { $match: { $expr: { $gte: [{ $divide: ['$quantity', { $max: ['$maxStock', 1] }] }, config.alerts.overstockThreshold] } } },
    ]);

    for (const item of items) {
      alerts.push({
        drugId: item.drugId,
        type: 'overstock',
        severity: 'info',
        title: `Overstock: ${item.drug.name}`,
        message: `${item.drug.name} is at ${item.quantity}/${item.maxStock} (${Math.round((item.quantity / item.maxStock) * 100)}%). Consider redistributing.`,
        data: { quantity: item.quantity, maxStock: item.maxStock },
      });
    }
    return alerts;
  },

  async checkExpiry(pharmacyId) {
    const alerts = [];
    const warningDate = new Date(Date.now() + config.alerts.expiryWarningDays * 24 * 60 * 60 * 1000);
    const items = await Inventory.aggregate([
      { $match: { pharmacyId, expiryDate: { $ne: null, $lte: warningDate } } },
      { $lookup: { from: 'drugs', localField: 'drugId', foreignField: '_id', as: 'drug' } },
      { $unwind: '$drug' },
    ]);

    for (const item of items) {
      const daysLeft = Math.ceil((new Date(item.expiryDate) - Date.now()) / (1000 * 60 * 60 * 24));
      const isExpired = daysLeft <= 0;
      alerts.push({
        drugId: item.drugId,
        type: 'expiry_warning',
        severity: isExpired ? 'critical' : daysLeft <= 7 ? 'warning' : 'info',
        title: isExpired ? `EXPIRED: ${item.drug.name}` : `Expiry Warning: ${item.drug.name}`,
        message: isExpired
          ? `${item.drug.name} (Batch: ${item.batchNumber || 'N/A'}) has expired. Remove from stock immediately.`
          : `${item.drug.name} (Batch: ${item.batchNumber || 'N/A'}) expires in ${daysLeft} days.`,
        data: { expiryDate: item.expiryDate, daysLeft, batchNumber: item.batchNumber },
      });
    }
    return alerts;
  },
};

module.exports = AlertEngine;
