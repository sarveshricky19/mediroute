const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
  drugId: { type: mongoose.Schema.Types.ObjectId, ref: 'Drug', required: true },
  quantity: { type: Number, required: true, default: 0, min: 0 },
  maxStock: { type: Number, default: 100 },
  minStock: { type: Number, default: 10 },
  location: { type: String },
  batchNumber: { type: String },
  expiryDate: { type: Date },
  lastRestocked: { type: Date },
  dailySales: [{ 
    date: { type: Date },
    quantity: { type: Number, default: 0 },
  }],
}, {
  timestamps: true,
});

// Indexes for aggregation pipelines
inventorySchema.index({ pharmacyId: 1, drugId: 1 }, { unique: true });
inventorySchema.index({ pharmacyId: 1, quantity: 1 });
inventorySchema.index({ pharmacyId: 1, expiryDate: 1 });

// Virtual for stock status
inventorySchema.virtual('stockStatus').get(function() {
  const ratio = this.maxStock > 0 ? this.quantity / this.maxStock : 0;
  if (ratio <= 0) return 'out_of_stock';
  if (ratio <= 0.2) return 'critical_low';
  if (ratio <= 0.4) return 'low';
  if (ratio >= 0.9) return 'overstock';
  return 'normal';
});

inventorySchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Inventory', inventorySchema);
