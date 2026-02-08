# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files (npm workspaces)
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/

# Install dependencies (includes dev deps needed for building + prisma)
RUN npm ci

# Copy backend source
COPY apps/backend ./apps/backend

# Generate Prisma client + build
WORKDIR /app/apps/backend
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy built backend and runtime deps
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production

EXPOSE 4000

# Run migrations and start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
