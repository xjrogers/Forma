import { Router } from 'express';
import { 
  register, 
  login, 
  logout, 
  refreshToken, 
  getProfile, 
  getWebSocketToken,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword
} from '../auth/authController';
import { authenticateToken } from '../middleware/authMiddleware';
import { 
  authRateLimit, 
  registerRateLimit, 
  sanitizeInput,
  validateTokenFormat as validateToken
} from '../middleware/securityMiddleware';
import { GitHubService } from '../services/github';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Request, Response, RequestHandler, NextFunction } from 'express';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types/express';

const router = Router();

// Type assertion helper for middleware (with next)
const asAuthMiddleware = (handler: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void | Response>): RequestHandler => {
  return handler as RequestHandler;
};

// Type assertion helper for route handlers (no next)
const asAuthHandler = (handler: (req: AuthRequest, res: Response) => Promise<void | Response>): RequestHandler => {
  return handler as RequestHandler;
};

// Public routes with enhanced security
router.post('/register', registerRateLimit, sanitizeInput, register);
router.post('/login', authRateLimit, sanitizeInput, login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// Protected routes with token validation
router.get('/profile', validateToken, asAuthMiddleware(authenticateToken), asAuthHandler(getProfile));
router.get('/me', validateToken, asAuthMiddleware(authenticateToken), asAuthHandler(getProfile));
router.get('/ws-token', validateToken, asAuthMiddleware(authenticateToken), asAuthHandler(getWebSocketToken));

// Email verification routes
router.post('/verify-email', authRateLimit, sanitizeInput, verifyEmail);
router.post('/resend-verification', authRateLimit, sanitizeInput, resendVerification);

// Password reset routes
router.post('/forgot-password', authRateLimit, sanitizeInput, forgotPassword);
router.post('/reset-password', authRateLimit, sanitizeInput, resetPassword);

// GitHub OAuth routes
router.get('/github', (_req: Request, res: Response) => {
  // Generate a random state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('github_state', state, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000 // 10 minutes
  });
  
  const authUrl = GitHubService.getAuthUrl(state);
  res.redirect(authUrl);
});

// GitHub OAuth popup route (for in-app authentication)
router.get('/github/popup', (_req: Request, res: Response) => {
  // Generate a random state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('github_state', state, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000 // 10 minutes
  });
  
  const authUrl = GitHubService.getAuthUrl(state, true); // isPopup = true
  res.redirect(authUrl);
});

