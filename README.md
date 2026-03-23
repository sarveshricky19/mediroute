# MediRoute — AI-Powered Drug Supply Chain Monitor

SaaS platform for pharmacies and hospitals to monitor inventory, get AI-driven demand forecasts, and receive real-time stockout alerts.

## 🚀 Quick Start

### Using Docker (recommended)
```bash
docker-compose up -d
```
API available at `http://localhost:3001`

### Manual Setup
```bash
npm install
cp .env.example .env
# Edit .env with MongoDB URI and API keys
npm run dev
```

## 📡 API Reference

### Auth
```bash
# Register
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Apollo Pharmacy","email":"admin@apollo.com","password":"secure123","type":"pharmacy"}'

# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@apollo.com","password":"secure123"}'
```

### Inventory
```bash
# Get inventory summary
curl http://localhost:3001/api/v1/inventory/summary \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Update stock
curl -X PUT http://localhost:3001/api/v1/inventory \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"drugId":"ID","quantity":50,"action":"add"}'
```

### AI Forecasts
```bash
curl http://localhost:3001/api/v1/forecasts \
  -H "Authorization: Bearer YOUR_JWT"
```

### WebSocket Alerts
```javascript
const ws = new WebSocket('ws://localhost:3001/ws/alerts?token=YOUR_JWT');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

## 💰 Subscription Tiers

| Tier | SKU Limit | Price | Features |
|------|-----------|-------|----------|
| Basic | 100 | ₹2,000/mo | Inventory + Basic Alerts |
| Standard | 500 | ₹5,000/mo | + AI Forecasting + Reports |
| Premium | 2,000 | ₹8,000/mo | + ERP Sync + Priority Support |

## 🏗 Architecture

```
src/
├── server.js          # Express + WebSocket entry
├── config/            # Environment config
├── middleware/         # JWT auth, tenant resolver, error handler
├── routes/            # REST endpoints (inventory, drugs, alerts, forecasts, subscriptions)
├── models/            # Mongoose schemas (Pharmacy, Drug, Inventory, Alert, Subscription)
├── services/          # AI forecasting, alert engine, demand forecaster, SOAP connector
├── ws/                # WebSocket alert push
└── utils/             # Logger, validators
```

## 📦 Tech Stack
- **Runtime**: Node.js + Express
- **Database**: MongoDB (Mongoose)
- **AI**: Anthropic Claude API
- **ERP**: SOAP integration
- **Auth**: JWT multi-tenant
- **Real-time**: WebSocket alerts
- **Containerization**: Docker + docker-compose

## License
MIT
