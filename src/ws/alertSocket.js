const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

function createAlertSocket(server) {
  const wss = new WebSocket.Server({ noServer: true });
  const pharmacyConnections = new Map();

  server.on('upgrade', (request, socket, head) => {
    if (request.url !== '/ws/alerts') {
      socket.destroy();
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.pharmacyId = decoded.id;
        wss.emit('connection', ws);
      });
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    const pharmacyId = ws.pharmacyId;
    logger.info('WebSocket alert client connected', { pharmacyId });

    if (!pharmacyConnections.has(pharmacyId)) {
      pharmacyConnections.set(pharmacyId, new Set());
    }
    pharmacyConnections.get(pharmacyId).add(ws);

    ws.send(JSON.stringify({ type: 'connected', message: 'Connected to MediRoute alerts' }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      } catch { /* ignore */ }
    });

    ws.on('close', () => {
      const conns = pharmacyConnections.get(pharmacyId);
      if (conns) {
        conns.delete(ws);
        if (conns.size === 0) pharmacyConnections.delete(pharmacyId);
      }
    });

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
  });

  // Heartbeat
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, config.wsHeartbeatInterval);

  wss.on('close', () => clearInterval(heartbeat));

  function emit(pharmacyId, data) {
    const conns = pharmacyConnections.get(pharmacyId);
    if (!conns) return;
    const message = JSON.stringify(data);
    conns.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(message);
    });
  }

  return { wss, emit };
}

module.exports = createAlertSocket;
