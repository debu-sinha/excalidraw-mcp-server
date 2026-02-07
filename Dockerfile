FROM node:18-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/

RUN npx tsc -p tsconfig.json

FROM node:18-slim AS production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs appuser

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist dist/

USER appuser

ENV NODE_ENV=production
ENV CANVAS_HOST=127.0.0.1
ENV CANVAS_PORT=3000

EXPOSE 3000

CMD ["node", "dist/canvas/index.js"]
