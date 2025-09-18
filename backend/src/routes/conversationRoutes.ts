import { Router, Response } from 'express';
import { AuthRequest } from '../types/express';
import { prisma } from '../lib/prisma';
import { authenticateToken, asAuthMiddleware, asAuthHandler } from '../middleware/authMiddleware';

const router = Router();

// All conversation routes require authentication
router.use(asAuthMiddleware(authenticateToken));

// Get conversation history for a project with pagination (POST with body)
router.post('/:projectId/paginated', asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.body;
    
    // Pagination parameters
    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const offset = (pageNum - 1) * limitNum;

    // Verify user has access to this project
    const project = await prisma.projects.findFirst({
      where: {
        id: projectId,
        userId: userId
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Find conversation for this project
    const conversation = await prisma.conversations.findFirst({
      where: {
        projectId: projectId,
        userId: userId
      }
    });

    if (!conversation) {
      return res.json({ 
        messages: [], 
        hasMore: false,
        totalCount: 0,
        currentPage: pageNum
      });
    }

    // Get total count of messages
    const totalCount = await prisma.messages.count({
      where: {
        conversationId: conversation.id
      }
    });

    // Get paginated messages (most recent first for pagination, then reverse for chronological order)
    const messages = await prisma.messages.findMany({
      where: {
        conversationId: conversation.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: limitNum
    });

    // Reverse to show chronological order (oldest first within this page)
    const chronologicalMessages = messages.reverse();

    const hasMore = offset + messages.length < totalCount;

    return res.json({
      conversationId: conversation.id,
      messages: chronologicalMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
        metadata: msg.metadata
      })),
      hasMore,
      totalCount,
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum)
    });

  } catch (error) {
    console.error('Failed to load conversation:', error);
    return res.status(500).json({ error: 'Failed to load conversation' });
  }
}));

// Get conversation history for a project (initial load only)
router.get('/:projectId', asAuthHandler(async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    
    // Default pagination for initial load
    const page = 1;
    const limit = 20;
    const offset = 0;

    // Verify user has access to this project
    const project = await prisma.projects.findFirst({
      where: {
        id: projectId,
        userId: userId
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Find conversation for this project
    const conversation = await prisma.conversations.findFirst({
      where: {
        projectId: projectId,
        userId: userId
      }
    });

    if (!conversation) {
      return res.json({ 
        messages: [], 
        hasMore: false,
        totalCount: 0,
        currentPage: page
      });
    }

    // Get total count of messages
    const totalCount = await prisma.messages.count({
      where: {
        conversationId: conversation.id
      }
    });

    // Get paginated messages (most recent first for pagination, then reverse for chronological order)
    const messages = await prisma.messages.findMany({
      where: {
        conversationId: conversation.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: limit
    });

    // Reverse to show chronological order (oldest first within this page)
    const chronologicalMessages = messages.reverse();

    const hasMore = offset + messages.length < totalCount;

    return res.json({
      conversationId: conversation.id,
      messages: chronologicalMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
        metadata: msg.metadata
      })),
      hasMore,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit)
    });

  } catch (error) {
    console.error('Failed to load conversation:', error);
    return res.status(500).json({ error: 'Failed to load conversation' });
  }
}));

export default router; 