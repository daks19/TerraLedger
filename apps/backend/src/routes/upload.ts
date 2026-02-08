import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { IPFSService } from '../services/ipfs';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();
const ipfsService = new IPFSService();

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed file types
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/json',
    'application/geo+json',
  ];

  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.json', '.geojson'];

  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 5, // Max 5 files at once
  },
});

// POST /api/upload/document
router.post('/document', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = req.file;
    const { parcelId, documentType, description } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!documentType) {
      return res.status(400).json({ error: 'Missing documentType' });
    }

    // Verify parcel exists and user has permission (only if parcelId provided)
    if (parcelId) {
      const parcel = await prisma.landParcel.findUnique({
        where: { parcelId },
        include: { owner: true },
      });

      if (!parcel) {
        return res.status(404).json({ error: 'Parcel not found' });
      }

      const isOfficial =
        req.user!.roles.includes('GOVERNMENT_OFFICIAL' as any) ||
        req.user!.roles.includes('ADMIN' as any);

      if (parcel.ownerId !== req.user!.id && !isOfficial) {
        return res.status(403).json({ error: 'Not authorized to upload documents for this parcel' });
      }
    }

    // Calculate file hash
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Upload to IPFS
    const ipfsResult = await ipfsService.uploadFile(file.buffer, file.originalname);
    const ipfsHash = ipfsResult.hash;

    // Find parcel database ID if parcelId provided
    let parcelDbId = null;
    if (parcelId) {
      const parcel = await prisma.landParcel.findUnique({
        where: { parcelId },
        select: { id: true },
      });
      parcelDbId = parcel?.id || null;
    }

    // Save document record
    const document = await prisma.document.create({
      data: {
        ipfsHash,
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        type: documentType,
        parcelId: parcelDbId,
        uploaderId: req.user!.id,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'DOCUMENT_UPLOADED',
        userId: req.user!.id,
        parcelId: parcelDbId,
        details: JSON.stringify({ parcelId, documentType, fileName: file.originalname, ipfsHash, description, fileHash }),
      },
    });

    logger.info(`Document uploaded: ${ipfsHash} for ${parcelId ? `parcel ${parcelId}` : 'user registration'}`);

    res.status(201).json({
      id: document.id,
      ipfsHash,
      fileHash,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      documentType,
      url: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
    });
  } catch (error: any) {
    logger.error('Document upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload document' });
  }
});

// POST /api/upload/boundary
router.post('/boundary', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = req.file;
    const { parcelId } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!parcelId) {
      return res.status(400).json({ error: 'Missing parcelId' });
    }

    // Parse GeoJSON
    let geoJSON;
    try {
      geoJSON = JSON.parse(file.buffer.toString('utf-8'));
    } catch {
      return res.status(400).json({ error: 'Invalid JSON format' });
    }

    // Validate GeoJSON
    if (!geoJSON.type || !['Polygon', 'Feature', 'FeatureCollection'].includes(geoJSON.type)) {
      return res.status(400).json({ error: 'Invalid GeoJSON type for boundary' });
    }

    // Verify parcel exists and user has permission
    const parcel = await prisma.landParcel.findUnique({
      where: { parcelId },
    });

    if (!parcel) {
      return res.status(404).json({ error: 'Parcel not found' });
    }

    // Only surveyor, government official, or admin can upload boundaries
    const allowedRoles = ['SURVEYOR', 'GOVERNMENT_OFFICIAL', 'ADMIN'] as const;
    const hasAllowedRole = req.user!.roles.some((role: string) => (allowedRoles as readonly string[]).includes(role));
    if (!hasAllowedRole) {
      return res.status(403).json({ error: 'Only surveyors or officials can upload boundary data' });
    }

    // Upload to IPFS
    const ipfsHash = await ipfsService.uploadBoundary(parcelId, geoJSON);

    // Update parcel with boundary hash
    await prisma.landParcel.update({
      where: { parcelId },
      data: { boundaryHash: ipfsHash },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'BOUNDARY_UPLOADED',
        userId: req.user!.id,
        parcelId: parcel.id,
        details: JSON.stringify({ parcelId, ipfsHash, geoJSONType: geoJSON.type }),
      },
    });

    logger.info(`Boundary uploaded: ${ipfsHash} for parcel ${parcelId}`);

    res.json({
      success: true,
      parcelId,
      boundaryHash: ipfsHash,
      url: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
    });
  } catch (error) {
    logger.error('Boundary upload error:', error);
    res.status(500).json({ error: 'Failed to upload boundary' });
  }
});

// POST /api/upload/evidence
router.post('/evidence', authenticateToken, upload.array('files', 5), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    const { disputeId, description } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    if (!disputeId) {
      return res.status(400).json({ error: 'Missing disputeId' });
    }

    // Verify dispute exists
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    // Upload all files to IPFS
    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
        const ipfsResult = await ipfsService.uploadFile(file.buffer, file.originalname);
        const ipfsHash = ipfsResult.hash;
        
        return {
          ipfsHash,
          fileHash,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
        };
      })
    );

    // Update dispute with evidence hashes (schema has evidenceHash + additionalEvidence[])
    const newEvidenceHashes = uploadedFiles.map((f) => f.ipfsHash);
    const existingAdditional = dispute.additionalEvidence || [];
    const existingPrimary = dispute.evidenceHash;

    const nextPrimary = existingPrimary ?? newEvidenceHashes[0] ?? null;
    const nextAdditional = existingPrimary
      ? [...existingAdditional, ...newEvidenceHashes]
      : [...existingAdditional, ...newEvidenceHashes.slice(1)];
    
    await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        evidenceHash: nextPrimary,
        additionalEvidence: nextAdditional,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'EVIDENCE_UPLOADED',
        userId: req.user!.id,
        parcelId: dispute.parcelId,
        details: JSON.stringify({ disputeId, filesCount: uploadedFiles.length, ipfsHashes: newEvidenceHashes, description }),
      },
    });

    logger.info(`Evidence uploaded: ${uploadedFiles.length} files for dispute ${disputeId}`);

    res.status(201).json({
      success: true,
      disputeId,
      files: uploadedFiles.map(f => ({
        ...f,
        url: `https://gateway.pinata.cloud/ipfs/${f.ipfsHash}`,
      })),
    });
  } catch (error) {
    logger.error('Evidence upload error:', error);
    res.status(500).json({ error: 'Failed to upload evidence' });
  }
});

