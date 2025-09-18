import { Router, Response, RequestHandler, NextFunction } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { validateTokenFormat as validateToken } from '../middleware/securityMiddleware';
import { GitHubService } from '../services/github';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types/express';

const router = Router();

// Type assertion helpers
const asAuthMiddleware = (handler: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void | Response> | void | Response): RequestHandler => {
  return handler as RequestHandler;
};

const asAuthHandler = (handler: (req: AuthRequest, res: Response) => Promise<Response>): RequestHandler => {
  return ((req, res, next) => {
    return handler(req as AuthRequest, res).catch(next);
  }) as RequestHandler;
};

// Get user's GitHub repositories
router.get('/repositories', 
  validateToken,
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.id;

      // Get user's GitHub token
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { githubAccessToken: true }
      });

      if (!user?.githubAccessToken) {
        return res.status(400).json({ error: 'GitHub not connected' });
      }

      // Fetch repositories from GitHub
      const github = GitHubService.getInstance(user.githubAccessToken);
      const repositories = await github.getUserRepositories();

      return res.json(repositories);
    } catch (error) {
      console.error('Error fetching repositories:', error);
      return res.status(500).json({ error: 'Failed to fetch repositories' });
    }
  })
);

// Create a new GitHub repository and connect it to project
router.post('/create-repository', 
  validateToken,
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const { projectId, name, private: isPrivate, description } = req.body;

      if (!projectId || !name) {
        return res.status(400).json({ error: 'Project ID and repository name are required' });
      }

      // Verify project ownership
      const project = await prisma.projects.findFirst({
        where: { id: projectId, userId }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get user's GitHub token
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { githubAccessToken: true, githubUsername: true }
      });

      if (!user?.githubAccessToken) {
        return res.status(400).json({ error: 'GitHub not connected' });
      }

      // Create repository on GitHub
      const github = GitHubService.getInstance(user.githubAccessToken);
      const repo = await github.createRepository({
        name,
        description,
        private: isPrivate
      });

      // Update project with GitHub info
      await prisma.projects.update({
        where: { id: projectId },
        data: {
          githubRepoId: repo.id.toString(),
          githubRepoName: repo.full_name,
          repoUrl: repo.html_url,
          githubPrivate: repo.private,
          updatedAt: new Date()
        }
      });

      return res.json({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        html_url: repo.html_url,
        description: repo.description
      });
    } catch (error) {
      console.error('Error creating repository:', error);
      
      // Handle specific GitHub errors
      if (error instanceof Error) {
        if (error.message.includes('name already exists')) {
          return res.status(400).json({ error: 'Repository name already exists' });
        }
        if (error.message.includes('validation failed')) {
          return res.status(400).json({ error: 'Invalid repository name' });
        }
      }
      
      return res.status(500).json({ error: 'Failed to create repository' });
    }
  })
);

