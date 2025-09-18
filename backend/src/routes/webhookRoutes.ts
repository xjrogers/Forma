import { Router, Request, Response } from 'express'
import { StripeService } from '../services/stripeService'
import Stripe from 'stripe'

const router = Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil'
})
const stripeService = StripeService.getInstance()

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

router.post('/stripe', async (req: Request, res: Response): Promise<Response> => {
  const sig = req.headers['stripe-signature']

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured')
    return res.status(500).send('Webhook secret not configured')
  }

  if (!sig) {
    return res.status(400).send('No signature header')
  }

  try {
    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    )

    // Handle the event
    await stripeService.handleWebhookEvent(event)

    return res.json({ received: true })
  } catch (err) {
    console.error('Webhook Error:', err)
    return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
})

export default router 