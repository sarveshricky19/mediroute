const Joi = require('joi');

const pharmacyRegistrationSchema = Joi.object({
  name: Joi.string().required().min(2).max(255),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(8).max(100),
  phone: Joi.string().max(20).optional(),
  address: Joi.object({
    street: Joi.string().max(500),
    city: Joi.string().max(100),
    state: Joi.string().max(100),
    pincode: Joi.string().max(10),
  }).optional(),
  licenseNumber: Joi.string().max(50).optional(),
  type: Joi.string().valid('pharmacy', 'hospital', 'clinic', 'distributor').default('pharmacy'),
  tier: Joi.string().valid('basic', 'standard', 'premium').default('basic'),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const drugSchema = Joi.object({
  name: Joi.string().required().min(2).max(255),
  genericName: Joi.string().max(255).optional(),
  manufacturer: Joi.string().max(255).optional(),
  category: Joi.string().valid(
    'antibiotics', 'analgesics', 'antihistamines', 'antidiabetics',
    'cardiovascular', 'respiratory', 'gastrointestinal', 'vitamins',
    'hormones', 'vaccines', 'other'
  ).default('other'),
  dosageForm: Joi.string().valid('tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'other').default('tablet'),
  strength: Joi.string().max(50).optional(),
  unitPrice: Joi.number().positive().required(),
  batchNumber: Joi.string().max(50).optional(),
  expiryDate: Joi.date().iso().optional(),
  sku: Joi.string().max(50).optional(),
});

const inventoryUpdateSchema = Joi.object({
  drugId: Joi.string().required(),
  quantity: Joi.number().integer().min(0).required(),
  maxStock: Joi.number().integer().positive().optional(),
  minStock: Joi.number().integer().min(0).optional(),
  location: Joi.string().max(100).optional(),
  batchNumber: Joi.string().max(50).optional(),
  expiryDate: Joi.date().iso().optional(),
  action: Joi.string().valid('set', 'add', 'subtract').default('set'),
});

const inventoryBatchSchema = Joi.object({
  items: Joi.array().items(inventoryUpdateSchema).min(1).max(200).required(),
});

module.exports = {
  pharmacyRegistrationSchema,
  loginSchema,
  drugSchema,
  inventoryUpdateSchema,
  inventoryBatchSchema,
};
