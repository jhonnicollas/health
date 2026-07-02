import makeWASocket, { useMultiFileAuthState, DisconnectReason, type WASocket, type BaileysEventMap } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { sendInbound } from './inbound.js';
import { startOutboundServer } from './outbound.js';
import { startHealthServer } from './health.js';
import { saveQRImage, printQRTerminal } from './qr.js';
import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });

let sock: WASocket | null = null;
let restartCount = 0;
const MAX_RESTART = 10;

export function getSocket(): WASocket {
  if (!sock) throw new Error('Baileys socket not connected');
  return sock;
}

export function getConnectionStatus(): { connected: boolean; restartCount: number } {
  return { connected: sock !== null, restartCount };
}

async function startBaileys() {
  const authDir = path.resolve(process.cwd(), 'auth');
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const proxyUrl = process.env.WA_PROXY_URL;
  const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
  const fetchAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

  if (proxyUrl) {
    logger.info('Using proxy: %s', proxyUrl.replace(/\/\/[^@]+@/, '//***@'));
  }

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    qrTimeout: 120_000,
    logger: logger.child({ module: 'baileys' }),
    browser: ['Chrome (Linux)', '', ''],
    connectTimeoutMs: 30_000,
    keepAliveIntervalMs: 30_000,
    agent,
    fetchAgent,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }: BaileysEventMap['messages.upsert']) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;

      try {
        await sendInbound(sock!, msg);
      } catch (err) {
        logger.error({ err, msgId: msg.key.id }, 'Failed to forward inbound message');
      }
    }
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        await saveQRImage(qr);
        logger.info('QR image saved to /app/qr/latest.png');
      } catch (err) {
        logger.warn({ err }, 'Failed to save QR image, printing to terminal');
        printQRTerminal(qr);
      }
      printQRTerminal(qr);
    }

    if (connection === 'close') {
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;

      logger.warn({ code }, 'Connection closed. Reconnect=%s', shouldReconnect);

      sock = null;
      if (shouldReconnect && restartCount < MAX_RESTART) {
        restartCount++;
        setTimeout(() => startBaileys(), 5000);
      } else {
        logger.error('Max restart reached or logged out. Manual intervention required.');
        process.exit(1);
      }
    } else if (connection === 'open') {
      restartCount = 0;
      logger.info('WhatsApp connection established');
    }
  });
}

async function main() {
  logger.info('Starting iSehat Baileys Gateway...');

  await startBaileys();

  const outboundPort = parseInt(process.env.OUTBOUND_LISTEN_PORT || '3001', 10);
  startOutboundServer(outboundPort);

  const healthPort = parseInt(process.env.HEALTH_CHECK_PORT || '3002', 10);
  startHealthServer(healthPort);

  logger.info('Outbound server on port %d, Health server on port %d', outboundPort, healthPort);
}

main().catch((err) => {
  logger.fatal(err, 'Fatal startup error');
  process.exit(1);
});
