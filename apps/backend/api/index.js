// Vercel serverless function entry point
// Lazy-loads everything to catch and report errors gracefully

let app = null;
let initPromise = null;

async function initializeApp() {
  if (app) return app;

  const express = require('express');
  const cors = require('cors');

  app = express();

  // CORS
  app.use(cors({
    origin: process.env.CORS_ORIGIN === '*' ? true : (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()),
    credentials: true,
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Root route
  app.get('/', (_req, res) => {
    res.json({ name: 'TerraLedger API', version: '1.0.0', status: 'running' });
  });

  // Debug route
  app.use((req, res, next) => {
    console.log('Request:', req.method, req.url, req.path);
    next();
  });

  // Health check (before any complex imports that might fail)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'unknown',
    });
  });

  try {
    // Prisma
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Services (lazy load to catch errors)
    const { BlockchainService } = require('../dist/services/blockchain');
    const { IPFSService } = require('../dist/services/ipfs');
    const blockchainService = new BlockchainService();
    const ipfsService = new IPFSService();

    // Routes
    const { authRouter } = require('../dist/routes/auth');
    const { landRouter } = require('../dist/routes/land');
    const { inheritanceRouter } = require('../dist/routes/inheritance');
    const { mapRouter } = require('../dist/routes/map');
    const { uploadRouter } = require('../dist/routes/upload');
    const publicRouter = require('../dist/routes/public').default; // default export

    // Middleware
    const { authMiddleware } = require('../dist/middleware/auth');

    // GraphQL
    const { ApolloServer } = require('@apollo/server');
    const { expressMiddleware } = require('@apollo/server/express4');
    const { typeDefs } = require('../dist/graphql/schema');
    const { resolvers } = require('../dist/graphql/resolvers');

    // REST API routes
    app.use('/api/auth', authRouter);
    app.use('/api/land', landRouter);
    app.use('/api/inheritance', inheritanceRouter);
    app.use('/api/map', mapRouter);
    app.use('/api/upload', uploadRouter);
    app.use('/api/public', publicRouter);

    // Initialize Apollo Server
    const apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      introspection: process.env.NODE_ENV !== 'production',
    });
    await apolloServer.start();

    // GraphQL endpoint
    app.use(
      '/graphql',
      expressMiddleware(apolloServer, {
        context: async ({ req }) => {
          const user = await authMiddleware(req);
          return { prisma, redis: null, user, blockchainService, ipfsService };
        },
      })
    );
  } catch (error) {
    console.error('Failed to initialize app:', error);
    // Fallback - still serve health and show the error
    app.use((_req, res) => {
      res.status(500).json({
        error: 'Server initialization failed',
        message: error.message,
      });
    });
    return app;
  }

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ 
      error: 'Not found',
      debug: {
        method: req.method,
        url: req.url,
        path: req.path,
        originalUrl: req.originalUrl,
      }
    });
  });

  return app;
}

module.exports = async (req, res) => {
  if (!initPromise) {
    initPromise = initializeApp();
  }
  const handler = await initPromise;
  return handler(req, res);
};


