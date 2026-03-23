const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const config = require('../config');

// GET /api/v1/subscriptions — Get current subscription
router.get('/', async (req, res, next) => {
  try {
    const subscription = req.subscription;
    const tierConfig = req.tierConfig;

    res.json({
      success: true,
      data: {
        subscription: {
          tier: subscription.tier,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
        },
        usage: {
          skuCount: req.skuCount,
          skuLimit: tierConfig.maxSkus,
          usagePercent: Math.round((req.skuCount / tierConfig.maxSkus) * 100),
        },
        plan: {
          name: tierConfig.name,
          priceInr: tierConfig.priceInr,
          features: tierConfig.features,
        },
        availablePlans: Object.entries(config.subscriptionTiers).map(([key, tier]) => ({
          tier: key,
          name: tier.name,
          priceInr: tier.priceInr,
          maxSkus: tier.maxSkus,
          features: tier.features,
          isCurrent: key === subscription.tier,
        })),
        billingHistory: subscription.billingHistory.slice(-6),
      },
    });
  } catch (err) { next(err); }
});

// PUT /api/v1/subscriptions/upgrade — Upgrade tier
router.put('/upgrade', async (req, res, next) => {
  try {
    const { tier } = req.body;
    if (!config.subscriptionTiers[tier]) {
      return res.status(400).json({ error: 'Invalid tier', message: 'Choose basic, standard, or premium' });
    }

    const subscription = await Subscription.findOneAndUpdate(
      { pharmacyId: req.pharmacyId },
      {
        $set: { tier, status: 'active' },
        $push: { billingHistory: { date: new Date(), amount: config.subscriptionTiers[tier].priceInr, tier, status: 'paid' } },
      },
      { new: true }
    );

    // Also update pharmacy tier
    await req.pharmacy.updateOne({ tier });

    res.json({ success: true, data: subscription, message: `Upgraded to ${tier} plan` });
  } catch (err) { next(err); }
});

module.exports = router;
