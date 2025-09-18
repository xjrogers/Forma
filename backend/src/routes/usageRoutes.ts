import { Router, RequestHandler, NextFunction } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types/express';
import { Response } from 'express';
import { StripeService } from '../services/stripeService';

const router = Router();

// Type assertion helpers
const asAuthMiddleware = (handler: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void | Response> | void | Response): RequestHandler => {
  return handler as RequestHandler;
};

const asAuthHandler = (handler: (req: AuthRequest, res: Response) => Promise<Response>): RequestHandler => {
  return ((req, res, next) => {
    return handler(req as AuthRequest, res).catch(next);
  }) as RequestHandler;
};

/**
 * Get usage records for the authenticated user
 * Supports filtering by date range and model
 */
router.get('/', 
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { from, to, model, limit = '100', offset = '0' } = req.query;

    // Build where clause for filtering
    const where: any = { userId };

    // Date range filtering
    if (from || to) {
      where.createdAt = {};
      if (from) {
        const fromDate = new Date(from as string);
        where.createdAt.gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to as string);
        where.createdAt.lte = toDate;
      }
    }

    // Model filtering
    if (model && model !== 'all') {
      where.model = model as string;
    }
    
    const [records, total, user, paymentMethods, recentPurchases, totalPurchases] = await Promise.all([
      prisma.usage_records.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.usage_records.count({ where }),
      prisma.users.findUnique({
        where: { id: userId },
        select: {
          autoTopUpEnabled: true,
          autoTopUpThreshold: true,
          autoTopUpAmount: true,
          plan: true,
          tokensUsed: true,
          tokensLimit: true,
          stripeSubscriptionId: true,
          subscriptionStatus: true,
          subscriptionEndDate: true
        }
      }),
      // Fetch payment methods
      (async () => {
        try {
          const stripeService = StripeService.getInstance();
          const methods = await stripeService.listPaymentMethods(userId);
          return methods.map(pm => ({
            id: pm.id,
            type: pm.type,
            last4: pm.card?.last4,
            expiry: pm.card ? `${pm.card.exp_month}/${pm.card.exp_year}` : undefined,
            brand: pm.card?.brand
          }));
        } catch (error) {
          console.error('❌ Failed to fetch payment methods in usage endpoint:', error);
          return [];
        }
      })(),
      // Fetch recent purchases with pagination support
      prisma.purchases.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20, // Get first 20 purchases for initial load
        skip: 0
      }),
      // Get total purchase count
      prisma.purchases.count({ where: { userId } })
    ]);

    // Get summary statistics
    const summary = await prisma.usage_records.aggregate({
      where,
      _sum: {
        tokens: true,
        cost: true
      },
      _count: {
        id: true
      }
    });

    // Get current month usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyUsage = await prisma.usage_records.aggregate({
      where: {
        userId,
        createdAt: {
          gte: startOfMonth
        }
      },
      _sum: {
        tokens: true,
        cost: true
      }
    });

    const response = {
      success: true,
      records,
      total,
      summary: {
        totalTokens: summary._sum.tokens || 0,
        totalCost: summary._sum.cost || 0,
        totalRecords: summary._count.id || 0
      },
      autoTopUp: {
        enabled: user?.autoTopUpEnabled || false,
        threshold: user?.autoTopUpThreshold || 10000,
        amount: user?.autoTopUpAmount || 15000000
      },
      user: {
        plan: user?.plan || 'free',
        // Get comprehensive token balance using TokenService
        ...(await (async () => {
          try {
            const { tokenService } = await import('../services/tokenService');
            const balance = await tokenService.getTokenBalance(userId);
            return {
              ...balance,
              tokensUsed: balance.plan === 'free' ? 
                (200000 - balance.dailyTokensRemaining) + (1000000 - balance.monthlyTokensRemaining) : 
                0, // For paid plans, we don't track "used" since we use remaining amounts
              tokensLimit: balance.plan === 'free' ? 1000000 : balance.subscriptionTokens + balance.purchasedTokens,
              tokenBalance: balance.totalAvailable
            };
          } catch (error) {
            console.error('Failed to get token balance:', error);
            return {
              tokensUsed: user?.tokensUsed || 0,
              tokensLimit: user?.tokensLimit || 1000000,
              tokenBalance: (user?.tokensLimit || 1000000) - (user?.tokensUsed || 0)
            };
          }
        })())
      },
      subscription: {
        id: user?.stripeSubscriptionId,
        status: user?.subscriptionStatus,
        endDate: user?.subscriptionEndDate
      },
      monthlyUsage: {
        tokens: monthlyUsage._sum.tokens || 0,
        cost: monthlyUsage._sum.cost || 0
      },
      paymentMethods: paymentMethods,
      recentPurchases: recentPurchases,
      totalPurchases: totalPurchases
    };
    
    return res.json(response);

  } catch (error) {
    console.error('Failed to fetch usage records:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch usage records',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  })
);

/**
 * Get more purchase history with pagination
 */
router.get('/purchases', 
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { limit = '20', offset = '0' } = req.query;

      const [purchases, total] = await Promise.all([
        prisma.purchases.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        }),
        prisma.purchases.count({ where: { userId } })
      ]);

      return res.json({
        success: true,
        purchases,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

    } catch (error) {
      console.error('Failed to fetch purchase history:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch purchase history',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Get usage summary by time period (daily, weekly, monthly)
 */
router.get('/summary', 
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { period = 'daily', days = '30' } = req.query;
    const daysBack = parseInt(days as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get usage grouped by date
    const records = await prisma.usage_records.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Group records by date
    const groupedData = records.reduce((acc: any, record) => {
      const date = record.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          tokens: 0,
          cost: 0,
          count: 0
        };
      }
      acc[date].tokens += record.tokens;
      acc[date].cost += record.cost;
      acc[date].count += 1;
      return acc;
    }, {});

    const summaryData = Object.values(groupedData);

    return res.json({
      success: true,
      data: summaryData,
      period,
      daysBack
    });

  } catch (error) {
    console.error('Failed to fetch usage summary:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch usage summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  })
);

export default router; 