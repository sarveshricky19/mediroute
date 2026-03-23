const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ error: 'Validation Error', message: messages.join(', ') });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Conflict', message: 'A resource with this identifier already exists' });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal Server Error' : err.message,
    message: status === 500 ? 'An unexpected error occurred.' : err.message,
  });
}

module.exports = errorHandler;
