require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config');
const Drug = require('./Drug');
const Inventory = require('./Inventory');
const Pharmacy = require('./Pharmacy');
const Subscription = require('./Subscription');
const logger = require('../utils/logger');

const sampleDrugs = [
  { name: 'Amoxicillin 500mg', genericName: 'Amoxicillin', manufacturer: 'Cipla', category: 'antibiotics', dosageForm: 'capsule', strength: '500mg', unitPrice: 8.50, sku: 'AMX-500' },
  { name: 'Paracetamol 650mg', genericName: 'Acetaminophen', manufacturer: 'GSK', category: 'analgesics', dosageForm: 'tablet', strength: '650mg', unitPrice: 2.00, sku: 'PCM-650' },
  { name: 'Cetirizine 10mg', genericName: 'Cetirizine HCl', manufacturer: 'Sun Pharma', category: 'antihistamines', dosageForm: 'tablet', strength: '10mg', unitPrice: 3.50, sku: 'CTZ-010' },
  { name: 'Metformin 500mg', genericName: 'Metformin HCl', manufacturer: 'USV', category: 'antidiabetics', dosageForm: 'tablet', strength: '500mg', unitPrice: 4.00, sku: 'MET-500' },
  { name: 'Amlodipine 5mg', genericName: 'Amlodipine Besylate', manufacturer: 'Pfizer', category: 'cardiovascular', dosageForm: 'tablet', strength: '5mg', unitPrice: 6.00, sku: 'AML-005' },
  { name: 'Salbutamol Inhaler', genericName: 'Salbutamol', manufacturer: 'Cipla', category: 'respiratory', dosageForm: 'inhaler', strength: '100mcg', unitPrice: 120.00, sku: 'SAL-INH' },
  { name: 'Omeprazole 20mg', genericName: 'Omeprazole', manufacturer: 'Dr. Reddy\'s', category: 'gastrointestinal', dosageForm: 'capsule', strength: '20mg', unitPrice: 5.50, sku: 'OMP-020' },
  { name: 'Vitamin D3 60K', genericName: 'Cholecalciferol', manufacturer: 'Abbott', category: 'vitamins', dosageForm: 'capsule', strength: '60000 IU', unitPrice: 30.00, sku: 'VTD-60K' },
  { name: 'Levothyroxine 50mcg', genericName: 'Levothyroxine Sodium', manufacturer: 'Abbott', category: 'hormones', dosageForm: 'tablet', strength: '50mcg', unitPrice: 7.00, sku: 'LTX-050' },
  { name: 'Azithromycin 500mg', genericName: 'Azithromycin', manufacturer: 'Zydus', category: 'antibiotics', dosageForm: 'tablet', strength: '500mg', unitPrice: 15.00, sku: 'AZM-500' },
  { name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', manufacturer: 'Mankind', category: 'analgesics', dosageForm: 'tablet', strength: '400mg', unitPrice: 3.00, sku: 'IBU-400' },
  { name: 'Montelukast 10mg', genericName: 'Montelukast Sodium', manufacturer: 'Sun Pharma', category: 'respiratory', dosageForm: 'tablet', strength: '10mg', unitPrice: 8.00, sku: 'MTL-010' },
];

async function seed() {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info('Connected to MongoDB for seeding');

    // Create a demo pharmacy if none exists
    let pharmacy = await Pharmacy.findOne({ email: 'demo@mediroute.in' });
    if (!pharmacy) {
      pharmacy = await Pharmacy.create({
        name: 'MediRoute Demo Pharmacy',
        email: 'demo@mediroute.in',
        password: 'demo1234',
        phone: '+91-9876543210',
        address: { street: '123 Health Street', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
        licenseNumber: 'MH-PHARM-2024-001',
        type: 'pharmacy',
        tier: 'standard',
      });
      logger.info('Demo pharmacy created', { id: pharmacy._id });
    }

    // Create subscription
    await Subscription.findOneAndUpdate(
      { pharmacyId: pharmacy._id },
      { $setOnInsert: { tier: 'standard', status: 'active', startDate: new Date(), endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) } },
      { upsert: true, new: true }
    );

    // Seed drugs
    const drugs = [];
    for (const drugData of sampleDrugs) {
      const drug = await Drug.findOneAndUpdate(
        { pharmacyId: pharmacy._id, sku: drugData.sku },
        { $setOnInsert: { ...drugData, pharmacyId: pharmacy._id } },
        { upsert: true, new: true }
      );
      drugs.push(drug);
    }
    logger.info(`Seeded ${drugs.length} drugs`);

    // Seed inventory with varied stock levels
    const stockLevels = [0, 5, 12, 45, 80, 150, 200, 30, 8, 95, 60, 180];
    for (let i = 0; i < drugs.length; i++) {
      const maxStock = 200;
      const quantity = stockLevels[i] || 50;

      // Generate some fake daily sales
      const dailySales = Array.from({ length: 14 }, (_, j) => ({
        date: new Date(Date.now() - (14 - j) * 24 * 60 * 60 * 1000),
        quantity: Math.floor(Math.random() * 10) + 1,
      }));

      await Inventory.findOneAndUpdate(
        { pharmacyId: pharmacy._id, drugId: drugs[i]._id },
        {
          $setOnInsert: {
            quantity,
            maxStock,
            minStock: 20,
            location: `Shelf ${String.fromCharCode(65 + (i % 6))}${Math.floor(i / 6) + 1}`,
            batchNumber: `BATCH-2025-${String(i + 1).padStart(3, '0')}`,
            expiryDate: new Date(Date.now() + (30 + Math.floor(Math.random() * 335)) * 24 * 60 * 60 * 1000),
            dailySales,
          },
        },
        { upsert: true, new: true }
      );
    }
    logger.info('Seeded inventory data');

    logger.info('Seeding complete!');
    logger.info(`Demo credentials — email: demo@mediroute.in, password: demo1234`);
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed', { error: error.message });
    process.exit(1);
  }
}

seed();
