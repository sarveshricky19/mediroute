const config = require('../config');
const Subscription = require('../models/Subscription');
const Drug = require('../models/Drug');
const logger = require('../utils/logger');

async function tenantResolver(req, res, next) {
  if (!req.pharmacyId) return next();

  try {
    // Get or create subscription
    let subscription = await Subscription.findOne({ pharmacyId: req.pharmacyId });
    if (!subscription) {
      subscription = await Subscription.create({
        pharmacyId: req.pharmacyId,
        tier: req.pharmacy.tier,
        status: 'trial',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 day trial
      });
    }

    // Check subscription status
    if (subscription.status === 'expired' || subscription.status === 'cancelled') {
      return res.status(403).json({
        error: 'Subscription inactive',
        message: 'Your subscription has expired. Please renew to continue.',
      });
    }

    // Check SKU limits
    const skuCount = await Drug.countDocuments({ pharmacyId: req.pharmacyId, isActive: true });
    const tierConfig = config.subscriptionTiers[subscription.tier] || config.subscriptionTiers.basic;

    req.subscription = subscription;
    req.tierConfig = tierConfig;
    req.skuCount = skuCount;

    next();
  } catch (error) {
    logger.error('Tenant resolver error', { error: error.message });
    next(error);
  }
}

module.exports = tenantResolver;
