import { EmailService } from './emailService'

export interface UserData {
  id: string
  email: string
  firstName?: string
  lastName?: string
  plan?: string
}

export interface SubscriptionData {
  planName: string
  amount: number
  currency: string
  interval: string
  nextBillingDate?: Date
  cancelAt?: Date
}

export interface PaymentData {
  amount: number
  currency: string
  paymentMethod?: string
  invoiceUrl?: string
}

export class NotificationManager {
  private static instance: NotificationManager
  private emailService: EmailService

  private constructor() {
    this.emailService = EmailService.getInstance()
  }

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager()
    }
    return NotificationManager.instance
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(user: UserData): Promise<string> {
    return await this.emailService.sendEmail({
      templateName: 'welcome',
      toEmail: user.email,
      toName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
      recipientId: user.id,
      variables: {
        firstName: user.firstName || 'there',
        fullName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email,
        email: user.email,
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
        supportUrl: `${process.env.FRONTEND_URL}/contact`
      }
    })
  }

  /**
   * Send subscription created notification
   */
  async sendSubscriptionCreated(user: UserData, subscription: SubscriptionData): Promise<string> {
    return await this.emailService.sendEmail({
      templateName: 'subscription_created',
      toEmail: user.email,
      toName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
      recipientId: user.id,
      variables: {
        firstName: user.firstName || 'there',
        planName: subscription.planName,
        amount: subscription.amount,
        currency: subscription.currency.toUpperCase(),
        interval: subscription.interval,
        nextBillingDate: subscription.nextBillingDate?.toLocaleDateString(),
        billingUrl: `${process.env.FRONTEND_URL}/dashboard/billing`,
        supportUrl: `${process.env.FRONTEND_URL}/contact`
      }
    })
  }

  /**
   * Send subscription cancelled notification
   */
  async sendSubscriptionCancelled(user: UserData, subscription: SubscriptionData): Promise<string> {
    return await this.emailService.sendEmail({
      templateName: 'subscription_cancelled',
      toEmail: user.email,
      toName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
      recipientId: user.id,
      variables: {
        firstName: user.firstName || 'there',
        planName: subscription.planName,
        cancelAt: subscription.cancelAt?.toLocaleDateString(),
        reactivateUrl: `${process.env.FRONTEND_URL}/pricing`,
        supportUrl: `${process.env.FRONTEND_URL}/contact`
      }
    })
  }

  /**
   * Send payment successful notification
   */
  async sendPaymentSuccessful(user: UserData, payment: PaymentData): Promise<string> {
    return await this.emailService.sendEmail({
      templateName: 'payment_successful',
      toEmail: user.email,
      toName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
      recipientId: user.id,
      variables: {
        firstName: user.firstName || 'there',
        amount: payment.amount,
        currency: payment.currency.toUpperCase(),
        paymentMethod: payment.paymentMethod || 'Card',
        invoiceUrl: payment.invoiceUrl,
        billingUrl: `${process.env.FRONTEND_URL}/dashboard/billing`
      }
    })
  }

  /**
   * Send payment failed notification
   */
  async sendPaymentFailed(user: UserData, payment: PaymentData): Promise<string> {
    return await this.emailService.sendEmail({
      templateName: 'payment_failed',
      toEmail: user.email,
      toName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
      recipientId: user.id,
      variables: {
        firstName: user.firstName || 'there',
        amount: payment.amount,
        currency: payment.currency.toUpperCase(),
        paymentMethod: payment.paymentMethod || 'Card',
        updatePaymentUrl: `${process.env.FRONTEND_URL}/dashboard/billing`,
        supportUrl: `${process.env.FRONTEND_URL}/contact`
      }
    })
  }

  /**
   * Send trial ending notification
   */
  async sendTrialEnding(user: UserData, daysLeft: number): Promise<string> {
    return await this.emailService.sendEmail({
      templateName: 'trial_ending',
      toEmail: user.email,
      toName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
      recipientId: user.id,
      variables: {
        firstName: user.firstName || 'there',
        daysLeft: daysLeft,
        upgradeUrl: `${process.env.FRONTEND_URL}/pricing`,
        supportUrl: `${process.env.FRONTEND_URL}/contact`
      }
    })
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(user: UserData, resetToken: string): Promise<string> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
    
    return await this.emailService.sendEmail({
      templateName: 'password_reset',
      toEmail: user.email,
      toName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
      recipientId: user.id,
      variables: {
        firstName: user.firstName || 'there',
        resetUrl: resetUrl,
        expiryHours: 24,
        supportUrl: `${process.env.FRONTEND_URL}/contact`
      }
    })
  }

  /**
   * Send account verification email
   */
  async sendAccountVerification(user: UserData, verificationCode: string): Promise<string> {    
    return await this.emailService.sendEmail({
      templateName: 'email_verification',
      toEmail: user.email,
      toName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
      recipientId: user.id,
      variables: {
        firstName: user.firstName || 'there',
        verificationCode: verificationCode
      }
    })
  }

  /**
   * Send low token balance warning
   */
  async sendLowTokenWarning(user: UserData, remainingTokens: number, tokenLimit: number): Promise<string> {
    const percentageLeft = (remainingTokens / tokenLimit) * 100
    
    return await this.emailService.sendEmail({
      templateName: 'low_token_warning',
      toEmail: user.email,
      toName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
      recipientId: user.id,
      variables: {
        firstName: user.firstName || 'there',
        remainingTokens: remainingTokens.toLocaleString(),
        tokenLimit: tokenLimit.toLocaleString(),
        percentageLeft: Math.round(percentageLeft),
        upgradeUrl: `${process.env.FRONTEND_URL}/pricing`,
        purchaseTokensUrl: `${process.env.FRONTEND_URL}/dashboard/billing`
      }
    })
  }

  /**
   * Send monthly usage summary
   */
  async sendMonthlyUsageSummary(user: UserData, usageData: {
    tokensUsed: number
    tokenLimit: number
    projectsCreated: number
    deploymentsCount: number
  }): Promise<string> {
    const usagePercentage = (usageData.tokensUsed / usageData.tokenLimit) * 100
    
    return await this.emailService.sendEmail({
      templateName: 'monthly_usage_summary',
      toEmail: user.email,
      toName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
      recipientId: user.id,
      variables: {
        firstName: user.firstName || 'there',
        tokensUsed: usageData.tokensUsed.toLocaleString(),
        tokenLimit: usageData.tokenLimit.toLocaleString(),
        usagePercentage: Math.round(usagePercentage),
        projectsCreated: usageData.projectsCreated,
        deploymentsCount: usageData.deploymentsCount,
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
        billingUrl: `${process.env.FRONTEND_URL}/dashboard/billing`
      }
    })
  }

  /**
   * Send custom notification
   */
  async sendCustomNotification(
    templateName: string,
    user: UserData,
    variables: Record<string, any>
  ): Promise<string> {
    return await this.emailService.sendEmail({
      templateName,
      toEmail: user.email,
      toName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
      recipientId: user.id,
      variables: {
        firstName: user.firstName || 'there',
        fullName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email,
        email: user.email,
        ...variables
      }
    })
  }

  /**
   * Send auto top-up success notification
   */
  async sendAutoTopUpSuccess(data: {
    userId: string
    email: string
    firstName?: string
    tokensAdded: number
    amountCharged: number
    newBalance: number
    cardLast4: string
  }): Promise<string> {
    return await this.emailService.sendEmail({
      templateName: 'auto_topup_success',
      toEmail: data.email,
      toName: data.firstName || undefined,
      recipientId: data.userId,
      variables: {
        firstName: data.firstName || 'there',
        tokensAdded: data.tokensAdded.toLocaleString(),
        amountCharged: data.amountCharged.toFixed(2),
        newBalance: data.newBalance.toLocaleString(),
        cardLast4: data.cardLast4
      }
    })
  }

  /**
   * Send password changed security notification
   */
  async sendPasswordChanged(data: {
    userId: string
    email: string
    firstName?: string
    ipAddress?: string
    userAgent?: string
  }): Promise<string> {
    // Format date and time
    const now = new Date()
    const changeDate = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    const changeTime = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZoneName: 'short'
    })

    // Simple location detection (you could enhance this with a GeoIP service)
    const location = data.ipAddress ? `IP: ${data.ipAddress}` : 'Unknown location'

    return await this.emailService.sendEmail({
      templateName: 'password_changed',
      toEmail: data.email,
      toName: data.firstName || undefined,
      recipientId: data.userId,
      variables: {
        firstName: data.firstName || 'there',
        email: data.email,
        changeDate,
        changeTime,
        ipAddress: data.ipAddress || 'Unknown',
        location
      }
    })
  }

  /**
   * Send internal notification for contact form submissions
   */
  async sendContactFormNotification(data: {
    name: string
    email: string
    reason: string
    message: string
    ipAddress?: string
    userAgent?: string
  }): Promise<string> {
    // Format submission time
    const submittedAt = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })

    // Send to your internal support email
    const supportEmail = process.env.SUPPORT_EMAIL || 'info@devassistant.io'

    return await this.emailService.sendEmail({
      templateName: 'contact_internal_notification',
      toEmail: supportEmail,
      toName: 'DevAssistant.io Support Team',
      variables: {
        name: data.name,
        email: data.email,
        reason: data.reason,
        message: data.message,
        submittedAt,
        ipAddress: data.ipAddress || 'Unknown'
      },
      metadata: {
        type: 'contact_form',
        customerEmail: data.email,
        reason: data.reason
      }
    })
  }
} 