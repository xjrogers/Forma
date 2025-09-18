import { Response, RequestHandler, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, requireStaff } from '../middleware/authMiddleware';
import { validateTokenFormat as validateToken } from '../middleware/securityMiddleware';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../types/express';
import { Router } from 'express';
import { NotificationManager } from '../services/notificationManager';

const router = Router();
const prisma = new PrismaClient();

// Type assertion helpers
const asAuthMiddleware = (handler: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void | Response> | void | Response): RequestHandler => {
  return handler as RequestHandler;
};

const asAuthHandler = (handler: (req: AuthRequest, res: Response) => Promise<Response>): RequestHandler => {
  return ((req, res, next) => {
    return handler(req as AuthRequest, res).catch(next);
  }) as RequestHandler;
};

// Rate limit for user updates: 10 requests per minute
const updateUserLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many update requests, please try again later' }
});

// Get user by ID (Staff only)
router.get('/:userId', 
  asAuthMiddleware(authenticateToken),
  asAuthMiddleware(requireStaff),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { userId } = req.params;

      const user = await prisma.users.findUnique({
        where: { id: userId },
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
      console.error('Error fetching user:', error);
      return res.status(500).json({
        error: 'Failed to fetch user'
      });
  }
  })
);

// Update user role (Admin only)
router.patch('/:userId/role',
  asAuthMiddleware(authenticateToken),
  asAuthMiddleware(requireAdmin),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

      // Validate role
    const validRoles = ['user', 'staff', 'admin', 'banned'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
          error: 'Invalid role'
      });
    }

    // Prevent self-demotion from admin
    if (req.userId === userId && role !== 'admin') {
        return res.status(403).json({
          error: 'Admins cannot demote themselves'
      });
    }

      const user = await prisma.users.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
          role: true,
          plan: true
      }
    });

      return res.json({ user });

  } catch (error) {
      console.error('Error updating user role:', error);
      return res.status(500).json({
        error: 'Failed to update user role'
      });
  }
  })
);

// Update user plan (Admin only)
router.patch('/:userId/plan',
  asAuthMiddleware(authenticateToken),
  asAuthMiddleware(requireAdmin),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const { plan, tokensLimit } = req.body;

      // Validate plan - Updated to match current plan system
    const validPlans = ['free', 'starter', 'business'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({
          error: 'Invalid plan'
      });
    }

      // Validate tokens limit
      if (typeof tokensLimit !== 'number' || tokensLimit < 0) {
        return res.status(400).json({
          error: 'Invalid tokens limit'
        });
    }

      const user = await prisma.users.update({
      where: { id: userId },
        data: {
          plan,
          tokensLimit
        },
      select: {
        id: true,
        email: true,
          role: true,
        plan: true,
        tokensLimit: true
      }
    });

      return res.json({ user });

  } catch (error) {
      console.error('Error updating user plan:', error);
      return res.status(500).json({
        error: 'Failed to update user plan'
      });
  }
  })
);

// Ban/unban user (Admin only)
router.patch('/:userId/ban',
  asAuthMiddleware(authenticateToken),
  asAuthMiddleware(requireAdmin),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;

    // Prevent self-ban
    if (req.userId === userId) {
        return res.status(403).json({
          error: 'Admins cannot ban themselves'
      });
    }

      const user = await prisma.users.update({
      where: { id: userId },
        data: { role: 'banned' },
      select: {
        id: true,
        email: true,
        role: true
      }
    });

      return res.json({ user });

  } catch (error) {
      console.error('Error banning user:', error);
      return res.status(500).json({
        error: 'Failed to ban user'
      });
  }
  })
);

// Delete user (Admin only)
router.delete('/:userId',
  asAuthMiddleware(authenticateToken),
  asAuthMiddleware(requireAdmin),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;

    // Prevent self-deletion
    if (req.userId === userId) {
        return res.status(403).json({
          error: 'Admins cannot delete themselves'
      });
    }

      await prisma.users.delete({
      where: { id: userId }
    });

      return res.json({
      message: 'User deleted successfully'
    });

  } catch (error) {
      console.error('Error deleting user:', error);
      return res.status(500).json({
        error: 'Failed to delete user'
      });
    }
  })
);