// Update repository visibility
router.post('/update-visibility', 
  validateToken,
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const { projectId, visibility } = req.body;

      if (!projectId || !visibility) {
        return res.status(400).json({ error: 'Project ID and visibility are required' });
      }

      if (!['public', 'private'].includes(visibility)) {
        return res.status(400).json({ error: 'Visibility must be either "public" or "private"' });
      }

      // Verify project ownership and get GitHub info
      const project = await prisma.projects.findFirst({
        where: { id: projectId, userId },
        select: { 
          id: true, 
          githubRepoName: true, 
          githubRepoId: true 
        }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!project.githubRepoName) {
        return res.status(400).json({ error: 'No GitHub repository connected to this project' });
      }

      // Get user's GitHub token
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { githubAccessToken: true }
      });

      if (!user?.githubAccessToken) {
        return res.status(400).json({ error: 'GitHub not connected' });
      }

      // Parse owner and repo from full name (e.g., "owner/repo")
      const [owner, repo] = project.githubRepoName.split('/');
      if (!owner || !repo) {
        return res.status(400).json({ error: 'Invalid repository name format' });
      }

      // Update repository visibility with proper transaction handling
      const github = GitHubService.getInstance(user.githubAccessToken);
      
      try {
        // Use a database transaction that includes the GitHub API call
        const result = await prisma.$transaction(async (tx) => {
          // First, verify project still exists and user still owns it
          const currentProject = await tx.projects.findFirst({
            where: { id: projectId, userId },
            select: { id: true, githubRepoName: true, githubPrivate: true }
          });
          
          if (!currentProject) {
            throw new Error('Project no longer exists or access denied');
          }
          
          if (currentProject.githubRepoName !== project.githubRepoName) {
            throw new Error('Project repository configuration has changed');
          }
          
          // Check if visibility is already what we want (avoid unnecessary API calls)
          const targetPrivate = visibility === 'private';
          if (currentProject.githubPrivate === targetPrivate) {
            return {
              alreadyUpToDate: true,
              repository: {
                name: repo,
                full_name: project.githubRepoName,
                private: targetPrivate,
                visibility: visibility
              }
            };
          }
          
          // Update GitHub repository visibility
          const updatedRepo = await github.updateRepositoryVisibility(owner, repo, targetPrivate);
          
          // Update the project in database
          await tx.projects.update({
            where: { id: projectId },
            data: {
              githubPrivate: targetPrivate,
              updatedAt: new Date()
            }
          });
          
          return {
            alreadyUpToDate: false,
            updatedRepo
          };
        });
        
        if (result.alreadyUpToDate) {
          return res.json({
            success: true,
            message: `Repository is already ${visibility}`,
            repository: result.repository
          });
        }

        // TypeScript guard: result.updatedRepo is guaranteed to exist when alreadyUpToDate is false
        if (!result.updatedRepo) {
          throw new Error('Updated repository data is missing');
        }

        return res.json({
          success: true,
          message: `Repository visibility updated to ${visibility}`,
          repository: {
            name: result.updatedRepo.name,
            full_name: result.updatedRepo.full_name,
            private: result.updatedRepo.private,
            visibility: result.updatedRepo.private ? 'private' : 'public'
          }
        });
      } catch (githubError: any) {
        console.error('GitHub API error:', githubError);
        
        // Handle specific GitHub API errors
        if (githubError.status === 403) {
          return res.status(403).json({ 
            error: 'Insufficient permissions to change repository visibility',
            message: 'You need admin access to this repository to change its visibility'
          });
        }
        
        if (githubError.status === 422) {
          return res.status(422).json({ 
            error: 'Repository visibility change not allowed',
            message: 'Organization settings may prevent visibility changes'
          });
        }
        
        // If it's a database transaction error, we need to handle it differently
        if (githubError.message && githubError.message.includes('Project no longer exists')) {
          return res.status(404).json({
            error: 'Project not found',
            message: 'Project may have been deleted during the update'
          });
        }
        
        if (githubError.message && githubError.message.includes('repository configuration has changed')) {
          return res.status(409).json({
            error: 'Repository configuration changed',
            message: 'The repository connection has been modified. Please refresh and try again.'
          });
        }
        
        throw githubError; // Re-throw for general error handling
      }
    } catch (error) {
      console.error('Error updating repository visibility:', error);
      return res.status(500).json({ 
        error: 'Failed to update repository visibility',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  })
);

