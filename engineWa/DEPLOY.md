# iSehat Baileys WhatsApp Gateway — Deploy Guide

## Prerequisites

- VPS: Ubuntu 22.04 LTS or Debian 12
- Docker + Docker Compose installed
- Cloudflare Tunnel configured (no open ports)
- WhatsApp business number ready for pairing
- `WA_GATEWAY_SECRET` matching Worker #4 secret

## Deploy Steps

### 1. Copy to VPS

```bash
scp -r engineWa/ user@your-vps:/opt/isehat-baileys/
```

### 2. Create .env on VPS

```bash
cd /opt/isehat-baileys
cp .env.example .env
# Edit .env with real values:
# - WEBHOOK_URL = your Worker #4 webhook URL
# - WA_GATEWAY_SECRET = same as Worker #4 secret
nano .env
```

### 3. Create required directories

```bash
mkdir -p auth qr logs
chmod 777 auth qr logs  # Docker needs write access
```

### 4. Build and start

```bash
docker compose up -d --build
```

### 5. Pair WhatsApp (first time only)

```bash
# Check QR code
docker exec isehat-baileys cat /app/qr/latest.png > qr.png
# Or view logs for terminal QR:
docker compose logs -f | grep -i qr
```

Open WhatsApp on your phone > Linked Devices > Link a device > Scan QR code.

### 6. Verify health

```bash
curl http://127.0.0.1:3002/health
# Expected: {"status":"ok","connected":true,...}
```

### 7. Configure Cloudflare Tunnel

```bash
# Install cloudflared if not already
cloudflared tunnel create isehat-baileys
cloudflared tunnel route dns isehat-baileys baileys.isehat.biz.id

# Create config
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: isehat-baileys
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: baileys.isehat.biz.id
    service: http://localhost:3001
  - service: http_status:404
EOF

cloudflared tunnel run isehat-baileys
```

### 8. Test inbound flow

Send a WhatsApp message to the bot number. Check logs:

```bash
docker compose logs -f
```

Verify the message appears in Worker #4 logs on Cloudflare.

### 9. Test outbound flow

From Worker #3, POST to `https://baileys.isehat.biz.id/api/whatsapp/outbound/send`:

```bash
curl -X POST https://baileys.isehat.biz.id/api/whatsapp/outbound/send \
  -H "Content-Type: application/json" \
  -H "X-Gateway-Secret: YOUR_SECRET" \
  -d '{"whatsappNumber":"+628123456789","textContent":"Test from iSehat","providerMessageId":"test-001"}'
```

## Maintenance

### View logs

```bash
docker compose logs -f
# Or PM2 inside container:
docker exec isehat-baileys pm2 logs isehat-baileys
```

### Restart

```bash
docker compose restart
```

### Re-pair WhatsApp

If auth session is corrupted:

```bash
docker compose down
rm -rf auth/*
docker compose up -d --build
# Scan new QR code
```

### Update code

```bash
cd /opt/isehat-baileys
git pull  # or re-scp the files
docker compose up -d --build
```

## Security Checklist

- [ ] `.env` file is not committed to git
- [ ] `WA_GATEWAY_SECRET` matches Worker #4 Cloudflare Secret
- [ ] No public ports — only Cloudflare Tunnel exposed
- [ ] VPS firewall blocks all inbound except SSH + Cloudflare
- [ ] `auth/` directory backed up securely (contains WA session)
- [ ] Health check monitored by Worker #4 every 5 minutes

## Architecture Reference

See: `docs_sprint6/WHATSAPP_BAILEYS_ARCHITECTURE.md`
