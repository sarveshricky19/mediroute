const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const { generateDemandForecast } = require('../services/aiService');
const logger = require('../utils/logger');

// GET /api/v1/forecasts — AI demand forecast for inventory
router.get('/', async (req, res, next) => {
  try {
    // Check tier access
    if (!req.tierConfig.features.includes('ai_forecasting')) {
      return res.status(403).json({
        error: 'Feature not available',
        message: 'AI demand forecasting requires Standard or Premium plan.',
      });
    }

    const { category, limit = 20 } = req.query;

    const pipeline = [
      { $match: { pharmacyId: req.pharmacyId } },
      {
        $lookup: { from: 'drugs', localField: 'drugId', foreignField: '_id', as: 'drug' },
      },
      { $unwind: '$drug' },
    ];

    if (category) {
      pipeline.push({ $match: { 'drug.category': category } });
    }

    pipeline.push({ $limit: Math.min(parseInt(limit, 10) || 20, 50) });

    const inventoryData = await Inventory.aggregate(pipeline);

    if (inventoryData.length === 0) {
      return res.json({ success: true, data: { forecasts: [], message: 'No inventory data to forecast' } });
    }

    const forecast = await generateDemandForecast(inventoryData);

    res.json({ success: true, data: forecast });
  } catch (err) { next(err); }
});

// GET /api/v1/forecasts/:drugId — Forecast for a specific drug
router.get('/:drugId', async (req, res, next) => {
  try {
    if (!req.tierConfig.features.includes('ai_forecasting')) {
      return res.status(403).json({ error: 'Feature not available', message: 'Upgrade to Standard or Premium.' });
    }

    const pipeline = [
      { $match: { pharmacyId: req.pharmacyId, drugId: req.params.drugId } },
      {
        $lookup: { from: 'drugs', localField: 'drugId', foreignField: '_id', as: 'drug' },
      },
      { $unwind: '$drug' },
    ];

    const inventoryData = await Inventory.aggregate(pipeline);

    if (inventoryData.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Inventory record not found' });
    }

    const forecast = await generateDemandForecast(inventoryData);

    res.json({ success: true, data: forecast });
  } catch (err) { next(err); }
});

module.exports = router;
