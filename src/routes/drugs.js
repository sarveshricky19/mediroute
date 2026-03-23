const express = require('express');
const router = express.Router();
const Drug = require('../models/Drug');
const { drugSchema } = require('../utils/validators');

// GET /api/v1/drugs — List drugs for this pharmacy
router.get('/', async (req, res, next) => {
  try {
    const { category, search, limit = 50, skip = 0 } = req.query;
    const filter = { pharmacyId: req.pharmacyId, isActive: true };
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }
    const [drugs, total] = await Promise.all([
      Drug.find(filter).sort({ name: 1 }).skip(parseInt(skip, 10) || 0).limit(Math.min(parseInt(limit, 10) || 50, 200)),
      Drug.countDocuments(filter),
    ]);
    res.json({ success: true, data: drugs, pagination: { total, limit: parseInt(limit, 10) || 50, skip: parseInt(skip, 10) || 0 } });
  } catch (err) { next(err); }
});

// POST /api/v1/drugs — Add a drug
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = drugSchema.validate(req.body);
    if (error) return res.status(400).json({ error: 'Validation Error', message: error.details.map(d => d.message).join(', ') });

    // Check SKU limits
    if (req.skuCount >= req.tierConfig.maxSkus) {
      return res.status(403).json({
        error: 'SKU Limit Reached',
        message: `Your ${req.subscription.tier} plan allows up to ${req.tierConfig.maxSkus} SKUs. Upgrade to add more.`,
      });
    }

    const drug = await Drug.create({ ...value, pharmacyId: req.pharmacyId });
    res.status(201).json({ success: true, data: drug });
  } catch (err) { next(err); }
});

// GET /api/v1/drugs/:id
router.get('/:id', async (req, res, next) => {
  try {
    const drug = await Drug.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!drug) return res.status(404).json({ error: 'Not Found', message: 'Drug not found' });
    res.json({ success: true, data: drug });
  } catch (err) { next(err); }
});

// PUT /api/v1/drugs/:id
router.put('/:id', async (req, res, next) => {
  try {
    const drug = await Drug.findOneAndUpdate(
      { _id: req.params.id, pharmacyId: req.pharmacyId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!drug) return res.status(404).json({ error: 'Not Found', message: 'Drug not found' });
    res.json({ success: true, data: drug });
  } catch (err) { next(err); }
});

// DELETE /api/v1/drugs/:id (soft delete)
router.delete('/:id', async (req, res, next) => {
  try {
    const drug = await Drug.findOneAndUpdate(
      { _id: req.params.id, pharmacyId: req.pharmacyId },
      { $set: { isActive: false } },
      { new: true }
    );
    if (!drug) return res.status(404).json({ error: 'Not Found', message: 'Drug not found' });
    res.json({ success: true, message: 'Drug deactivated' });
  } catch (err) { next(err); }
});

module.exports = router;