// Update project branch with GitHub validation
router.post('/update-branch', 
  validateToken,
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const { projectId, branch, createIfMissing = false } = req.body;

      if (!projectId || !branch) {
        return res.status(400).json({ error: 'Project ID and branch name are required' });
      }

      // Validate branch name format
      const branchNameRegex = /^[a-zA-Z0-9._/-]+$/;
      if (!branchNameRegex.test(branch)) {
        return res.status(400).json({ 
          error: 'Invalid branch name', 
          message: 'Branch name can only contain letters, numbers, dots, underscores, hyphens, and forward slashes' 
        });
      }

      // Verify project ownership and get GitHub info
      const project = await prisma.projects.findFirst({
        where: { id: projectId, userId },
        select: { 
          id: true, 
          githubRepoName: true, 
          githubRepoId: true,
          branch: true
        }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!project.githubRepoName) {
        return res.status(400).json({ error: 'No GitHub repository connected to this project' });
      }

      // Get user's GitHub token
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { githubAccessToken: true }
      });

      if (!user?.githubAccessToken) {
        return res.status(400).json({ error: 'GitHub not connected' });
      }

      // Parse owner and repo from full name (e.g., "owner/repo")
      const [owner, repo] = project.githubRepoName.split('/');
      if (!owner || !repo) {
        return res.status(400).json({ error: 'Invalid repository name format' });
      }

      // Update branch with proper transaction handling
      const github = GitHubService.getInstance(user.githubAccessToken);
      
      try {
        // Use a database transaction that includes the GitHub API call
        const result = await prisma.$transaction(async (tx) => {
          // First, verify project still exists and user still owns it
          const currentProject = await tx.projects.findFirst({
            where: { id: projectId, userId },
            select: { id: true, githubRepoName: true, branch: true }
          });
          
          if (!currentProject) {
            throw new Error('Project no longer exists or access denied');
          }
          
          if (currentProject.githubRepoName !== project.githubRepoName) {
            throw new Error('Project repository configuration has changed');
          }
          
          // Check if branch is already what we want (avoid unnecessary API calls)
          if (currentProject.branch === branch) {
            return {
              alreadyUpToDate: true,
              branch: {
                name: branch,
                current: true
              }
            };
          }
          
          // Validate and setup branch on GitHub
          const branchResult = await github.validateAndSetupBranch(owner, repo, branch, createIfMissing);
          
          // Update the project in database
          await tx.projects.update({
            where: { id: projectId },
            data: {
              branch: branch,
              updatedAt: new Date()
            }
          });
          
          return {
            alreadyUpToDate: false,
            branchResult,
            previousBranch: currentProject.branch
          };
        });
        
        if (result.alreadyUpToDate) {
          return res.json({
            success: true,
            message: `Project is already using branch "${branch}"`,
            branch: result.branch
          });
        }

        // TypeScript guard: result.branchResult is guaranteed to exist when alreadyUpToDate is false
        if (!result.branchResult) {
          throw new Error('Branch validation result is missing');
        }

        let message = `Branch updated to "${branch}"`;
        if (result.branchResult.created) {
          message = `Branch "${branch}" created and set as project branch`;
        } else if (result.branchResult.exists) {
          message = `Branch updated to existing branch "${branch}"`;
        }

        return res.json({
          success: true,
          message,
          branch: {
            name: result.branchResult.branch.name,
            sha: result.branchResult.branch.sha,
            protected: result.branchResult.branch.protected,
            created: result.branchResult.created,
            previousBranch: result.previousBranch
          }
        });
      } catch (githubError: any) {
        console.error('GitHub API error:', githubError);
        
        // Handle specific GitHub API errors
        if (githubError.status === 403) {
          return res.status(403).json({ 
            error: 'Insufficient permissions',
            message: 'You need push access to this repository to create or validate branches'
          });
        }
        
        if (githubError.status === 404) {
          return res.status(404).json({ 
            error: 'Repository or branch not found',
            message: githubError.message || 'The repository or branch could not be found'
          });
        }
        
        if (githubError.message && githubError.message.includes('does not exist')) {
          return res.status(400).json({
            error: 'Branch does not exist',
            message: githubError.message,
            suggestion: 'Enable "Create if missing" option to automatically create the branch'
          });
        }
        
        // If it's a database transaction error, we need to handle it differently
        if (githubError.message && githubError.message.includes('Project no longer exists')) {
          return res.status(404).json({
            error: 'Project not found',
            message: 'Project may have been deleted during the update'
          });
        }
        
        if (githubError.message && githubError.message.includes('repository configuration has changed')) {
          return res.status(409).json({
            error: 'Repository configuration changed',
            message: 'The repository connection has been modified. Please refresh and try again.'
          });
        }
        
        throw githubError; // Re-throw for general error handling
      }
    } catch (error) {
      console.error('Error updating branch:', error);
      return res.status(500).json({ 
        error: 'Failed to update branch',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  })
);

export default router; 