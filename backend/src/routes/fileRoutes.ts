import { Router, Response, Request } from 'express';
import { storage } from '../services/storage';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types/express';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import mime from 'mime-types';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Rate limiter for file operations
const fileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Limit each IP to 100 requests per window
});

// Upload a file
router.post('/:projectId/*', 
  authenticateToken as any,
  fileLimiter, 
  upload.single('file'), 
  async (req: Request, res: Response) => {
    let r2Key: string | null = null;

    try {
      const authReq = req as AuthRequest;
      if (!authReq.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId } = req.params;
      const filePath = req.params[0];

      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Check project access
      const project = await prisma.projects.findFirst({
        where: {
          id: projectId,
          userId: authReq.user.id
        }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check if file already exists
      const existingFile = await prisma.projectFiles.findFirst({
        where: {
          projectId,
          path: filePath
        }
      });

      if (existingFile) {
        return res.status(409).json({ error: 'File already exists' });
      }

      // Use a transaction to ensure both operations succeed or fail together
      const file = await prisma.$transaction(async (tx) => {
        try {
          // Upload to R2 first
          const contentType = req.file!.mimetype || mime.lookup(filePath) || 'application/octet-stream';
          r2Key = await storage.saveFile(projectId, filePath, req.file!.buffer, contentType);

          // If R2 upload succeeded, create database record
          return await tx.projectFiles.create({
            data: {
              projectId,
              path: filePath,
              r2Key,
              contentType,
              size: req.file!.size
            }
          });
        } catch (error) {
          // If anything fails and we uploaded to R2, clean it up
          if (r2Key) {
            try {
              await storage.deleteFile(r2Key);
            } catch (cleanupError) {
              console.error('Failed to clean up R2 file after error:', cleanupError);
            }
          }
          throw error; // Re-throw to trigger transaction rollback
        }
      });

      return res.status(201).json({ file });
    } catch (error) {
      console.error('Error uploading file:', error);
      // If the transaction failed but we uploaded to R2, make sure it's cleaned up
      if (r2Key) {
        try {
          await storage.deleteFile(r2Key);
        } catch (cleanupError) {
          console.error('Failed to clean up R2 file after transaction error:', cleanupError);
        }
      }
      if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to upload file' });
    }
  }
);

// Download a file
router.get('/:projectId/*', 
  authenticateToken as any,
  fileLimiter, 
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId } = req.params;
      const filePath = req.params[0];

      // Check project access
      const project = await prisma.projects.findFirst({
        where: {
          id: projectId,
          userId: authReq.user.id
        }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get file record
      const file = await prisma.projectFiles.findFirst({
        where: {
          projectId,
          path: filePath
        }
      });

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      let content: Buffer | string;

      // Check if file is in R2 or still in database
      if (file.r2Key) {
        // Get file from R2 (returns Buffer)
        content = await storage.getFile(file.r2Key);
      } else if (file.content) {
        // File is still in database (pending upload)
        content = file.content;
      } else {
        return res.status(404).json({ error: 'File content not available' });
      }

      // Set appropriate headers
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Length', file.size);
      res.setHeader('Cache-Control', 'max-age=3600');

      return res.send(content);
    } catch (error) {
      console.error('Error downloading file:', error);
      return res.status(500).json({ error: 'Failed to download file' });
    }
  }
);

// Delete a file
router.delete('/:projectId/*', 
  authenticateToken as any,
  fileLimiter, 
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId } = req.params;
      const filePath = req.params[0];

      // Check project access
      const project = await prisma.projects.findFirst({
        where: {
          id: projectId,
          userId: authReq.user.id
        }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get file record
      const file = await prisma.projectFiles.findFirst({
        where: {
          projectId,
          path: filePath
        }
      });

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Use a transaction to ensure both operations succeed or fail together
      await prisma.$transaction(async (tx) => {
        // Only try to delete from R2 if the file has been uploaded there
        if (file.r2Key) {
          try {
            // Try to delete from R2 first
            await storage.deleteFile(file.r2Key);
          } catch (error) {
            console.error('Error deleting from R2:', error);
            // If R2 deletion fails, don't delete from database
            throw new Error('Failed to delete file from storage');
          }
        }

        // Delete from database (whether it was in R2 or just in DB)
        await tx.projectFiles.delete({
          where: {
            id: file.id
          }
        });
      });

      return res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
      console.error('Error deleting file:', error);
      if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to delete file' });
    }
  }
);

// List files in a project
router.get('/:projectId', 
  authenticateToken as any,
  fileLimiter, 
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId } = req.params;

      // Check project access
      const project = await prisma.projects.findFirst({
        where: {
          id: projectId,
          userId: authReq.user.id
        }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get all files for the project
      const files = await prisma.projectFiles.findMany({
        where: {
          projectId
        },
        orderBy: {
          path: 'asc'
        }
      });

      return res.status(200).json({ files });
    } catch (error) {
      console.error('Error listing files:', error);
      return res.status(500).json({ error: 'Failed to list files' });
    }
  }
);

export default router; 