import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(req, params.path, 'GET')
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(req, params.path, 'POST')
}

export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(req, params.path, 'PATCH')
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(req, params.path, 'PUT')
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(req, params.path, 'DELETE')
}

async function handleRequest(req: NextRequest, path: string[], method: string) {
  try {
    // Construct the backend URL with query parameters
    const baseUrl = `${BACKEND_URL}/api/${path.join('/')}`
    const searchParams = req.nextUrl.searchParams.toString()
    const url = searchParams ? `${baseUrl}?${searchParams}` : baseUrl
    
    console.log('🔄 API PROXY: Forwarding request to:', url)

    // Get cookies from the request
    const cookieHeader = req.headers.get('cookie') || ''

    // Get request body if present
    let body = null
    if (method !== 'GET' && method !== 'DELETE') {
      try {
        const contentType = req.headers.get('content-type') || ''
        const contentLength = req.headers.get('content-length')
        
        // Only try to read body if there's actually content
        if (contentLength && parseInt(contentLength) > 0) {
          if (contentType.includes('application/json')) {
            body = await req.json()
          } else {
            body = await req.text()
          }
        }
      } catch (e) {
        console.error('Error reading request body:', e)
      }
    }

    // Forward the request to the backend
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      },
      credentials: 'include',
      ...(body ? { body: JSON.stringify(body) } : {})
    })

    // Get the response data
    let data
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => null)
    } else if (contentType.includes('application/octet-stream') || contentType.includes('application/zip')) {
      // Handle binary data (like ZIP files) - don't convert to text!
      data = await response.arrayBuffer()
    } else {
      data = await response.text()
    }

    // Log error responses
    if (!response.ok) {
      console.error('Backend error:', {
        url,
        method,
        status: response.status,
        data
      })
    }

    // Create the response
    let nextResponse: NextResponse | undefined
    if (data instanceof ArrayBuffer) {
      // Handle binary data - preserve original headers
      nextResponse = new NextResponse(data, { status: response.status })
      // Copy important headers from backend response
      const headersToForward = ['content-type', 'content-disposition', 'content-length', 'transfer-encoding']
      headersToForward.forEach(header => {
        const value = response.headers.get(header)
        if (value && nextResponse) {
          nextResponse.headers.set(header, value)
        }
      })
    } else if (data) {
      nextResponse = typeof data === 'string' 
          ? new NextResponse(data, { status: response.status })
        : NextResponse.json(data, { status: response.status })
    } else {
      nextResponse = NextResponse.json(
          { error: 'Invalid response from server' },
          { status: response.status }
        )
    }

    // Forward any Set-Cookie headers
    const backendSetCookie = response.headers.get('set-cookie')
    if (backendSetCookie) {
      nextResponse.headers.set('set-cookie', backendSetCookie)
    }

    return nextResponse
  } catch (error) {
    console.error('API proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 