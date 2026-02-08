"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const otplib_1 = require("otplib");
const qrcode_1 = __importDefault(require("qrcode"));
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
const signature_1 = require("../utils/signature");
const router = (0, express_1.Router)();
exports.authRouter = router;
const prisma = new client_1.PrismaClient();
const expiresInJwt = (value, fallback) => {
    return (value ?? fallback);
};
// Validation schemas
const registerSchema = zod_1.z.object({
    walletAddress: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    name: zod_1.z.string().optional(),
    role: zod_1.z.enum(['LAND_OWNER', 'BUYER', 'GOVERNMENT_OFFICIAL', 'SURVEYOR', 'NOTARY']),
    signature: zod_1.z.string(),
});
const loginSchema = zod_1.z.object({
    walletAddress: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    signature: zod_1.z.string(),
    twoFactorCode: zod_1.z.string().optional(),
});
// Email-based auth schemas (for government portal)
const emailRegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    name: zod_1.z.string().min(2),
    phone: zod_1.z.string().min(10),
    aadhaarNumber: zod_1.z.string().length(12).regex(/^\d+$/),
});
const emailLoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
const kycSchema = zod_1.z.object({
    documentType: zod_1.z.enum(['aadhaar', 'pan', 'dl']),
    documentHash: zod_1.z.string(),
});
// POST /api/auth/register
router.post('/register', async (req, res) => {
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
        if (!(0, signature_1.shouldSkipSignatureVerification)()) {
            const isValid = await (0, signature_1.verifyWalletSignature)(data.walletAddress, data.signature);
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
                    roles: [data.role],
                    kycStatus: client_1.KYCStatus.PENDING,
                },
            });
            const token = jsonwebtoken_1.default.sign({ userId: user.id, roles: user.roles }, process.env.JWT_SECRET, { expiresIn: expiresInJwt(process.env.JWT_EXPIRES_IN, '1h') });
            const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: expiresInJwt(process.env.JWT_REFRESH_EXPIRES_IN, '7d') });
            await prisma.refreshToken.create({
                data: {
                    token: refreshToken,
                    userId: user.id,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
            });
            logger_1.logger.info(`User registered: ${user.walletAddress}`);
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
        }
        catch (dbError) {
            // Handle unique constraint violation (race condition)
            if (dbError.code === 'P2002') {
                return res.status(400).json({
                    error: 'Wallet address already registered',
                    message: 'This MetaMask wallet address is already associated with another account. Each wallet can only be used for one TerraLedger account.'
                });
            }
            throw dbError;
        }
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        logger_1.logger.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/auth/login
router.post('/login', async (req, res) => {
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
        if (!(0, signature_1.shouldSkipSignatureVerification)()) {
            const isValid = await (0, signature_1.verifyWalletSignature)(data.walletAddress, data.signature);
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid signature. Please sign the message with your wallet.' });
            }
        }
        // Check 2FA if enabled
        if (user.twoFactorEnabled) {
            if (!data.twoFactorCode) {
                return res.status(200).json({ requires2FA: true });
            }
            const isValid = otplib_1.authenticator.verify({
                token: data.twoFactorCode,
                secret: user.twoFactorSecret,
            });
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid 2FA code' });
            }
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, roles: user.roles }, process.env.JWT_SECRET, { expiresIn: expiresInJwt(process.env.JWT_EXPIRES_IN, '1h') });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: expiresInJwt(process.env.JWT_REFRESH_EXPIRES_IN, '7d') });
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
        logger_1.logger.info(`User logged in: ${user.walletAddress}`);
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        logger_1.logger.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }
        // Verify refresh token
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
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
        const newToken = jsonwebtoken_1.default.sign({ userId: storedToken.user.id, roles: storedToken.user.roles }, process.env.JWT_SECRET, { expiresIn: expiresInJwt(process.env.JWT_EXPIRES_IN, '1h') });
        const newRefreshToken = jsonwebtoken_1.default.sign({ userId: storedToken.user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: expiresInJwt(process.env.JWT_REFRESH_EXPIRES_IN, '7d') });
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
    }
    catch (error) {
        logger_1.logger.error('Token refresh error:', error);
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});
// POST /api/auth/kyc
router.post('/kyc', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization required' });
        }
        const token = authHeader.replace('Bearer ', '');
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const data = kycSchema.parse(req.body);
        // Update user with KYC document hash
        const updateData = {};
        if (data.documentType === 'aadhaar') {
            updateData.aadhaarHash = data.documentHash;
        }
        else if (data.documentType === 'pan') {
            updateData.panHash = data.documentHash;
        }
        const user = await prisma.user.update({
            where: { id: decoded.userId },
            data: updateData,
        });
        logger_1.logger.info(`KYC document submitted: ${user.walletAddress}, type: ${data.documentType}`);
        res.json({
            message: 'KYC document submitted',
            kycStatus: user.kycStatus,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        logger_1.logger.error('KYC submission error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/auth/2fa/setup
router.post('/2fa/setup', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization required' });
        }
        const token = authHeader.replace('Bearer ', '');
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const secret = otplib_1.authenticator.generateSecret();
        const otpauthUrl = otplib_1.authenticator.keyuri(user.walletAddress, process.env.TOTP_ISSUER || 'TerraLedger', secret);
        const qrCode = await qrcode_1.default.toDataURL(otpauthUrl);
        await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorSecret: secret },
        });
        res.json({ secret, qrCode });
    }
    catch (error) {
        logger_1.logger.error('2FA setup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/auth/2fa/verify
router.post('/2fa/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization required' });
        }
        const token = authHeader.replace('Bearer ', '');
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Verification code required' });
        }
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || !user.twoFactorSecret) {
            return res.status(400).json({ error: '2FA not set up' });
        }
        const isValid = otplib_1.authenticator.verify({
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
        logger_1.logger.info(`2FA enabled for user: ${user.walletAddress}`);
        res.json({ success: true, message: '2FA enabled successfully' });
    }
    catch (error) {
        logger_1.logger.error('2FA verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/auth/logout
router.post('/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
        }
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ============================================================
// EMAIL/PASSWORD AUTH ROUTES (for government portal)
// ============================================================
// POST /api/auth/email/register - Email-based registration
router.post('/email/register', async (req, res) => {
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
        const passwordHash = await bcryptjs_1.default.hash(data.password, 12);
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
                    aadhaarHash: await bcryptjs_1.default.hash(data.aadhaarNumber, 10), // Store hashed Aadhaar
                    roles: [client_1.UserRole.LAND_OWNER],
                    kycStatus: isDevMode ? client_1.KYCStatus.VERIFIED : client_1.KYCStatus.PENDING,
                    isActive: isDevMode, // Auto-activate in dev mode
                },
            });
            logger_1.logger.info(`Email registration submitted: ${data.email} (active: ${isDevMode})`);
            res.status(201).json({
                message: isDevMode
                    ? 'Registration successful. You can now sign in.'
                    : 'Registration submitted. Your account will be activated after verification.',
                userId: user.id,
            });
        }
        catch (error) {
            // Handle unique constraint violation
            if (error.code === 'P2002') {
                return res.status(400).json({
                    error: 'Account registration failed',
                    message: 'This email or phone number is already registered with another account.'
                });
            }
            throw error;
        }
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        logger_1.logger.error('Email registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/auth/email/login - Email-based login
router.post('/email/login', async (req, res) => {
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
        const passwordValid = await bcryptjs_1.default.compare(data.password, user.passwordHash);
        if (!passwordValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const accessToken = jsonwebtoken_1.default.sign({ userId: user.id, roles: user.roles }, process.env.JWT_SECRET, { expiresIn: expiresInJwt(process.env.JWT_EXPIRES_IN, '1h') });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: expiresInJwt(process.env.JWT_REFRESH_EXPIRES_IN, '7d') });
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
        logger_1.logger.info(`Email login successful: ${data.email}`);
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        logger_1.logger.error('Email login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=auth.js.map