import express from 'express';
import { getConnectionStatus } from './index.js';

const app = express();

app.get('/health', (_req, res) => {
  const status = getConnectionStatus();
  res.json({
    status: status.connected ? 'ok' : 'disconnected',
    connected: status.connected,
    restartCount: status.restartCount,
    timestamp: new Date().toISOString(),
  });
});

export function startHealthServer(port: number): void {
  app.listen(port, '0.0.0.0', () => {
    console.info('Health server listening on 0.0.0.0:%d', port);
  });
}
