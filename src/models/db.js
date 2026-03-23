const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../utils/logger');

async function connectDB() {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection error', { error: error.message });
    process.exit(1);
  }
}

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error', { error: err.message });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

async function healthCheck() {
  try {
    const state = mongoose.connection.readyState;
    const stateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    return { status: state === 1 ? 'healthy' : 'unhealthy', state: stateMap[state] || 'unknown' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

async function closeDB() {
  await mongoose.connection.close();
}

module.exports = { connectDB, healthCheck, closeDB };
