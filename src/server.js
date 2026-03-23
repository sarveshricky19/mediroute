const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const config = require('./config');
const logger = require('./utils/logger');
const { connectDB, closeDB } = require('./models/db');
const errorHandler = require('./middleware/errorHandler');
const { auth, generateToken } = require('./middleware/auth');
const tenantResolver = require('./middleware/tenantResolver');
const createAlertSocket = require('./ws/alertSocket');

// Models
const Pharmacy = require('./models/Pharmacy');
const { pharmacyRegistrationSchema, loginSchema } = require('./utils/validators');

// Routes
const healthRoutes = require('./routes/health');
const inventoryRoutes = require('./routes/inventory');
const drugRoutes = require('./routes/drugs');
const alertRoutes = require('./routes/alerts');
const forecastRoutes = require('./routes/forecasts');
const subscriptionRoutes = require('./routes/subscriptions');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Public routes
app.use('/health', healthRoutes);

// Auth routes
app.post('/api/v1/auth/register', async (req, res, next) => {
  try {
    const { error, value } = pharmacyRegistrationSchema.validate(req.body);
    if (error) return res.status(400).json({ error: 'Validation Error', message: error.details.map(d => d.message).join(', ') });

    const existing = await Pharmacy.findOne({ email: value.email });
    if (existing) return res.status(409).json({ error: 'Conflict', message: 'Email already registered' });

    const pharmacy = await Pharmacy.create(value);
    const token = generateToken(pharmacy._id);

    logger.info('Pharmacy registered', { pharmacyId: pharmacy._id, tier: pharmacy.tier });

    res.status(201).json({
      success: true,
      data: { pharmacy: pharmacy.toJSON(), token, message: 'Registration successful. Use the token for API calls.' },
    });
  } catch (err) { next(err); }
});

app.post('/api/v1/auth/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: 'Validation Error', message: error.details.map(d => d.message).join(', ') });

    const pharmacy = await Pharmacy.findOne({ email: value.email }).select('+password');
    if (!pharmacy || !(await pharmacy.comparePassword(value.password))) {
      return res.status(401).json({ error: 'Invalid credentials', message: 'Email or password is incorrect' });
    }

    pharmacy.lastLogin = new Date();
    await pharmacy.save();

    const token = generateToken(pharmacy._id);

    res.json({
      success: true,
      data: { pharmacy: pharmacy.toJSON(), token },
    });
  } catch (err) { next(err); }
});

// Authenticated + tenant routes
app.use('/api/v1/inventory', auth, tenantResolver, inventoryRoutes);
app.use('/api/v1/drugs', auth, tenantResolver, drugRoutes);
app.use('/api/v1/alerts', auth, tenantResolver, alertRoutes);
app.use('/api/v1/forecasts', auth, tenantResolver, forecastRoutes);
app.use('/api/v1/subscriptions', auth, tenantResolver, subscriptionRoutes);

// Error handler
app.use(errorHandler);

// WebSocket
const { emit: wsEmit } = createAlertSocket(server);
app.locals.wsEmit = wsEmit;

// Graceful shutdown
function gracefulShutdown(signal) {
  logger.info(`${signal} received. Shutting down...`);
  server.close(async () => {
    await closeDB();
    logger.info('Server shut down');
    process.exit(0);
  });
  setTimeout(() => { process.exit(1); }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start
if (require.main === module) {
  connectDB().then(() => {
    server.listen(config.port, () => {
      logger.info(`MediRoute API running on port ${config.port}`, { environment: config.nodeEnv });
    });
  });
}

module.exports = { app, server };
