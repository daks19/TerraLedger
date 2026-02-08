"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.landRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
const blockchain_1 = require("../services/blockchain");
const ipfs_1 = require("../services/ipfs");
const router = (0, express_1.Router)();
exports.landRouter = router;
const prisma = new client_1.PrismaClient();
const blockchainService = new blockchain_1.BlockchainService();
const ipfsService = new ipfs_1.IPFSService();
// Auth middleware
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Authorization required' });
    }
    try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        req.userRoles = decoded.roles;
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};
// Validation schemas
const registerParcelSchema = zod_1.z.object({
    surveyNumber: zod_1.z.string().min(1),
    areaSqM: zod_1.z.number().positive(),
    village: zod_1.z.string().min(1),
    district: zod_1.z.string().min(1),
    state: zod_1.z.string().min(1),
    boundaryGeoJSON: zod_1.z.string(),
    documentsHash: zod_1.z.string().optional(),
    ownerWallet: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    latitude: zod_1.z.number().min(-90).max(90),
    longitude: zod_1.z.number().min(-180).max(180),
});
// GET /api/land/my-parcels - Get user's parcels
router.get('/my-parcels', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const parcels = await prisma.landParcel.findMany({
            where: { ownerId: user.id },
            include: {
                owner: {
                    select: { id: true, name: true, email: true, walletAddress: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(parcels);
    }
    catch (error) {
        logger_1.logger.error('Get my parcels error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/land/all - Get all parcels (admin only)
router.get('/all', requireAuth, async (req, res) => {
    try {
        const roles = req.userRoles;
        // Only government officials and admins can view all parcels
        if (!roles.includes('GOVERNMENT_OFFICIAL') && !roles.includes('ADMIN')) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        const parcels = await prisma.landParcel.findMany({
            include: {
                owner: {
                    select: { id: true, name: true, email: true, walletAddress: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(parcels);
    }
    catch (error) {
        logger_1.logger.error('Get all parcels error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/land/register
router.post('/register', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const roles = req.userRoles;
        // Only government officials and admins can register parcels
        if (!roles.includes('GOVERNMENT_OFFICIAL') && !roles.includes('ADMIN')) {
            return res.status(403).json({ error: 'Not authorized to register parcels' });
        }
        const data = registerParcelSchema.parse(req.body);
        // Check if survey number already exists
        const existing = await prisma.landParcel.findUnique({
            where: { surveyNumber: data.surveyNumber },
        });
        if (existing) {
            return res.status(400).json({ error: 'Survey number already registered' });
        }
        // Find owner by wallet
        let owner = await prisma.user.findUnique({
            where: { walletAddress: data.ownerWallet.toLowerCase() },
        });
        if (!owner) {
            // Create new user for owner
            try {
                owner = await prisma.user.create({
                    data: {
                        walletAddress: data.ownerWallet.toLowerCase(),
                        roles: ['LAND_OWNER'],
                    },
                });
            }
            catch (error) {
                // Handle unique constraint violation
                if (error.code === 'P2002') {
                    return res.status(400).json({
                        error: 'Wallet address already registered',
                        message: 'This wallet address is already associated with another account.'
                    });
                }
                throw error;
            }
        }
        // Generate unique parcel ID
        const parcelId = `${data.state.substring(0, 2).toUpperCase()}-${data.district.substring(0, 2).toUpperCase()}-${Date.now()}`;
        // Upload boundary to IPFS
        const boundaryHash = await ipfsService.uploadBoundaries(JSON.parse(data.boundaryGeoJSON), parcelId);
        // Register on blockchain
        const txHash = await blockchainService.registerParcel(parcelId, owner.walletAddress, data.areaSqM, data.surveyNumber, data.village, data.district, data.state, boundaryHash, data.documentsHash || '');
        // Create parcel in database
        const parcel = await prisma.landParcel.create({
            data: {
                parcelId,
                ownerId: owner.id,
                surveyNumber: data.surveyNumber,
                areaSqM: data.areaSqM,
                village: data.village,
                district: data.district,
                state: data.state,
                latitude: data.latitude,
                longitude: data.longitude,
                boundaryHash,
                ipfsDocHash: data.documentsHash,
                blockchainTxHash: txHash,
                status: client_1.ParcelStatus.ACTIVE,
            },
            include: { owner: true },
        });
        // Create owner history entry
        await prisma.parcelOwnerHistory.create({
            data: {
                parcelId: parcel.id,
                ownerWallet: owner.walletAddress,
                fromDate: new Date(),
                txHash,
            },
        });
        // Create audit log
        await prisma.auditLog.create({
            data: {
                parcelId: parcel.id,
                userId: user.id,
                action: 'REGISTERED',
                details: `Parcel ${parcelId} registered with survey number ${data.surveyNumber}`,
                txHash,
            },
        });
        logger_1.logger.info(`Parcel registered: ${parcelId}`);
        res.status(201).json({ parcel, txHash });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        logger_1.logger.error('Register parcel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// PUT /api/land/:parcelId - Update parcel (admin only)
router.put('/:parcelId', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const roles = req.userRoles;
        const { parcelId } = req.params;
        // Only government officials and admins can update parcels
        if (!roles.includes('GOVERNMENT_OFFICIAL') && !roles.includes('ADMIN')) {
            return res.status(403).json({ error: 'Not authorized to update parcels' });
        }
        const existingParcel = await prisma.landParcel.findUnique({
            where: { parcelId },
        });
        if (!existingParcel) {
            return res.status(404).json({ error: 'Parcel not found' });
        }
        const { surveyNumber, areaSqM, village, district, state, status, registrationStatus } = req.body;
        const updatedParcel = await prisma.landParcel.update({
            where: { parcelId },
            data: {
                ...(surveyNumber && { surveyNumber }),
                ...(areaSqM && { areaSqM }),
                ...(village && { village }),
                ...(district && { district }),
                ...(state && { state }),
                ...(status && { status }),
                ...(registrationStatus && { registrationStatus }),
            },
            include: { owner: true },
        });
        // Create audit log
        await prisma.auditLog.create({
            data: {
                parcelId: existingParcel.id,
                userId: user.id,
                action: 'UPDATED',
                details: `Parcel ${parcelId} updated by admin`,
            },
        });
        logger_1.logger.info(`Parcel updated: ${parcelId} by ${user.email}`);
        res.json(updatedParcel);
    }
    catch (error) {
        logger_1.logger.error('Update parcel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/land/transfer
router.post('/transfer', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const { parcelId, buyerWallet, amount } = req.body;
        const parcel = await prisma.landParcel.findUnique({
            where: { parcelId },
            include: { owner: true },
        });
        if (!parcel) {
            return res.status(404).json({ error: 'Parcel not found' });
        }
        if (!parcel.isForSale) {
            return res.status(400).json({ error: 'Parcel is not for sale' });
        }
        // Find buyer
        let buyer = await prisma.user.findUnique({
            where: { walletAddress: buyerWallet.toLowerCase() },
        });
        if (!buyer) {
            try {
                buyer = await prisma.user.create({
                    data: {
                        walletAddress: buyerWallet.toLowerCase(),
                        roles: ['BUYER'],
                    },
                });
            }
            catch (error) {
                // Handle unique constraint violation
                if (error.code === 'P2002') {
                    return res.status(400).json({
                        error: 'Wallet address already registered',
                        message: 'This wallet address is already associated with another account.'
                    });
                }
                throw error;
            }
        }
        // Create escrow on blockchain
        const escrowId = await blockchainService.createEscrow(parcelId, parcel.owner.walletAddress, amount);
        // Create transaction record
        const transaction = await prisma.transaction.create({
            data: {
                escrowId,
                parcelId: parcel.id,
                sellerId: parcel.owner.id,
                buyerId: buyer.id,
                amount,
                status: 'PENDING',
                deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
            include: { parcel: true, seller: true, buyer: true },
        });
        // Create audit log
        await prisma.auditLog.create({
            data: {
                parcelId: parcel.id,
                userId: user.id,
                action: 'TRANSFER_INITIATED',
                details: `Transfer initiated to ${buyerWallet} for ${amount} wei`,
            },
        });
        logger_1.logger.info(`Transfer initiated for parcel: ${parcelId}`);
        res.status(201).json({ transaction, escrowId });
    }
    catch (error) {
        logger_1.logger.error('Transfer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/land/search
router.get('/search', async (req, res) => {
    try {
        const { query, district, village, status, isForSale, minArea, maxArea, page = '1', limit = '20', } = req.query;
        const where = {};
        if (query) {
            where.OR = [
                { surveyNumber: { contains: query, mode: 'insensitive' } },
                { village: { contains: query, mode: 'insensitive' } },
                { district: { contains: query, mode: 'insensitive' } },
                { parcelId: { contains: query, mode: 'insensitive' } },
            ];
        }
        if (district)
            where.district = { equals: district, mode: 'insensitive' };
        if (village)
            where.village = { equals: village, mode: 'insensitive' };
        if (status)
            where.status = status;
        if (isForSale !== undefined)
            where.isForSale = isForSale === 'true';
        if (minArea || maxArea) {
            where.areaSqM = {};
            if (minArea)
                where.areaSqM.gte = parseFloat(minArea);
            if (maxArea)
                where.areaSqM.lte = parseFloat(maxArea);
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        const [parcels, total] = await Promise.all([
            prisma.landParcel.findMany({
                where,
                include: {
                    owner: { select: { walletAddress: true, name: true } },
                },
                skip,
                take,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.landParcel.count({ where }),
        ]);
        res.json({
            parcels,
            pagination: {
                total,
                page: parseInt(page),
                pageSize: take,
                totalPages: Math.ceil(total / take),
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// PUT /api/land/:parcelId/list
router.put('/:parcelId/list', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const { parcelId } = req.params;
        const { price } = req.body;
        const parcel = await prisma.landParcel.findUnique({
            where: { parcelId },
        });
        if (!parcel) {
            return res.status(404).json({ error: 'Parcel not found' });
        }
        if (parcel.ownerId !== user.id) {
            return res.status(403).json({ error: 'Not the owner of this parcel' });
        }
        if (parcel.status === client_1.ParcelStatus.DISPUTED) {
            return res.status(400).json({ error: 'Cannot list disputed parcel' });
        }
        // List on blockchain
        await blockchainService.listParcelForSale(parcelId, price);
        const updated = await prisma.landParcel.update({
            where: { parcelId },
            data: {
                isForSale: true,
                price,
            },
        });
        await prisma.auditLog.create({
            data: {
                parcelId: parcel.id,
                userId: user.id,
                action: 'LISTED_FOR_SALE',
                details: `Listed for ${price} wei`,
            },
        });
        res.json(updated);
    }
    catch (error) {
        logger_1.logger.error('List parcel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// PUT /api/land/:parcelId/unlist
router.put('/:parcelId/unlist', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const { parcelId } = req.params;
        const parcel = await prisma.landParcel.findUnique({
            where: { parcelId },
        });
        if (!parcel) {
            return res.status(404).json({ error: 'Parcel not found' });
        }
        if (parcel.ownerId !== user.id) {
            return res.status(403).json({ error: 'Not the owner of this parcel' });
        }
        const updated = await prisma.landParcel.update({
            where: { parcelId },
            data: {
                isForSale: false,
                price: null,
            },
        });
        await prisma.auditLog.create({
            data: {
                parcelId: parcel.id,
                userId: user.id,
                action: 'UNLISTED',
                details: 'Removed from sale',
            },
        });
        res.json(updated);
    }
    catch (error) {
        logger_1.logger.error('Unlist parcel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/land/self-register - Owner self-registers their land (pending approval)
router.post('/self-register', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const { surveyNumber, areaSqM, village, district, state, boundaryGeoJSON, documentIds, latitude, longitude } = req.body;
        if (!surveyNumber || !areaSqM || !village || !district || !state) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Check if survey number already exists
        const existing = await prisma.landParcel.findUnique({
            where: { surveyNumber },
        });
        if (existing) {
            return res.status(400).json({ error: 'Survey number already registered or pending approval' });
        }
        // Generate temporary parcel ID
        const parcelId = `PENDING-${state.substring(0, 2).toUpperCase()}-${district.substring(0, 2).toUpperCase()}-${Date.now()}`;
        // Upload boundary to IPFS if provided
        let boundaryHash = '';
        if (boundaryGeoJSON) {
            try {
                boundaryHash = await ipfsService.uploadBoundaries(JSON.parse(boundaryGeoJSON), parcelId);
            }
            catch (e) {
                logger_1.logger.warn('Boundary upload failed, continuing without it');
            }
        }
        // Create parcel with PENDING_REVIEW status
        const parcel = await prisma.landParcel.create({
            data: {
                parcelId,
                ownerId: user.id,
                surveyNumber,
                areaSqM: parseFloat(areaSqM),
                village,
                district,
                state,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                boundaryHash,
                status: 'ACTIVE',
                registrationStatus: 'PENDING_REVIEW',
                submittedById: user.id,
                submittedAt: new Date(),
            },
            include: {
                owner: {
                    select: { id: true, name: true, email: true, walletAddress: true },
                },
            },
        });
        // Link documents to parcel if provided
        if (documentIds && Array.isArray(documentIds)) {
            await prisma.document.updateMany({
                where: {
                    id: { in: documentIds },
                    uploaderId: user.id,
                },
                data: {
                    parcelId: parcel.id,
                },
            });
        }
        // Create audit log
        await prisma.auditLog.create({
            data: {
                parcelId: parcel.id,
                userId: user.id,
                action: 'SUBMITTED_FOR_REVIEW',
                details: `Self-registration submitted for survey number ${surveyNumber}`,
            },
        });
        logger_1.logger.info(`Self-registration submitted: ${parcelId} by user ${user.id}`);
        res.status(201).json({
            success: true,
            parcel,
            message: 'Registration submitted successfully. Awaiting admin approval.',
        });
    }
    catch (error) {
        logger_1.logger.error('Self-register error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
// GET /api/land/pending-approvals - Get pending registrations (admin only)
router.get('/pending-approvals', requireAuth, async (req, res) => {
    try {
        const roles = req.userRoles;
        if (!roles.includes('GOVERNMENT_OFFICIAL') && !roles.includes('ADMIN')) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        const pendingParcels = await prisma.landParcel.findMany({
            where: {
                registrationStatus: { in: ['PENDING_REVIEW', 'UNDER_REVIEW'] },
            },
            include: {
                owner: {
                    select: { id: true, name: true, email: true, walletAddress: true, kycStatus: true },
                },
                submittedBy: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: { submittedAt: 'desc' },
        });
        res.json(pendingParcels);
    }
    catch (error) {
        logger_1.logger.error('Get pending approvals error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/land/approve/:parcelId - Approve a pending registration (admin only)
router.post('/approve/:parcelId', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const roles = req.userRoles;
        const { parcelId } = req.params;
        if (!roles.includes('GOVERNMENT_OFFICIAL') && !roles.includes('ADMIN')) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        const parcel = await prisma.landParcel.findUnique({
            where: { parcelId },
            include: { owner: true },
        });
        if (!parcel) {
            return res.status(404).json({ error: 'Parcel not found' });
        }
        if (parcel.registrationStatus !== 'PENDING_REVIEW' && parcel.registrationStatus !== 'UNDER_REVIEW') {
            return res.status(400).json({ error: 'Parcel is not pending approval' });
        }
        // Generate final parcel ID
        const finalParcelId = `${parcel.state.substring(0, 2).toUpperCase()}-${parcel.district.substring(0, 2).toUpperCase()}-${Date.now()}`;
        // Register on blockchain
        const txHash = await blockchainService.registerParcel(finalParcelId, parcel.owner.walletAddress, Number(parcel.areaSqM), parcel.surveyNumber, parcel.village, parcel.district, parcel.state, parcel.boundaryHash || '', parcel.ipfsDocHash || '');
        const simulated = String(txHash).toLowerCase().startsWith('0xdeadbeef');
        // Update parcel with approval
        const updated = await prisma.landParcel.update({
            where: { parcelId },
            data: {
                parcelId: finalParcelId,
                registrationStatus: 'APPROVED',
                approvedById: user.id,
                reviewedAt: new Date(),
                blockchainTxHash: txHash,
            },
            include: {
                owner: true,
                approvedBy: {
                    select: { name: true, email: true },
                },
            },
        });
        // Create owner history
        await prisma.parcelOwnerHistory.create({
            data: {
                parcelId: updated.id,
                ownerWallet: parcel.owner.walletAddress,
                fromDate: new Date(),
                txHash,
            },
        });
        // Create audit log
        await prisma.auditLog.create({
            data: {
                parcelId: updated.id,
                userId: user.id,
                action: 'APPROVED',
                details: `Registration approved and registered on blockchain. New parcel ID: ${finalParcelId}`,
                txHash,
            },
        });
        logger_1.logger.info(`Parcel approved: ${finalParcelId} by admin ${user.id}`);
        res.json({
            success: true,
            parcel: updated,
            txHash,
            simulated,
            message: simulated
                ? 'Registration approved (blockchain simulated - RPC unavailable/misconfigured)'
                : 'Registration approved and registered on blockchain',
        });
    }
    catch (error) {
        logger_1.logger.error('Approve parcel error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
// POST /api/land/reject/:parcelId - Reject a pending registration (admin only)
router.post('/reject/:parcelId', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const roles = req.userRoles;
        const { parcelId } = req.params;
        const { reason } = req.body;
        if (!roles.includes('GOVERNMENT_OFFICIAL') && !roles.includes('ADMIN')) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        if (!reason) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }
        const parcel = await prisma.landParcel.findUnique({
            where: { parcelId },
        });
        if (!parcel) {
            return res.status(404).json({ error: 'Parcel not found' });
        }
        if (parcel.registrationStatus !== 'PENDING_REVIEW' && parcel.registrationStatus !== 'UNDER_REVIEW') {
            return res.status(400).json({ error: 'Parcel is not pending approval' });
        }
        // Update parcel with rejection
        const updated = await prisma.landParcel.update({
            where: { parcelId },
            data: {
                registrationStatus: 'REJECTED',
                approvedById: user.id,
                reviewedAt: new Date(),
                rejectionReason: reason,
            },
            include: {
                owner: true,
                approvedBy: {
                    select: { name: true, email: true },
                },
            },
        });
        // Create audit log
        await prisma.auditLog.create({
            data: {
                parcelId: updated.id,
                userId: user.id,
                action: 'REJECTED',
                details: `Registration rejected: ${reason}`,
            },
        });
        logger_1.logger.info(`Parcel rejected: ${parcelId} by admin ${user.id}`);
        res.json({
            success: true,
            parcel: updated,
            message: 'Registration rejected',
        });
    }
    catch (error) {
        logger_1.logger.error('Reject parcel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/land/:parcelId - MUST BE LAST to avoid catching specific routes
router.get('/:parcelId', async (req, res) => {
    try {
        const { parcelId } = req.params;
        const parcel = await prisma.landParcel.findUnique({
            where: { parcelId },
            include: {
                owner: {
                    select: { id: true, walletAddress: true, name: true, kycStatus: true },
                },
                transactions: {
                    include: {
                        seller: { select: { walletAddress: true, name: true } },
                        buyer: { select: { walletAddress: true, name: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                disputes: {
                    orderBy: { createdAt: 'desc' },
                },
                previousOwners: {
                    orderBy: { fromDate: 'desc' },
                },
            },
        });
        if (!parcel) {
            return res.status(404).json({ error: 'Parcel not found' });
        }
        // Get audit trail
        const auditTrail = await prisma.auditLog.findMany({
            where: { parcelId: parcel.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json({
            parcel,
            history: auditTrail,
        });
    }
    catch (error) {
        logger_1.logger.error('Get parcel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=land.js.map