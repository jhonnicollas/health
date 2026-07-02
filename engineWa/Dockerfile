FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

RUN npm prune --omit=dev && rm -rf /root/.npm

RUN npm install -g pm2

COPY ecosystem.config.cjs ./

VOLUME ["/app/auth", "/app/qr", "/app/logs"]

EXPOSE 3001 3002

HEALTHCHECK --interval=60s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

CMD ["pm2-runtime", "ecosystem.config.cjs"]
