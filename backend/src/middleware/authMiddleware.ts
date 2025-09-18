import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types/express';

const prisma = new PrismaClient();

// Basic authentication middleware
export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const token = req.cookies.accessToken;

    if (!token) {
      return res.status(401).json({
        error: 'Not authenticated'
      });
    }

    // Verify JWT token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    const decoded = jwt.verify(token, secret) as any;
    
    // Check if user still exists and is not banned
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        plan: true,
        subscriptionStatus: true,
        subscriptionEndDate: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'User not found'
      });
    }

    if (user.role === 'banned') {
      return res.status(403).json({
        error: 'Account has been suspended'
      });
    }

    // Note: Subscription expiration is now handled by Stripe webhooks
    // This ensures proper token limit management and prevents race conditions

    // Attach user info to request
    req.userId = user.id;
    req.user = user;
    
    next();

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: 'Invalid access token'
      });
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: 'Access token expired'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Role-based access control middleware
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void | Response => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Admin-only middleware
export const requireAdmin = requireRole(['admin']);

// Staff or Admin middleware
export const requireStaff = requireRole(['staff', 'admin']);

// Plan-based access control
export const requirePlan = (allowedPlans: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void | Response => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!allowedPlans.includes(user.plan)) {
      return res.status(403).json({
        error: 'Upgrade required for this feature',
        requiredPlans: allowedPlans,
        currentPlan: user.plan
      });
    }

    next();
  };
};

// Pro plan or higher middleware
export const requirePro = requirePlan(['pro', 'team', 'enterprise']);

// Team plan or higher middleware  
export const requireTeam = requirePlan(['team', 'enterprise']);

// Rate limiting middleware (basic implementation)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (maxRequests: number, windowMs: number) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const key = req.userId || req.ip || 'unknown';
    const now = Date.now();
    
    const userLimit = rateLimitStore.get(key);
    
    if (!userLimit || now > userLimit.resetTime) {
      // Reset or create new limit
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    if (userLimit.count >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
      });
      return;
    }
    
    userLimit.count++;
    next();
  };
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET is not defined');
      }
      const decoded = jwt.verify(token, secret) as any;
      
      const user = await prisma.users.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          plan: true
        }
      });

      if (user && user.role !== 'banned') {
        req.userId = user.id;
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// WebSocket authentication function
export const authenticateTokenWS = async (token: string): Promise<{ id: string } | null> => {
  try {
    if (!token) {
      return null;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }

    const decoded = jwt.verify(token, secret) as { userId: string };
    
    // Verify user exists in database and is not banned
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: { 
        id: true,
        role: true
      }
    });

    if (!user || user.role === 'banned') {
      return null;
    }

    return { id: user.id };
  } catch (error) {
    console.error('WebSocket authentication failed:', error);
    return null;
  }
};

// Type assertion helpers for Express route handlers
export const asAuthMiddleware = (middleware: any) => middleware;
export const asAuthHandler = (handler: any) => handler; 