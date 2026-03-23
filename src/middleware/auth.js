const jwt = require('jsonwebtoken');
const config = require('../config');
const Pharmacy = require('../models/Pharmacy');
const logger = require('../utils/logger');

async function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Provide a valid JWT token in the Authorization header (Bearer <token>)',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const pharmacy = await Pharmacy.findById(decoded.id);

    if (!pharmacy || !pharmacy.isActive) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Account not found or deactivated',
      });
    }

    req.pharmacy = pharmacy;
    req.pharmacyId = pharmacy._id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', message: 'Please login again' });
    }
    return res.status(401).json({ error: 'Invalid token', message: 'Token verification failed' });
  }
}

function generateToken(pharmacyId) {
  return jwt.sign({ id: pharmacyId }, config.jwtSecret, { expiresIn: config.jwtExpire });
}

module.exports = { auth, generateToken };
