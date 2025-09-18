import { prisma } from '../lib/prisma'
import { randomUUID } from 'crypto'

export interface TokenBalance {
  // Free plan tokens
  dailyTokensRemaining: number
  monthlyTokensRemaining: number
  
  // Subscription tokens (reset by Stripe webhooks)
  subscriptionTokens: number
  
  // Purchased tokens (rollover, countdown from purchased amount to 0)
  purchasedTokens: number
  
  // Total available
  totalAvailable: number
  
  // Plan info
  plan: string
  needsReset: boolean
}

export interface TokenConsumptionResult {
  success: boolean
  tokensConsumed: number
  newBalance: TokenBalance
  error?: string
}

export class TokenService {
  private static instance: TokenService
  
  public static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService()
    }
    return TokenService.instance
  }

  /**
   * Get comprehensive token balance for a user
   */
  async getTokenBalance(userId: string): Promise<TokenBalance> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        createdAt: true, // Need this for monthly reset calculation
        // Legacy fields
        tokensUsed: true,
        tokensLimit: true,
        // New dual system
        subscriptionTokens: true,
        purchasedTokens: true,
        dailyTokensRemaining: true,
        dailyTokensResetAt: true,
        monthlyTokensRemaining: true,
        monthlyTokensResetAt: true,
      }
    })

    if (!user) {
      throw new Error('User not found')
    }

    const now = new Date()
    let needsReset = false

    // Check if resets are needed (only for free plan - subscription resets handled by Stripe webhooks)
    const needsDailyReset = user.plan === 'free' && 
      (!user.dailyTokensResetAt || now >= user.dailyTokensResetAt)
    
    const needsMonthlyReset = user.plan === 'free' && 
      (!user.monthlyTokensResetAt || now >= user.monthlyTokensResetAt)

    if (needsDailyReset || needsMonthlyReset) {
      needsReset = true
      await this.performResets(userId, user.plan, needsDailyReset, needsMonthlyReset, user.createdAt)
      
      // Refetch user data after reset
      const updatedUser = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          plan: true,
          subscriptionTokens: true,
          purchasedTokens: true,
          dailyTokensRemaining: true,
          monthlyTokensRemaining: true,
        }
      })
      
      if (updatedUser) {
        user.subscriptionTokens = updatedUser.subscriptionTokens
        user.purchasedTokens = updatedUser.purchasedTokens
        user.dailyTokensRemaining = updatedUser.dailyTokensRemaining
        user.monthlyTokensRemaining = updatedUser.monthlyTokensRemaining
      }
    }

    // Calculate balances based on plan
    if (user.plan === 'free') {
      // Free plan is limited by BOTH daily and monthly limits
      const freeTokensAvailable = Math.min(user.dailyTokensRemaining, user.monthlyTokensRemaining)
      
      return {
        dailyTokensRemaining: user.dailyTokensRemaining,
        monthlyTokensRemaining: user.monthlyTokensRemaining,
        subscriptionTokens: 0,
        purchasedTokens: user.purchasedTokens,
        totalAvailable: freeTokensAvailable + user.purchasedTokens,
        plan: user.plan,
        needsReset
      }
    } else {
      // Paid plans: subscription tokens + purchased tokens
      return {
        dailyTokensRemaining: 0,
        monthlyTokensRemaining: 0,
        subscriptionTokens: user.subscriptionTokens,
        purchasedTokens: user.purchasedTokens,
        totalAvailable: user.subscriptionTokens + user.purchasedTokens,
        plan: user.plan,
        needsReset
      }
    }
  }

  /**
   * Consume tokens with proper priority and limits
   */
  async consumeTokens(
    userId: string, 
    tokensToConsume: number, 
    model: string, 
    cost: number,
    projectId?: string
  ): Promise<TokenConsumptionResult> {
    return await prisma.$transaction(async (tx) => {
      // Get current balance
      const balance = await this.getTokenBalance(userId)
      
      if (balance.totalAvailable < tokensToConsume) {
        return {
          success: false,
          tokensConsumed: 0,
          newBalance: balance,
          error: `Insufficient tokens. Need ${tokensToConsume}, have ${balance.totalAvailable}`
        }
      }

      let remainingToConsume = tokensToConsume
      let subscriptionTokensConsumed = 0
      let purchasedTokensConsumed = 0
      let dailyTokensConsumed = 0
      let monthlyTokensConsumed = 0

      if (balance.plan === 'free') {
        // Free plan: consume from free allocation first, then purchased
        const freeTokensAvailable = Math.min(balance.dailyTokensRemaining, balance.monthlyTokensRemaining)
        const freeTokensToUse = Math.min(remainingToConsume, freeTokensAvailable)
        
        console.log(`🔄 Free plan token consumption for user ${userId}:`)
        console.log(`  Daily remaining: ${balance.dailyTokensRemaining}`)
        console.log(`  Monthly remaining: ${balance.monthlyTokensRemaining}`)
        console.log(`  Free tokens available: ${freeTokensAvailable}`)
        console.log(`  Tokens to consume: ${tokensToConsume}`)
        
        if (freeTokensToUse > 0) {
          dailyTokensConsumed = freeTokensToUse
          monthlyTokensConsumed = freeTokensToUse
          remainingToConsume -= freeTokensToUse
          console.log(`  ✅ Using ${freeTokensToUse} free tokens`)
        }
        
        // Use purchased tokens for remainder
        if (remainingToConsume > 0) {
          purchasedTokensConsumed = Math.min(remainingToConsume, balance.purchasedTokens)
          remainingToConsume -= purchasedTokensConsumed
          console.log(`  💰 Using ${purchasedTokensConsumed} purchased tokens`)
        }
      } else {
        // Paid plans: consume subscription tokens first, then purchased
        console.log(`🔄 Paid plan (${balance.plan}) token consumption for user ${userId}:`)
        console.log(`  Subscription tokens: ${balance.subscriptionTokens}`)
        console.log(`  Purchased tokens: ${balance.purchasedTokens}`)
        console.log(`  Tokens to consume: ${tokensToConsume}`)
        
        subscriptionTokensConsumed = Math.min(remainingToConsume, balance.subscriptionTokens)
        remainingToConsume -= subscriptionTokensConsumed
        
        if (subscriptionTokensConsumed > 0) {
          console.log(`  📋 Using ${subscriptionTokensConsumed} subscription tokens`)
        }
        
        if (remainingToConsume > 0) {
          purchasedTokensConsumed = Math.min(remainingToConsume, balance.purchasedTokens)
          remainingToConsume -= purchasedTokensConsumed
          console.log(`  💰 Using ${purchasedTokensConsumed} purchased tokens`)
        }
      }

      // Update user token usage
      const updateData: any = {}
      
      if (subscriptionTokensConsumed > 0) {
        updateData.subscriptionTokens = { decrement: subscriptionTokensConsumed }
      }
      if (purchasedTokensConsumed > 0) {
        updateData.purchasedTokens = { decrement: purchasedTokensConsumed }
      }
      if (dailyTokensConsumed > 0) {
        updateData.dailyTokensRemaining = { decrement: dailyTokensConsumed }
      }
      if (monthlyTokensConsumed > 0) {
        updateData.monthlyTokensRemaining = { decrement: monthlyTokensConsumed }
      }
      
      // Also update legacy fields for backward compatibility
      updateData.tokensUsed = { increment: tokensToConsume }

      await tx.users.update({
        where: { id: userId },
        data: updateData
      })

      // Create usage record
      await tx.usage_records.create({
        data: {
          id: randomUUID(),
          userId,
          tokens: tokensToConsume,
          model,
          cost,
          createdAt: new Date()
        }
      })

      // Update project usage if provided
      if (projectId) {
        try {
          await tx.projects.update({
            where: { 
              id: projectId,
              userId: userId
            },
            data: {
              tokensUsed: { increment: tokensToConsume },
              updatedAt: new Date()
            }
          })
        } catch (error) {
          console.warn(`⚠️ Failed to update project token usage for ${projectId}:`, error)
        }
      }

      // Get updated balance
      const newBalance = await this.getTokenBalance(userId)
      
      // Check for auto top-up
      await this.checkAutoTopUp(userId, newBalance)

      return {
        success: true,
        tokensConsumed: tokensToConsume,
        newBalance
      }
    })
  }

  /**
   * Add subscription tokens (monthly allocation, reset by Stripe webhooks)
   */
  async addSubscriptionTokens(userId: string, tokens: number, planId: string): Promise<void> {
    await prisma.users.update({
      where: { id: userId },
      data: {
        subscriptionTokens: tokens, // Set to new allocation (replaces previous amount)
        plan: planId,
        // Update legacy field for backward compatibility
        tokensLimit: { increment: tokens }
      }
    })
    
    console.log(`✅ Set ${tokens} subscription tokens for user ${userId}, plan: ${planId}`)
  }

  /**
   * Add purchased tokens (rollover allowed)
   */
  async addPurchasedTokens(userId: string, tokens: number): Promise<void> {
    await prisma.users.update({
      where: { id: userId },
      data: {
        purchasedTokens: { increment: tokens },
        // Update legacy field for backward compatibility
        tokensLimit: { increment: tokens }
      }
    })
    
    console.log(`✅ Added ${tokens} purchased tokens for user ${userId}`)
  }

  /**
   * Perform token resets based on schedule (free plan only - subscription resets handled by Stripe)
   */
  private async performResets(
    userId: string, 
    plan: string,
    resetDaily: boolean, 
    resetMonthly: boolean,
    userSignupDate: Date
  ): Promise<void> {
    const updateData: any = {}
    
    // Only reset daily/monthly tokens for free plan
    if (plan === 'free') {
      if (resetDaily) {
        updateData.dailyTokensRemaining = 200000 // Reset to 200K daily limit
        updateData.dailyTokensResetAt = this.getNextDailyReset()
        console.log(`🔄 Resetting daily tokens for user ${userId}`)
      }
      
      if (resetMonthly) {
        updateData.monthlyTokensRemaining = 1000000 // Reset to 1M monthly limit
        updateData.monthlyTokensResetAt = this.getNextMonthlyReset(userSignupDate)
        console.log(`🔄 Resetting monthly tokens for user ${userId} (anniversary: ${userSignupDate.getUTCDate()})`)
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.users.update({
        where: { id: userId },
        data: updateData
      })
    }
  }

  /**
   * Check and trigger auto top-up if needed
   */
  private async checkAutoTopUp(userId: string, balance: TokenBalance): Promise<void> {
    // Only trigger auto top-up if balance is low
    if (balance.totalAvailable > 0) {
      const { autoTopUpService } = await import('./autoTopUpService')
      
      // Process auto top-up asynchronously (don't block token consumption)
      autoTopUpService.checkAndProcessAutoTopUp(userId, balance.totalAvailable)
        .then(result => {
          if (result.success) {
            console.log(`✅ Auto top-up completed for user ${userId}: +${result.tokensAdded} tokens`)
          } else if (result.error !== 'Auto top-up not enabled' && result.error !== 'Balance above threshold') {
            console.log(`⚠️ Auto top-up failed for user ${userId}: ${result.error}`)
          }
        })
        .catch(error => {
          console.error(`❌ Auto top-up error for user ${userId}:`, error)
        })
    }
  }

  /**
   * Get next daily reset time (midnight UTC)
   */
  private getNextDailyReset(): Date {
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    tomorrow.setUTCHours(0, 0, 0, 0)
    return tomorrow
  }

  /**
   * Get next monthly reset time based on user's signup anniversary
   */
  private getNextMonthlyReset(userSignupDate: Date): Date {
    const now = new Date()
    const signupDay = userSignupDate.getUTCDate()
    
    // Start with next month
    const nextReset = new Date(now)
    nextReset.setUTCMonth(nextReset.getUTCMonth() + 1)
    nextReset.setUTCDate(signupDay)
    nextReset.setUTCHours(0, 0, 0, 0)
    
    // Handle edge case: if signup day doesn't exist in next month (e.g., Jan 31 → Feb 28)
    if (nextReset.getUTCDate() !== signupDay) {
      // Set to last day of the month
      nextReset.setUTCDate(0) // This sets to last day of previous month
    }
    
    return nextReset
  }

  /**
   * Initialize token system for new users
   */
  async initializeUserTokens(userId: string, plan: string = 'free'): Promise<void> {
    // Get user's creation date for monthly reset calculation
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { createdAt: true }
    })
    
    if (!user) {
      throw new Error('User not found')
    }
    
    const updateData: any = {
      plan,
      dailyTokensRemaining: 200000, // 200K daily for free plan
      dailyTokensResetAt: this.getNextDailyReset(),
      monthlyTokensRemaining: 1000000, // 1M monthly for free plan
      monthlyTokensResetAt: this.getNextMonthlyReset(user.createdAt), // Use user's signup date
      subscriptionTokens: 0,
      purchasedTokens: 0
    }

    if (plan !== 'free') {
      // For paid plans, set different token amounts based on plan
      // Stripe webhooks will handle resetting subscription tokens on billing cycles
      if (plan === 'starter') {
        updateData.subscriptionTokens = 12000000 // 12M monthly
      } else if (plan === 'business') {
        updateData.subscriptionTokens = 35000000 // 35M monthly
      }
    }

    await prisma.users.update({
      where: { id: userId },
      data: updateData
    })

    console.log(`✅ Initialized token system for user ${userId}, plan: ${plan}`)
  }
}

export const tokenService = TokenService.getInstance() 