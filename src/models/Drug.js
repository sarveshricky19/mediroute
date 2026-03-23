const mongoose = require('mongoose');

const drugSchema = new mongoose.Schema({
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
  name: { type: String, required: true, trim: true },
  genericName: { type: String, trim: true },
  manufacturer: { type: String, trim: true },
  category: {
    type: String,
    enum: ['antibiotics', 'analgesics', 'antihistamines', 'antidiabetics',
           'cardiovascular', 'respiratory', 'gastrointestinal', 'vitamins',
           'hormones', 'vaccines', 'other'],
    default: 'other',
  },
  dosageForm: {
    type: String,
    enum: ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'other'],
    default: 'tablet',
  },
  strength: { type: String },
  unitPrice: { type: Number, required: true },
  sku: { type: String },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

// Compound index for tenant isolation
drugSchema.index({ pharmacyId: 1, name: 1 });
drugSchema.index({ pharmacyId: 1, sku: 1 });
drugSchema.index({ pharmacyId: 1, category: 1 });

module.exports = mongoose.model('Drug', drugSchema);
