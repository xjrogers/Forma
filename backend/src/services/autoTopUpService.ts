import { prisma } from '../lib/prisma'
import { StripeService } from './stripeService'
import { tokenService } from './tokenService'
import { NotificationManager } from './notificationManager'

export interface AutoTopUpResult {
  success: boolean
  tokensAdded?: number
  newBalance?: number
  error?: string
  paymentIntentId?: string
}

export class AutoTopUpService {
  private static instance: AutoTopUpService
  private processingTopUps = new Set<string>() // Prevent duplicate top-ups

  private constructor() {}

  public static getInstance(): AutoTopUpService {
    if (!AutoTopUpService.instance) {
      AutoTopUpService.instance = new AutoTopUpService()
    }
    return AutoTopUpService.instance
  }

  /**
   * Check if user needs auto top-up and process it
   */
  async checkAndProcessAutoTopUp(userId: string, currentBalance: number): Promise<AutoTopUpResult> {
    // Prevent duplicate processing for the same user
    if (this.processingTopUps.has(userId)) {
      console.log(`🔄 Auto top-up already processing for user ${userId}`)
      return { success: false, error: 'Auto top-up already in progress' }
    }

    try {
      this.processingTopUps.add(userId)

      // Get user's auto top-up settings
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          autoTopUpEnabled: true,
          autoTopUpThreshold: true,
          autoTopUpAmount: true,
          stripeCustomerId: true,
          email: true,
          firstName: true,
          plan: true
        }
      })

      if (!user) {
        return { success: false, error: 'User not found' }
      }

      // Check if auto top-up is enabled and needed
      if (!user.autoTopUpEnabled) {
        return { success: false, error: 'Auto top-up not enabled' }
      }

      if (!user.stripeCustomerId) {
        return { success: false, error: 'No Stripe customer ID found' }
      }

      if (currentBalance > user.autoTopUpThreshold) {
        return { success: false, error: 'Balance above threshold' }
      }

      console.log(`🔔 Auto top-up triggered for user ${userId}`)
      console.log(`💰 Current balance: ${currentBalance}, Threshold: ${user.autoTopUpThreshold}`)
      console.log(`🎯 Will purchase: ${user.autoTopUpAmount} tokens`)

      // Calculate cost based on token packages (same as manual purchase)
      const cost = this.calculateTokenCost(user.autoTopUpAmount)
      if (!cost) {
        return { success: false, error: 'Invalid token amount for auto top-up' }
      }

      // Check if user has valid payment methods
      const stripeService = StripeService.getInstance()
      const paymentMethods = await stripeService.listPaymentMethods(userId)
      if (paymentMethods.length === 0) {
        console.log(`❌ Auto top-up failed: No payment methods for user ${userId}`)
        return { success: false, error: 'No payment methods available' }
      }

      // Process the payment
      const paymentResult = await this.processAutoTopUpPayment(
        userId, 
        user.autoTopUpAmount, 
        cost
      )

      if (!paymentResult.success) {
        return paymentResult
      }

      // Add purchased tokens using TokenService
      await tokenService.addPurchasedTokens(userId, user.autoTopUpAmount)

      // Get updated balance
      const updatedBalance = await tokenService.getTokenBalance(userId)

      // Get payment method details for notification (reuse existing variables)
      const defaultPaymentMethod = paymentMethods.find(pm => (pm as any).isDefault) || paymentMethods[0]
      const cardLast4 = defaultPaymentMethod?.card?.last4 || '****'

      console.log(`✅ Auto top-up completed for user ${userId}`)
      console.log(`💳 Payment: $${cost}, Tokens added: ${user.autoTopUpAmount}`)
      console.log(`💰 New balance: ${updatedBalance.totalAvailable}`)

      // Send auto top-up success notification
      try {
        const notificationManager = NotificationManager.getInstance()
        await notificationManager.sendAutoTopUpSuccess({
          userId,
          email: user.email,
          firstName: user.firstName || 'there',
          tokensAdded: user.autoTopUpAmount,
          amountCharged: cost,
          newBalance: updatedBalance.totalAvailable,
          cardLast4
        })
        console.log(`📧 Auto top-up success notification sent to ${user.email}`)
      } catch (notificationError) {
        console.error(`❌ Failed to send auto top-up notification:`, notificationError)
        // Don't fail the entire process if notification fails
      }

      return {
        success: true,
        tokensAdded: user.autoTopUpAmount,
        newBalance: updatedBalance.totalAvailable,
        paymentIntentId: paymentResult.paymentIntentId
      }

    } catch (error) {
      console.error(`❌ Auto top-up failed for user ${userId}:`, error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    } finally {
      this.processingTopUps.delete(userId)
    }
  }

  /**
   * Process Stripe payment for auto top-up
   */
  private async processAutoTopUpPayment(
    userId: string, 
    tokens: number, 
    cost: number
  ): Promise<AutoTopUpResult> {
    try {
      const stripeService = StripeService.getInstance()

      // Process payment using existing Stripe service
      const paymentIntent = await stripeService.processPayment(userId, cost)

      if (paymentIntent.status !== 'succeeded') {
        console.log(`❌ Auto top-up payment failed: ${paymentIntent.status}`)
        return { 
          success: false, 
          error: `Payment failed with status: ${paymentIntent.status}` 
        }
      }

      // Record the purchase in database
      await prisma.purchases.create({
        data: {
          userId,
          type: 'tokens',
          amount: cost,
          currency: 'usd',
          tokens: tokens,
          description: `Auto top-up: ${tokens.toLocaleString()} tokens`,
          status: 'completed',
          stripePaymentIntentId: paymentIntent.id,
          metadata: {
            autoTopUp: true,
            tokenPackage: tokens,
            pricePerToken: cost / tokens
          }
        }
      })

      console.log(`💳 Auto top-up payment processed: ${paymentIntent.id}`)

      return {
        success: true,
        paymentIntentId: paymentIntent.id
      }

    } catch (error) {
      console.error('Auto top-up payment processing failed:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Payment processing failed' 
      }
    }
  }

  /**
   * Calculate cost for token amount (same logic as manual purchase)
   */
  private calculateTokenCost(tokens: number): number | null {
    // Use the same pricing as manual token purchases
    if (tokens === 1000000) return 10
    if (tokens === 5000000) return 45
    if (tokens === 10000000) return 85
    if (tokens === 25000000) return 200
    
    // For custom amounts, calculate based on the best rate (25M package)
    if (tokens >= 1000000) {
      const baseRate = 200 / 25000000 // $0.000008 per token (25M package rate)
      return Math.ceil(tokens * baseRate * 100) / 100 // Round up to nearest cent
    }
    
    return null
  }

  /**
   * Validate auto top-up settings
   */
  validateAutoTopUpSettings(threshold: number, amount: number): { valid: boolean; error?: string } {
    if (threshold < 10000) {
      return { valid: false, error: 'Minimum threshold is 10,000 tokens' }
    }

    if (threshold > 50000000) {
      return { valid: false, error: 'Maximum threshold is 50,000,000 tokens' }
    }

    if (amount < 1000000) {
      return { valid: false, error: 'Minimum auto top-up amount is 1,000,000 tokens' }
    }

    if (amount > 25000000) {
      return { valid: false, error: 'Maximum auto top-up amount is 25,000,000 tokens' }
    }

    // Ensure amount is one of the valid token packages
    const validAmounts = [1000000, 5000000, 10000000, 25000000]
    if (!validAmounts.includes(amount)) {
      return { valid: false, error: 'Auto top-up amount must be 1M, 5M, 10M, or 25M tokens' }
    }

    return { valid: true }
  }

  /**
   * Validate that user has payment methods for auto top-up
   */
  async validatePaymentMethods(userId: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const stripeService = StripeService.getInstance()
      const paymentMethods = await stripeService.listPaymentMethods(userId)
      
      if (paymentMethods.length === 0) {
        return { 
          valid: false, 
          error: 'You must add a payment method before enabling auto top-up. Please add a payment method first.' 
        }
      }

      return { valid: true }
    } catch (error) {
      console.error('Failed to validate payment methods for auto top-up:', error)
      return { 
        valid: false, 
        error: 'Unable to verify payment methods. Please ensure you have a valid payment method before enabling auto top-up.' 
      }
    }
  }

  /**
   * Disable auto top-up for a user (e.g., after payment failures)
   */
  async disableAutoTopUp(userId: string, reason: string): Promise<void> {
    await prisma.users.update({
      where: { id: userId },
      data: { autoTopUpEnabled: false }
    })

    console.log(`🔕 Auto top-up disabled for user ${userId}: ${reason}`)
  }
}

export const autoTopUpService = AutoTopUpService.getInstance() 