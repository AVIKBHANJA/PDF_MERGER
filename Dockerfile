FROM node:20-alpine AS base

# Install Ghostscript
RUN apk add --no-cache ghostscript

# --- Dependencies stage ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# --- Build stage ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Production stage ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
