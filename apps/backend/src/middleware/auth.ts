import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, User } from '@prisma/client';
import { RedisClientType } from 'redis';
import { BlockchainService } from '../services/blockchain';
import { IPFSService } from '../services/ipfs';

export interface Context {
  prisma: PrismaClient;
  redis: RedisClientType | any;
  user: User | null;
  blockchainService: BlockchainService;
  ipfsService: IPFSService;
}

export interface JWTPayload {
  userId: string;
  roles: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * Express middleware for REST routes.
 * Sets req.user when a valid JWT is provided.
 */
export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    const prisma = new PrismaClient();
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    await prisma.$disconnect();

    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export async function authMiddleware(req: Request): Promise<User | null> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    
    // Get user from database
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    
    await prisma.$disconnect();
    
    return user;
  } catch (error) {
    return null;
  }
}

export function requireAuth(user: User | null): User {
  if (!user) {
    throw new Error('Not authenticated');
  }
  return user;
}

export function requireRole(user: User | null, allowedRoles: string[]): User {
  const authenticatedUser = requireAuth(user);
  
  const hasRole = authenticatedUser.roles.some((role: string) => allowedRoles.includes(role));
  
  if (!hasRole) {
    throw new Error('Not authorized');
  }
  
  return authenticatedUser;
}
