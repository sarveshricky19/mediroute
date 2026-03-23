const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');

// GET /api/v1/alerts — List alerts for this pharmacy
router.get('/', async (req, res, next) => {
  try {
    const { type, severity, unreadOnly, limit = 50, skip = 0 } = req.query;
    const filter = { pharmacyId: req.pharmacyId, isDismissed: false };
    if (type) filter.type = type;
    if (severity) filter.severity = severity;
    if (unreadOnly === 'true') filter.isRead = false;

    const [alerts, total, unreadCount] = await Promise.all([
      Alert.find(filter).populate('drugId', 'name category').sort({ createdAt: -1 })
        .skip(parseInt(skip, 10) || 0).limit(Math.min(parseInt(limit, 10) || 50, 200)),
      Alert.countDocuments(filter),
      Alert.countDocuments({ pharmacyId: req.pharmacyId, isRead: false, isDismissed: false }),
    ]);

    res.json({
      success: true,
      data: alerts,
      unreadCount,
      pagination: { total, limit: parseInt(limit, 10) || 50, skip: parseInt(skip, 10) || 0 },
    });
  } catch (err) { next(err); }
});

// PUT /api/v1/alerts/:id/read — Mark alert as read
router.put('/:id/read', async (req, res, next) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, pharmacyId: req.pharmacyId },
      { $set: { isRead: true } },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Not Found' });
    res.json({ success: true, data: alert });
  } catch (err) { next(err); }
});

// PUT /api/v1/alerts/:id/dismiss — Dismiss alert
router.put('/:id/dismiss', async (req, res, next) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, pharmacyId: req.pharmacyId },
      { $set: { isDismissed: true } },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Not Found' });
    res.json({ success: true, data: alert });
  } catch (err) { next(err); }
});

// POST /api/v1/alerts/read-all — Mark all as read
router.post('/read-all', async (req, res, next) => {
  try {
    await Alert.updateMany(
      { pharmacyId: req.pharmacyId, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true, message: 'All alerts marked as read' });
  } catch (err) { next(err); }
});

module.exports = router;
