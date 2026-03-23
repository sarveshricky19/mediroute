const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
  drugId: { type: mongoose.Schema.Types.ObjectId, ref: 'Drug' },
  type: {
    type: String,
    enum: ['stockout', 'low_stock', 'overstock', 'expiry_warning', 'demand_spike', 'forecast_alert'],
    required: true,
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'warning',
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed },
  isRead: { type: Boolean, default: false },
  isDismissed: { type: Boolean, default: false },
}, {
  timestamps: true,
});

alertSchema.index({ pharmacyId: 1, createdAt: -1 });
alertSchema.index({ pharmacyId: 1, isRead: 1 });
alertSchema.index({ pharmacyId: 1, type: 1 });

module.exports = mongoose.model('Alert', alertSchema);
