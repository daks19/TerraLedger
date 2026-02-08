/**
 * Public Read-Only API Routes
 * 
 * These endpoints are exposed to the public portal for viewing land records.
 * No authentication required - read-only access.
 * All write operations (register, transfer, update) are restricted to 
 * internal government systems only.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { BlockchainService } from '../services/blockchain';

const router = Router();
const prisma = new PrismaClient();
const blockchainService = new BlockchainService();

/**
 * GET /api/public/records/search
 * Search land records by query
 */
router.get('/records/search', async (req: Request, res: Response) => {
  try {
    const { q, type = 'all', page = 1, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const query = String(q).toLowerCase();
    const skip = (Number(page) - 1) * Number(limit);

    // Build search conditions based on type
    let whereClause: any = {
      OR: []
    };

    if (type === 'all' || type === 'survey') {
      whereClause.OR.push({
        surveyNumber: { contains: query, mode: 'insensitive' }
      });
      whereClause.OR.push({
        parcelId: { contains: query, mode: 'insensitive' }
      });
    }

    if (type === 'all' || type === 'location') {
      whereClause.OR.push({
        village: { contains: query, mode: 'insensitive' }
      });
      whereClause.OR.push({
        district: { contains: query, mode: 'insensitive' }
      });
      whereClause.OR.push({
        state: { contains: query, mode: 'insensitive' }
      });
    }

    const [records, total] = await Promise.all([
      prisma.landParcel.findMany({
        where: whereClause,
        select: {
          id: true,
          parcelId: true,
          surveyNumber: true,
          village: true,
          district: true,
          state: true,
          areaSqM: true,
          status: true,
          createdAt: true,
          owner: {
            select: {
              name: true,
            }
          }
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.landParcel.count({ where: whereClause })
    ]);

    // Transform response to hide sensitive data
    const publicRecords = records.map(r => ({
      id: r.id,
      parcelId: r.parcelId,
      surveyNumber: r.surveyNumber,
      village: r.village,
      district: r.district,
      state: r.state,
      areaSqM: r.areaSqM,
      status: r.status,
      registrationDate: r.createdAt,
      ownerName: r.owner?.name || 'Government Entity',
    }));

    res.json({
      records: publicRecords,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Public search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/public/records/:parcelId
 * Get single land record details (public view)
 */
router.get('/records/:parcelId', async (req: Request, res: Response) => {
  try {
    const { parcelId } = req.params;

    const parcel = await prisma.landParcel.findUnique({
      where: { parcelId },
      select: {
        id: true,
        parcelId: true,
        surveyNumber: true,
        village: true,
        district: true,
        state: true,
        areaSqM: true,
        status: true,
        boundaryHash: true,
        ipfsDocHash: true,
        blockchainTxHash: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            name: true,
            // Don't expose wallet address, email, or other PII
          }
        }
      }
    });

    if (!parcel) {
      return res.status(404).json({ error: 'Record not found' });
    }

    // Get audit history (public events only)
    const history = await prisma.auditLog.findMany({
      where: { 
        parcelId: parcel.id,
        action: {
          in: ['REGISTERED', 'VERIFIED', 'BOUNDARY_UPDATED', 'TRANSFER_COMPLETED']
        }
      },
      select: {
        action: true,
        details: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json({
      parcel: {
        id: parcel.id,
        parcelId: parcel.parcelId,
        surveyNumber: parcel.surveyNumber,
        village: parcel.village,
        district: parcel.district,
        state: parcel.state,
        areaSqM: parcel.areaSqM,
        status: parcel.status,
        registrationDate: parcel.createdAt,
        lastUpdated: parcel.updatedAt,
        boundaryHash: parcel.boundaryHash,
        documentHash: parcel.ipfsDocHash,
        blockchainTxHash: parcel.blockchainTxHash,
        owner: {
          name: parcel.owner?.name || 'Government Entity',
          type: 'Registered Owner'
        }
      },
      history: history.map(h => ({
        date: h.createdAt,
        event: formatEventName(h.action),
        details: h.details
      }))
    });
  } catch (error) {
    logger.error('Public record fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/public/verify
 * Verify document authenticity
 */
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const { parcelId, hash } = req.query;

    if (!parcelId && !hash) {
      return res.status(400).json({ error: 'Parcel ID or document hash is required' });
    }

    let parcel;

    if (parcelId) {
      parcel = await prisma.landParcel.findUnique({
        where: { parcelId: String(parcelId) },
        select: {
          parcelId: true,
          surveyNumber: true,
          status: true,
          boundaryHash: true,
          ipfsDocHash: true,
          blockchainTxHash: true,
          createdAt: true,
        }
      });
    } else if (hash) {
      parcel = await prisma.landParcel.findFirst({
        where: { 
          OR: [
            { ipfsDocHash: String(hash) },
            { boundaryHash: String(hash) }
          ]
        },
        select: {
          parcelId: true,
          surveyNumber: true,
          status: true,
          boundaryHash: true,
          ipfsDocHash: true,
          blockchainTxHash: true,
          createdAt: true,
        }
      });
    }

    if (!parcel) {
      return res.json({
        verified: false,
        message: 'Document not found in registry'
      });
    }

    // Optional on-chain verification (if contracts are configured)
    const hashToCheck = hash ? String(hash) : null;

    const chain = {
      configured: true,
      match: null as boolean | null,
      checks: {
        boundaryHash: null as boolean | null,
        ipfsDocHash: null as boolean | null,
      },
      onChain: null as null | {
        owner: string;
        boundaryHash: string;
        ipfsDocHash: string;
        status: number;
        registeredAt: string;
        lastUpdatedAt: string;
        isForSale: boolean;
        price: string;
      },
      error: null as string | null,
    };

    try {
      const onChainParcel = await blockchainService.getParcel(parcel.parcelId);

      if (!onChainParcel) {
        chain.configured = false;
      } else {
        const getField = (name: string, idx: number) => {
          const v = (onChainParcel as any)?.[name];
          if (v !== undefined) return v;
          return (onChainParcel as any)?.[idx];
        };

        const onChainBoundaryHash = String(getField('boundaryHash', 7) ?? '');
        const onChainIpfsDocHash = String(getField('ipfsDocHash', 8) ?? '');

        const boundaryMatch = !!parcel.boundaryHash && !!onChainBoundaryHash
          ? String(parcel.boundaryHash) === onChainBoundaryHash
          : null;
        const docMatch = !!parcel.ipfsDocHash && !!onChainIpfsDocHash
          ? String(parcel.ipfsDocHash) === onChainIpfsDocHash
          : null;

        chain.checks.boundaryHash = boundaryMatch;
        chain.checks.ipfsDocHash = docMatch;

        if (hashToCheck) {
          chain.match = hashToCheck === onChainBoundaryHash || hashToCheck === onChainIpfsDocHash;
        } else {
          // If checking by parcelId, consider it a match if all available DB hashes match.
          const checks = [boundaryMatch, docMatch].filter(v => v !== null) as boolean[];
          chain.match = checks.length === 0 ? null : checks.every(Boolean);
        }

        chain.onChain = {
          owner: String(getField('owner', 1) ?? ''),
          boundaryHash: onChainBoundaryHash,
          ipfsDocHash: onChainIpfsDocHash,
          status: Number(getField('status', 10) ?? 0),
          registeredAt: String(getField('registeredAt', 11) ?? ''),
          lastUpdatedAt: String(getField('lastUpdatedAt', 12) ?? ''),
          isForSale: Boolean(getField('isForSale', 13) ?? false),
          price: String(getField('price', 9) ?? '0'),
        };
      }
    } catch (e: any) {
      chain.error = e?.message || 'On-chain verification failed';
      chain.match = null;
    }

    const verified = chain.match === false ? false : true;
    const message = chain.match === false
      ? 'Record found, but on-chain verification failed (mismatch)'
      : 'Document verified successfully';

    res.json({
      verified,
      message,
      details: {
        parcelId: parcel.parcelId,
        surveyNumber: parcel.surveyNumber,
        status: parcel.status,
        registrationDate: parcel.createdAt,
        blockchainTxHash: parcel.blockchainTxHash,
        lastVerified: new Date().toISOString(),
        chain,
      }
    });
  } catch (error) {
    logger.error('Verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/public/map/parcels
 * Get parcels for map display
 */
router.get('/map/parcels', async (req: Request, res: Response) => {
  try {
    const { minLat, minLng, maxLat, maxLng, status } = req.query;

    // In production, use PostGIS spatial query
    const whereClause: any = {};
    
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    const parcels = await prisma.landParcel.findMany({
      where: whereClause,
      select: {
        id: true,
        parcelId: true,
        surveyNumber: true,
        village: true,
        district: true,
        state: true,
        areaSqM: true,
        status: true,
        boundaryHash: true,
      },
      take: 500 // Limit for performance
    });

    res.json({
      parcels: parcels.map(p => ({
        id: p.id,
        parcelId: p.parcelId,
        surveyNumber: p.surveyNumber,
        village: p.village,
        district: p.district,
        state: p.state,
        areaSqM: p.areaSqM,
        status: p.status,
      }))
    });
  } catch (error) {
    logger.error('Map parcels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/public/stats
 * Get public statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [totalRecords, activeRecords, stateCount] = await Promise.all([
      prisma.landParcel.count(),
      prisma.landParcel.count({ where: { status: 'ACTIVE' } }),
      prisma.landParcel.groupBy({
        by: ['state'],
        _count: true
      })
    ]);

    res.json({
      totalRecords,
      verifiedRecords: activeRecords,
      statesCount: stateCount.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function formatEventName(action: string): string {
  const names: Record<string, string> = {
    'REGISTERED': 'Initial Registration',
    'VERIFIED': 'Record Verified',
    'BOUNDARY_UPDATED': 'Boundary Updated',
    'TRANSFER_COMPLETED': 'Ownership Transfer',
  };
  return names[action] || action;
}

export default router;
