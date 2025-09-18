import { Router, Request, Response } from 'express'
import { NotificationManager } from '../services/notificationManager'

const router = Router()

// Handle contact form submissions
router.post('/', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, email, reason, message, ipAddress, userAgent } = req.body

    // Validate required fields
    if (!name || !email || !reason || !message) {
      return res.status(400).json({
        error: 'All fields are required'
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      })
    }

    // Validate message length
    if (message.length < 10) {
      return res.status(400).json({
        error: 'Message must be at least 10 characters long'
      })
    }

    if (message.length > 5000) {
      return res.status(400).json({
        error: 'Message must be less than 5000 characters'
      })
    }

    console.log('📧 Processing contact form submission:', {
      name,
      email,
      reason,
      ipAddress: ipAddress || req.ip,
      timestamp: new Date().toISOString()
    })

    // Send internal notification to support team
    try {
      const notificationManager = NotificationManager.getInstance()
      await notificationManager.sendContactFormNotification({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        reason,
        message: message.trim(),
        ipAddress: ipAddress || req.ip || 'Unknown',
        userAgent: userAgent || req.get('User-Agent') || 'Unknown'
      })
      
      console.log(`📧 Contact form notification sent to support team for ${email}`)
    } catch (notificationError) {
      console.error('❌ Failed to send contact form notification:', notificationError)
      // Don't fail the request if notification fails
    }

    return res.status(200).json({
      success: true,
      message: 'Contact form processed successfully'
    })

  } catch (error) {
    console.error('Error processing contact form:', error)
    return res.status(500).json({
      error: 'Internal server error'
    })
  }
})

export default router 