// Update user field
router.patch('/profile/:field',
  asAuthMiddleware(authenticateToken),
  updateUserLimiter,
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { field } = req.params;
      const { value } = req.body;
      
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'Unauthorized'
        });
      }

      const userId = req.user.id;

      // Validate field name
      const allowedFields = ['firstName', 'lastName'];
      if (!allowedFields.includes(field)) {
        return res.status(400).json({
          error: 'Invalid field name'
        });
      }

      // Update the field
      const updatedUser = await prisma.users.update({
        where: { id: userId },
        data: { [field]: value },
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
          updatedAt: true,
          stripeSubscriptionId: true,
          subscriptionStatus: true,
          subscriptionEndDate: true
        }
      });

      return res.json(updatedUser);

    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({
        error: 'Failed to update user'
      });
    }
  })
);

// Change password
router.post('/change-password',
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'Unauthorized'
        });
      }

      // Validate password
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({
          error: 'New password must be at least 8 characters long'
        });
      }

      // Get user with password
      const user = await prisma.users.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          password: true
        }
      });

      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Current password is incorrect'
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await prisma.users.update({
        where: { id: req.user.id },
        data: { password: hashedPassword }
      });

      // Send password changed security notification
      try {
        const notificationManager = NotificationManager.getInstance()
        await notificationManager.sendPasswordChanged({
          userId: user.id,
          email: user.email,
          firstName: user.firstName || undefined,
          ipAddress: req.ip || req.connection.remoteAddress || undefined,
          userAgent: req.get('User-Agent') || undefined
        })
        console.log(`📧 Password changed notification sent to ${user.email}`)
      } catch (notificationError) {
        console.error(`❌ Failed to send password changed notification:`, notificationError)
        // Don't fail the password change if notification fails
      }

      return res.json({
        message: 'Password updated successfully'
      });

    } catch (error) {
      console.error('Error changing password:', error);
      return res.status(500).json({
        error: 'Failed to change password'
      });
    }
  })
);

// Connect existing GitHub repository to project
router.post('/projects/connect-github', 
  validateToken,
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const { projectId, githubRepoId, githubRepoName, repoUrl, githubPrivate } = req.body;

      if (!projectId || !githubRepoId || !githubRepoName) {
        return res.status(400).json({ 
          error: 'Project ID, repository ID, and repository name are required' 
        });
      }

      // Verify project ownership
      const project = await prisma.projects.findFirst({
        where: { id: projectId, userId }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Update project with GitHub info
      const updatedProject = await prisma.projects.update({
        where: { id: projectId },
        data: {
          githubRepoId,
          githubRepoName,
          repoUrl,
          githubPrivate: githubPrivate || false,
          updatedAt: new Date()
        }
      });

      return res.json({
        success: true,
        project: {
          id: updatedProject.id,
          githubRepoId: updatedProject.githubRepoId,
          githubRepoName: updatedProject.githubRepoName,
          repoUrl: updatedProject.repoUrl,
          githubPrivate: updatedProject.githubPrivate
        }
      });

    } catch (error) {
      console.error('Error connecting GitHub repository:', error);
      return res.status(500).json({
        error: 'Failed to connect repository'
      });
    }
  })
);

// Disconnect GitHub repository from project
router.post('/projects/disconnect-github', 
  validateToken,
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const { projectId } = req.body;

      if (!projectId) {
        return res.status(400).json({ 
          error: 'Project ID is required' 
        });
      }

      // Verify project ownership
      const project = await prisma.projects.findFirst({
        where: { id: projectId, userId }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Remove GitHub info from project
      const updatedProject = await prisma.projects.update({
        where: { id: projectId },
        data: {
          githubRepoId: null,
          githubRepoName: null,
          repoUrl: null,
          githubPrivate: false,
          updatedAt: new Date()
        }
      });

      return res.json({
        success: true,
        message: 'GitHub repository disconnected successfully',
        project: {
          id: updatedProject.id,
          githubRepoId: null,
          githubRepoName: null,
          repoUrl: null,
          githubPrivate: false
        }
      });

    } catch (error) {
      console.error('Error disconnecting GitHub repository:', error);
      return res.status(500).json({
        error: 'Failed to disconnect repository'
      });
    }
  })
);

export default router; 