const request = require('supertest');

// Mock Mongoose
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn().mockResolvedValue(true),
    connection: {
      readyState: 1,
      on: jest.fn(),
      close: jest.fn(),
    },
    Schema: actualMongoose.Schema,
    model: jest.fn().mockImplementation((name) => {
      const Model = function(data) { Object.assign(this, data); };
      Model.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }) }) });
      Model.findOne = jest.fn().mockResolvedValue(null);
      Model.findById = jest.fn().mockResolvedValue(null);
      Model.create = jest.fn().mockImplementation(data => Promise.resolve({ _id: 'mock-id', ...data, toJSON() { const o = { ...this }; delete o.password; return o; } }));
      Model.countDocuments = jest.fn().mockResolvedValue(0);
      Model.aggregate = jest.fn().mockResolvedValue([]);
      Model.findOneAndUpdate = jest.fn().mockResolvedValue(null);
      Model.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });
      Model.prototype.save = jest.fn().mockResolvedValue(true);
      Model.prototype.comparePassword = jest.fn().mockResolvedValue(true);
      Model.prototype.toJSON = function() { const o = { ...this }; delete o.password; return o; };
      Model.schema = { pre: jest.fn(), methods: {}, set: jest.fn() };
      return Model;
    }),
  };
});

// Need to require after mocking
let app;
beforeAll(() => {
  const server = require('../src/server');
  app = server.app;
});

describe('MediRoute API', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.service).toBe('MediRoute API');
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Test' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should validate login fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'invalid' });
      expect(res.status).toBe(400);
    });
  });

  describe('Authenticated routes', () => {
    it('should reject requests without token', async () => {
      const res = await request(app).get('/api/v1/inventory');
      expect(res.status).toBe(401);
    });

    it('should reject invalid tokens', async () => {
      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', 'Bearer invalid_token');
      expect(res.status).toBe(401);
    });
  });
});
