"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = exports.prisma = void 0;
exports.default = handler;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const server_1 = require("@apollo/server");
const express4_1 = require("@apollo/server/express4");
const client_1 = require("@prisma/client");
const redis_1 = require("redis");
const dotenv_1 = __importDefault(require("dotenv"));
const schema_1 = require("./graphql/schema");
const resolvers_1 = require("./graphql/resolvers");
const auth_1 = require("./routes/auth");
const land_1 = require("./routes/land");
const inheritance_1 = require("./routes/inheritance");
const map_1 = require("./routes/map");
const upload_1 = require("./routes/upload");
const public_1 = __importDefault(require("./routes/public"));
const auth_2 = require("./middleware/auth");
const blockchain_1 = require("./services/blockchain");
const ipfs_1 = require("./services/ipfs");
const logger_1 = require("./utils/logger");
const env_validator_1 = require("./utils/env-validator");
dotenv_1.default.config();
// Validate environment before starting server
(0, env_validator_1.validateEnvironment)();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
exports.prisma = prisma;
// Redis client
// Redis client (optional)
let redis = null;
exports.redis = redis;
// Only initialize Redis if explicitly configured
if (process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379') {
    exports.redis = redis = (0, redis_1.createClient)({
        url: process.env.REDIS_URL,
    });
    // Prevent Redis errors from crashing the application
    redis.on('error', (err) => {
        logger_1.logger.warn('Redis Client Error:', err);
    });
}
// Initialize services
const blockchainService = new blockchain_1.BlockchainService();
const ipfsService = new ipfs_1.IPFSService();
async function startServer() {
    // Connect to Redis (if configured)
    if (redis) {
        try {
            await redis.connect();
            logger_1.logger.info('Connected to Redis');
        }
        catch (error) {
            logger_1.logger.warn('Redis connection failed, continuing without cache:', error);
        }
    }
    else {
        logger_1.logger.info('Redis not configured, continuing without cache');
    }
    // Security middleware
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    }));
    // CORS - allow all localhost ports in development
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps, curl, etc)
            if (!origin)
                return callback(null, true);
            // Allow any localhost port in development
            if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
                return callback(null, true);
            }
            // Otherwise use configured origin
            const allowedOriginRaw = process.env.CORS_ORIGIN || 'http://localhost:3000';
            if (allowedOriginRaw === '*')
                return callback(null, true);
            const allowedOrigins = allowedOriginRaw
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean);
            if (allowedOrigins.includes(origin))
                return callback(null, true);
            callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
    }));
    // Body parsing
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    // Logging
    app.use((0, morgan_1.default)('combined', {
        stream: { write: (message) => logger_1.logger.http(message.trim()) },
    }));
    // Rate limiting
    const limiter = (0, express_rate_limit_1.default)({
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
    app.use('/api/public', public_1.default);
    // Internal/Admin API routes (authentication required)
    app.use('/api/auth', auth_1.authRouter);
    app.use('/api/land', land_1.landRouter);
    app.use('/api/inheritance', inheritance_1.inheritanceRouter);
    app.use('/api/map', map_1.mapRouter);
    app.use('/api/upload', upload_1.uploadRouter);
    // Apollo Server for GraphQL
    const server = new server_1.ApolloServer({
        typeDefs: schema_1.typeDefs,
        resolvers: resolvers_1.resolvers,
    });
    await server.start();
    // GraphQL endpoint
    app.use('/graphql', (0, express4_1.expressMiddleware)(server, {
        context: async ({ req }) => {
            const user = await (0, auth_2.authMiddleware)(req);
            return {
                prisma,
                redis,
                user,
                blockchainService,
                ipfsService,
            };
        },
    }));
    // Error handling
    app.use((err, req, res, next) => {
        logger_1.logger.error('Unhandled error:', err);
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
            logger_1.logger.info(`🚀 Server running on port ${PORT}`);
            logger_1.logger.info(`📊 GraphQL endpoint: http://localhost:${PORT}/graphql`);
            logger_1.logger.info(`📡 REST API: http://localhost:${PORT}/api`);
        });
    }
    return app;
}
// Graceful shutdown
process.on('SIGINT', async () => {
    logger_1.logger.info('Shutting down gracefully...');
    await prisma.$disconnect();
    if (redis)
        await redis.quit();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    logger_1.logger.info('Shutting down gracefully...');
    await prisma.$disconnect();
    if (redis)
        await redis.quit();
    process.exit(0);
});
// Export for Vercel serverless
let serverPromise = null;
async function handler(req, res) {
    if (!serverPromise) {
        serverPromise = startServer();
    }
    const app = await serverPromise;
    // Express app is a request handler function
    return app(req, res);
}
// Start server for local development
if (process.env.NODE_ENV !== 'production') {
    startServer().catch((error) => {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map