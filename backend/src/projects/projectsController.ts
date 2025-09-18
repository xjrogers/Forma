import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types/express';
import { rateLimit } from 'express-rate-limit';
import { githubService } from '../services/github';
import { randomUUID } from 'crypto';
import { GitHubService } from '../services/github';

// Rate limiter for general project operations
export const projectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many project operations, please try again later'
});

// Stricter rate limiter for project creation
export const createProjectLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 projects per hour
  message: 'Project creation limit reached. Please try again later.',
  skipFailedRequests: true // Only count successful project creations
});

export class ProjectsController {
  // Get all projects for the authenticated user
  static async getUserProjects(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const projects = await prisma.projects.findMany({
        where: {
          userId: req.user.id
        },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          branch: true,
          tokensUsed: true,
          // GitHub info
          githubRepoId: true,
          githubRepoName: true,
          githubPrivate: true,
          repoUrl: true,
          // Database info (masked)
          dbHost: true,
          dbName: true,
          dbUser: true,
          // Don't include dbPassword for security
          // Include files
          files: {
            select: {
              id: true,
              path: true,
              contentType: true,
              size: true,
              createdAt: true,
              updatedAt: true
            },
            orderBy: {
              path: 'asc'
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });

      // Enhance projects with additional info
      const enhancedProjects = projects.map(project => ({
        ...project,
        // Format dates for frontend
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        // Add GitHub URL if available
        githubUrl: project.githubRepoName 
          ? `https://github.com/${process.env.GITHUB_USERNAME}/${project.githubRepoName}`
          : null,
        // Add status indicators
        hasGithub: !!project.githubRepoName,
        hasDatabase: !!(project.dbHost && project.dbName && project.dbUser),
        // Add file stats
        fileCount: project.files.length,
        totalSize: project.files.reduce((sum, f) => sum + f.size, 0),
        // Format file dates
        files: project.files.map(f => ({
          ...f,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
          // Add human-readable size
          sizeFormatted: formatFileSize(f.size)
        })),
        // Mask sensitive info
        dbHost: project.dbHost ? `${project.dbHost.split('.')[0]}...` : null,
        dbUser: project.dbUser ? `${project.dbUser.substring(0, 3)}...` : null,
      }));

      return res.status(200).json({ 
        projects: enhancedProjects,
        total: enhancedProjects.length,
        tokensUsed: enhancedProjects.reduce((sum, p) => sum + p.tokensUsed, 0)
      });
    } catch (error) {
      console.error('Error fetching user projects:', error);
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }
  }

  // Create a new project
  static async createProject(req: AuthRequest, res: Response): Promise<Response> {
    try {
      console.log('Creating project with user:', req.user);
      
      if (!req.user?.id) {
        console.log('Unauthorized: No user ID in request');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, description, isPrivate = true } = req.body;
      console.log('Project details:', { name, description, isPrivate });

      if (!name) {
        console.log('Validation failed: Project name is required');
        return res.status(400).json({ error: 'Project name is required' });
      }

      let githubRepo = null;

      // Get user's GitHub token
      const user = await prisma.users.findUnique({
        where: { id: req.user.id },
        select: {
          githubAccessToken: true,
          githubUsername: true
        }
      });
      console.log('Found user GitHub info:', { 
        hasToken: !!user?.githubAccessToken,
        hasUsername: !!user?.githubUsername 
      });

      // Only try to create GitHub repo if user has connected their account
      if (user?.githubAccessToken) {
        try {
          console.log('Creating GitHub repository...');
          const github = GitHubService.getInstance(user.githubAccessToken);
          githubRepo = await github.createRepository({
            name,
            description,
            private: isPrivate
          });
          console.log('GitHub repository created:', { 
            repoId: githubRepo.id,
            repoName: githubRepo.name 
          });
        } catch (error) {
          console.error('Failed to create GitHub repository:', error);
          if (error instanceof Error && error.message.includes('GitHub authentication failed')) {
            // Don't block project creation, just note GitHub failed
            console.log('GitHub auth failed, continuing without GitHub repo');
          } else {
            console.error('Unexpected GitHub error:', error);
          }
          // Continue without GitHub integration
        }
      }

      // Create project in our database
      console.log('Creating project in database...');
      const project = await prisma.projects.create({
        data: {
          id: randomUUID(),
          name,
          description,
          users: {
            connect: {
              id: req.user.id
            }
          },
          // Only set GitHub fields if we successfully created a repo
          ...(githubRepo ? {
            githubRepoId: githubRepo.id.toString(),
            githubRepoName: githubRepo.name,
            githubPrivate: isPrivate,
          } : {}),
          branch: 'main', // Default branch
          updatedAt: new Date()
        }
      });
      console.log('Project created in database:', { projectId: project.id });

      return res.status(201).json({ 
        project,
        githubStatus: githubRepo ? 'connected' : 'not_connected'
      });
    } catch (error) {
      console.error('Error creating project:', error);
      return res.status(500).json({ error: 'Failed to create project' });
    }
  }

  // Get a single project by ID
  static async getProject(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId } = req.params;
      const { includeContent = 'false' } = req.query;

      const project = await prisma.projects.findFirst({
        where: {
          id: projectId,
          userId: req.user.id
        },
        include: {
          files: {
            select: {
              id: true,
              path: true,
              contentType: true,
              size: true,
              createdAt: true,
              updatedAt: true,
              // Only include content if explicitly requested (for file editor)
              ...(includeContent === 'true' && {
                content: true
              })
            },
            orderBy: { path: 'asc' }
          }
        }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Format the response like Bolt.new - efficient file tree
      const formattedProject = {
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        files: project.files.map(f => ({
          id: f.id,
          path: f.path,
          contentType: f.contentType,
          size: f.size,
          sizeFormatted: formatFileSize(f.size),
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
          // Only include content if requested
          ...(includeContent === 'true' && f.content && {
            content: f.content
          })
        })),
        // Add file stats
        fileCount: project.files.length,
        totalSize: project.files.reduce((sum, f) => sum + f.size, 0)
      };

      return res.status(200).json({ project: formattedProject });
    } catch (error) {
      console.error('Error fetching project:', error);
      return res.status(500).json({ error: 'Failed to fetch project' });
    }
  }

  // Update a project
  static async updateProject(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId } = req.params;
      const {
        name,
        description,
        dbName,
        dbHost,
        dbUser,
        dbPassword,
        repoUrl,
        branch,
        githubPrivate
      } = req.body;

      const project = await prisma.projects.findFirst({
        where: {
          id: projectId,
          userId: req.user.id
        }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Build update data object, only including fields that are provided
      const updateData: any = {
        updatedAt: new Date()
      };

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (dbName !== undefined) updateData.dbName = dbName;
      if (dbHost !== undefined) updateData.dbHost = dbHost;
      if (dbUser !== undefined) updateData.dbUser = dbUser;
      if (dbPassword !== undefined) updateData.dbPassword = dbPassword;
      if (repoUrl !== undefined) updateData.repoUrl = repoUrl;
      if (branch !== undefined) updateData.branch = branch;
      if (githubPrivate !== undefined) updateData.githubPrivate = githubPrivate;

      const updatedProject = await prisma.projects.update({
        where: {
          id: projectId
        },
        data: updateData
      });

      return res.status(200).json({ 
        success: true, 
        project: updatedProject 
      });
    } catch (error) {
      console.error('Error updating project:', error);
      return res.status(500).json({ error: 'Failed to update project' });
    }
  }

  // Delete a project
  static async deleteProject(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId } = req.params;

      const project = await prisma.projects.findFirst({
        where: {
          id: projectId,
          userId: req.user.id
        }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Delete GitHub repository if it exists
      if (project.githubRepoName) {
        try {
          await githubService.deleteRepository(project.githubRepoName);
        } catch (error) {
          console.error('Error deleting GitHub repository:', error);
          // Continue with local deletion even if GitHub deletion fails
        }
      }

      // Delete project from our database
      await prisma.projects.delete({
        where: {
          id: projectId
        }
      });

      return res.status(200).json({ message: 'Project deleted successfully' });
    } catch (error) {
      console.error('Error deleting project:', error);
      return res.status(500).json({ error: 'Failed to delete project' });
    }
  }

  // Get individual file content (Bolt.new style on-demand loading)
  static async getFileContent(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId, fileId } = req.params;

      // Verify project access
      const project = await prisma.projects.findFirst({
        where: {
          id: projectId,
          userId: req.user.id
        }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get file with content
      const file = await prisma.projectFiles.findFirst({
        where: {
          id: fileId,
          projectId
        },
        select: {
          id: true,
          path: true,
          content: true,
          contentType: true,
          size: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const formattedFile = {
        ...file,
        content: file.content || '',
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),
        sizeFormatted: formatFileSize(file.size)
      };

      return res.status(200).json({ file: formattedFile });
    } catch (error) {
      console.error('Error fetching file content:', error);
      return res.status(500).json({ error: 'Failed to fetch file content' });
    }
  }

  // Update file content with rate limiting
  static async updateFileContent(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId, fileId } = req.params;
      const { content } = req.body;

      // Validate content
      if (typeof content !== 'string') {
        return res.status(400).json({ error: 'Content must be a string' });
      }

      // Content size limit (5MB)
      if (content.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'File content too large (max 5MB)' });
      }

      // Verify project access
      const project = await prisma.projects.findFirst({
        where: {
          id: projectId,
          userId: req.user.id
        }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check if file exists and belongs to the project
      const existingFile = await prisma.projectFiles.findFirst({
        where: {
          id: fileId,
          projectId: projectId
        }
      });

      if (!existingFile) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Update file content and metadata
      const updatedFile = await prisma.projectFiles.update({
        where: {
          id: fileId
        },
        data: {
          content: content,
          size: Buffer.byteLength(content, 'utf8'),
          updatedAt: new Date()
        },
        select: {
          id: true,
          path: true,
          content: true,
          contentType: true,
          size: true,
          createdAt: true,
          updatedAt: true
        }
      });

      // Also update the project's updatedAt timestamp
      await prisma.projects.update({
        where: {
          id: projectId
        },
        data: {
          updatedAt: new Date()
        }
      });

      const formattedFile = {
        ...updatedFile,
        content: updatedFile.content || '',
        createdAt: updatedFile.createdAt.toISOString(),
        updatedAt: updatedFile.updatedAt.toISOString(),
        sizeFormatted: formatFileSize(updatedFile.size)
      };

      console.log(`✅ File updated: ${existingFile.path} (${content.length} chars) by user ${req.user.id}`);

      return res.status(200).json({
        success: true,
        file: formattedFile
      });

    } catch (error) {
      console.error('Error updating file content:', error);
      return res.status(500).json({ error: 'Failed to update file content' });
    }
  }

  // Delete all messages for a project
  static async deleteProjectMessages(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId } = req.params;

      // Verify the user owns the project
      const project = await prisma.projects.findFirst({
        where: {
          id: projectId,
          userId: req.user.id
        }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Delete all messages for conversations belonging to this project
      const result = await prisma.messages.deleteMany({
        where: {
          conversation: {
            projectId: projectId
          }
        }
      });

      return res.status(200).json({ 
        success: true, 
        deletedCount: result.count,
        message: `Deleted ${result.count} messages successfully` 
      });
    } catch (error) {
      console.error('Error deleting project messages:', error);
      return res.status(500).json({ error: 'Failed to delete messages' });
    }
  }

  // Estimate tokens for project import
  static async estimateImportTokens(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { repository, config } = req.body;

      if (!repository || !config) {
        return res.status(400).json({ error: 'Repository and configuration are required' });
      }

      // Import token estimation service
      const { TokenEstimationService } = await import('../services/tokenEstimationService');
      
      const estimate = TokenEstimationService.estimateImportTokens(repository, config);
      const level = TokenEstimationService.getEstimateLevel(estimate.totalTokens);
      const formattedBreakdown = TokenEstimationService.formatTokenEstimate(estimate);

      // Get user's current token balance using TokenService
      const { tokenService } = await import('../services/tokenService');
      const balance = await tokenService.getTokenBalance(req.user.id);
      const canAfford = balance.totalAvailable >= estimate.totalTokens;

      return res.json({
        estimate: {
          ...estimate,
          level,
          formattedBreakdown
        },
        userBalance: {
          ...balance,
          canAfford
        }
      });

    } catch (error) {
      console.error('Error estimating import tokens:', error);
      return res.status(500).json({ error: 'Failed to estimate tokens' });
    }
  }

