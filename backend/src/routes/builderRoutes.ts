import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { BuilderController } from '../controllers/builderController';
import { asAuthMiddleware, asAuthHandler } from '../middleware/authMiddleware';
import { requirePlan, PLAN_REQUIREMENTS } from '../middleware/planValidation';

const router = Router();

// All builder routes require authentication
router.use(asAuthMiddleware(authenticateToken));

// TRUE streaming chat (like Cursor/Bolt)
router.post('/chat/stream', asAuthHandler(BuilderController.chatWithAgentStreaming));

// AI Quick Fix (like Cursor)
router.post('/quick-fix', asAuthHandler(BuilderController.generateQuickFix));

// Legacy generate project endpoint (redirects to chat)
router.post('/generate', asAuthHandler(BuilderController.generateProject));



// Deploy project
router.post('/deploy', asAuthHandler(BuilderController.deployProject));

// Push to GitHub (requires starter plan)
router.post('/github/push', asAuthMiddleware(requirePlan(PLAN_REQUIREMENTS.GITHUB_INTEGRATION)), asAuthHandler(BuilderController.pushToGitHub));

// Export project (requires starter plan)
router.get('/export/:projectId', asAuthMiddleware(requirePlan(PLAN_REQUIREMENTS.PROJECT_EXPORT)), asAuthHandler(BuilderController.exportProject));



export default router; 