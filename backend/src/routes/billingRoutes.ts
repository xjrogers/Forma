import { Router, RequestHandler, NextFunction } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types/express';
import { Response } from 'express';
import { StripeService } from '../services/stripeService';

const router = Router();
const stripeService = StripeService.getInstance();

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
 * Create a SetupIntent for adding a payment method
 */
router.post('/setup-intent',
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Get or create customer
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { email: true }
      });

      if (!user?.email) {
        return res.status(404).json({ error: 'User email not found' });
      }

      const setupIntent = await stripeService.createSetupIntent(userId, user.email);

      return res.json({
        clientSecret: setupIntent.client_secret
      });

    } catch (error) {
      console.error('Failed to create setup intent:', error);
      return res.status(500).json({ 
        error: 'Failed to initialize payment form',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Purchase tokens with Stripe payment
 */
router.post('/purchase-tokens', 
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { tokens } = req.body;

      // Validate token amount
      if (!tokens || typeof tokens !== 'number' || tokens < 1000000) {
        return res.status(400).json({ error: 'Minimum purchase is 1,000,000 tokens' });
      }

      if (tokens > 25000000) {
        return res.status(400).json({ error: 'Maximum purchase is 25,000,000 tokens' });
      }

      // Calculate cost based on token packages
      let cost: number;
      if (tokens === 1000000) cost = 10;
      else if (tokens === 5000000) cost = 45;
      else if (tokens === 10000000) cost = 85;
      else if (tokens === 25000000) cost = 200;
      else {
        return res.status(400).json({ error: 'Invalid token amount. Please select from available packages.' });
      }

      // Get user and verify they have a payment method
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { 
          stripeCustomerId: true, 
          email: true,
          tokensLimit: true,
          tokensUsed: true
        }
      });

      if (!user || !user.stripeCustomerId) {
        return res.status(400).json({ error: 'No payment method found. Please add a payment method first.' });
      }

      // Check if user has payment methods
      const paymentMethods = await stripeService.listPaymentMethods(userId);
      if (paymentMethods.length === 0) {
        return res.status(400).json({ error: 'No payment method found. Please add a payment method first.' });
      }

             // Use database transaction to ensure atomicity
       const result = await prisma.$transaction(async (tx) => {
         // Process payment with Stripe (creates and confirms payment intent)
         const paymentIntent = await stripeService.processPayment(userId, cost);

         if (paymentIntent.status !== 'succeeded') {
           throw new Error(`Payment failed with status: ${paymentIntent.status}`);
         }

                 // Use TokenService to add purchased tokens
        const { tokenService } = await import('../services/tokenService')
        await tokenService.addPurchasedTokens(userId, tokens)
        
        // Get updated user for response
        const updatedUser = await tx.users.findUnique({
          where: { id: userId },
          select: { tokensUsed: true, tokensLimit: true }
        })
        
        if (!updatedUser) {
          throw new Error('User not found after token purchase')
        }

        // Record the purchase in purchases table (for invoices/billing history)
         const purchaseRecord = await tx.purchases.create({
           data: {
             userId,
             type: 'tokens',
             amount: cost,
             currency: 'usd',
             tokens: tokens,
             description: `${tokens.toLocaleString()} tokens purchase`,
             status: 'completed',
             stripePaymentIntentId: paymentIntent.id,
             metadata: {
               tokenPackage: tokens,
               pricePerToken: cost / tokens
             }
           }
         });

                 return {
          updatedUser,
          purchaseRecord,
          paymentIntentId: paymentIntent.id
        };
       });

      // Get updated balance using TokenService
      const { tokenService } = await import('../services/tokenService');
      const balance = await tokenService.getTokenBalance(userId);

      return res.json({
        success: true,
        message: `Successfully purchased ${tokens.toLocaleString()} tokens`,
        newBalance: balance.totalAvailable,
        balance: balance,
        tokensAdded: tokens,
        cost: cost,
        paymentIntentId: result.paymentIntentId
      });

    } catch (error) {
      console.error('Token purchase failed:', error);
      
      // Check if it's a Stripe error
      if (error && typeof error === 'object' && 'type' in error) {
        const stripeError = error as any;
        if (stripeError.type === 'StripeCardError') {
          return res.status(400).json({ 
            error: 'Payment failed',
            message: stripeError.message || 'Your card was declined'
          });
        }
      }

      return res.status(500).json({ 
        error: 'Failed to process token purchase',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Create subscription
 */
router.post('/subscribe', 
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { planId, isYearly = false } = req.body;

      const validPlans = ['starter', 'business'];
      if (!validPlans.includes(planId)) {
        return res.status(400).json({ error: 'Invalid plan ID' });
      }

      if (typeof isYearly !== 'boolean') {
        return res.status(400).json({ error: 'isYearly must be a boolean' });
      }

      // Check if user already has an active subscription
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { stripeSubscriptionId: true, subscriptionStatus: true }
      });

      if (user?.stripeSubscriptionId && user.subscriptionStatus === 'active') {
        return res.status(400).json({ error: 'User already has an active subscription' });
      }

      // Create subscription using StripeService
      const stripeService = StripeService.getInstance();
      const subscription = await stripeService.createSubscription(userId, planId, isYearly);

      return res.json({
        success: true,
        message: `Successfully subscribed to ${planId} plan`,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          current_period_end: (subscription as any).current_period_end
        }
      });

    } catch (error) {
      console.error('Subscription creation failed:', error);
      
      // Handle specific Stripe errors
      if (error instanceof Error) {
        if (error.message.includes('No payment method found')) {
          return res.status(400).json({ 
            error: 'No payment method found',
            message: 'Please add a payment method before subscribing'
          });
        }
      }

      return res.status(500).json({ 
        error: 'Failed to create subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Create subscription with new payment method (transaction-safe)
 */
router.post('/subscribe-with-payment-method', 
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { paymentMethodId, planId, isYearly = false } = req.body;

      const validPlans = ['starter', 'business'];
      if (!validPlans.includes(planId)) {
        return res.status(400).json({ error: 'Invalid plan ID' });
      }

      if (!paymentMethodId) {
        return res.status(400).json({ error: 'Payment method ID is required' });
      }

      if (typeof isYearly !== 'boolean') {
        return res.status(400).json({ error: 'isYearly must be a boolean' });
      }

      // Check if user already has an active subscription
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { 
          stripeSubscriptionId: true, 
          subscriptionStatus: true,
          stripeCustomerId: true,
          email: true
        }
      });

      if (user?.stripeSubscriptionId && user.subscriptionStatus === 'active') {
        return res.status(400).json({ error: 'User already has an active subscription' });
      }

      // Handle Stripe operations in a single optimized call (webhooks will handle database updates)
      const stripeService = StripeService.getInstance();

      // Create subscription with payment method in one call
      const subscription = await stripeService.createSubscriptionWithPaymentMethod(userId, planId, paymentMethodId, user?.email || '', isYearly);

      const result = { subscription };

      return res.json({
        success: true,
        message: `Successfully subscribed to ${planId} plan`,
        subscription: {
          id: result.subscription.id,
          status: result.subscription.status,
          current_period_end: (result.subscription as any).current_period_end
        }
      });

    } catch (error) {
      console.error('Subscription with payment method failed:', error);
      
      return res.status(500).json({ 
        error: 'Failed to create subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Cancel subscription
 */
router.post('/cancel-subscription', 
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const stripeService = StripeService.getInstance();
      await stripeService.cancelSubscription(userId);

      return res.json({
        success: true,
        message: 'Subscription canceled successfully. You can continue using your plan until the end of the current billing period.'
      });

    } catch (error) {
      console.error('Subscription cancellation failed:', error);
      return res.status(500).json({ 
        error: 'Failed to cancel subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Reactivate canceled subscription
 */
router.post('/reactivate-subscription', 
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const stripeService = StripeService.getInstance();
      await stripeService.reactivateSubscription(userId);

      return res.json({
        success: true,
        message: 'Subscription reactivated successfully.'
      });

    } catch (error) {
      console.error('Subscription reactivation failed:', error);
      return res.status(500).json({ 
        error: 'Failed to reactivate subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Update subscription plan
 */
router.post('/update-subscription', 
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { planId } = req.body;

      const validPlans = ['starter', 'business'];
      if (!validPlans.includes(planId)) {
        return res.status(400).json({ error: 'Invalid plan ID' });
      }

      const stripeService = StripeService.getInstance();
      const subscription = await stripeService.updateSubscription(userId, planId);

      return res.json({
        success: true,
        message: `Successfully updated to ${planId} plan`,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          current_period_end: (subscription as any).current_period_end
        }
      });

    } catch (error) {
      console.error('Subscription update failed:', error);
      return res.status(500).json({ 
        error: 'Failed to update subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Get subscription details
 */
router.get('/subscription', 
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const stripeService = StripeService.getInstance();
      const subscription = await stripeService.getSubscription(userId);

      if (!subscription) {
        return res.json({
          success: true,
          subscription: null
        });
      }

      return res.json({
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          current_period_start: (subscription as any).current_period_start,
          current_period_end: (subscription as any).current_period_end,
          cancel_at_period_end: subscription.cancel_at_period_end,
          plan: subscription.metadata.planId
        }
      });

    } catch (error) {
      console.error('Failed to get subscription:', error);
      return res.status(500).json({ 
        error: 'Failed to get subscription details',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Update auto top-up settings
 */
router.post('/auto-topup', 
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { enabled, threshold, amount } = req.body;

      // Validate settings using AutoTopUpService
      if (enabled) {
        const { autoTopUpService } = await import('../services/autoTopUpService');
        const validation = autoTopUpService.validateAutoTopUpSettings(threshold || 10000, amount || 15000000);
        
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error });
        }

        // Check if user has payment methods before enabling auto top-up
        const paymentValidation = await autoTopUpService.validatePaymentMethods(userId);
        if (!paymentValidation.valid) {
          return res.status(400).json({ 
            error: 'Payment method required',
            message: paymentValidation.error
          });
        }
      }

      // Update user's auto top-up settings in database
      const updatedUser = await prisma.users.update({
        where: { id: userId },
        data: {
          autoTopUpEnabled: !!enabled,
          autoTopUpThreshold: threshold || 10000,
          autoTopUpAmount: amount || 15000000,
        },
        select: {
          autoTopUpEnabled: true,
          autoTopUpThreshold: true,
          autoTopUpAmount: true,
        }
      });

      return res.json({
        success: true,
        message: `Auto top-up ${enabled ? 'enabled' : 'disabled'}`,
        settings: {
          enabled: updatedUser.autoTopUpEnabled,
          threshold: updatedUser.autoTopUpThreshold,
          amount: updatedUser.autoTopUpAmount,
        }
      });

    } catch (error) {
      console.error('Auto top-up update failed:', error);
      return res.status(500).json({ 
        error: 'Failed to update auto top-up settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Manually trigger auto top-up (for testing or emergency)
 */
router.post('/auto-topup/trigger', 
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { autoTopUpService } = await import('../services/autoTopUpService');
      const { tokenService } = await import('../services/tokenService');
      
      // Get current balance
      const balance = await tokenService.getTokenBalance(userId);
      
      // Trigger auto top-up
      const result = await autoTopUpService.checkAndProcessAutoTopUp(userId, balance.totalAvailable);

      if (result.success) {
        return res.json({
          success: true,
          message: 'Auto top-up completed successfully',
          tokensAdded: result.tokensAdded,
          newBalance: result.newBalance,
          paymentIntentId: result.paymentIntentId
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('Manual auto top-up trigger failed:', error);
      return res.status(500).json({ 
        error: 'Failed to trigger auto top-up',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Get current billing information
 */
router.get('/info', 
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          tokensUsed: true,
          tokensLimit: true,
          plan: true,
          createdAt: true,
          autoTopUpEnabled: true,
          autoTopUpThreshold: true,
          autoTopUpAmount: true,
          stripeSubscriptionId: true,
          subscriptionStatus: true,
          subscriptionEndDate: true
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

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

      // Get comprehensive token balance using TokenService
      const { tokenService } = await import('../services/tokenService');
      const balance = await tokenService.getTokenBalance(userId);

      return res.json({
        success: true,
        user: {
          tokenBalance: balance.totalAvailable,
          ...balance,
          plan: user.plan,
          memberSince: user.createdAt
        },
        monthlyUsage: {
          tokens: monthlyUsage._sum.tokens || 0,
          cost: monthlyUsage._sum.cost || 0
        },
        autoTopUp: {
          enabled: user.autoTopUpEnabled,
          threshold: user.autoTopUpThreshold,
          amount: user.autoTopUpAmount
        },
        subscription: {
          id: user.stripeSubscriptionId,
          status: user.subscriptionStatus,
          endDate: user.subscriptionEndDate
        }
      });

    } catch (error) {
      console.error('Failed to fetch billing info:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch billing information',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Add payment method
 */
router.post('/payment-methods',
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    console.log('🔒 POST /payment-methods - Adding new payment method');
    console.log('Request body:', req.body);
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        console.error('❌ User not authenticated');
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { paymentMethodId } = req.body;
      if (!paymentMethodId) {
        console.error('❌ Payment method ID missing');
        return res.status(400).json({ error: 'Payment method ID is required' });
      }

      console.log(`📝 Getting user info for ${userId}`);
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { email: true, stripeCustomerId: true }
      });

      if (!user?.email) {
        console.error('❌ User email not found');
        return res.status(404).json({ error: 'User email not found' });
      }

      console.log('💳 Adding payment method to Stripe');
      const paymentMethod = await stripeService.addPaymentMethod(userId, paymentMethodId);
      console.log('✅ Payment method added:', paymentMethod.id);

      return res.json({
        success: true,
        paymentMethod: {
          id: paymentMethod.id,
          type: paymentMethod.type,
          last4: paymentMethod.card?.last4,
          expiry: paymentMethod.card ? `${paymentMethod.card.exp_month}/${paymentMethod.card.exp_year}` : undefined,
          brand: paymentMethod.card?.brand
        }
      });

    } catch (error) {
      console.error('❌ Failed to add payment method:', error);
      return res.status(500).json({ 
        error: 'Failed to add payment method',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Get payment methods
 */
router.get('/payment-methods', 
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    console.log('🔒 GET /payment-methods - Fetching payment methods');
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        console.error('❌ User not authenticated');
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log(`📝 Getting payment methods for user ${userId}`);
      const paymentMethods = await stripeService.listPaymentMethods(userId);
      console.log(`✅ Found ${paymentMethods.length} payment methods`);

      return res.json({
        success: true,
        paymentMethods: paymentMethods.map(pm => ({
          id: pm.id,
          type: pm.type,
          last4: pm.card?.last4,
          expiry: pm.card ? `${pm.card.exp_month}/${pm.card.exp_year}` : undefined,
          brand: pm.card?.brand
        }))
      });

    } catch (error) {
      console.error('❌ Failed to get payment methods:', error);
      return res.status(500).json({ 
        error: 'Failed to get payment methods',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Delete payment method
 */
router.delete('/payment-methods/:id',
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    console.log('🔒 DELETE /payment-methods/:id - Deleting payment method');
    console.log('Payment method ID:', req.params.id);
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        console.error('❌ User not authenticated');
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const paymentMethodId = req.params.id;
      console.log(`💳 Deleting payment method ${paymentMethodId} for user ${userId}`);
      await stripeService.deletePaymentMethod(userId, paymentMethodId);
      console.log('✅ Payment method deleted');

      // Check if this was the last payment method and disable auto top-up if so
      try {
        const remainingPaymentMethods = await stripeService.listPaymentMethods(userId);
        if (remainingPaymentMethods.length === 0) {
          // Get current auto top-up status
          const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { autoTopUpEnabled: true }
          });

          if (user?.autoTopUpEnabled) {
            // Disable auto top-up since no payment methods remain
            await prisma.users.update({
              where: { id: userId },
              data: { autoTopUpEnabled: false }
            });
            console.log(`🔕 Auto top-up disabled for user ${userId} - no payment methods remaining`);
          }
        }
      } catch (error) {
        console.error('Failed to check/disable auto top-up after payment method deletion:', error);
        // Don't fail the main operation if this check fails
      }

      return res.json({
        success: true,
        message: 'Payment method deleted successfully'
      });

    } catch (error) {
      console.error('❌ Failed to delete payment method:', error);
      return res.status(500).json({ 
        error: 'Failed to delete payment method',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Get purchase history/invoices
 */
router.get('/purchases',
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { limit = '10', offset = '0', type } = req.query;

      // Build where clause
      const where: any = { userId };
      if (type && type !== 'all') {
        where.type = type as string;
      }

      const [purchases, total] = await Promise.all([
        prisma.purchases.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        }),
        prisma.purchases.count({ where })
      ]);

      // Calculate summary statistics
      const summary = await prisma.purchases.aggregate({
        where: { userId },
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      });

      return res.json({
        success: true,
        purchases,
        total,
        summary: {
          totalSpent: summary._sum.amount || 0,
          totalPurchases: summary._count.id || 0
        }
      });

    } catch (error) {
      console.error('Failed to fetch purchases:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch purchases',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * Set default payment method
 */
router.post('/payment-methods/:id/default',
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    console.log('🔒 POST /payment-methods/:id/default - Setting default payment method');
    console.log('Payment method ID:', req.params.id);
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        console.error('❌ User not authenticated');
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const paymentMethodId = req.params.id;
      console.log(`💳 Setting payment method ${paymentMethodId} as default for user ${userId}`);
      await stripeService.setDefaultPaymentMethod(userId, paymentMethodId);
      console.log('✅ Default payment method updated');

      return res.json({
        success: true,
        message: 'Default payment method updated successfully'
      });

    } catch (error) {
      console.error('❌ Failed to set default payment method:', error);
      return res.status(500).json({ 
        error: 'Failed to set default payment method',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export default router; 