import { Router, Request, Response } from 'express';
import { PrismaClient, UserRole, KYCStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { verifyWalletSignature, shouldSkipSignatureVerification } from '../utils/signature';

const router = Router();
const prisma = new PrismaClient();

const expiresInJwt = (value: string | undefined, fallback: jwt.SignOptions['expiresIn']) => {
  return (value ?? fallback) as jwt.SignOptions['expiresIn'];
};

// Validation schemas
const registerSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
  role: z.enum(['LAND_OWNER', 'BUYER', 'GOVERNMENT_OFFICIAL', 'SURVEYOR', 'NOTARY']),
  signature: z.string(),
});

const loginSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string(),
  twoFactorCode: z.string().optional(),
});

// Email-based auth schemas (for government portal)
const emailRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  phone: z.string().min(10),
  aadhaarNumber: z.string().length(12).regex(/^\d+$/),
});

const emailLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const kycSchema = z.object({
  documentType: z.enum(['aadhaar', 'pan', 'dl']),
  documentHash: z.string(),
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { walletAddress: data.walletAddress.toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: 'Wallet address already registered',
        message: 'This MetaMask wallet address is already associated with another account. Each wallet can only be used for one TerraLedger account.'
      });
    }

    // Verify wallet signature (skipped in development mode)
    if (!shouldSkipSignatureVerification()) {
      const isValid = await verifyWalletSignature(data.walletAddress, data.signature);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature. Please sign the message with your wallet.' });
      }
    }

    try {
      const user = await prisma.user.create({
        data: {
          walletAddress: data.walletAddress.toLowerCase(),
          email: data.email,
          phone: data.phone,
          name: data.name,
          roles: [data.role as UserRole],
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

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      logger.info(`User registered: ${user.walletAddress}`);

      res.status(201).json({
        token,
        refreshToken,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          email: user.email,
          name: user.name,
          roles: user.roles,
          kycStatus: user.kycStatus,
        },
      });
    } catch (dbError: any) {
      // Handle unique constraint violation (race condition)
      if (dbError.code === 'P2002') {
        return res.status(400).json({ 
          error: 'Wallet address already registered',
          message: 'This MetaMask wallet address is already associated with another account. Each wallet can only be used for one TerraLedger account.'
        });
      }
      throw dbError;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { walletAddress: data.walletAddress.toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    // Verify wallet signature (skipped in development mode)
    if (!shouldSkipSignatureVerification()) {
      const isValid = await verifyWalletSignature(data.walletAddress, data.signature);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature. Please sign the message with your wallet.' });
      }
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!data.twoFactorCode) {
        return res.status(200).json({ requires2FA: true });
      }

      const isValid = authenticator.verify({
        token: data.twoFactorCode,
        secret: user.twoFactorSecret!,
      });

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid 2FA code' });
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

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info(`User logged in: ${user.walletAddress}`);

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        email: user.email,
        name: user.name,
        roles: user.roles,
        kycStatus: user.kycStatus,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string };

    // Check if token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Delete old refresh token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Generate new tokens
    const newToken = jwt.sign(
      { userId: storedToken.user.id, roles: storedToken.user.roles },
      process.env.JWT_SECRET!,
      { expiresIn: expiresInJwt(process.env.JWT_EXPIRES_IN, '1h') }
    );

    const newRefreshToken = jwt.sign(
      { userId: storedToken.user.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: expiresInJwt(process.env.JWT_REFRESH_EXPIRES_IN, '7d') }
    );

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: storedToken.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/kyc
router.post('/kyc', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const data = kycSchema.parse(req.body);

    // Update user with KYC document hash
    const updateData: any = {};
    if (data.documentType === 'aadhaar') {
      updateData.aadhaarHash = data.documentHash;
    } else if (data.documentType === 'pan') {
      updateData.panHash = data.documentHash;
    }

    const user = await prisma.user.update({
      where: { id: decoded.userId },
      data: updateData,
    });

    logger.info(`KYC document submitted: ${user.walletAddress}, type: ${data.documentType}`);

    res.json({
      message: 'KYC document submitted',
      kycStatus: user.kycStatus,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('KYC submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/2fa/setup
router.post('/2fa/setup', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      user.walletAddress,
      process.env.TOTP_ISSUER || 'TerraLedger',
      secret
    );
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret },
    });

    res.json({ secret, qrCode });
  } catch (error) {
    logger.error('2FA setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/2fa/verify
router.post('/2fa/verify', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Verification code required' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: '2FA not set up' });
    }

    const isValid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });

    logger.info(`2FA enabled for user: ${user.walletAddress}`);

    res.json({ success: true, message: '2FA enabled successfully' });
  } catch (error) {
    logger.error('2FA verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// EMAIL/PASSWORD AUTH ROUTES (for government portal)
// ============================================================

// POST /api/auth/email/register - Email-based registration
router.post('/email/register', async (req: Request, res: Response) => {
  try {
    const data = emailRegisterSchema.parse(req.body);

    // Check if user with email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Generate a placeholder wallet address for email-based users
    const placeholderWallet = `0x${Buffer.from(data.email).toString('hex').padStart(40, '0').slice(0, 40)}`;

    // In demo/dev mode, auto-activate accounts. In production, set isActive: false
    const isDevMode = process.env.NODE_ENV !== 'production';

    // Create user
    try {
      const user = await prisma.user.create({
        data: {
          walletAddress: placeholderWallet,
          email: data.email,
          phone: data.phone,
          name: data.name,
          passwordHash: passwordHash,
          aadhaarHash: await bcrypt.hash(data.aadhaarNumber, 10), // Store hashed Aadhaar
          roles: [UserRole.LAND_OWNER],
          kycStatus: isDevMode ? KYCStatus.VERIFIED : KYCStatus.PENDING,
          isActive: isDevMode, // Auto-activate in dev mode
        },
      });

      logger.info(`Email registration submitted: ${data.email} (active: ${isDevMode})`);

      res.status(201).json({
        message: isDevMode 
          ? 'Registration successful. You can now sign in.'
          : 'Registration submitted. Your account will be activated after verification.',
        userId: user.id,
      });
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === 'P2002') {
        return res.status(400).json({ 
          error: 'Account registration failed',
          message: 'This email or phone number is already registered with another account.'
        });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Email registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/email/login - Email-based login
router.post('/email/login', async (req: Request, res: Response) => {
  try {
    const data = emailLoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account pending verification. Please wait for approval.' });
    }

    const passwordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const accessToken = jwt.sign(
      { userId: user.id, roles: user.roles },
      process.env.JWT_SECRET!,
      { expiresIn: expiresInJwt(process.env.JWT_EXPIRES_IN, '1h') }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: expiresInJwt(process.env.JWT_REFRESH_EXPIRES_IN, '7d') }
    );

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info(`Email login successful: ${data.email}`);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
        kycStatus: user.kycStatus,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Email login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as authRouter };
