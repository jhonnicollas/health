import type { WASocket, WAMessage } from '@whiskeysockets/baileys';

const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

interface InboundPayload {
  providerMessageId: string;
  whatsappNumber: string;
  messageType: 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'unknown';
  textContent: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  timestamp: string;
  isGroupMessage: boolean;
}

function getJidNumber(jid: string): string {
  return jid.split('@')[0];
}

function extractTextContent(msg: WAMessage): string | null {
  if (!msg.message) return null;
  return msg.message.conversation
    || msg.message.extendedTextMessage?.text
    || msg.message.imageMessage?.caption
    || msg.message.videoMessage?.caption
    || msg.message.documentMessage?.caption
    || null;
}

function getMessageType(msg: WAMessage): InboundPayload['messageType'] {
  if (!msg.message) return 'unknown';
  if (msg.message.conversation || msg.message.extendedTextMessage) return 'text';
  if (msg.message.imageMessage) return 'image';
  if (msg.message.documentMessage) return 'document';
  if (msg.message.audioMessage) return 'audio';
  if (msg.message.videoMessage) return 'video';
  if (msg.message.stickerMessage) return 'sticker';
  return 'unknown';
}

export function normalizeMessage(msg: WAMessage): InboundPayload {
  const jid = msg.key.remoteJid || '';
  const isGroup = jid.endsWith('@g.us');

  return {
    providerMessageId: msg.key.id || '',
    whatsappNumber: isGroup ? jid : `+${getJidNumber(jid)}`,
    messageType: getMessageType(msg),
    textContent: extractTextContent(msg),
    mediaUrl: null,
    mediaMimeType: null,
    timestamp: msg.messageTimestamp
      ? new Date(typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Date.now()).toISOString()
      : new Date().toISOString(),
    isGroupMessage: isGroup,
  };
}

export async function sendInbound(sock: WASocket, msg: WAMessage): Promise<void> {
  const payload = normalizeMessage(msg);

  if (!payload.providerMessageId) return;
  if (payload.isGroupMessage) return;

  if (!WEBHOOK_URL) {
    console.warn('WEBHOOK_URL not configured, skipping inbound forward');
    return;
  }

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Gateway-Secret': WEBHOOK_SECRET,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Webhook POST failed: %d %s', res.status, body);
  }
}