router.get('/github/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, popup } = req.query;
    const savedState = req.cookies.github_state;

    console.log('🔍 GitHub callback validation:', {
      code: !!code,
      state: state,
      savedState: savedState,
      popup: popup,
      stateMatch: state === savedState
    });

    // For popup flows, be more lenient with state validation
    if (!code) {
      console.log('❌ Missing authorization code');
      throw new Error('Missing authorization code');
    }
    
    if (!state) {
      console.log('❌ Missing state parameter');
      throw new Error('Missing state parameter');
    }
    
    // Only validate state for non-popup flows
    if (popup !== 'true' && (!savedState || state !== savedState)) {
      console.log('❌ State validation failed:', { code: !!code, state, savedState, match: state === savedState });
      throw new Error('Invalid state or missing code');
    }
    
    if (popup === 'true') {
      console.log('✅ Popup flow - skipping strict state validation');
    }

    // Clear the state cookie
    res.clearCookie('github_state');

    // Exchange code for access token
    const { accessToken } = await GitHubService.exchangeCode(code as string);

    // Get user info from GitHub
    const github = GitHubService.getInstance(accessToken);
    const githubUser = await github.getAuthenticatedUser();

    // Check if user is already logged in (from existing session)
    let currentUser = null;
    try {
      const token = req.cookies.accessToken;
      if (token) {
        const secret = process.env.JWT_SECRET;
        if (secret) {
          const decoded = jwt.verify(token, secret) as any;
          currentUser = await prisma.users.findUnique({
            where: { id: decoded.userId }
          });
          console.log('🔍 Found existing logged-in user:', { id: currentUser?.id, email: currentUser?.email });
        }
      }
    } catch (error) {
      console.log('🔍 No valid existing session found');
    }

    let user;

    if (currentUser) {
      // User is already logged in - link GitHub to existing account
      console.log('🔗 Linking GitHub to existing user account:', currentUser.id);
      user = await prisma.users.update({
        where: { id: currentUser.id },
        data: {
          githubId: githubUser.id.toString(),
          githubUsername: githubUser.login,
          githubAccessToken: accessToken,
          githubTokenExpiresAt: null, // GitHub tokens don't expire
          updatedAt: new Date()
        }
      });
    } else {
      // No existing session - find or create user by GitHub ID/email
      user = await prisma.users.findFirst({
        where: {
          OR: [
            { githubId: githubUser.id ? githubUser.id.toString() : undefined },
            { email: githubUser.email || undefined }
          ].filter(Boolean) as any
        }
      });

      if (user) {
        // Update existing user with GitHub info
        console.log('🔗 Updating existing user with GitHub info:', user.id);
        user = await prisma.users.update({
          where: { id: user.id },
          data: {
                         githubId: githubUser.id.toString(),
             githubUsername: githubUser.login,
             githubAccessToken: accessToken,
             githubTokenExpiresAt: null, // GitHub tokens don't expire
            updatedAt: new Date()
          }
        });
      } else {
        // Create new user
        console.log('👤 Creating new user from GitHub OAuth');
        const email = githubUser.email || `${githubUser.id}@github.noreply.com`;
        const name = githubUser.name?.split(' ') || [githubUser.login];
        
        user = await prisma.users.create({
          data: {
            email,
            password: crypto.randomBytes(32).toString('hex'), // random password
            firstName: name[0],
            lastName: name.slice(1).join(' ') || undefined,
            githubId: githubUser.id.toString(),
            githubUsername: githubUser.login,
            githubAccessToken: accessToken,
            githubTokenExpiresAt: null // GitHub tokens don't expire
          }
        });
      }
    }

    // Generate JWT tokens
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Set cookies
    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    // Handle popup vs redirect flow
    console.log('🔍 GitHub callback - popup parameter:', popup);
    console.log('🔍 User data for popup:', { id: user.id, githubUsername: user.githubUsername, githubId: user.githubId });
    
    if (popup === 'true') {
      // For popup flow, redirect to a success page with a simple success flag
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/github/success?success=true&userId=${user.id}`);
      return;
      
      // OLD popup approach (keeping as backup)
      /*
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>GitHub Authentication</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              background: #0a0a0a;
              color: white;
              overflow: hidden;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: rgba(30, 30, 30, 0.95);
              border-radius: 16px;
              backdrop-filter: blur(20px);
              border: 1px solid rgba(255, 255, 255, 0.1);
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
              max-width: 350px;
              width: 90%;
              animation: fadeIn 0.2s ease-out;
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
            }
            .icon {
              width: 48px;
              height: 48px;
              margin: 0 auto 1rem;
              background: #22c55e;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 24px;
              animation: checkmark 0.5s ease-out 0.2s both;
            }
            @keyframes checkmark {
              from { transform: scale(0); }
              to { transform: scale(1); }
            }
            h1 {
              font-size: 1.25rem;
              font-weight: 600;
              margin-bottom: 0.5rem;
              color: #ffffff;
            }
            .subtitle {
              color: rgba(255, 255, 255, 0.7);
              font-size: 0.875rem;
              margin-bottom: 1rem;
            }
            .status {
              color: #22c55e;
              font-size: 0.875rem;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✓</div>
            <h1>Authentication Complete</h1>
            <p class="subtitle">Redirecting back to Forge...</p>
            <p class="status">Success</p>
          </div>
          <script>
            console.log('GitHub auth success page loaded');
            
            // Test message sending immediately
            try {
              if (window.opener) {
                console.log('Sending test message first');
                window.opener.postMessage({ type: 'TEST_MESSAGE', test: 'hello' }, '*');
              }
            } catch (e) {
              console.error('Test message failed:', e);
            }
            
            // Send success message to parent window immediately
            try {
              if (window.opener && !window.opener.closed) {
                console.log('Sending success message to parent');
                
                const message = { 
                  type: 'GITHUB_AUTH_SUCCESS', 
                  user: ${JSON.stringify({
                    id: user.id,
                    githubUsername: user.githubUsername,
                    githubId: user.githubId
                  })} 
                };
                
                console.log('Message to send:', message);
                console.log('Target origin:', '${process.env.FRONTEND_URL || 'http://localhost:3000'}');
                
                // Send to primary target
                window.opener.postMessage(message, '${process.env.FRONTEND_URL || 'http://localhost:3000'}');
                
                // Also try sending to all possible origins as fallback
                const origins = ['http://localhost:3000', 'http://localhost:3001', '*'];
                origins.forEach(origin => {
                  try {
                    console.log('Sending to origin:', origin);
                    window.opener.postMessage(message, origin);
                  } catch (e) {
                    console.log('Failed to send to:', origin, e.message);
                  }
                });
                
                // Close after ensuring message is sent (extended for debugging)
                setTimeout(() => {
                  console.log('Closing popup window');
                  window.close();
                }, 10000); // 10 seconds to debug
              } else {
                console.log('No opener window found, closing in 2 seconds');
                setTimeout(() => window.close(), 2000);
              }
            } catch (error) {
              console.error('Error in popup:', error);
              setTimeout(() => window.close(), 2000);
            }
          </script>
        </body>
        </html>
      `);
      */
    } else {
      // Regular redirect flow
      res.redirect('/dashboard');
    }

  } catch (error) {
    console.error('GitHub OAuth error:', error);
    
    if (req.query.popup === 'true') {
      // For popup flow, return error page
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>GitHub Connection Failed</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: rgba(255,255,255,0.1);
              border-radius: 12px;
              backdrop-filter: blur(10px);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Connection Failed</h1>
            <p>Unable to connect to GitHub. Please try again.</p>
            <p>This window will close automatically...</p>
          </div>
          <script>
            // Send error message to parent window
            if (window.opener) {
                             window.opener.postMessage({ type: 'GITHUB_AUTH_ERROR', error: 'Authentication failed' }, '${process.env.FRONTEND_URL || 'http://localhost:3000'}');
            }
            // Close popup after 3 seconds
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
        </html>
      `);
    } else {
      res.redirect('/login?error=github_auth_failed');
    }
  }
});

export default router; 