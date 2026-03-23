const express = require('express');
const router = express.Router();
const Drug = require('../models/Drug');
const Inventory = require('../models/Inventory');
const { inventoryUpdateSchema, inventoryBatchSchema } = require('../utils/validators');
const logger = require('../utils/logger');

// GET /api/v1/inventory — List inventory with aggregation
router.get('/', async (req, res, next) => {
  try {
    const { status, category, search, limit = 50, skip = 0, sort = 'quantity' } = req.query;
    const matchStage = { pharmacyId: req.pharmacyId };

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'drugs',
          localField: 'drugId',
          foreignField: '_id',
          as: 'drug',
        },
      },
      { $unwind: '$drug' },
    ];

    if (category) {
      pipeline.push({ $match: { 'drug.category': category } });
    }

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'drug.name': { $regex: search, $options: 'i' } },
            { 'drug.genericName': { $regex: search, $options: 'i' } },
            { 'drug.sku': { $regex: search, $options: 'i' } },
          ],
        },
      });
    }

    // Add stock status
    pipeline.push({
      $addFields: {
        stockRatio: { $cond: [{ $gt: ['$maxStock', 0] }, { $divide: ['$quantity', '$maxStock'] }, 0] },
        stockStatus: {
          $switch: {
            branches: [
              { case: { $eq: ['$quantity', 0] }, then: 'out_of_stock' },
              { case: { $lte: [{ $divide: ['$quantity', { $max: ['$maxStock', 1] }] }, 0.2] }, then: 'critical_low' },
              { case: { $lte: [{ $divide: ['$quantity', { $max: ['$maxStock', 1] }] }, 0.4] }, then: 'low' },
              { case: { $gte: [{ $divide: ['$quantity', { $max: ['$maxStock', 1] }] }, 0.9] }, then: 'overstock' },
            ],
            default: 'normal',
          },
        },
      },
    });

    if (status) {
      pipeline.push({ $match: { stockStatus: status } });
    }

    // Sort
    const sortMap = {
      quantity: { quantity: 1 },
      '-quantity': { quantity: -1 },
      name: { 'drug.name': 1 },
      expiry: { expiryDate: 1 },
    };
    pipeline.push({ $sort: sortMap[sort] || { quantity: 1 } });

    // Count total before pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Inventory.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Paginate
    pipeline.push({ $skip: parseInt(skip, 10) || 0 });
    pipeline.push({ $limit: Math.min(parseInt(limit, 10) || 50, 200) });

    const inventory = await Inventory.aggregate(pipeline);

    res.json({
      success: true,
      data: inventory,
      pagination: { total, limit: parseInt(limit, 10) || 50, skip: parseInt(skip, 10) || 0 },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/summary — Dashboard summary using aggregation pipelines
router.get('/summary', async (req, res, next) => {
  try {
    const summary = await Inventory.aggregate([
      { $match: { pharmacyId: req.pharmacyId } },
      {
        $lookup: {
          from: 'drugs',
          localField: 'drugId',
          foreignField: '_id',
          as: 'drug',
        },
      },
      { $unwind: '$drug' },
      {
        $group: {
          _id: null,
          totalSkus: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: { $sum: { $multiply: ['$quantity', '$drug.unitPrice'] } },
          outOfStock: { $sum: { $cond: [{ $eq: ['$quantity', 0] }, 1, 0] } },
          lowStock: { $sum: { $cond: [{ $lte: [{ $divide: ['$quantity', { $max: ['$maxStock', 1] }] }, 0.2] }, 1, 0] } },
          overstock: { $sum: { $cond: [{ $gte: [{ $divide: ['$quantity', { $max: ['$maxStock', 1] }] }, 0.9] }, 1, 0] } },
          expiringIn30Days: {
            $sum: {
              $cond: [
                { $and: [
                  { $ne: ['$expiryDate', null] },
                  { $lte: ['$expiryDate', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)] },
                ]},
                1, 0,
              ],
            },
          },
        },
      },
    ]);

    // Category breakdown
    const categoryBreakdown = await Inventory.aggregate([
      { $match: { pharmacyId: req.pharmacyId } },
      {
        $lookup: { from: 'drugs', localField: 'drugId', foreignField: '_id', as: 'drug' },
      },
      { $unwind: '$drug' },
      {
        $group: {
          _id: '$drug.category',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: { $sum: { $multiply: ['$quantity', '$drug.unitPrice'] } },
        },
      },
      { $sort: { totalValue: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        overview: summary[0] || { totalSkus: 0, totalQuantity: 0, totalValue: 0, outOfStock: 0 },
        categoryBreakdown,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/inventory — Update inventory
router.put('/', async (req, res, next) => {
  try {
    const { error, value } = inventoryUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: 'Validation Error', message: error.details.map(d => d.message).join(', ') });
    }

    // Verify drug belongs to this pharmacy
    const drug = await Drug.findOne({ _id: value.drugId, pharmacyId: req.pharmacyId });
    if (!drug) {
      return res.status(404).json({ error: 'Not Found', message: 'Drug not found' });
    }

    const updateData = { pharmacyId: req.pharmacyId, drugId: value.drugId };
    let quantity = value.quantity;

    if (value.action === 'add' || value.action === 'subtract') {
      const existing = await Inventory.findOne({ pharmacyId: req.pharmacyId, drugId: value.drugId });
      const currentQty = existing ? existing.quantity : 0;
      quantity = value.action === 'add' ? currentQty + value.quantity : Math.max(0, currentQty - value.quantity);
    }

    const inventory = await Inventory.findOneAndUpdate(
      { pharmacyId: req.pharmacyId, drugId: value.drugId },
      {
        $set: {
          quantity,
          maxStock: value.maxStock || 100,
          minStock: value.minStock || 10,
          location: value.location,
          batchNumber: value.batchNumber,
          expiryDate: value.expiryDate,
          lastRestocked: value.action === 'add' ? new Date() : undefined,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Push daily sales record if subtracting (sales)
    if (value.action === 'subtract') {
      await Inventory.updateOne(
        { _id: inventory._id },
        { $push: { dailySales: { date: new Date(), quantity: value.quantity } } }
      );
    }

    // Emit alert via WebSocket if stock is low
    if (req.app.locals.wsEmit && inventory.maxStock > 0) {
      const ratio = inventory.quantity / inventory.maxStock;
      if (ratio <= 0.2) {
        req.app.locals.wsEmit(req.pharmacyId.toString(), {
          type: 'stock_alert',
          severity: ratio === 0 ? 'critical' : 'warning',
          drugId: value.drugId,
          drugName: drug.name,
          quantity: inventory.quantity,
          maxStock: inventory.maxStock,
        });
      }
    }

    res.json({ success: true, data: inventory });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/batch — Batch inventory update
router.post('/batch', async (req, res, next) => {
  try {
    const { error, value } = inventoryBatchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: 'Validation Error', message: error.details.map(d => d.message).join(', ') });
    }

    const results = [];
    const errors = [];

    for (const item of value.items) {
      try {
        const drug = await Drug.findOne({ _id: item.drugId, pharmacyId: req.pharmacyId });
        if (!drug) {
          errors.push({ drugId: item.drugId, error: 'Drug not found' });
          continue;
        }

        let quantity = item.quantity;
        if (item.action === 'add' || item.action === 'subtract') {
          const existing = await Inventory.findOne({ pharmacyId: req.pharmacyId, drugId: item.drugId });
          const currentQty = existing ? existing.quantity : 0;
          quantity = item.action === 'add' ? currentQty + item.quantity : Math.max(0, currentQty - item.quantity);
        }

        const inv = await Inventory.findOneAndUpdate(
          { pharmacyId: req.pharmacyId, drugId: item.drugId },
          { $set: { quantity, maxStock: item.maxStock || 100, minStock: item.minStock || 10 } },
          { upsert: true, new: true }
        );

        results.push(inv);
      } catch (err) {
        errors.push({ drugId: item.drugId, error: err.message });
      }
    }

    res.json({
      success: true,
      data: { processed: results.length, failed: errors.length, results, errors: errors.length > 0 ? errors : undefined },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
