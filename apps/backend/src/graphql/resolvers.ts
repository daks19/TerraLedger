import { PrismaClient, UserRole, KYCStatus, ParcelStatus, TransactionStatus, DisputeStatus, InheritancePlanStatus } from '@prisma/client';
import { GraphQLError } from 'graphql';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { Context } from '../middleware/auth';
import { BlockchainService } from '../services/blockchain';
import { IPFSService } from '../services/ipfs';
import { verifyWalletSignature, shouldSkipSignatureVerification } from '../utils/signature';

const expiresInJwt = (value: string | undefined, fallback: jwt.SignOptions['expiresIn']) => {
  return (value ?? fallback) as jwt.SignOptions['expiresIn'];
};

// Helper to check authentication
const requireAuth = (context: Context) => {
  if (!context.user) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
};

// Helper to check role
const requireRole = (context: Context, roles: UserRole[]) => {
  const user = requireAuth(context);
  if (!user.roles.some((role: string) => roles.includes(role as UserRole))) {
    throw new GraphQLError('Not authorized', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return user;
};

export const resolvers = {
  Query: {
    // User queries
    me: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);
      return context.prisma.user.findUnique({
        where: { id: user.id },
        include: { ownedParcels: true },
      });
    },

    user: async (_: any, { id }: { id: string }, context: Context) => {
      requireRole(context, [UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL]);
      return context.prisma.user.findUnique({
        where: { id },
        include: { ownedParcels: true },
      });
    },

    userByWallet: async (_: any, { walletAddress }: { walletAddress: string }, context: Context) => {
      return context.prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
      });
    },

    users: async (_: any, args: { role?: UserRole; kycStatus?: KYCStatus; limit?: number; offset?: number }, context: Context) => {
      requireRole(context, [UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL]);
      return context.prisma.user.findMany({
        where: {
          ...(args.role && { roles: { has: args.role } }),
          ...(args.kycStatus && { kycStatus: args.kycStatus }),
        },
        take: args.limit || 20,
        skip: args.offset || 0,
        orderBy: { createdAt: 'desc' },
      });
    },

    // Parcel queries
    parcel: async (_: any, { id }: { id: string }, context: Context) => {
      return context.prisma.landParcel.findUnique({
        where: { id },
        include: {
          owner: true,
          transactions: { include: { seller: true, buyer: true } },
          disputes: true,
          previousOwners: true,
        },
      });
    },

    parcelByParcelId: async (_: any, { parcelId }: { parcelId: string }, context: Context) => {
      return context.prisma.landParcel.findUnique({
        where: { parcelId },
        include: {
          owner: true,
          transactions: true,
          disputes: true,
        },
      });
    },

    parcelBySurveyNumber: async (_: any, { surveyNumber }: { surveyNumber: string }, context: Context) => {
      return context.prisma.landParcel.findUnique({
        where: { surveyNumber },
        include: { owner: true },
      });
    },

    parcels: async (_: any, args: { filter?: any; limit?: number; offset?: number }, context: Context) => {
      const where: any = {};
      
      if (args.filter) {
        if (args.filter.district) where.district = args.filter.district;
        if (args.filter.village) where.village = args.filter.village;
        if (args.filter.status) where.status = args.filter.status;
        if (args.filter.isForSale !== undefined) where.isForSale = args.filter.isForSale;
        if (args.filter.minArea || args.filter.maxArea) {
          where.areaSqM = {};
          if (args.filter.minArea) where.areaSqM.gte = args.filter.minArea;
          if (args.filter.maxArea) where.areaSqM.lte = args.filter.maxArea;
        }
      }

      const [parcels, total] = await Promise.all([
        context.prisma.landParcel.findMany({
          where,
          include: { owner: true },
          take: args.limit || 20,
          skip: args.offset || 0,
          orderBy: { createdAt: 'desc' },
        }),
        context.prisma.landParcel.count({ where }),
      ]);

      return {
        parcels,
        total,
        page: Math.floor((args.offset || 0) / (args.limit || 20)) + 1,
        pageSize: args.limit || 20,
      };
    },

    searchParcels: async (_: any, { query, limit }: { query: string; limit?: number }, context: Context) => {
      return context.prisma.landParcel.findMany({
        where: {
          OR: [
            { surveyNumber: { contains: query, mode: 'insensitive' } },
            { village: { contains: query, mode: 'insensitive' } },
            { district: { contains: query, mode: 'insensitive' } },
            { parcelId: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: { owner: true },
        take: limit || 10,
      });
    },

    myParcels: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);
      return context.prisma.landParcel.findMany({
        where: { ownerId: user.id },
        include: { transactions: true, disputes: true },
        orderBy: { createdAt: 'desc' },
      });
    },

    parcelHistory: async (_: any, { parcelId }: { parcelId: string }, context: Context) => {
      return context.prisma.auditLog.findMany({
        where: { parcel: { parcelId } },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });
    },

    // Transaction queries
    transaction: async (_: any, { id }: { id: string }, context: Context) => {
      return context.prisma.transaction.findUnique({
        where: { id },
        include: { parcel: true, seller: true, buyer: true },
      });
    },

    transactions: async (_: any, args: { filter?: any; limit?: number; offset?: number }, context: Context) => {
      requireRole(context, [UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL]);
      
      const where: any = {};
      if (args.filter) {
        if (args.filter.status) where.status = args.filter.status;
        if (args.filter.parcelId) where.parcel = { parcelId: args.filter.parcelId };
      }

      return context.prisma.transaction.findMany({
        where,
        include: { parcel: true, seller: true, buyer: true },
        take: args.limit || 20,
        skip: args.offset || 0,
        orderBy: { createdAt: 'desc' },
      });
    },

    myTransactions: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);
      return context.prisma.transaction.findMany({
        where: {
          OR: [{ sellerId: user.id }, { buyerId: user.id }],
        },
        include: { parcel: true, seller: true, buyer: true },
        orderBy: { createdAt: 'desc' },
      });
    },

    // Dispute queries
    dispute: async (_: any, { id }: { id: string }, context: Context) => {
      return context.prisma.dispute.findUnique({
        where: { id },
        include: { parcel: true, filer: true, surveyReport: { include: { surveyor: true } } },
      });
    },

    disputes: async (_: any, args: { status?: DisputeStatus; limit?: number; offset?: number }, context: Context) => {
      return context.prisma.dispute.findMany({
        where: args.status ? { status: args.status } : undefined,
        include: { parcel: true, filer: true },
        take: args.limit || 20,
        skip: args.offset || 0,
        orderBy: { createdAt: 'desc' },
      });
    },

    parcelDisputes: async (_: any, { parcelId }: { parcelId: string }, context: Context) => {
      return context.prisma.dispute.findMany({
        where: { parcel: { parcelId } },
        include: { filer: true, surveyReport: true },
        orderBy: { createdAt: 'desc' },
      });
    },

    // Inheritance queries
    inheritancePlan: async (_: any, { id }: { id: string }, context: Context) => {
      return context.prisma.inheritancePlan.findUnique({
        where: { id },
        include: {
          owner: true,
          heirs: { include: { user: true } },
          milestones: true,
        },
      });
    },

    myInheritancePlan: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);
      return context.prisma.inheritancePlan.findFirst({
        where: { ownerId: user.id },
        include: {
          heirs: { include: { user: true } },
          milestones: true,
        },
      });
    },

    inheritancePlansAsHeir: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);
      return context.prisma.inheritancePlan.findMany({
        where: {
          heirs: { some: { userId: user.id } },
        },
        include: {
          owner: true,
          heirs: { include: { user: true } },
          milestones: true,
        },
      });
    },

    // Dashboard stats
    dashboardStats: async (_: any, __: any, context: Context) => {
      requireRole(context, [UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL]);

      const [
        totalParcels,
        activeParcels,
        disputedParcels,
        totalTransactions,
        pendingTransactions,
        completedTransactions,
        totalUsers,
        verifiedUsers,
      ] = await Promise.all([
        context.prisma.landParcel.count(),
        context.prisma.landParcel.count({ where: { status: ParcelStatus.ACTIVE } }),
        context.prisma.landParcel.count({ where: { status: ParcelStatus.DISPUTED } }),
        context.prisma.transaction.count(),
        context.prisma.transaction.count({ where: { status: TransactionStatus.PENDING } }),
        context.prisma.transaction.count({ where: { status: TransactionStatus.COMPLETED } }),
        context.prisma.user.count(),
        context.prisma.user.count({ where: { kycStatus: KYCStatus.VERIFIED } }),
      ]);

      return {
        totalParcels,
        activeParcels,
        disputedParcels,
        totalTransactions,
        pendingTransactions,
        completedTransactions,
        totalUsers,
        verifiedUsers,
      };
    },
  },

  Mutation: {
    // Auth mutations
    register: async (_: any, { input }: any, context: Context) => {
      const existingUser = await context.prisma.user.findUnique({
        where: { walletAddress: input.walletAddress.toLowerCase() },
      });

      if (existingUser) {
        throw new GraphQLError('Wallet address already registered. This MetaMask wallet is already associated with another account. Each wallet can only be used for one TerraLedger account.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Verify wallet signature (skipped in development mode)
      if (!shouldSkipSignatureVerification()) {
        const isValid = await verifyWalletSignature(input.walletAddress, input.signature);
        if (!isValid) {
          throw new GraphQLError('Invalid signature. Please sign the message with your wallet.', {
            extensions: { code: 'UNAUTHORIZED' },
          });
        }
      }

      const user = await context.prisma.user.create({
        data: {
          walletAddress: input.walletAddress.toLowerCase(),
          email: input.email,
          phone: input.phone,
          name: input.name,
          roles: [input.role],
          kycStatus: KYCStatus.PENDING,
        },
      });

      const token = jwt.sign(
        { userId: user.id, roles: user.roles },
        process.env.JWT_SECRET!,
        { expiresIn: expiresInJwt(process.env.JWT_EXPIRES_IN, '1h') }
      );

      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: expiresInJwt(process.env.JWT_REFRESH_EXPIRES_IN, '7d') }
      );

      await context.prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return { token, refreshToken, user };
    },

    login: async (_: any, { walletAddress, signature }: any, context: Context) => {
      const user = await context.prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
      });

      if (!user) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (!user.isActive) {
        throw new GraphQLError('Account deactivated', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify wallet signature (skipped in development mode)
      if (!shouldSkipSignatureVerification()) {
        const isValid = await verifyWalletSignature(walletAddress, signature);
        if (!isValid) {
          throw new GraphQLError('Invalid signature. Please sign the message with your wallet.', {
            extensions: { code: 'UNAUTHORIZED' },
          });
        }
      }

      const token = jwt.sign(
        { userId: user.id, roles: user.roles },
        process.env.JWT_SECRET!,
        { expiresIn: expiresInJwt(process.env.JWT_EXPIRES_IN, '1h') }
      );

      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: expiresInJwt(process.env.JWT_REFRESH_EXPIRES_IN, '7d') }
      );

      await context.prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await context.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      return { token, refreshToken, user };
    },

    enable2FA: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);
      
      const secret = authenticator.generateSecret();
      const otpauthUrl = authenticator.keyuri(
        user.walletAddress,
        process.env.TOTP_ISSUER || 'TerraLedger',
        secret
      );
      const qrCode = await QRCode.toDataURL(otpauthUrl);

      await context.prisma.user.update({
        where: { id: user.id },
        data: { twoFactorSecret: secret },
      });

      return { secret, qrCode };
    },

    verify2FA: async (_: any, { code }: { code: string }, context: Context) => {
      const user = requireAuth(context);
      
      const dbUser = await context.prisma.user.findUnique({
        where: { id: user.id },
      });

      if (!dbUser?.twoFactorSecret) {
        throw new GraphQLError('2FA not set up', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      const isValid = authenticator.verify({
        token: code,
        secret: dbUser.twoFactorSecret,
      });

      if (!isValid) {
        throw new GraphQLError('Invalid 2FA code', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      await context.prisma.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: true },
      });

      return true;
    },

    // Parcel mutations
    registerParcel: async (_: any, { input }: any, context: Context) => {
      const user = requireRole(context, [UserRole.GOVERNMENT_OFFICIAL, UserRole.ADMIN]);

      // Generate unique parcel ID
      const parcelId = `${input.state.substring(0, 2).toUpperCase()}-${input.district.substring(0, 2).toUpperCase()}-${Date.now()}`;

      // Register on blockchain
      const txHash = await context.blockchainService.registerParcel(
        parcelId,
        user.walletAddress,
        input.areaSqM,
        input.surveyNumber,
        input.village,
        input.district,
        input.state,
        input.boundaryGeoJSON,
        input.documentsHash || ''
      );

      const parcel = await context.prisma.landParcel.create({
        data: {
          parcelId,
          ownerId: user.id,
          surveyNumber: input.surveyNumber,
          areaSqM: input.areaSqM,
          village: input.village,
          district: input.district,
          state: input.state,
          latitude: input.latitude,
          longitude: input.longitude,
          boundaryHash: input.boundaryGeoJSON,
          ipfsDocHash: input.documentsHash,
          blockchainTxHash: txHash,
        },
        include: { owner: true },
      });

      // Create audit log
      await context.prisma.auditLog.create({
        data: {
          parcelId: parcel.id,
          userId: user.id,
          action: 'REGISTERED',
          details: `Parcel ${parcelId} registered`,
          txHash,
        },
      });

      return parcel;
    },

    listParcelForSale: async (_: any, { parcelId, price }: any, context: Context) => {
      const user = requireAuth(context);

      const parcel = await context.prisma.landParcel.findUnique({
        where: { parcelId },
      });

      if (!parcel || parcel.ownerId !== user.id) {
        throw new GraphQLError('Parcel not found or not owned', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (parcel.status === ParcelStatus.DISPUTED) {
        throw new GraphQLError('Cannot list disputed parcel', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      // List on blockchain
      await context.blockchainService.listParcelForSale(parcelId, price);

      return context.prisma.landParcel.update({
        where: { parcelId },
        data: {
          isForSale: true,
          price,
        },
        include: { owner: true },
      });
    },

    // Transaction mutations
    createTransaction: async (_: any, { input }: any, context: Context) => {
      const user = requireAuth(context);

      const parcel = await context.prisma.landParcel.findUnique({
        where: { parcelId: input.parcelId },
        include: { owner: true },
      });

      if (!parcel) {
        throw new GraphQLError('Parcel not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (!parcel.isForSale) {
        throw new GraphQLError('Parcel not for sale', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      // Create escrow on blockchain
      const escrowId = await context.blockchainService.createEscrow(
        input.parcelId,
        parcel.owner.walletAddress,
        input.amount
      );

      return context.prisma.transaction.create({
        data: {
          escrowId,
          parcelId: parcel.id,
          sellerId: parcel.ownerId,
          buyerId: user.id,
          amount: input.amount,
          status: TransactionStatus.PENDING,
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
        include: { parcel: true, seller: true, buyer: true },
      });
    },

    approveTransaction: async (_: any, { transactionId }: { transactionId: string }, context: Context) => {
      const user = requireAuth(context);

      const transaction = await context.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { seller: true, buyer: true },
      });

      if (!transaction) {
        throw new GraphQLError('Transaction not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      let updateData: any = {};

      if (transaction.sellerId === user.id) {
        await context.blockchainService.sellerApprove(transaction.escrowId!);
        updateData.sellerApproved = true;
      } else if (transaction.buyerId === user.id) {
        updateData.buyerApproved = true;
      } else if (user.roles.includes(UserRole.GOVERNMENT_OFFICIAL)) {
        await context.blockchainService.governmentApprove(transaction.escrowId!);
        updateData.govtApproved = true;
        updateData.status = TransactionStatus.VERIFIED;
      } else {
        throw new GraphQLError('Not authorized to approve', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.prisma.transaction.update({
        where: { id: transactionId },
        data: updateData,
        include: { parcel: true, seller: true, buyer: true },
      });
    },

    // Inheritance mutations
    createInheritancePlan: async (_: any, { input }: any, context: Context) => {
      const user = requireAuth(context);

      // Verify ownership of all parcels
      const parcels = await context.prisma.landParcel.findMany({
        where: {
          parcelId: { in: input.parcelIds },
          ownerId: user.id,
        },
      });

      if (parcels.length !== input.parcelIds.length) {
        throw new GraphQLError('You do not own all specified parcels', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      // Create plan on blockchain
      const planId = await context.blockchainService.createInheritancePlan(
        input.parcelIds,
        input.useAgeMilestones || false
      );

      return context.prisma.inheritancePlan.create({
        data: {
          planId,
          ownerId: user.id,
          parcelIds: input.parcelIds,
          useAgeMilestones: input.useAgeMilestones || false,
        },
        include: { owner: true, heirs: true, milestones: true },
      });
    },

    addHeir: async (_: any, { input }: any, context: Context) => {
      const user = requireAuth(context);

      const plan = await context.prisma.inheritancePlan.findUnique({
        where: { id: input.planId },
        include: { heirs: true },
      });

      if (!plan || plan.ownerId !== user.id) {
        throw new GraphQLError('Plan not found or not owned', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Check total percentage
      const currentTotal = plan.heirs.reduce((sum: number, h: { percentage: number }) => sum + h.percentage, 0);
      if (currentTotal + input.percentage > 100) {
        throw new GraphQLError('Total percentage exceeds 100%', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      // Find or create heir user
      let heirUser = await context.prisma.user.findUnique({
        where: { walletAddress: input.walletAddress.toLowerCase() },
      });

      if (!heirUser) {
        try {
          heirUser = await context.prisma.user.create({
            data: {
              walletAddress: input.walletAddress.toLowerCase(),
              roles: [UserRole.BUYER],
            },
          });
        } catch (error: any) {
          // Handle unique constraint violation
          if (error.code === 'P2002') {
            throw new GraphQLError('Wallet address already registered. This wallet is already associated with another account.', {
              extensions: { code: 'BAD_USER_INPUT' },
            });
          }
          throw error;
        }
      }

      // Add heir on blockchain
      await context.blockchainService.addHeir(
        plan.planId!,
        input.walletAddress,
        input.percentage,
        input.releaseAge || 0,
        input.birthDate ? new Date(input.birthDate).getTime() / 1000 : 0
      );

      await context.prisma.heir.create({
        data: {
          planId: plan.id,
          userId: heirUser.id,
          walletAddress: input.walletAddress.toLowerCase(),
          percentage: input.percentage,
          releaseAge: input.releaseAge,
          birthDate: input.birthDate ? new Date(input.birthDate) : null,
        },
      });

      return context.prisma.inheritancePlan.findUnique({
        where: { id: input.planId },
        include: { owner: true, heirs: { include: { user: true } }, milestones: true },
      });
    },

    triggerInheritance: async (_: any, { planId, deathCertHash }: any, context: Context) => {
      requireRole(context, [UserRole.GOVERNMENT_OFFICIAL, UserRole.ADMIN]);

      const plan = await context.prisma.inheritancePlan.findUnique({
        where: { id: planId },
      });

      if (!plan) {
        throw new GraphQLError('Plan not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Trigger on blockchain
      await context.blockchainService.triggerInheritance(plan.planId!, deathCertHash);

      return context.prisma.inheritancePlan.update({
        where: { id: planId },
        data: {
          status: InheritancePlanStatus.TRIGGERED,
          deathCertHash,
          triggeredAt: new Date(),
        },
        include: { owner: true, heirs: { include: { user: true } }, milestones: true },
      });
    },

    // Dispute mutations
    fileDispute: async (_: any, { input }: any, context: Context) => {
      const user = requireAuth(context);

      const parcel = await context.prisma.landParcel.findUnique({
        where: { parcelId: input.parcelId },
      });

      if (!parcel) {
        throw new GraphQLError('Parcel not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // File dispute on blockchain
      const disputeId = await context.blockchainService.fileDispute(
        input.parcelId,
        input.affectedParcelIds || [],
        input.description,
        input.evidenceHash || ''
      );

      // Update parcel status
      await context.prisma.landParcel.update({
        where: { id: parcel.id },
        data: { status: ParcelStatus.DISPUTED },
      });

      return context.prisma.dispute.create({
        data: {
          disputeId,
          parcelId: parcel.id,
          filerId: user.id,
          affectedParcelIds: input.affectedParcelIds || [],
          description: input.description,
          evidenceHash: input.evidenceHash,
        },
        include: { parcel: true, filer: true },
      });
    },

    resolveDispute: async (_: any, { disputeId, resolution, details, newBoundaryHash }: any, context: Context) => {
      requireRole(context, [UserRole.GOVERNMENT_OFFICIAL, UserRole.ADMIN]);

      const dispute = await context.prisma.dispute.findUnique({
        where: { id: disputeId },
        include: { parcel: true },
      });

      if (!dispute) {
        throw new GraphQLError('Dispute not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Resolve on blockchain
      await context.blockchainService.resolveDispute(
        dispute.disputeId!,
        resolution,
        details,
        newBoundaryHash || ''
      );

      // Update parcel status
      await context.prisma.landParcel.update({
        where: { id: dispute.parcelId },
        data: { status: ParcelStatus.ACTIVE },
      });

      return context.prisma.dispute.update({
        where: { id: disputeId },
        data: {
          status: DisputeStatus.RESOLVED,
          resolutionType: resolution,
          resolutionDetails: details,
          newBoundaryHash,
          resolvedAt: new Date(),
        },
        include: { parcel: true, filer: true },
      });
    },
  },

  // Field resolvers
  User: {
    ownedParcels: async (parent: any, _: any, context: Context) => {
      return context.prisma.landParcel.findMany({
        where: { ownerId: parent.id },
      });
    },
  },

  LandParcel: {
    owner: async (parent: any, _: any, context: Context) => {
      return context.prisma.user.findUnique({
        where: { id: parent.ownerId },
      });
    },
    transactions: async (parent: any, _: any, context: Context) => {
      return context.prisma.transaction.findMany({
        where: { parcelId: parent.id },
      });
    },
  },

  Transaction: {
    parcel: async (parent: any, _: any, context: Context) => {
      return context.prisma.landParcel.findUnique({
        where: { id: parent.parcelId },
      });
    },
    seller: async (parent: any, _: any, context: Context) => {
      return context.prisma.user.findUnique({
        where: { id: parent.sellerId },
      });
    },
    buyer: async (parent: any, _: any, context: Context) => {
      return context.prisma.user.findUnique({
        where: { id: parent.buyerId },
      });
    },
  },
};
