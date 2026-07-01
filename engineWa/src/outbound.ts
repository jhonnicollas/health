import express from 'express';
import { getSocket } from './index.js';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

interface OutboundPayload {
  whatsappNumber: string;
  textContent: string;
  providerMessageId: string;
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  const secret = req.headers['x-gateway-secret'];
  if (secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
  }
  next();
});

app.post('/api/whatsapp/outbound/send', async (req, res) => {
  const { whatsappNumber, textContent, providerMessageId } = req.body as OutboundPayload;

  if (!whatsappNumber || !textContent) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS' } });
  }

  try {
    const socket = getSocket();
    const jid = whatsappNumber.replace(/\D/g, '') + '@s.whatsapp.net';

    await socket.sendMessage(jid, { text: textContent });

    res.json({ success: true, providerMessageId });
  } catch (err: any) {
    console.error('Outbound send failed:', err.message);
    res.status(500).json({ success: false, error: { code: 'SEND_FAILED', message: err.message } });
  }
});

export function startOutboundServer(port: number): void {
  app.listen(port, '0.0.0.0', () => {
    console.info('Outbound server listening on 0.0.0.0:%d', port);
  });
}

export { app };