// POST /api/upload/kyc
router.post('/kyc', authenticateToken, upload.array('documents', 3), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    const { documentTypes } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Parse document types
    let types: string[];
    try {
      types = typeof documentTypes === 'string' ? JSON.parse(documentTypes) : documentTypes;
    } catch {
      types = ['ID_DOCUMENT'];
    }

    // Upload all files to IPFS
    const uploadedDocs = await Promise.all(
      files.map(async (file, index) => {
        const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
        const ipfsResult = await ipfsService.uploadFile(file.buffer, file.originalname);
        const ipfsHash = ipfsResult.hash;
        
        return {
          ipfsHash,
          fileHash,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          documentType: types[index] || 'ID_DOCUMENT',
        };
      })
    );

    // Store a pointer to KYC docs in metadataUri (schema does not have a kycDocuments array)
    const meta = await ipfsService.uploadJSON(
      {
        type: 'KYC_DOCUMENTS',
        uploadedAt: new Date().toISOString(),
        documents: uploadedDocs,
      },
      `kyc-${req.user!.id}-${Date.now()}`
    );

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        metadataUri: meta.hash,
        kycStatus: 'PENDING',
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'KYC_DOCUMENTS_UPLOADED',
        userId: req.user!.id,
        details: JSON.stringify({ documentsCount: uploadedDocs.length, documentTypes: uploadedDocs.map(d => d.documentType), metadataUri: meta.hash }),
      },
    });

    logger.info(`KYC documents uploaded for user ${req.user!.id}`);

    res.status(201).json({
      success: true,
      message: 'KYC documents uploaded successfully. Verification pending.',
      metadataUri: meta.hash,
      documents: uploadedDocs.map(d => ({
        documentType: d.documentType,
        fileName: d.fileName,
        ipfsHash: d.ipfsHash,
      })),
    });
  } catch (error) {
    logger.error('KYC upload error:', error);
    res.status(500).json({ error: 'Failed to upload KYC documents' });
  }
});

// GET /api/upload/document/:ipfsHash
router.get('/document/:ipfsHash', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ipfsHash } = req.params;

    // Find document record
    const document = await prisma.document.findFirst({
      where: { ipfsHash },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access permissions
    let isOwner = false;
    if (document.parcelId) {
      const parcel = await prisma.landParcel.findUnique({ where: { id: document.parcelId } });
      isOwner = parcel?.ownerId === req.user!.id;
    }

    const isUploader = document.uploaderId === req.user!.id;
    const isOfficial =
      req.user!.roles.includes('GOVERNMENT_OFFICIAL' as any) ||
      req.user!.roles.includes('ADMIN' as any);

    if (!isOwner && !isUploader && !isOfficial) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      id: document.id,
      ipfsHash: document.ipfsHash,
      fileName: document.name,
      mimeType: document.mimeType,
      fileSize: document.size,
      documentType: document.type,
      description: null,
      uploadedAt: document.createdAt,
      uploader: { id: document.uploaderId },
      url: `https://gateway.pinata.cloud/ipfs/${document.ipfsHash}`,
    });
  } catch (error) {
    logger.error('Get document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/upload/document/:documentId
router.delete('/document/:documentId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentId } = req.params;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Only uploader or admin can delete
    const isAdmin = req.user!.roles.includes('ADMIN' as any);
    if (document.uploaderId !== req.user!.id && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this document' });
    }

    // Unpin from IPFS
    await ipfsService.unpinContent(document.ipfsHash);

    // Delete record
    await prisma.document.delete({
      where: { id: documentId },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'DOCUMENT_DELETED',
        userId: req.user!.id,
        parcelId: document.parcelId,
        details: JSON.stringify({ ipfsHash: document.ipfsHash, fileName: document.name }),
      },
    });

    logger.info(`Document deleted: ${documentId}`);

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    logger.error('Delete document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/upload/parcel/:parcelId/documents
router.get('/parcel/:parcelId/documents', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { parcelId } = req.params;

    const parcel = await prisma.landParcel.findUnique({
      where: { parcelId },
    });

    if (!parcel) {
      return res.status(404).json({ error: 'Parcel not found' });
    }

    // Check access permissions
    const isOwner = parcel.ownerId === req.user!.id;
    const isOfficial =
      req.user!.roles.includes('GOVERNMENT_OFFICIAL' as any) ||
      req.user!.roles.includes('ADMIN' as any);

    if (!isOwner && !isOfficial) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const documents = await prisma.document.findMany({
      where: { parcelId: parcel.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      parcelId,
      documents: documents.map((doc: any) => ({
        id: doc.id,
        ipfsHash: doc.ipfsHash,
        fileName: doc.name,
        mimeType: doc.mimeType,
        fileSize: doc.size,
        documentType: doc.type,
        description: null,
        uploadedAt: doc.createdAt,
        uploader: { id: doc.uploaderId },
        url: `https://gateway.pinata.cloud/ipfs/${doc.ipfsHash}`,
      })),
    });
  } catch (error) {
    logger.error('Get parcel documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as uploadRouter };