  // Import project from GitHub with AI analysis (queued)
  static async importProject(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { repository, config } = req.body;

      if (!repository || !config) {
        return res.status(400).json({ error: 'Repository and configuration are required' });
      }

      // Estimate tokens needed
      const { TokenEstimationService } = await import('../services/tokenEstimationService');
      const estimate = TokenEstimationService.estimateImportTokens(repository, config);

      // Check user's token balance
      const user = await prisma.users.findUnique({
        where: { id: req.user.id },
        select: { 
          tokensUsed: true, 
          tokensLimit: true, 
          githubAccessToken: true 
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Use TokenService for validation
      const { tokenService } = await import('../services/tokenService');
      const balance = await tokenService.getTokenBalance(req.user.id);
      if (balance.totalAvailable < estimate.totalTokens) {
        return res.status(400).json({ 
          error: 'Insufficient tokens',
          message: `Import requires ${estimate.totalTokens.toLocaleString()} tokens, but you only have ${balance.totalAvailable.toLocaleString()} remaining.`,
          estimate: estimate,
          balance: balance
        });
      }

      if (!user.githubAccessToken) {
        return res.status(400).json({ error: 'GitHub account not connected' });
      }

      // Create placeholder project
      const project = await prisma.projects.create({
        data: {
          id: randomUUID(),
          name: config.projectName,
          description: 'Import queued...',
          userId: req.user.id,
          githubRepoId: repository.id.toString(),
          githubRepoName: repository.name,
          githubPrivate: repository.private,
          repoUrl: repository.clone_url,
          branch: repository.default_branch,
          updatedAt: new Date()
        }
      });

      // Add to import queue
      const { queueService } = await import('../services/queueService');
      const job = await queueService.queueProjectImport({
        importId: project.id,
        userId: req.user.id,
        repository,
        config,
        estimatedTokens: estimate.totalTokens
      });

      console.log(`📦 Queued import job ${job.id} for project ${project.id}`);

      return res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          status: 'queued'
        },
        job: {
          id: job.id,
          status: 'queued'
        },
        estimate: estimate
      });

    } catch (error) {
      console.error('Error queuing import:', error);
      return res.status(500).json({ error: 'Failed to queue import' });
    }
  }

  // Get import job status
  static async getImportStatus(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { jobId } = req.params;

      const { queueService } = await import('../services/queueService');
      const jobStatus = await queueService.getImportJobStatus(jobId);

      if (!jobStatus) {
        return res.status(404).json({ error: 'Import job not found' });
      }

      // Verify user owns this job
      if (jobStatus.data.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.json({
        job: jobStatus,
        project: {
          id: jobStatus.data.importId,
          name: jobStatus.data.repository.name
        }
      });

    } catch (error) {
      console.error('Error getting import status:', error);
      return res.status(500).json({ error: 'Failed to get import status' });
    }
  }
} 

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
} 