const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const pharmacySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  phone: { type: String },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
  },
  licenseNumber: { type: String },
  type: {
    type: String,
    enum: ['pharmacy', 'hospital', 'clinic', 'distributor'],
    default: 'pharmacy',
  },
  tier: {
    type: String,
    enum: ['basic', 'standard', 'premium'],
    default: 'basic',
  },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
}, {
  timestamps: true,
});

// Hash password before saving
pharmacySchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
pharmacySchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON
pharmacySchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('Pharmacy', pharmacySchema);
