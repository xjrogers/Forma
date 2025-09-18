import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { StringValue } from 'ms';
import { AuthRequest } from '../types/express';
import { sendVerificationEmail } from '../utils/verification';
import { EmailService } from '../services/emailService';
import { tokenService } from '../services/tokenService';
import { NotificationManager } from '../services/notificationManager';

const prisma = new PrismaClient();

// JWT Helper Functions
const generateToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }
  const options: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as StringValue };
  return jwt.sign({ userId }, secret, options);
};

const generateRefreshToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }
  const options: SignOptions = { expiresIn: '30d' as StringValue };
  return jwt.sign({ userId, type: 'refresh' }, secret, options);
};

// Register new user
export const register = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    // Password strength validation
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.users.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
        role: 'user',
        isVerified: false
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        plan: true,
        tokensUsed: true,
        tokensLimit: true,
        createdAt: true,
        isVerified: true
      }
    });

    // Initialize token system for the new user
    await tokenService.initializeUserTokens(user.id, 'free');

    // Send verification email
    await sendVerificationEmail(user.id);

    return res.status(201).json({
      message: 'User registered successfully. Please check your email for verification code.',
      user,
      requiresVerification: true
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      error: 'Internal server error during registration'
    });
  }
};

// Login user
export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find user
    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Check if user is banned
    if (user.role === 'banned') {
      return res.status(403).json({
        error: 'Account has been suspended. Please contact support.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({
        error: 'Account not verified. Please verify your email to continue.',
        requiresVerification: true,
        userId: user.id
      });
    }

    // Generate tokens
    const accessToken = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Set secure HTTP-only cookies for both tokens
    res.cookie('accessToken', accessToken, {
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

    // Return user data (excluding password and sensitive info)
    const { 
      password: _, 
      stripeCustomerId: __,
      verificationCode: ___,
      verificationExpires: ____,
      ...safeUserData 
    } = user;

    return res.json({
      message: 'Login successful',
      user: safeUserData
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Internal server error during login'
    });
  }
};

// Refresh access token
export const refreshToken = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token not provided'
      });
    }

    // Verify refresh token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    const decoded = jwt.verify(refreshToken, secret) as any;
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        error: 'Invalid token type'
      });
    }

    // Check if user still exists and is not banned
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || user.role === 'banned') {
      return res.status(401).json({
        error: 'User not found or account suspended'
      });
    }

    // Generate new access token
    const newAccessToken = generateToken(user.id);

    return res.json({
      accessToken: newAccessToken
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(401).json({
      error: 'Invalid or expired refresh token'
    });
  }
};

// Logout user
export const logout = async (_req: Request, res: Response): Promise<Response> => {
  try {
    // Clear both access token and refresh token cookies with same options as when setting
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    
    return res.json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      error: 'Internal server error during logout'
    });
  }
};

// Get current user profile
export const getProfile = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        plan: true,
        tokensUsed: true,
        tokensLimit: true,
        stripeCustomerId: true,
        createdAt: true,
        updatedAt: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        subscriptionEndDate: true
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    return res.json({ user });

  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Get WebSocket token for authenticated users
export const getWebSocketToken = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    // User is already authenticated via middleware
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'Not authenticated'
      });
    }

    // Get the access token from cookies (same token used for regular auth)
    const accessToken = req.cookies.accessToken;
    
    if (!accessToken) {
      return res.status(401).json({
        error: 'No access token found'
      });
    }

    // Return the token for WebSocket use
    return res.json({
      token: accessToken,
      userId: user.id
    });

  } catch (error) {
    console.error('WebSocket token generation error:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}; 

// Verify email
export const verifyEmail = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({
        error: 'User ID and verification code are required'
      });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        error: 'Email is already verified'
      });
    }

    if (!user.verificationCode || !user.verificationExpires) {
      return res.status(400).json({
        error: 'No verification code found. Please request a new one.'
      });
    }

    if (new Date() > user.verificationExpires) {
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new one.'
      });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({
        error: 'Invalid verification code'
      });
    }

    // Mark user as verified
    await prisma.users.update({
      where: { id: userId },
      data: {
        isVerified: true,
        verificationCode: null,
        verificationExpires: null
      }
    });

    // Generate tokens for automatic login
    const accessToken = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Set secure HTTP-only cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.json({
      message: 'Email verified successfully',
      isVerified: true
    });

  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({
      error: 'Internal server error during verification'
    });
  }
};

// Resend verification code
export const resendVerification = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'User ID is required'
      });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        error: 'Email is already verified'
      });
    }

    // Send new verification email
    await sendVerificationEmail(user.id);

    return res.json({
      message: 'Verification code sent successfully'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({
      error: 'Internal server error while resending verification code'
    });
  }
}; 

// Request password reset
export const forgotPassword = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required'
      });
    }

    // Find user
    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() }
    });

    // Don't reveal if user exists
    if (!user) {
      return res.status(200).json({
        message: 'If an account exists with this email, you will receive a password reset code.'
      });
    }

    // Generate reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Update user with reset code
    await prisma.users.update({
      where: { id: user.id },
      data: {
        resetCode,
        resetCodeExpires
      }
    });

    // Send reset email
    const emailService = EmailService.getInstance();
    await emailService.sendEmail({
      templateName: 'password_reset',
      toEmail: user.email,
      toName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
      recipientId: user.id,
      variables: {
        firstName: user.firstName || 'there',
        resetCode
      }
    });

    return res.status(200).json({
      message: 'If an account exists with this email, you will receive a password reset code.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      error: 'Internal server error during password reset request'
    });
  }
};

// Reset password with code
export const resetPassword = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, resetCode, newPassword } = req.body;

    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({
        error: 'Email, reset code, and new password are required'
      });
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long'
      });
    }

    // Find user
    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired reset code'
      });
    }

    // Verify reset code
    if (!user.resetCode || !user.resetCodeExpires || user.resetCode !== resetCode) {
      return res.status(400).json({
        error: 'Invalid or expired reset code'
      });
    }

    // Check if code is expired
    if (new Date() > user.resetCodeExpires) {
      return res.status(400).json({
        error: 'Reset code has expired. Please request a new one.'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear reset code
    await prisma.users.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetCode: null,
        resetCodeExpires: null
      }
    });

    // Send password changed security notification
    try {
      const notificationManager = NotificationManager.getInstance()
      await notificationManager.sendPasswordChanged({
        userId: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        ipAddress: req.ip || req.connection?.remoteAddress || undefined,
        userAgent: req.get('User-Agent') || undefined
      })
      console.log(`📧 Password reset notification sent to ${user.email}`)
    } catch (notificationError) {
      console.error(`❌ Failed to send password reset notification:`, notificationError)
      // Don't fail the password reset if notification fails
    }

    return res.status(200).json({
      message: 'Password has been reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      error: 'Internal server error during password reset'
    });
  }
}; 