"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.authMiddleware = authMiddleware;
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
/**
 * Express middleware for REST routes.
 * Sets req.user when a valid JWT is provided.
 */
async function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Authorization required' });
    }
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Authorization required' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const prisma = new client_1.PrismaClient();
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        await prisma.$disconnect();
        if (!user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        req.user = user;
        return next();
    }
    catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
async function authMiddleware(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return null;
    }
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
        return null;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Get user from database
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });
        await prisma.$disconnect();
        return user;
    }
    catch (error) {
        return null;
    }
}
function requireAuth(user) {
    if (!user) {
        throw new Error('Not authenticated');
    }
    return user;
}
function requireRole(user, allowedRoles) {
    const authenticatedUser = requireAuth(user);
    const hasRole = authenticatedUser.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
        throw new Error('Not authorized');
    }
    return authenticatedUser;
}
//# sourceMappingURL=auth.js.map