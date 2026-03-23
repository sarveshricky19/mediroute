const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true, unique: true },
  tier: {
    type: String,
    enum: ['basic', 'standard', 'premium'],
    default: 'basic',
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'trial'],
    default: 'trial',
  },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  skuCount: { type: Number, default: 0 },
  billingHistory: [{
    date: { type: Date },
    amount: { type: Number },
    tier: { type: String },
    status: { type: String, enum: ['paid', 'pending', 'failed'] },
  }],
}, {
  timestamps: true,
});

subscriptionSchema.index({ pharmacyId: 1 });
subscriptionSchema.index({ status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
