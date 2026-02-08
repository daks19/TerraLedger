import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { authRouter } from './routes/auth';
import { landRouter } from './routes/land';
import { inheritanceRouter } from './routes/inheritance';
import { mapRouter } from './routes/map';
import { uploadRouter } from './routes/upload';
import publicRouter from './routes/public';
import { authMiddleware, Context } from './middleware/auth';
import { BlockchainService } from './services/blockchain';
import { IPFSService } from './services/ipfs';
import { logger } from './utils/logger';
import { validateEnvironment } from './utils/env-validator';

dotenv.config();

// Validate environment before starting server
validateEnvironment();

const app = express();
const prisma = new PrismaClient();

// Redis client
// Redis client (optional)
let redis: ReturnType<typeof createClient> | null = null;

// Only initialize Redis if explicitly configured
if (process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379') {
  redis = createClient({
    url: process.env.REDIS_URL,
  });

  // Prevent Redis errors from crashing the application
  redis.on('error', (err) => {
    logger.warn('Redis Client Error:', err);
  });
}

// Initialize services
const blockchainService = new BlockchainService();
const ipfsService = new IPFSService();

async function startServer() {
  // Connect to Redis (if configured)
  if (redis) {
    try {
      await redis.connect();
      logger.info('Connected to Redis');
    } catch (error) {
      logger.warn('Redis connection failed, continuing without cache:', error);
    }
  } else {
    logger.info('Redis not configured, continuing without cache');
  }

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  }));

  // CORS - allow all localhost ports in development
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, etc)
      if (!origin) return callback(null, true);
      // Allow any localhost port in development
      if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      // Otherwise use configured origin
      const allowedOriginRaw = process.env.CORS_ORIGIN || 'http://localhost:3000';
      if (allowedOriginRaw === '*') return callback(null, true);

      const allowedOrigins = allowedOriginRaw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (allowedOrigins.includes(origin)) return callback(null, true);

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Logging
  app.use(morgan('combined', {
    stream: { write: (message) => logger.http(message.trim()) },
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api/', limiter);

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: prisma ? 'connected' : 'disconnected',
        redis: redis?.isReady ? 'connected' : 'disconnected',
      },
    });
  });

  // REST API routes
  // Public read-only API (no authentication required)
  app.use('/api/public', publicRouter);
  
  // Internal/Admin API routes (authentication required)
  app.use('/api/auth', authRouter);
  app.use('/api/land', landRouter);
  app.use('/api/inheritance', inheritanceRouter);
  app.use('/api/map', mapRouter);
  app.use('/api/upload', uploadRouter);

  // Apollo Server for GraphQL
  const server = new ApolloServer<Context>({
    typeDefs,
    resolvers,
  });

  await server.start();

  // GraphQL endpoint
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }: { req: express.Request }) => {
        const user = await authMiddleware(req);
        return {
          prisma,
          redis,
          user,
          blockchainService,
          ipfsService,
        };
      },
    })
  );

  // Error handling
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // For local development
  if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 GraphQL endpoint: http://localhost:${PORT}/graphql`);
      logger.info(`📡 REST API: http://localhost:${PORT}/api`);
    });
  }

  return app;
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await prisma.$disconnect();
  if (redis) await redis.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  await prisma.$disconnect();
  if (redis) await redis.quit();
  process.exit(0);
});

// Export for Vercel serverless
let serverPromise: Promise<express.Application> | null = null;

export default async function handler(req: any, res: any) {
  if (!serverPromise) {
    serverPromise = startServer();
  }
  const app = await serverPromise;
  // Express app is a request handler function
  return (app as any)(req, res);
}

// Start server for local development
if (process.env.NODE_ENV !== 'production') {
  startServer().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { prisma, redis };
