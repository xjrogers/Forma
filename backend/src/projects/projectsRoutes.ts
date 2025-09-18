import { Router, Response, RequestHandler, NextFunction } from 'express';
import { ProjectsController, projectLimiter } from './projectsController';
import { authenticateToken } from '../middleware/authMiddleware';
import { AuthRequest } from '../types/express';
import { 
  importRateLimit, 
  validateImportSecurity, 
  validateTokenEstimation, 
  logImportAttempt 
} from '../middleware/importSecurityMiddleware';
import { requirePlan, PLAN_REQUIREMENTS } from '../middleware/planValidation';

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

// All routes require authentication
router.use(asAuthMiddleware(authenticateToken));

// Get all projects for the authenticated user
router.get('/', 
  projectLimiter,
  asAuthHandler(ProjectsController.getUserProjects)
);

// Create a new project
router.post('/', 
  projectLimiter,
  asAuthHandler(ProjectsController.createProject)
);

// Get a single project
router.get('/:projectId', 
  projectLimiter,
  asAuthHandler(ProjectsController.getProject)
);

// Get individual file content (Bolt.new style on-demand loading)
router.get('/:projectId/files/:fileId', 
  projectLimiter,
  asAuthHandler(ProjectsController.getFileContent)
);

// Update file content
router.put('/:projectId/files/:fileId', 
  projectLimiter,
  asAuthHandler(ProjectsController.updateFileContent)
);

// Update a project
router.patch('/:projectId', 
  projectLimiter,
  asAuthHandler(ProjectsController.updateProject)
);

// Delete a project
router.delete('/:projectId', 
  projectLimiter,
  asAuthHandler(ProjectsController.deleteProject)
);

// Delete all messages for a project
router.delete('/:projectId/messages', 
  projectLimiter,
  asAuthHandler(ProjectsController.deleteProjectMessages)
);

// Estimate tokens for import
router.post('/import/estimate', 
  projectLimiter,
  asAuthMiddleware(validateTokenEstimation),
  asAuthHandler(ProjectsController.estimateImportTokens)
);

// Import project from GitHub with AI analysis (queued) - requires starter plan
router.post('/import', 
  importRateLimit, // More restrictive rate limiting for imports
  projectLimiter,
  asAuthMiddleware(requirePlan(PLAN_REQUIREMENTS.IMPORT_PROJECT)), // Plan validation
  asAuthMiddleware(logImportAttempt), // Log all import attempts
  asAuthMiddleware(validateImportSecurity), // Comprehensive security validation
  asAuthHandler(ProjectsController.importProject)
);

// Get import job status
router.get('/import/:jobId/status', 
  projectLimiter,
  asAuthHandler(ProjectsController.getImportStatus)
);

export default router; 