import Stripe from 'stripe'
import { prisma } from '../lib/prisma'
import { WebSocketManager } from './websocketManager'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
  typescript: true
})

export class StripeService {
  private static instance: StripeService
  private constructor() {}

  static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService()
    }
    return StripeService.instance
  }

  /**
   * Create or update a Stripe customer
   */
  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    try {
      // Check if user already has a Stripe customer ID
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true }
      })

      if (user?.stripeCustomerId) {
        return user.stripeCustomerId
      }

      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email,
        metadata: {
          userId
        }
      })

      // Save Stripe customer ID
      await prisma.users.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id }
      })

      return customer.id
    } catch (error) {
      console.error('Failed to create/get Stripe customer:', error)
      throw new Error('Failed to process customer information')
    }
  }

  /**
   * List payment methods for a customer
   */
  async listPaymentMethods(userId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true, email: true }
      })

      if (!user) {
        throw new Error('User not found')
      }

      let { stripeCustomerId } = user

      // Create customer if doesn't exist
      if (!stripeCustomerId) {
        stripeCustomerId = await this.getOrCreateCustomer(userId, user.email)
      }

      const paymentMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: 'card'
      })

      return paymentMethods.data
    } catch (error) {
      console.error('Failed to list payment methods:', error)
      throw new Error('Failed to get payment methods')
    }
  }

  /**
   * Add a payment method to a customer
   */
  async addPaymentMethod(userId: string, paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true, email: true }
      })

      if (!user) {
        throw new Error('User not found')
      }

      let { stripeCustomerId } = user

      // Create customer if doesn't exist
      if (!stripeCustomerId) {
        stripeCustomerId = await this.getOrCreateCustomer(userId, user.email)
      }

      // Attach payment method to customer
      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      })

      // Set as default payment method since we only allow one
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      })

      return paymentMethod
    } catch (error) {
      console.error('Failed to add payment method:', error)
      throw new Error('Failed to add payment method')
    }
  }

  /**
   * Delete a payment method
   */
  async deletePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { 
          stripeCustomerId: true, 
          subscriptionStatus: true,
          plan: true
        }
      })

      if (!user?.stripeCustomerId) {
        throw new Error('No Stripe customer found')
      }

      // Verify the payment method belongs to this customer
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
      if (paymentMethod.customer !== user.stripeCustomerId) {
        throw new Error('Payment method does not belong to this customer')
      }

      // Check if this is the only payment method and user has active subscription
      const allPaymentMethods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: 'card'
      })

      const isLastPaymentMethod = allPaymentMethods.data.length === 1
      const hasActiveSubscription = user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing'

      if (isLastPaymentMethod && hasActiveSubscription) {
        throw new Error('Cannot delete the only payment method while you have an active subscription. Please add another payment method first or cancel your subscription.')
      }

      // Check if this is the default payment method
      const customer = await stripe.customers.retrieve(user.stripeCustomerId) as Stripe.Customer
      const isDefaultPaymentMethod = customer.invoice_settings?.default_payment_method === paymentMethodId

      // If removing default payment method and there are other methods, set a new default
      if (isDefaultPaymentMethod && allPaymentMethods.data.length > 1) {
        const newDefaultMethod = allPaymentMethods.data.find(pm => pm.id !== paymentMethodId)
        if (newDefaultMethod) {
          await stripe.customers.update(user.stripeCustomerId, {
            invoice_settings: {
              default_payment_method: newDefaultMethod.id
            }
          })
          console.log(`🔄 Set new default payment method: ${newDefaultMethod.id}`)
        }
      } else if (isDefaultPaymentMethod) {
        // Unset default if this was the only/last payment method
        await stripe.customers.update(user.stripeCustomerId, {
          invoice_settings: {
            default_payment_method: undefined
          }
        })
      }

      // Detach the payment method (this triggers payment_method.detached webhook)
      await stripe.paymentMethods.detach(paymentMethodId)
      
      console.log(`✅ Payment method ${paymentMethodId} detached for user ${userId}`)
    } catch (error) {
      console.error('Failed to delete payment method:', error)
      throw error // Re-throw the original error to preserve the message
    }
  }

  /**
   * Delete a customer from Stripe (when user deletes their account)
   */
  async deleteCustomer(userId: string): Promise<void> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { 
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          subscriptionStatus: true,
          plan: true
        }
      })

      if (!user?.stripeCustomerId) {
        console.log(`⚠️ No Stripe customer found for user ${userId}`)
        return
      }

      console.log(`🗑️ Deleting Stripe customer ${user.stripeCustomerId} for user ${userId}`)

      // Cancel any active subscriptions first
      if (user.stripeSubscriptionId && (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing')) {
        console.log(`📅 Canceling active subscription ${user.stripeSubscriptionId}`)
        await stripe.subscriptions.cancel(user.stripeSubscriptionId)
      }

      // Delete the customer (this triggers customer.deleted webhook)
      await stripe.customers.del(user.stripeCustomerId)
      
      console.log(`✅ Stripe customer ${user.stripeCustomerId} deleted for user ${userId}`)
    } catch (error) {
      console.error(`Failed to delete Stripe customer for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Set a payment method as default
   */
  async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true }
      })

      if (!user?.stripeCustomerId) {
        throw new Error('No Stripe customer found')
      }

      // Verify the payment method belongs to this customer
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
      if (paymentMethod.customer !== user.stripeCustomerId) {
        throw new Error('Payment method does not belong to this customer')
      }

      // Update customer's default payment method
      await stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      })

      // Update metadata on all payment methods
      const paymentMethods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: 'card'
      })

      for (const pm of paymentMethods.data) {
        await stripe.paymentMethods.update(pm.id, {
          metadata: { isDefault: pm.id === paymentMethodId ? 'true' : 'false' }
        })
      }
    } catch (error) {
      console.error('Failed to set default payment method:', error)
      throw new Error('Failed to set default payment method')
    }
  }

  /**
   * Process a one-time payment using customer's default payment method
   */
  async processPayment(userId: string, amount: number, currency: string = 'usd'): Promise<Stripe.PaymentIntent> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true, email: true }
      })

      if (!user) {
        throw new Error('User not found')
      }

      let { stripeCustomerId } = user

      // Create customer if doesn't exist
      if (!stripeCustomerId) {
        stripeCustomerId = await this.getOrCreateCustomer(userId, user.email)
      }

      // Get customer to check for default payment method
      const customer = await stripe.customers.retrieve(stripeCustomerId) as Stripe.Customer
      
      if (!customer.invoice_settings?.default_payment_method) {
        throw new Error('No default payment method found')
      }

      // Create and confirm payment intent in one step
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        customer: stripeCustomerId,
        payment_method: customer.invoice_settings.default_payment_method as string,
        confirm: true,
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/billing`,
        metadata: {
          userId,
          type: 'token_purchase'
        }
      })

      return paymentIntent
    } catch (error) {
      console.error('Failed to process payment:', error)
      throw new Error('Failed to process payment')
    }
  }

  /**
   * Create a SetupIntent for adding a payment method
   */
  async createSetupIntent(userId: string, email: string): Promise<Stripe.SetupIntent> {
    try {
      // Get or create customer
      const customerId = await this.getOrCreateCustomer(userId, email);

      // Create setup intent
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session', // Allow using this payment method for future payments
      });

      return setupIntent;
    } catch (error) {
      console.error('Failed to create setup intent:', error);
      throw new Error('Failed to initialize payment form');
    }
  }

  /**
   * Create a subscription for a user
   */
  async createSubscription(userId: string, planId: string, isYearly: boolean = false): Promise<Stripe.Subscription> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true, email: true }
      })

      if (!user?.stripeCustomerId) {
        throw new Error('User does not have a Stripe customer ID')
      }

      // Get customer's default payment method
      const paymentMethods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: 'card'
      })

      if (paymentMethods.data.length === 0) {
        throw new Error('No payment method found for customer')
      }

      // Define Stripe price IDs for each plan and billing cycle
      const stripePriceIds = isYearly ? {
        starter: process.env.STRIPE_STARTER_YEARLY_PRICE_ID!,
        business: process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID!
      } : {
        starter: process.env.STRIPE_STARTER_PRICE_ID!,
        business: process.env.STRIPE_BUSINESS_PRICE_ID!
      }

      if (!stripePriceIds[planId as keyof typeof stripePriceIds]) {
        throw new Error(`Invalid plan ID: ${planId}`)
      }

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: user.stripeCustomerId,
        items: [{
          price: stripePriceIds[planId as keyof typeof stripePriceIds]
        }],
        default_payment_method: paymentMethods.data[0].id,
        description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan Subscription`,
        metadata: {
          userId,
          planId,
          billingCycle: isYearly ? 'yearly' : 'monthly'
        },
        expand: ['latest_invoice.payment_intent']
      })

      return subscription
    } catch (error) {
      console.error('Failed to create subscription:', error)
      throw error
    }
  }

  /**
   * Create subscription with payment method in a single optimized call
   */
  async createSubscriptionWithPaymentMethod(userId: string, planId: string, paymentMethodId: string, email: string, isYearly: boolean = false): Promise<Stripe.Subscription> {
    try {
      // Define Stripe price IDs for each plan and billing cycle
      const stripePriceIds = isYearly ? {
        starter: process.env.STRIPE_STARTER_YEARLY_PRICE_ID!,
        business: process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID!
      } : {
        starter: process.env.STRIPE_STARTER_PRICE_ID!,
        business: process.env.STRIPE_BUSINESS_PRICE_ID!
      }

      if (!stripePriceIds[planId as keyof typeof stripePriceIds]) {
        throw new Error(`Invalid plan ID: ${planId}`)
      }

      // Get or create customer (reuse existing getOrCreateCustomer method)
      const stripeCustomerId = await this.getOrCreateCustomer(userId, email);

      // Attach payment method to customer first
      try {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: stripeCustomerId,
        });
      } catch (attachError: any) {
        // If payment method is already attached to another customer, or invalid
        if (attachError.code === 'resource_already_exists') {
          // Payment method is already attached to this customer, continue
        } else {
          throw new Error(`Payment method error: ${attachError.message}`)
        }
      }

      // Set as default payment method
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Create subscription with attached payment method
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{
          price: stripePriceIds[planId as keyof typeof stripePriceIds]
        }],
        default_payment_method: paymentMethodId,
        description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan Subscription`,
        metadata: {
          userId,
          planId,
          billingCycle: isYearly ? 'yearly' : 'monthly'
        },
        expand: ['latest_invoice.payment_intent']
      })

      return subscription
    } catch (error) {
      console.error('Failed to create subscription with payment method:', error)
      throw error
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(userId: string): Promise<void> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { stripeSubscriptionId: true, plan: true }
      })

      if (!user?.stripeSubscriptionId) {
        throw new Error('User does not have an active subscription')
      }

      // Cancel at period end to allow user to use remaining time
      const updatedSubscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true
      })

      // Get the subscription end date from the correct location
      // For canceled subscriptions, use cancel_at, otherwise use current_period_end from items
      const cancelAt = (updatedSubscription as any).cancel_at
      const currentPeriodEnd = (updatedSubscription as any).items?.data?.[0]?.current_period_end
      
      console.log('🔍 Cancel at:', cancelAt, 'Current period end:', currentPeriodEnd)
      
      const endTimestamp = cancelAt || currentPeriodEnd
      
      if (!endTimestamp) {
        throw new Error('Unable to get subscription end date from Stripe')
      }

      const subscriptionEndDate = new Date(endTimestamp * 1000)
      console.log('🔍 Calculated end date:', subscriptionEndDate)
      
      if (isNaN(subscriptionEndDate.getTime())) {
        throw new Error('Invalid subscription end date calculated')
      }

      // Update database with subscription end date
      await prisma.users.update({
        where: { id: userId },
        data: {
          subscriptionStatus: 'cancel_at_period_end',
          subscriptionEndDate: subscriptionEndDate
        }
      })

      // Broadcast subscription update via WebSocket
      const wsManager = WebSocketManager.getInstance()
      wsManager.broadcastSubscriptionUpdate(userId, {
        plan: user.plan, // Keep current plan until period ends
        subscriptionStatus: 'cancel_at_period_end',
        subscriptionId: user.stripeSubscriptionId,
        subscriptionEndDate: subscriptionEndDate.toISOString()
      })

      console.log(`📢 Broadcasted subscription cancellation to user ${userId}`)
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
      throw error
    }
  }

  /**
   * Reactivate canceled subscription
   */
  async reactivateSubscription(userId: string): Promise<void> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { 
          stripeSubscriptionId: true, 
          subscriptionStatus: true,
          plan: true 
        }
      })

      if (!user?.stripeSubscriptionId) {
        throw new Error('User does not have a subscription')
      }

      if (user.subscriptionStatus !== 'cancel_at_period_end') {
        throw new Error('Subscription is not canceled')
      }

      // Reactivate the subscription by removing cancel_at_period_end
      const updatedSubscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: false
      })

      // Get the current period end from the correct location in the subscription object
      const currentPeriodEnd = (updatedSubscription as any).items?.data?.[0]?.current_period_end
      
      if (!currentPeriodEnd) {
        throw new Error('Unable to get subscription end date from Stripe')
      }

      const subscriptionEndDate = new Date(currentPeriodEnd * 1000)
      
      if (isNaN(subscriptionEndDate.getTime())) {
        throw new Error('Invalid subscription end date calculated')
      }

      // Update database
      await prisma.users.update({
        where: { id: userId },
        data: {
          subscriptionStatus: 'active',
          subscriptionEndDate: subscriptionEndDate
        }
      })

      // Broadcast subscription update via WebSocket
      const wsManager = WebSocketManager.getInstance()
      wsManager.broadcastSubscriptionUpdate(userId, {
        plan: user.plan,
        subscriptionStatus: 'active',
        subscriptionId: user.stripeSubscriptionId,
        subscriptionEndDate: subscriptionEndDate.toISOString()
      })

      console.log(`📢 Broadcasted subscription reactivation to user ${userId}`)
    } catch (error) {
      console.error('Failed to reactivate subscription:', error)
      throw error
    }
  }

  /**
   * Update subscription plan
   */
  async updateSubscription(userId: string, newPlanId: string): Promise<Stripe.Subscription> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { stripeSubscriptionId: true }
      })

      if (!user?.stripeSubscriptionId) {
        throw new Error('User does not have an active subscription')
      }

      // Get current subscription to determine billing cycle and plan
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
      const currentPrice = subscription.items.data[0].price
      
      // Determine if current subscription is yearly based on interval
      const isYearly = currentPrice.recurring?.interval === 'year'
      
      console.log(`🔍 Current subscription: ${currentPrice.id}, interval: ${currentPrice.recurring?.interval}`)
      console.log(`🔍 Current price amount: ${currentPrice.unit_amount} ${currentPrice.currency}`)
      console.log(`🔍 Upgrading to: ${newPlanId}, keeping yearly: ${isYearly}`)
      
      // Define price IDs for both monthly and yearly
      const stripePriceIds = {
        starter: {
          monthly: process.env.STRIPE_STARTER_PRICE_ID!,
          yearly: process.env.STRIPE_STARTER_YEARLY_PRICE_ID!
        },
        business: {
          monthly: process.env.STRIPE_BUSINESS_PRICE_ID!,
          yearly: process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID!
        }
      }

      if (!stripePriceIds[newPlanId as keyof typeof stripePriceIds]) {
        throw new Error(`Invalid plan ID: ${newPlanId}`)
      }

      // Select appropriate price ID based on current billing cycle
      const billingCycle = isYearly ? 'yearly' : 'monthly'
      const newPriceId = stripePriceIds[newPlanId as keyof typeof stripePriceIds][billingCycle]
      
      // Get the new price details for logging
      const newPrice = await stripe.prices.retrieve(newPriceId)
      console.log(`🔍 New price: ${newPriceId}, amount: ${newPrice.unit_amount} ${newPrice.currency}`)
      console.log(`🔍 Price difference: ${(newPrice.unit_amount || 0) - (currentPrice.unit_amount || 0)} ${newPrice.currency}`)
      
      // Determine if this is an upgrade or downgrade for proration logic
      const planHierarchy = { free: 0, starter: 1, business: 2 }
      const currentPlanFromUser = await prisma.users.findUnique({
        where: { id: userId },
        select: { plan: true }
      })
      
      const currentPlanLevel = planHierarchy[currentPlanFromUser?.plan as keyof typeof planHierarchy] || 0
      const newPlanLevel = planHierarchy[newPlanId as keyof typeof planHierarchy] || 0
      const isUpgrade = newPlanLevel > currentPlanLevel
      
      console.log(`🔍 Plan change: ${currentPlanFromUser?.plan} (level ${currentPlanLevel}) → ${newPlanId} (level ${newPlanLevel})`)
      console.log(`🔍 Is upgrade: ${isUpgrade}, will ${isUpgrade ? 'prorate' : 'not prorate'}`)
      
      // Update subscription with new price and clear any cancellation
      const updateParams: any = {
        items: [{
          id: subscription.items.data[0].id,
          price: newPriceId
        }],
        cancel_at_period_end: false, // Clear any pending cancellation
        proration_behavior: isUpgrade ? 'create_prorations' : 'none', // Only prorate upgrades
        description: `${newPlanId.charAt(0).toUpperCase() + newPlanId.slice(1)} Plan Subscription`,
        metadata: {
          userId,
          planId: newPlanId,
          billingCycle
        }
      }

      // For upgrades with proration, ensure immediate payment collection
      if (isUpgrade) {
        // Get customer's default payment method
        const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer
        if (customer.deleted) {
          throw new Error('Customer has been deleted')
        }

        console.log(`🔍 Customer default payment method: ${customer.invoice_settings?.default_payment_method}`)
        
        updateParams.payment_behavior = 'default_incomplete' // Create payment intent if needed
        updateParams.expand = ['latest_invoice.payment_intent', 'latest_invoice.lines'] // Include payment and line item details
        
        // Ensure we have a default payment method set
        if (customer.invoice_settings?.default_payment_method) {
          updateParams.default_payment_method = customer.invoice_settings.default_payment_method
        }
      }

      const updatedSubscription = await stripe.subscriptions.update(user.stripeSubscriptionId, updateParams)

      // Log payment status for upgrades
      if (isUpgrade && updatedSubscription.latest_invoice) {
        const invoice = updatedSubscription.latest_invoice as any
        console.log(`💳 Upgrade invoice status: ${invoice.status}`)
        console.log(`💳 Invoice amount_due: ${invoice.amount_due / 100} ${invoice.currency}`)
        console.log(`💳 Invoice amount_paid: ${invoice.amount_paid / 100} ${invoice.currency}`)
        console.log(`💳 Invoice subtotal: ${invoice.subtotal / 100} ${invoice.currency}`)
        
        // Log line items to see what's being charged
        if (invoice.lines && invoice.lines.data) {
          console.log(`💳 Invoice line items:`)
          invoice.lines.data.forEach((line: any, index: number) => {
            console.log(`  ${index + 1}. ${line.description}: ${line.amount / 100} ${line.currency} (${line.proration ? 'proration' : 'regular'})`)
          })
        }
        
        if (invoice.payment_intent) {
          console.log(`💳 Payment intent status: ${invoice.payment_intent.status}`)
        }
      }

      return updatedSubscription
    } catch (error) {
      console.error('Failed to update subscription:', error)
      throw error
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(userId: string): Promise<Stripe.Subscription | null> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { stripeSubscriptionId: true }
      })

      if (!user?.stripeSubscriptionId) {
        return null
      }

      return await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
    } catch (error) {
      console.error('Failed to get subscription:', error)
      return null
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    console.log(`🔔 Processing webhook event: ${event.type} (${event.id})`)
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent)
          break

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent)
          break

        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription)
          break

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
          break

        case 'customer.subscription.deleted':
          await this.handleSubscriptionCancellation(event.data.object as Stripe.Subscription)
          break

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
          break

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
          break

        case 'customer.subscription.trial_will_end':
          await this.handleTrialWillEnd(event.data.object as Stripe.Subscription)
          break

        case 'customer.deleted':
          await this.handleCustomerDeleted(event.data.object as Stripe.Customer)
          break

        case 'payment_method.detached':
          await this.handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod)
          break

        case 'customer.updated':
          await this.handleCustomerUpdated(event.data.object as Stripe.Customer)
          break

        default:
          console.log(`Unhandled event type: ${event.type}`)
      }
    } catch (error) {
      console.error(`❌ Failed to handle webhook event ${event.type} (${event.id}):`, error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        eventType: event.type,
        eventId: event.id
      })
      throw error
    }
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const userId = paymentIntent.metadata.userId
    if (!userId) return

    console.log(`💳 Payment succeeded webhook for user ${userId}, type: ${paymentIntent.metadata.type}, amount: $${paymentIntent.amount / 100}`)

    // Handle different payment types
    switch (paymentIntent.metadata.type) {
      case 'token_purchase':
        // For token purchases, the payment is already processed synchronously in billingRoutes.ts
        // This webhook is just for logging/confirmation - no action needed
        console.log(`✅ Token purchase webhook confirmed for payment intent ${paymentIntent.id}`)
        break

      // Add more payment type handlers for async payments
    }
  }

  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const userId = paymentIntent.metadata.userId
    if (!userId) return

    // Log failure and notify user if needed
    console.error(`Payment failed for user ${userId}:`, paymentIntent.last_payment_error?.message)
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    console.log('🔍 handleSubscriptionCreated called with subscription:', subscription.id)
    
    const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer
    console.log('🔍 Customer retrieved:', { id: customer.id, deleted: customer.deleted, metadata: customer.metadata })
    
    if (customer.deleted) {
      console.log('❌ Customer is deleted, skipping')
      return
    }

    const userId = customer.metadata.userId
    const planId = subscription.metadata.planId
    console.log('🔍 Extracted metadata:', { userId, planId, subscriptionMetadata: subscription.metadata })
    
    if (!userId || !planId) {
      console.log('❌ Missing userId or planId in metadata, skipping')
      return
    }

    console.log(`🎯 Subscription created for user ${userId}, plan: ${planId}`)

    // Calculate token allocation and deployment limits based on plan
    const planConfigs = {
      starter: { 
        tokens: 12000000,  // 12M tokens
        maxDeployments: 1  // 1 concurrent deployment
      },
      business: { 
        tokens: 35000000,  // 35M tokens
        maxDeployments: 3  // 3 concurrent deployments
      }
    }

    const planConfig = planConfigs[planId as keyof typeof planConfigs]
    const tokensToAdd = planConfig?.tokens || 0
    const maxDeployments = planConfig?.maxDeployments || 1

    console.log(`📊 Plan config for ${planId}:`, { tokensToAdd, maxDeployments })

    // Use new TokenService for subscription token allocation
    const { tokenService } = await import('./tokenService')
    await tokenService.addSubscriptionTokens(userId, tokensToAdd, planId)

    // Use transaction to update other subscription info
    console.log('🔍 Starting database transaction...')
    await prisma.$transaction(async (tx) => {
      // Update user's subscription info (tokens handled by TokenService)
      console.log('🔍 Updating user with data:', {
        userId,
        plan: planId,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        maxDeployments,
        tokensToAdd
      })
      
      await tx.users.update({
        where: { id: userId },
        data: {
          plan: planId,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          subscriptionEndDate: (subscription as any).items?.data?.[0]?.current_period_end 
            ? new Date((subscription as any).items.data[0].current_period_end * 1000)
            : null,
          maxDeployments // Update deployment limits
          // Note: tokens handled by TokenService
        }
      })
      
      console.log('✅ User updated successfully')

      // Record the subscription purchase
      console.log('🔍 Creating purchase record...')
      const billingCycle = subscription.metadata.billingCycle || 'monthly'
      await tx.purchases.create({
        data: {
          userId,
          type: 'subscription',
          amount: (subscription.items.data[0].price?.unit_amount || 0) / 100,
          currency: subscription.currency || 'usd',
          description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} plan subscription (${billingCycle})`,
          status: 'completed',
          stripeInvoiceId: subscription.latest_invoice as string,
          metadata: {
            subscriptionId: subscription.id,
            planId,
            billingCycle,
            tokensAllocated: tokensToAdd
          }
        }
      })
      
      console.log('✅ Purchase record created successfully')
    })

    console.log(`✅ Subscription setup complete for user ${userId}`)

    // Broadcast real-time update to user
    const wsManager = WebSocketManager.getInstance()
    wsManager.broadcastSubscriptionUpdate(userId, {
      plan: planId,
      subscriptionStatus: subscription.status,
      subscriptionId: subscription.id
    })
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer
    if (customer.deleted) return

    const userId = customer.metadata.userId
    if (!userId) return

    console.log(`🔄 Subscription updated for user ${userId}, status: ${subscription.status}, cancel_at_period_end: ${subscription.cancel_at_period_end}`)

    const planId = subscription.metadata.planId

    // Handle different subscription statuses
    switch (subscription.status) {
      case 'active':
        // Check if subscription is set to cancel at period end
        if (subscription.cancel_at_period_end) {
          // User canceled but subscription continues until period end
          await prisma.users.update({
            where: { id: userId },
            data: {
              subscriptionStatus: 'cancel_at_period_end',
              // Keep current plan active until period end
              subscriptionEndDate: (subscription as any).items?.data?.[0]?.current_period_end 
                ? new Date((subscription as any).items.data[0].current_period_end * 1000)
                : null
            }
          })
          console.log(`📅 Subscription will cancel at period end for user ${userId}`)
        } else if (planId) {
          // Normal active subscription
          // Get deployment limits for the plan
          const planConfigs = {
            starter: { maxDeployments: 1 },
            business: { maxDeployments: 3 }
          }
          
          const planConfig = planConfigs[planId as keyof typeof planConfigs]
          const maxDeployments = planConfig?.maxDeployments || 1

          await prisma.users.update({
            where: { id: userId },
            data: {
              plan: planId,
              subscriptionStatus: 'active',
              subscriptionEndDate: (subscription as any).items?.data?.[0]?.current_period_end 
                ? new Date((subscription as any).items.data[0].current_period_end * 1000)
                : null,
              maxDeployments // Update deployment limits on plan change
            }
          })
          
          console.log(`📊 Updated user ${userId} to plan ${planId} with ${maxDeployments} max deployments`)
        }
        break

      case 'past_due':
        await prisma.users.update({
          where: { id: userId },
          data: {
            subscriptionStatus: 'past_due'
          }
        })
        console.log(`⚠️ Subscription past due for user ${userId} - payment action may be required`)
        break

      case 'paused':
        await prisma.users.update({
          where: { id: userId },
          data: {
            subscriptionStatus: 'paused'
          }
        })
        console.log(`⏸️ Subscription paused for user ${userId}`)
        break

      case 'canceled':
        await this.handleSubscriptionCancellation(subscription)
        break

      case 'incomplete_expired':
      case 'unpaid':
        // Subscription failed to be paid and has expired
        console.log(`💸 Subscription expired due to non-payment for user ${userId}`)
        await this.handleSubscriptionCancellation(subscription)
        break

      default:
        // Handle other statuses
        await prisma.users.update({
          where: { id: userId },
          data: {
            subscriptionStatus: subscription.status
          }
        })
        console.log(`🔄 Subscription status updated to ${subscription.status} for user ${userId}`)
        break
    }

    // Get the updated user data to broadcast the correct status
    const updatedUser = await prisma.users.findUnique({
      where: { id: userId },
      select: { 
        plan: true, 
        subscriptionStatus: true, 
        subscriptionEndDate: true 
      }
    })

    // Broadcast real-time update to user with database values
    const wsManager = WebSocketManager.getInstance()
    wsManager.broadcastSubscriptionUpdate(userId, {
      plan: updatedUser?.plan || 'free',
      subscriptionStatus: updatedUser?.subscriptionStatus || subscription.status,
      subscriptionId: subscription.id,
      subscriptionEndDate: updatedUser?.subscriptionEndDate?.toISOString()
    })
  }

  private async handleSubscriptionCancellation(subscription: Stripe.Subscription): Promise<void> {
    const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer
    if (customer.deleted) return

    const userId = customer.metadata.userId
    if (!userId) return

    console.log(`❌ Subscription canceled/expired for user ${userId}`)

    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Get current user data to preserve purchased tokens
      const user = await tx.users.findUnique({
        where: { id: userId },
        select: {
          purchasedTokens: true,
          subscriptionTokens: true,
        }
      })

      if (!user) {
        console.error(`User ${userId} not found during subscription cancellation`)
        return
      }

      // Calculate remaining purchased tokens to preserve
      const remainingPurchasedTokens = user.purchasedTokens || 0

      // Reset subscription tokens but preserve purchased tokens
      await tx.users.update({
        where: { id: userId },
        data: {
          plan: 'free',
          stripeSubscriptionId: null,
          subscriptionStatus: 'canceled',
          subscriptionEndDate: null,
          maxDeployments: 0, // Free plan has no deployments
          
          // Reset subscription tokens (no longer have access)
          subscriptionTokens: 0,
        }
      })

      console.log(`✅ User ${userId} downgraded to free plan, preserved ${remainingPurchasedTokens} purchased tokens`)
    })

    // Broadcast subscription status update
    const wsManager = WebSocketManager.getInstance()
    wsManager.broadcastSubscriptionUpdate(userId, {
      subscriptionStatus: 'canceled',
      subscriptionEndDate: null,
      plan: 'free'
    })
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    if (!(invoice as any).subscription) return

    const subscription = await stripe.subscriptions.retrieve((invoice as any).subscription as string)
    const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer
    if (customer.deleted) return

    const userId = customer.metadata.userId
    const planId = subscription.metadata.planId
    if (!userId || !planId) return

    console.log(`💰 Invoice payment succeeded for user ${userId}`)

    // For recurring payments, allocate monthly tokens
    if (invoice.billing_reason === 'subscription_cycle') {
      const tokenAllocations = {
        starter: 12000000,  // 12M tokens
        business: 35000000  // 35M tokens
      }

      const tokensToAdd = tokenAllocations[planId as keyof typeof tokenAllocations] || 0

      // Use TokenService for monthly token allocation
      const { tokenService } = await import('./tokenService')
      await tokenService.addSubscriptionTokens(userId, tokensToAdd, planId)

      await prisma.$transaction(async (tx) => {
        // Update subscription end date (tokens handled by TokenService)
        await tx.users.update({
          where: { id: userId },
          data: {
            subscriptionEndDate: (subscription as any).items?.data?.[0]?.current_period_end 
              ? new Date((subscription as any).items.data[0].current_period_end * 1000)
              : null
          }
        })

        // Record the monthly billing
        await tx.purchases.create({
          data: {
            userId,
            type: 'subscription',
            amount: (invoice.amount_paid || 0) / 100,
            currency: invoice.currency || 'usd',
            description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} plan - Monthly billing`,
            status: 'completed',
            stripeInvoiceId: invoice.id,
            metadata: {
              subscriptionId: subscription.id,
              planId,
              tokensAllocated: tokensToAdd,
              billingPeriodStart: new Date(((subscription as any).items?.data?.[0]?.current_period_start as number) * 1000).toISOString(),
              billingPeriodEnd: new Date(((subscription as any).items?.data?.[0]?.current_period_end as number) * 1000).toISOString()
            }
          }
        })
      })

      console.log(`✅ Monthly tokens allocated: ${tokensToAdd} for user ${userId}`)
    }
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!(invoice as any).subscription) return

    const subscription = await stripe.subscriptions.retrieve((invoice as any).subscription as string)
    const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer
    if (customer.deleted) return

    const userId = customer.metadata.userId
    if (!userId) return

    console.log(`❌ Invoice payment failed for user ${userId}`)

    // Update subscription status
    await prisma.users.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'past_due'
      }
    })

    // Record the failed payment
    await prisma.purchases.create({
      data: {
        userId,
        type: 'subscription',
        amount: (invoice.amount_due || 0) / 100,
        currency: invoice.currency || 'usd',
        description: 'Subscription payment failed',
        status: 'failed',
        stripeInvoiceId: invoice.id,
        metadata: {
          subscriptionId: subscription.id,
          failureReason: 'payment_failed',
          attemptCount: invoice.attempt_count
        }
      }
    })

    // TODO: Send email notification about failed payment
    // TODO: Implement retry logic or grace period
  }

  private async handleTrialWillEnd(subscription: Stripe.Subscription): Promise<void> {
    const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer
    if (customer.deleted) return

    const userId = customer.metadata.userId
    if (!userId) return

    console.log(`⏰ Trial ending soon for user ${userId}`)

    // TODO: Send email notification about trial ending
    // TODO: Implement trial extension logic if needed
  }

  /**
   * Handle customer deletion from Stripe
   */
  private async handleCustomerDeleted(customer: Stripe.Customer): Promise<void> {
    console.log(`🗑️ Customer deleted in Stripe: ${customer.id}`)
    
    if (!customer.metadata?.userId) {
      console.log('⚠️ No userId found in customer metadata, skipping cleanup')
      return
    }

    const userId = customer.metadata.userId
    console.log(`🧹 Cleaning up data for user ${userId} after customer deletion`)

    try {
      await prisma.$transaction(async (tx) => {
        // Find the user first
        const user = await tx.users.findUnique({
          where: { id: userId },
          select: { 
            id: true, 
            email: true, 
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            plan: true
          }
        })

        if (!user) {
          console.log(`⚠️ User ${userId} not found in database`)
          return
        }

        if (user.stripeCustomerId !== customer.id) {
          console.log(`⚠️ Customer ID mismatch for user ${userId}. Expected: ${user.stripeCustomerId}, Got: ${customer.id}`)
          return
        }

        // Cancel any active subscription and reset to free plan
        await tx.users.update({
          where: { id: userId },
          data: {
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            subscriptionStatus: 'canceled',
            subscriptionEndDate: null,
            plan: 'free',
            maxDeployments: 0 // Free plan has no deployments
          }
        })

        // Note: No purchase record created for customer deletion since no refund occurs
        // This is an administrative action, not a financial transaction

        console.log(`✅ Successfully cleaned up data for user ${userId} after customer deletion`)
      })
    } catch (error) {
      console.error(`❌ Failed to handle customer deletion for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Handle payment method detachment from Stripe
   */
  private async handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    console.log(`💳 Payment method detached: ${paymentMethod.id}`)
    
    if (!paymentMethod.customer) {
      console.log('⚠️ Payment method has no customer, skipping')
      return
    }

    try {
      // Get customer to find the user
      const customer = await stripe.customers.retrieve(paymentMethod.customer as string) as Stripe.Customer
      
      if (customer.deleted) {
        console.log('⚠️ Customer is deleted, skipping payment method cleanup')
        return
      }

      if (!customer.metadata?.userId) {
        console.log('⚠️ No userId found in customer metadata, skipping')
        return
      }

      const userId = customer.metadata.userId
      console.log(`🔍 Checking if payment method removal affects user ${userId}`)

      // Check if this was the user's default payment method
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { 
          stripeCustomerId: true, 
          subscriptionStatus: true,
          plan: true
        }
      })

      if (!user || user.stripeCustomerId !== customer.id) {
        console.log(`⚠️ User not found or customer ID mismatch for user ${userId}`)
        return
      }

      // Check if customer has any remaining payment methods
      const remainingPaymentMethods = await stripe.paymentMethods.list({
        customer: customer.id,
        type: 'card'
      })

      if (remainingPaymentMethods.data.length === 0) {
        console.log(`⚠️ User ${userId} has no remaining payment methods`)
        
        // Disable auto top-up since no payment methods remain
        const userWithAutoTopUp = await prisma.users.findUnique({
          where: { id: userId },
          select: { autoTopUpEnabled: true }
        })

        if (userWithAutoTopUp?.autoTopUpEnabled) {
          await prisma.users.update({
            where: { id: userId },
            data: { autoTopUpEnabled: false }
          })
          console.log(`🔕 Auto top-up disabled for user ${userId} - no payment methods remaining`)
        }
        
        // If user has an active subscription but no payment methods, this could cause issues
        if (user.subscriptionStatus === 'active') {
          console.log(`⚠️ User ${userId} has active subscription but no payment methods - potential payment failure risk`)
          
          // Note: Warning logged but no purchase record created since this is not a financial transaction
        }
      }

      console.log(`✅ Payment method detachment handled for user ${userId}`)
    } catch (error) {
      console.error(`❌ Failed to handle payment method detachment:`, error)
      // Don't throw error as this is not critical
    }
  }

  /**
   * Handle customer updates from Stripe (e.g., metadata changes)
   */
  private async handleCustomerUpdated(customer: Stripe.Customer): Promise<void> {
    console.log(`👤 Customer updated in Stripe: ${customer.id}`)
    
    // Check if userId metadata was removed
    if (!customer.metadata?.userId) {
      console.log(`⚠️ Customer ${customer.id} no longer has userId metadata - potential orphaned customer`)
      
      // Try to find user by stripeCustomerId
      const user = await prisma.users.findFirst({
        where: { stripeCustomerId: customer.id },
        select: { id: true, email: true, plan: true }
      })

      if (user) {
        console.log(`🔗 Found orphaned customer ${customer.id} belongs to user ${user.id}`)
        
        // Note: Warning logged but no purchase record created since this is not a financial transaction
      }
      return
    }

    const userId = customer.metadata.userId
    
    // Verify the customer belongs to the correct user
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true, email: true }
    })

    if (!user) {
      console.log(`⚠️ User ${userId} not found for customer ${customer.id}`)
      return
    }

    if (user.stripeCustomerId !== customer.id) {
      console.log(`⚠️ Customer ID mismatch for user ${userId}. Expected: ${user.stripeCustomerId}, Got: ${customer.id}`)
      return
    }

    // Update user email if it changed in Stripe
    if (customer.email && customer.email !== user.email) {
      console.log(`📧 Updating email for user ${userId}: ${user.email} -> ${customer.email}`)
      
      await prisma.users.update({
        where: { id: userId },
        data: { email: customer.email }
      })
    }

    console.log(`✅ Customer update handled for user ${userId}`)
  }
} 