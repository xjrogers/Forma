import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express';
import { prisma } from '../lib/prisma';
import rateLimit from 'express-rate-limit';

// Rate limiting specifically for imports (more restrictive)
export const importRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 imports per hour per user
  message: {
    error: 'Import rate limit exceeded',
    message: 'You can only import 3 projects per hour. Please try again later.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    // Use user ID if authenticated, otherwise use a safe default
    return req.user?.id || 'anonymous';
  }
});

// Comprehensive import security validation
export const validateImportSecurity = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { repository, config } = req.body;

    // 1. Validate repository object structure
    if (!repository || typeof repository !== 'object') {
      return res.status(400).json({ 
        error: 'Invalid repository data',
        message: 'Repository information is required and must be a valid object'
      });
    }

    // 2. Validate required repository fields
    const requiredRepoFields = ['id', 'name', 'full_name', 'clone_url', 'default_branch'];
    for (const field of requiredRepoFields) {
      if (!repository[field]) {
        return res.status(400).json({ 
          error: 'Invalid repository data',
          message: `Repository ${field} is required`
        });
      }
    }

    // 3. Validate repository size limits
    if (repository.size && repository.size > 500 * 1024) { // 500MB limit
      return res.status(400).json({ 
        error: 'Repository too large',
        message: 'Repository must be smaller than 500MB for import'
      });
    }

    // 4. Validate config object structure
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ 
        error: 'Invalid configuration',
        message: 'Import configuration is required and must be a valid object'
      });
    }

    // 5. Validate project name (prevent injection attacks)
    if (!config.projectName || typeof config.projectName !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid project name',
        message: 'Project name is required and must be a string'
      });
    }

    // Sanitize project name
    const sanitizedName = config.projectName.trim().replace(/[<>\"'&]/g, '');
    if (sanitizedName.length < 1 || sanitizedName.length > 100) {
      return res.status(400).json({ 
        error: 'Invalid project name',
        message: 'Project name must be between 1 and 100 characters'
      });
    }

    // 6. Check for duplicate project names for this user
    const existingProject = await prisma.projects.findFirst({
      where: {
        userId: req.user.id,
        name: sanitizedName
      }
    });

    if (existingProject) {
      return res.status(409).json({ 
        error: 'Project name already exists',
        message: 'You already have a project with this name. Please choose a different name.'
      });
    }

    // 7. Validate user account status
    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: { 
        role: true,
        plan: true,
        tokensUsed: true, 
        tokensLimit: true, 
        githubAccessToken: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    // 8. Check if user is banned or suspended
    if (user.role === 'banned' || user.role === 'suspended') {
      return res.status(403).json({ 
        error: 'Account suspended',
        message: 'Your account has been suspended and cannot perform imports'
      });
    }

    // 9. Check if account is too new (prevent spam)
    const accountAge = Date.now() - new Date(user.createdAt).getTime();
    const minAccountAge = 24 * 60 * 60 * 1000; // 24 hours
    if (accountAge < minAccountAge) {
      return res.status(403).json({ 
        error: 'Account too new',
        message: 'Account must be at least 24 hours old to import projects'
      });
    }

    // 10. Validate GitHub connection
    if (!user.githubAccessToken) {
      return res.status(400).json({ 
        error: 'GitHub not connected',
        message: 'You must connect your GitHub account before importing projects'
      });
    }

    // 11. Check concurrent import limit
    const activeImports = await prisma.projects.count({
      where: {
        userId: req.user.id,
        description: {
          in: ['Import queued...', 'Import in progress...']
        }
      }
    });

    if (activeImports >= 2) { // Max 2 concurrent imports
      return res.status(429).json({ 
        error: 'Too many active imports',
        message: 'You can only have 2 active imports at a time. Please wait for current imports to complete.'
      });
    }

    // 12. Validate boolean config fields
    const booleanFields = [
      'enableAIAnalysis', 'analyzeArchitecture', 'extractBusinessLogic',
      'buildKnowledgeGraph', 'generateDocumentation', 'scanSecurity', 'optimizeForAI'
    ];

    for (const field of booleanFields) {
      if (config[field] !== undefined && typeof config[field] !== 'boolean') {
        return res.status(400).json({ 
          error: 'Invalid configuration',
          message: `${field} must be a boolean value`
        });
      }
    }

    // 13. Store sanitized data back to request
    req.body.config.projectName = sanitizedName;
    req.body.repository = {
      ...repository,
      // Ensure only safe fields are passed through
      id: repository.id,
      name: repository.name,
      full_name: repository.full_name,
      description: repository.description || null,
      private: Boolean(repository.private),
      html_url: repository.html_url,
      clone_url: repository.clone_url,
      default_branch: repository.default_branch,
      language: repository.language || null,
      stargazers_count: Number(repository.stargazers_count) || 0,
      size: Number(repository.size) || 0,
      updated_at: repository.updated_at,
      topics: Array.isArray(repository.topics) ? repository.topics : []
    };

    next();

  } catch (error) {
    console.error('Import security validation error:', error);
    return res.status(500).json({ 
      error: 'Security validation failed',
      message: 'Unable to validate import request'
    });
  }
};

// Additional validation for token estimation endpoint
export const validateTokenEstimation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    // Same validations as import, but without the heavy checks
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { repository, config } = req.body;

    if (!repository || !config) {
      return res.status(400).json({ 
        error: 'Repository and configuration required for estimation' 
      });
    }

    // Basic repository validation
    if (!repository.id || !repository.size) {
      return res.status(400).json({ 
        error: 'Invalid repository data for estimation' 
      });
    }

    next();

  } catch (error) {
    console.error('Token estimation validation error:', error);
    return res.status(500).json({ 
      error: 'Estimation validation failed' 
    });
  }
};

// Middleware to log all import attempts for security monitoring
export const logImportAttempt = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void => {
  const { repository, config } = req.body;
  
  console.log(`🔍 IMPORT ATTEMPT:`, {
    userId: req.user?.id,
    userIP: req.ip,
    userAgent: req.get('User-Agent'),
    repository: repository?.full_name,
    projectName: config?.projectName,
    timestamp: new Date().toISOString()
  });

  next();
}; 