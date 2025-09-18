import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, reason, message } = body

    // Validate required fields
    if (!name || !email || !reason || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate message length
    if (message.length < 10) {
      return NextResponse.json(
        { error: 'Message must be at least 10 characters long' },
        { status: 400 }
      )
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message must be less than 5000 characters' },
        { status: 400 }
      )
    }

    // Get client information
    const ipAddress = request.ip || 
                     request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'Unknown'
    const userAgent = request.headers.get('user-agent') || 'Unknown'

    console.log('📧 Contact form submission:', {
      name,
      email,
      reason,
      ipAddress,
      timestamp: new Date().toISOString()
    })

    // Send to backend API for processing
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${backendUrl}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          reason,
          message,
          ipAddress,
          userAgent
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Backend service unavailable' }))
        throw new Error(errorData.error || 'Failed to process contact form')
      }

      console.log(`📧 Contact form processed successfully for ${email}`)
    } catch (backendError) {
      console.error('❌ Backend contact processing failed:', backendError)
      // Continue anyway - we don't want to fail the user experience if backend is down
      // In production, you might want to store this in a database or queue for retry
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Thank you for your message. We\'ll get back to you within 24 hours!' 
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Error processing contact form:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 