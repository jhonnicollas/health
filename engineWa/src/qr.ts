import fs from 'node:fs';
import path from 'node:path';
import qrcode from 'qrcode-terminal';

const QR_DIR = process.env.QR_FILE_PATH
  ? path.dirname(process.env.QR_FILE_PATH)
  : path.resolve(process.cwd(), 'qr');

export async function saveQRImage(qrString: string): Promise<void> {
  if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });

  const sharp = (await import('sharp')).default;
  const qrDataUrl = `data:image/png;base64,${await generateQRBase64(qrString)}`;

  const matches = qrDataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!matches?.[1]) return;

  const buf = Buffer.from(matches[1], 'base64');
  const destPath = process.env.QR_FILE_PATH || path.join(QR_DIR, 'latest.png');

  await sharp(buf).resize(400).png().toFile(destPath);
  console.info('QR image saved to %s', destPath);
}

async function generateQRBase64(text: string): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    qrcode.generate(text, { type: 'png' }, (data: string) => {
      resolve(Buffer.from(data, 'binary').toString('base64'));
    });
  });
}

export function printQRTerminal(qrString: string): void {
  qrcode.generate(qrString, { small: true });
  console.info('Scan QR code above with WhatsApp > Linked Devices');
}
