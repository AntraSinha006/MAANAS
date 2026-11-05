# ── build stage ──────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

# ── runtime stage ────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app/backend
# Copy installed deps
COPY --from=deps /app/backend/node_modules ./node_modules
# Copy source
COPY backend/ ./
# Copy frontend so Express can serve it (config.js looks one level up: ../frontend)
COPY frontend/ /app/frontend/

EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
