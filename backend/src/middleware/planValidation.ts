import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express';
import { prisma } from '../lib/prisma';

export interface PlanRequirement {
  requiredPlan: 'starter' | 'business';
  feature: string;
}

/**
 * Middleware to validate user plan for restricted features
 */
export function requirePlan(requirement: PlanRequirement) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response> => {
    try {
      const userId = req.user.id;
      
      // Get user's current plan
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { plan: true, subscriptionStatus: true }
      });

      if (!user) {
        return res.status(404).json({ 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Check if user has required plan
      const userPlan = user.plan || 'free';
      const isValidPlan = checkPlanAccess(userPlan, requirement.requiredPlan);
      
      // Also check subscription status for paid plans
      const hasActiveSubscription = userPlan === 'free' || 
        (user.subscriptionStatus === 'active' || 
         user.subscriptionStatus === 'trialing' ||
         user.subscriptionStatus === 'cancel_at_period_end' || // Still active until period end
         user.subscriptionStatus === 'past_due'); // Grace period for failed payments

      if (!isValidPlan || !hasActiveSubscription) {
        return res.status(403).json({
          error: `${requirement.feature} requires ${requirement.requiredPlan} plan or higher`,
          code: 'PLAN_UPGRADE_REQUIRED',
          currentPlan: userPlan,
          requiredPlan: requirement.requiredPlan,
          feature: requirement.feature,
          subscriptionStatus: user.subscriptionStatus
        });
      }

      next();
    } catch (error) {
      console.error('Plan validation error:', error);
      return res.status(500).json({ 
        error: 'Plan validation failed',
        code: 'PLAN_VALIDATION_ERROR'
      });
    }
  };
}

/**
 * Check if user plan has access to required plan level
 */
function checkPlanAccess(userPlan: string, requiredPlan: string): boolean {
  const planHierarchy = {
    'free': 0,
    'starter': 1,
    'business': 2
  };

  const userLevel = planHierarchy[userPlan as keyof typeof planHierarchy] ?? 0;
  const requiredLevel = planHierarchy[requiredPlan as keyof typeof planHierarchy] ?? 0;

  return userLevel >= requiredLevel;
}

/**
 * Common plan requirements
 */
export const PLAN_REQUIREMENTS = {
  DEPLOYMENT: {
    requiredPlan: 'starter' as const,
    feature: 'Project deployment'
  },
  GITHUB_INTEGRATION: {
    requiredPlan: 'starter' as const,
    feature: 'GitHub integration'
  },
  PROJECT_EXPORT: {
    requiredPlan: 'starter' as const,
    feature: 'Project export'
  },
  IMPORT_PROJECT: {
    requiredPlan: 'starter' as const,
    feature: 'Project import'
  }
} as const; 