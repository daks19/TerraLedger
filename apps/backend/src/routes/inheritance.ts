import { Router, Request, Response } from 'express';
import { PrismaClient, InheritancePlanStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { BlockchainService } from '../services/blockchain';

const router = Router();
const prisma = new PrismaClient();
const blockchainService = new BlockchainService();

// Auth middleware
const requireAuth = async (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; roles: string[] };
    (req as any).user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    (req as any).userRoles = decoded.roles;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Validation schemas
const createPlanSchema = z.object({
  parcelIds: z.array(z.string()).min(1),
  useAgeMilestones: z.boolean().optional(),
});

const addHeirSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  percentage: z.number().min(1).max(100),
  releaseAge: z.number().min(0).optional(),
  birthDate: z.string().optional(),
});

const addMilestoneSchema = z.object({
  age: z.number().min(0),
  percentage: z.number().min(1).max(100),
});

// POST /api/inheritance/setup
router.post('/setup', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = createPlanSchema.parse(req.body);

    // Check if user already has a plan
    const existingPlan = await prisma.inheritancePlan.findFirst({
      where: { ownerId: user.id, status: { not: InheritancePlanStatus.CANCELLED } },
    });

    if (existingPlan) {
      return res.status(400).json({ error: 'You already have an active inheritance plan' });
    }

    // Verify ownership of all parcels
    const parcels = await prisma.landParcel.findMany({
      where: {
        parcelId: { in: data.parcelIds },
        ownerId: user.id,
      },
    });

    if (parcels.length !== data.parcelIds.length) {
      return res.status(400).json({ error: 'You do not own all specified parcels' });
    }

    // Create plan on blockchain
    const planId = await blockchainService.createInheritancePlan(
      data.parcelIds,
      data.useAgeMilestones || false
    );

    // Create plan in database
    const plan = await prisma.inheritancePlan.create({
      data: {
        planId,
        ownerId: user.id,
        parcelIds: data.parcelIds,
        useAgeMilestones: data.useAgeMilestones || false,
        status: InheritancePlanStatus.ACTIVE,
      },
      include: {
        owner: true,
        heirs: true,
        milestones: true,
      },
    });

    logger.info(`Inheritance plan created: ${plan.id} by ${user.walletAddress}`);

    res.status(201).json(plan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Create inheritance plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inheritance/:planId/heir
router.post('/:planId/heir', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { planId } = req.params;
    const data = addHeirSchema.parse(req.body);

    const plan = await prisma.inheritancePlan.findUnique({
      where: { id: planId },
      include: { heirs: true },
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (plan.ownerId !== user.id) {
      return res.status(403).json({ error: 'Not authorized to modify this plan' });
    }

    if (plan.status !== InheritancePlanStatus.ACTIVE) {
      return res.status(400).json({ error: 'Plan is not active' });
    }

    // Check total percentage
    const currentTotal = plan.heirs.reduce((sum: number, h: { percentage: number }) => sum + h.percentage, 0);
    if (currentTotal + data.percentage > 100) {
      return res.status(400).json({ error: 'Total percentage would exceed 100%' });
    }

    // Find or create heir user
    let heirUser = await prisma.user.findUnique({
      where: { walletAddress: data.walletAddress.toLowerCase() },
    });

    if (!heirUser) {
      try {
        heirUser = await prisma.user.create({
          data: {
            walletAddress: data.walletAddress.toLowerCase(),
            roles: ['BUYER'],
          },
        });
      } catch (error: any) {
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

    // Add heir on blockchain
    await blockchainService.addHeir(
      plan.planId!,
      data.walletAddress,
      data.percentage,
      data.releaseAge || 0,
      data.birthDate ? Math.floor(new Date(data.birthDate).getTime() / 1000) : 0
    );

    // Create heir in database
    const heir = await prisma.heir.create({
      data: {
        planId: plan.id,
        userId: heirUser.id,
        walletAddress: data.walletAddress.toLowerCase(),
        percentage: data.percentage,
        releaseAge: data.releaseAge,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
      },
    });

    const updatedPlan = await prisma.inheritancePlan.findUnique({
      where: { id: planId },
      include: { heirs: { include: { user: true } }, milestones: true },
    });

    logger.info(`Heir added to plan ${planId}: ${data.walletAddress}`);

    res.status(201).json(updatedPlan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Add heir error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inheritance/:planId/milestone
router.post('/:planId/milestone', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { planId } = req.params;
    const data = addMilestoneSchema.parse(req.body);

    const plan = await prisma.inheritancePlan.findUnique({
      where: { id: planId },
      include: { milestones: true },
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (plan.ownerId !== user.id) {
      return res.status(403).json({ error: 'Not authorized to modify this plan' });
    }

    // Check total milestone percentage
    const currentTotal = plan.milestones.reduce((sum: number, m: { percentage: number }) => sum + m.percentage, 0);
    if (currentTotal + data.percentage > 100) {
      return res.status(400).json({ error: 'Total milestone percentage would exceed 100%' });
    }

    // Create milestone
    await prisma.releaseMilestone.create({
      data: {
        planId: plan.id,
        age: data.age,
        percentage: data.percentage,
      },
    });

    const updatedPlan = await prisma.inheritancePlan.findUnique({
      where: { id: planId },
      include: { heirs: true, milestones: true },
    });

    logger.info(`Milestone added to plan ${planId}: age ${data.age}, ${data.percentage}%`);

    res.status(201).json(updatedPlan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Add milestone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inheritance/trigger
router.post('/trigger', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const roles = (req as any).userRoles;
    const { planId, deathCertHash } = req.body;

    // Only government officials can trigger inheritance
    if (!roles.includes('GOVERNMENT_OFFICIAL') && !roles.includes('ADMIN')) {
      return res.status(403).json({ error: 'Not authorized to trigger inheritance' });
    }

    const plan = await prisma.inheritancePlan.findUnique({
      where: { id: planId },
      include: { heirs: true },
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (plan.status !== InheritancePlanStatus.ACTIVE) {
      return res.status(400).json({ error: 'Plan is not active' });
    }

    // Verify heirs total 100%
    const totalPercentage = plan.heirs.reduce((sum: number, h: { percentage: number }) => sum + h.percentage, 0);
    if (totalPercentage !== 100) {
      return res.status(400).json({ error: 'Heir percentages must total 100%' });
    }

    // Trigger on blockchain
    await blockchainService.triggerInheritance(plan.planId!, deathCertHash);

    // Update plan
    const updatedPlan = await prisma.inheritancePlan.update({
      where: { id: planId },
      data: {
        status: InheritancePlanStatus.TRIGGERED,
        deathCertHash,
        triggeredAt: new Date(),
      },
      include: { heirs: true, milestones: true },
    });

    logger.info(`Inheritance triggered for plan ${planId}`);

    res.json(updatedPlan);
  } catch (error) {
    logger.error('Trigger inheritance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/inheritance/claim
router.get('/claim', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Find plans where user is an heir
    const heirRecords = await prisma.heir.findMany({
      where: {
        userId: user.id,
        hasClaimed: false,
      },
      include: {
        plan: {
          include: { owner: true, milestones: true },
        },
      },
    });

    const eligiblePlans = heirRecords
      .filter((h: any) => h.plan.status === InheritancePlanStatus.TRIGGERED || 
                   h.plan.status === InheritancePlanStatus.EXECUTING)
      .map((h: any) => {
        // Calculate claimable percentage based on age milestones
        let claimablePercentage = h.percentage;
        
        if (h.plan.useAgeMilestones && h.birthDate && h.plan.milestones.length > 0) {
          const currentAge = Math.floor(
            (Date.now() - new Date(h.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
          );
          
          let milestonePercent = 0;
          for (const milestone of h.plan.milestones) {
            if (currentAge >= milestone.age) {
              milestonePercent += milestone.percentage;
            }
          }
          
          claimablePercentage = Math.floor((h.percentage * milestonePercent) / 100);
        }

        return {
          planId: h.plan.id,
          owner: h.plan.owner,
          parcelIds: h.plan.parcelIds,
          percentage: h.percentage,
          claimablePercentage,
          releaseAge: h.releaseAge,
          triggeredAt: h.plan.triggeredAt,
        };
      });

    res.json({ eligiblePlans });
  } catch (error) {
    logger.error('Get claim eligibility error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inheritance/:planId/claim
router.post('/:planId/claim', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { planId } = req.params;

    const heir = await prisma.heir.findFirst({
      where: {
        planId,
        userId: user.id,
      },
      include: {
        plan: { include: { milestones: true } },
      },
    });

    if (!heir) {
      return res.status(404).json({ error: 'You are not an heir of this plan' });
    }

    if (heir.hasClaimed) {
      return res.status(400).json({ error: 'You have already claimed your inheritance' });
    }

    const plan = heir.plan;
    if (plan.status !== InheritancePlanStatus.TRIGGERED && 
        plan.status !== InheritancePlanStatus.EXECUTING) {
      return res.status(400).json({ error: 'Inheritance has not been triggered' });
    }

    // Check claim period (1 year from trigger)
    if (plan.triggeredAt) {
      const claimDeadline = new Date(plan.triggeredAt.getTime() + 365 * 24 * 60 * 60 * 1000);
      if (new Date() > claimDeadline) {
        return res.status(400).json({ error: 'Claim period has expired' });
      }
    }

    // Update heir as claimed
    await prisma.heir.update({
      where: { id: heir.id },
      data: {
        hasClaimed: true,
        claimedAt: new Date(),
      },
    });

    // Check if all heirs have claimed
    const allHeirs = await prisma.heir.findMany({
      where: { planId },
    });

    const allClaimed = allHeirs.every((h: { hasClaimed: boolean }) => h.hasClaimed);

    if (allClaimed) {
      await prisma.inheritancePlan.update({
        where: { id: planId },
        data: {
          status: InheritancePlanStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    } else {
      await prisma.inheritancePlan.update({
        where: { id: planId },
        data: { status: InheritancePlanStatus.EXECUTING },
      });
    }

    logger.info(`Inheritance claimed by ${user.walletAddress} for plan ${planId}`);

    res.json({
      success: true,
      percentage: heir.percentage,
      parcelIds: plan.parcelIds,
    });
  } catch (error) {
    logger.error('Claim inheritance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/inheritance/my-plan
router.get('/my-plan', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const plan = await prisma.inheritancePlan.findFirst({
      where: {
        ownerId: user.id,
        status: { not: InheritancePlanStatus.CANCELLED },
      },
      include: {
        heirs: { include: { user: true } },
        milestones: true,
      },
    });

    res.json(plan);
  } catch (error) {
    logger.error('Get my plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/inheritance/:planId
router.delete('/:planId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { planId } = req.params;

    const plan = await prisma.inheritancePlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (plan.ownerId !== user.id) {
      return res.status(403).json({ error: 'Not authorized to cancel this plan' });
    }

    if (plan.status !== InheritancePlanStatus.ACTIVE) {
      return res.status(400).json({ error: 'Can only cancel active plans' });
    }

    await prisma.inheritancePlan.update({
      where: { id: planId },
      data: { status: InheritancePlanStatus.CANCELLED },
    });

    logger.info(`Inheritance plan cancelled: ${planId}`);

    res.json({ success: true });
  } catch (error) {
    logger.error('Cancel plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as inheritanceRouter };
