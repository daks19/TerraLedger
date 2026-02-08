import { Request, Response, NextFunction } from 'express';
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
export declare function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function authMiddleware(req: Request): Promise<User | null>;
export declare function requireAuth(user: User | null): User;
export declare function requireRole(user: User | null, allowedRoles: string[]): User;
//# sourceMappingURL=auth.d.ts.map