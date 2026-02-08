# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time public env (baked into client bundle)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GRAPHQL_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GRAPHQL_URL=$NEXT_PUBLIC_GRAPHQL_URL

# Copy package files (npm workspaces)
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/

RUN npm ci

# Copy source code
COPY apps/web ./apps/web

# Build (standalone output configured in next.config.js)
WORKDIR /app/apps/web
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Runtime env (server-side only; client is baked at build)
ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone server
COPY --from=builder /app/apps/web/.next/standalone ./

# Copy static + public assets to expected locations
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
