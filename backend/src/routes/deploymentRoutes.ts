import { Router } from 'express';
import { authenticateToken, asAuthHandler, asAuthMiddleware } from '../middleware/authMiddleware';
import DeploymentController from '../controllers/deploymentController';
import { requirePlan, PLAN_REQUIREMENTS } from '../middleware/planValidation';

const router = Router();

/**
 * Deploy a project to production
 * POST /api/deployments/deploy
 */
router.post('/deploy', 
  asAuthMiddleware(authenticateToken),
  asAuthMiddleware(requirePlan(PLAN_REQUIREMENTS.DEPLOYMENT)),
  asAuthHandler(DeploymentController.deployProject)
);

/**
 * Get deployment status for a project
 * GET /api/deployments/status/:projectId
 */
router.get('/status/:projectId',
  asAuthMiddleware(authenticateToken),
  asAuthHandler(DeploymentController.getDeploymentStatus)
);

/**
 * Stop/undeploy a project
 * DELETE /api/deployments/:projectId
 */
router.delete('/:projectId',
  asAuthMiddleware(authenticateToken),
  asAuthHandler(DeploymentController.undeployProject)
);

/**
 * Get deployment logs for a project
 * GET /api/deployments/logs/:projectId
 */
router.get('/logs/:projectId',
  asAuthMiddleware(authenticateToken),
  asAuthHandler(DeploymentController.getDeploymentLogs)
);

/**
 * Get user's deployment usage and billing
 * GET /api/deployments/usage
 */
router.get('/usage',
  asAuthMiddleware(authenticateToken),
  asAuthHandler(DeploymentController.getDeploymentUsage)
);

/**
 * Get DNS configuration instructions for a domain
 * GET /api/deployments/dns/:subdomain
 */
router.get('/dns/:subdomain',
  asAuthMiddleware(authenticateToken),
  asAuthHandler(async (req: any, res: any) => {
    try {
      const { subdomain } = req.params;
      const DNSService = (await import('../services/dnsService')).default;
      const dnsService = new DNSService();
      
      // Generate DNS config (using Railway's default URL as example)
      const railwayUrl = `https://${subdomain}.railway.app`;
      const config = dnsService.generateDNSConfig(subdomain, railwayUrl);
      const instructions = dnsService.getDNSInstructions(config);
      
      return res.json({
        subdomain,
        config,
        instructions,
        sslInfo: dnsService.getSSLInfo()
      });
    } catch (error) {
      console.error('DNS config error:', error);
      return res.status(500).json({ error: 'Failed to generate DNS configuration' });
    }
  })
);

export default router; 