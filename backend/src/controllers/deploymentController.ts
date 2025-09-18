import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types/express';
import RailwayDeploymentService from '../services/railwayService';
import { randomUUID } from 'crypto';

export class DeploymentController {
  private static railwayService = RailwayDeploymentService.getInstance();

  /**
   * Deploy a project to production
   */
  static async deployProject(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { projectId } = req.body;
      const userId = req.user.id;

      console.log(`🚀 Starting deployment for project: ${projectId}`);

      // Get project with files
      const project = await prisma.projects.findFirst({
        where: { 
          id: projectId, 
          userId 
        },
        include: {
          files: true,
          users: {
            select: {
              plan: true,
              maxDeployments: true
            }
          }
        }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check if user has reached deployment limit
      const activeDeployments = await prisma.projects.count({
        where: {
          userId,
          isDeployed: true,
          deploymentStatus: 'deployed'
        }
      });

      if (activeDeployments >= project.users.maxDeployments) {
        return res.status(403).json({ 
          error: 'Deployment limit reached',
          limit: project.users.maxDeployments,
          current: activeDeployments
        });
      }

      // Check if project has files
      if (!project.files || project.files.length === 0) {
        return res.status(400).json({ error: 'Project has no files to deploy' });
      }

      // Generate unique subdomain
      const subdomain = DeploymentController.railwayService.generateSubdomain(project.name, userId);
      
      // Update project status to building
      await prisma.projects.update({
        where: { id: projectId },
        data: {
          deploymentStatus: 'building',
          subdomain
        }
      });

      // Start deployment process in background
      DeploymentController.performDeployment(projectId, userId, project, subdomain)
        .catch(error => {
          console.error(`Deployment failed for project ${projectId}:`, error);
          // Update status to failed
          prisma.projects.update({
            where: { id: projectId },
            data: {
              deploymentStatus: 'failed'
            }
          }).catch(console.error);
        });

      return res.json({
        message: 'Deployment started',
        projectId,
        subdomain,
        status: 'building',
        estimatedTime: '2-5 minutes'
      });

    } catch (error) {
      console.error('Deployment error:', error);
      return res.status(500).json({ error: 'Deployment failed' });
    }
  }

  /**
   * Perform the actual deployment (runs in background) with transaction rollback
   */
  private static async performDeployment(
    projectId: string, 
    userId: string, 
    project: any, 
    subdomain: string
  ): Promise<void> {
    const startTime = Date.now();
    
    // Transaction state tracking for comprehensive rollback
    const deploymentTransaction = {
      railwayProjectId: null as string | null,
      railwayServiceId: null as string | null,
      tempRepo: null as { repoName: string; repoUrl: string } | null,
      formaGitHubToken: null as string | null,
      environmentVariablesSet: false,
      githubRepoConnected: false,
      customDomainSet: false,
      databaseRecordsCreated: false,
      deploymentUrl: null as string | null
    };

    try {
      console.log(`📦 Creating Railway project for: ${project.name}`);
      
      // Step 1: Create Railway project
      const railwayProject = await DeploymentController.railwayService.createProject(
        `forma-${subdomain}`,
        `Forma deployment: ${project.name}`
      );
      deploymentTransaction.railwayProjectId = railwayProject.id;
      console.log(`✅ Railway project created: ${railwayProject.id}`);

      // Step 2: Create service within the project
      console.log(`🔧 Creating Railway service...`);
      const railwayService = await DeploymentController.railwayService.createService(
        deploymentTransaction.railwayProjectId,
        'web-service'
      );
      deploymentTransaction.railwayServiceId = railwayService.id;
      console.log(`✅ Railway service created: ${railwayService.id}`);

      // Step 3: Detect framework and prepare files
      const framework = DeploymentController.detectFramework(project.files);
      DeploymentController.prepareDeploymentFiles(project.files, framework);
      console.log(`✅ Framework detected: ${framework}`);

             // Step 4: Set environment variables
       console.log(`🏗️ Setting environment variables...`);
       await DeploymentController.railwayService.setEnvironmentVariables(
         deploymentTransaction.railwayServiceId, 
         {
           NODE_ENV: 'production',
           PORT: '3000'
         },
         deploymentTransaction.railwayProjectId
       );
      deploymentTransaction.environmentVariablesSet = true;
      console.log(`✅ Environment variables set`);

      // Step 5: Setup GitHub integration
      console.log(`📁 Creating temporary GitHub repository via Forma app...`);
      deploymentTransaction.formaGitHubToken = process.env.GITHUB_APP_TOKEN || process.env.GITHUB_ACCESS_TOKEN || null;
      if (!deploymentTransaction.formaGitHubToken) {
        throw new Error('Forma GitHub app not configured. Please contact support.');
      }

      // Step 6: Create temporary GitHub repo
      const GitHubTempRepoService = (await import('../services/githubTempRepoService')).default;
      const githubService = new GitHubTempRepoService(deploymentTransaction.formaGitHubToken);
      
      deploymentTransaction.tempRepo = await githubService.createTempRepo(project.name);
      console.log(`✅ Temporary GitHub repo created: ${deploymentTransaction.tempRepo.repoName}`);
      
      // Step 7: Upload project files to GitHub
      console.log(`📤 Uploading project files to GitHub...`);
      const deploymentFiles = DeploymentController.prepareDeploymentFiles(project.files, framework);
      await githubService.uploadFiles(deploymentTransaction.tempRepo.repoName, deploymentFiles);
      console.log(`✅ Project files uploaded`);
      
      // Step 8: Connect Railway service to GitHub repo
      console.log(`🔗 Connecting Railway service to GitHub repository...`);
      await DeploymentController.railwayService.connectServiceToGitHub(
        deploymentTransaction.railwayServiceId, 
        deploymentTransaction.tempRepo.repoName
      );
      deploymentTransaction.githubRepoConnected = true;
      console.log(`✅ Railway connected to GitHub`);
      
      // Step 9: Wait for deployment to complete
      console.log(`⏳ Waiting for deployment to complete...`);
      await DeploymentController.waitForDeployment(deploymentTransaction.railwayServiceId, 300000); // 5 minute timeout
      console.log(`✅ Deployment completed`);

      // Step 10: Set up custom domain
      console.log(`🌐 Setting up custom domain...`);
      deploymentTransaction.deploymentUrl = await DeploymentController.railwayService.setupCustomDomain(
        deploymentTransaction.railwayServiceId, 
        subdomain
      );
      deploymentTransaction.customDomainSet = true;
      console.log(`✅ Custom domain configured: ${deploymentTransaction.deploymentUrl}`);

      const buildTime = Math.round((Date.now() - startTime) / 1000);

      // Step 11: Update database records (wrapped in Prisma transaction)
      console.log(`💾 Updating database records...`);
      await prisma.$transaction(async (tx) => {
        // Create deployment record
        const deployment = await tx.deployments.create({
          data: {
            id: randomUUID(),
            projectId,
            status: 'success',
            railwayServiceId: deploymentTransaction.railwayServiceId,
            deploymentUrl: deploymentTransaction.deploymentUrl,
            subdomain,
            triggeredBy: 'user_manual',
            buildTime
          }
        });

        // Update project with deployment info
        await tx.projects.update({
          where: { id: projectId },
          data: {
            isDeployed: true,
            deploymentStatus: 'deployed',
            deploymentUrl: deploymentTransaction.deploymentUrl,
            railwayServiceId: deploymentTransaction.railwayServiceId,
            lastDeployedAt: new Date()
          }
        });

        // Create billing record
        const monthlyCost = DeploymentController.railwayService.calculateMonthlyCost('starter');
        const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

        await tx.deployment_usage.create({
          data: {
            id: randomUUID(),
            projectId,
            userId,
            deploymentId: deployment.id,
            monthlyCost,
            billingMonth: currentMonth,
            isActive: true
          }
        });
      });
      deploymentTransaction.databaseRecordsCreated = true;
      console.log(`✅ Database records updated`);

      // Step 12: Clean up temporary GitHub repository
      console.log(`🧹 Cleaning up temporary GitHub repository...`);
      if (deploymentTransaction.tempRepo && deploymentTransaction.formaGitHubToken) {
        try {
          await githubService.deleteTempRepo(deploymentTransaction.tempRepo.repoName);
          console.log(`✅ Temporary repository cleaned up`);
        } catch (cleanupError) {
          console.warn('⚠️ Failed to cleanup temp repo (non-critical):', cleanupError);
          // Don't fail deployment for cleanup issues
        }
      }

      console.log(`🎉 Deployment completed successfully: ${deploymentTransaction.deploymentUrl}`);

    } catch (error) {
      console.error('❌ Deployment failed, initiating comprehensive rollback:', error);

      // COMPREHENSIVE ROLLBACK - Reverse order of operations
      await DeploymentController.rollbackDeployment(deploymentTransaction, projectId, startTime, error);

      throw error;
    }
  }

  /**
   * Comprehensive rollback function for failed deployments
   */
  private static async rollbackDeployment(
    transaction: any, 
    projectId: string, 
    startTime: number,
    originalError: any
  ): Promise<void> {
    const rollbackErrors: string[] = [];

    try {
      console.log(`🔄 Starting comprehensive rollback...`);

      // Step 11 Rollback: Database records (if created)
      if (transaction.databaseRecordsCreated) {
        try {
          console.log(`🔄 Rolling back database records...`);
          await prisma.$transaction(async (tx) => {
            // Delete deployment usage records
            await tx.deployment_usage.deleteMany({ 
              where: { projectId } 
            });
            
            // Delete deployment records
            await tx.deployments.deleteMany({ 
              where: { projectId, status: 'success' } 
            });
            
            // Reset project deployment status
            await tx.projects.update({
              where: { id: projectId },
              data: {
                isDeployed: false,
                deploymentUrl: null,
                subdomain: null,
                deploymentStatus: 'not_deployed',
                railwayServiceId: null,
                lastDeployedAt: null
              }
            });
          });
          console.log(`✅ Database records rolled back`);
        } catch (error) {
          rollbackErrors.push(`Database rollback failed: ${error}`);
        }
      }

      // Step 10 Rollback: Custom domain (handled by service deletion)
      if (transaction.customDomainSet) {
        console.log(`🔄 Custom domain will be removed with service deletion`);
      }

      // Step 8 Rollback: GitHub connection (handled by service deletion)
      if (transaction.githubRepoConnected) {
        console.log(`🔄 GitHub connection will be removed with service deletion`);
      }

      // Step 6-7 Rollback: Temporary GitHub repository
      if (transaction.tempRepo && transaction.formaGitHubToken) {
        try {
          console.log(`🔄 Rolling back temporary GitHub repository...`);
          const GitHubTempRepoService = (await import('../services/githubTempRepoService')).default;
          const githubService = new GitHubTempRepoService(transaction.formaGitHubToken);
          await githubService.deleteTempRepo(transaction.tempRepo.repoName);
          console.log(`✅ Temporary GitHub repository rolled back`);
        } catch (error) {
          rollbackErrors.push(`GitHub repository rollback failed: ${error}`);
        }
      }

      // Step 4 Rollback: Environment variables (handled by service deletion)
      if (transaction.environmentVariablesSet) {
        console.log(`🔄 Environment variables will be removed with service deletion`);
      }

      // Step 2 Rollback: Railway service (if created)
      if (transaction.railwayServiceId) {
        try {
          console.log(`🔄 Rolling back Railway service...`);
          await DeploymentController.railwayService.deleteService(transaction.railwayServiceId);
          console.log(`✅ Railway service rolled back`);
        } catch (error) {
          rollbackErrors.push(`Railway service rollback failed: ${error}`);
        }
      }

      // Step 1 Rollback: Railway project (typically not deleted, just emptied)
      if (transaction.railwayProjectId) {
        console.log(`🔄 Railway project ${transaction.railwayProjectId} left empty (standard practice)`);
      }

      // Create failed deployment record for tracking
      try {
        const buildTime = Math.round((Date.now() - startTime) / 1000);
        await prisma.deployments.create({
          data: {
            id: randomUUID(),
            projectId,
            status: 'failed',
            railwayServiceId: transaction.railwayServiceId,
            subdomain: null,
            triggeredBy: 'user_manual',
            buildTime,
            errorMessage: originalError instanceof Error ? originalError.message : 'Unknown error'
          }
        });

        // Update project status to failed
        await prisma.projects.update({
          where: { id: projectId },
          data: {
            deploymentStatus: 'failed'
          }
        });
      } catch (error) {
        rollbackErrors.push(`Failed deployment record creation failed: ${error}`);
      }

      if (rollbackErrors.length > 0) {
        console.error('⚠️ Some rollback operations failed:', rollbackErrors);
      } else {
        console.log(`✅ Complete rollback successful`);
      }

    } catch (rollbackError) {
      console.error('💥 Critical rollback failure:', rollbackError);
      rollbackErrors.push(`Critical rollback failure: ${rollbackError}`);
    }
  }

  /**
   * Wait for Railway deployment to complete
   */
  private static async waitForDeployment(serviceId: string, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds

    while (Date.now() - startTime < timeoutMs) {
      const status = await DeploymentController.railwayService.getDeploymentStatus(serviceId);
      
      console.log(`🔄 Deployment status: ${status.status}`);
      
      if (status.status === 'SUCCESS') {
        console.log(`✅ Deployment completed successfully`);
        return;
      } else if (status.status === 'FAILED' || status.status === 'CRASHED') {
        throw new Error(`Deployment failed with status: ${status.status}`);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error('Deployment timeout - taking longer than expected');
  }

  /**
   * Get deployment status for a project
   */
  static async getDeploymentStatus(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const userId = req.user.id;

      const project = await prisma.projects.findFirst({
        where: { id: projectId, userId },
        include: {
          deployments: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const latestDeployment = project.deployments[0];

      return res.json({
        projectId,
        isDeployed: project.isDeployed,
        status: project.deploymentStatus,
        url: project.deploymentUrl,
        subdomain: project.subdomain,
        lastDeployedAt: project.lastDeployedAt,
        latestDeployment: latestDeployment ? {
          id: latestDeployment.id,
          status: latestDeployment.status,
          buildTime: latestDeployment.buildTime,
          createdAt: latestDeployment.createdAt,
          errorMessage: latestDeployment.errorMessage
        } : null
      });

    } catch (error) {
      console.error('Get deployment status error:', error);
      return res.status(500).json({ error: 'Failed to get deployment status' });
    }
  }

  /**
   * Stop/undeploy a project
   */
  static async undeployProject(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const userId = req.user.id;

      const project = await prisma.projects.findFirst({
        where: { id: projectId, userId }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!project.isDeployed || !project.railwayServiceId) {
        return res.status(400).json({ error: 'Project is not deployed' });
      }

      // Delete Railway service
      await DeploymentController.railwayService.deleteService(project.railwayServiceId);

      // Update project
      await prisma.projects.update({
        where: { id: projectId },
        data: {
          isDeployed: false,
          deploymentStatus: 'not_deployed',
          deploymentUrl: null,
          railwayServiceId: null
        }
      });

      // Mark billing as inactive
      const currentMonth = new Date().toISOString().substring(0, 7);
      await prisma.deployment_usage.updateMany({
        where: {
          projectId,
          billingMonth: currentMonth,
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      // Create deployment record
      await prisma.deployments.create({
        data: {
          id: randomUUID(),
          projectId,
          status: 'cancelled',
          triggeredBy: 'user_manual'
        }
      });

      return res.json({
        message: 'Project undeployed successfully',
        projectId
      });

    } catch (error) {
      console.error('Undeploy error:', error);
      return res.status(500).json({ error: 'Failed to undeploy project' });
    }
  }

  /**
   * Get deployment logs
   */
  static async getDeploymentLogs(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const userId = req.user.id;

      const project = await prisma.projects.findFirst({
        where: { id: projectId, userId }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!project.railwayServiceId) {
        return res.status(400).json({ error: 'Project is not deployed' });
      }

      const logs = await DeploymentController.railwayService.getServiceLogs(project.railwayServiceId);

      return res.json({
        projectId,
        logs
      });

    } catch (error) {
      console.error('Get logs error:', error);
      return res.status(500).json({ error: 'Failed to get deployment logs' });
    }
  }

  /**
   * Get user's deployment usage and billing
   */
  static async getDeploymentUsage(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user.id;
      const { month } = req.query; // Optional month filter (YYYY-MM)

      const currentMonth = month as string || new Date().toISOString().substring(0, 7);

      const usage = await prisma.deployment_usage.findMany({
        where: {
          userId,
          billingMonth: currentMonth
        },
        include: {
          project: {
            select: {
              name: true,
              deploymentUrl: true
            }
          }
        }
      });

      const totalCost = usage.reduce((sum: number, record: any) => sum + record.monthlyCost, 0);
      const activeDeployments = usage.filter((record: any) => record.isActive).length;

      return res.json({
        month: currentMonth,
        totalCost,
        activeDeployments,
        usage
      });

    } catch (error) {
      console.error('Get deployment usage error:', error);
      return res.status(500).json({ error: 'Failed to get deployment usage' });
    }
  }

  /**
   * Detect project framework from files
   */
  private static detectFramework(files: any[]): string {
    const packageJsonFile = files.find(f => f.path === 'package.json');
    
    if (packageJsonFile && packageJsonFile.content) {
      try {
        const packageJson = JSON.parse(packageJsonFile.content);
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (dependencies.next) return 'nextjs';
        if (dependencies.react) return 'react';
        if (dependencies.vue) return 'vue';
        if (dependencies.express) return 'express';
        if (dependencies.fastify) return 'fastify';
      } catch (error) {
        console.warn('Failed to parse package.json:', error);
      }
    }

    // Check for specific files
    const hasIndexHtml = files.some(f => f.path === 'index.html');
    const hasNextConfig = files.some(f => f.path.includes('next.config'));
    const hasVueConfig = files.some(f => f.path.includes('vue.config'));

    if (hasNextConfig) return 'nextjs';
    if (hasVueConfig) return 'vue';
    if (hasIndexHtml) return 'static';

    return 'nodejs'; // Default
  }

  /**
   * Prepare files for deployment based on framework
   */
  private static prepareDeploymentFiles(files: any[], framework: string): Array<{ path: string; content: string }> {
    const deploymentFiles = files.map(file => ({
      path: file.path,
      content: file.content || ''
    }));

    // Add framework-specific files if missing
    const hasPackageJson = files.some(f => f.path === 'package.json');
    
    if (!hasPackageJson) {
      // Create basic package.json based on framework
      const packageJson = this.generatePackageJson(framework);
      deploymentFiles.push({
        path: 'package.json',
        content: JSON.stringify(packageJson, null, 2)
      });
    }

    return deploymentFiles;
  }

  /**
   * Generate package.json for deployment
   */
  private static generatePackageJson(framework: string): any {
    const basePackage = {
      name: 'forma-deployment',
      version: '1.0.0',
      scripts: {},
      dependencies: {}
    };

    switch (framework) {
      case 'nextjs':
        return {
          ...basePackage,
          scripts: {
            build: 'next build',
            start: 'next start',
            dev: 'next dev'
          },
          dependencies: {
            next: '^14.0.0',
            react: '^18.0.0',
            'react-dom': '^18.0.0'
          }
        };

      case 'react':
        return {
          ...basePackage,
          scripts: {
            build: 'react-scripts build',
            start: 'serve -s build',
            dev: 'react-scripts start'
          },
          dependencies: {
            react: '^18.0.0',
            'react-dom': '^18.0.0',
            'react-scripts': '^5.0.0',
            serve: '^14.0.0'
          }
        };

      case 'express':
        return {
          ...basePackage,
          scripts: {
            start: 'node index.js',
            dev: 'nodemon index.js'
          },
          dependencies: {
            express: '^4.18.0'
          }
        };

      default:
        return {
          ...basePackage,
          scripts: {
            start: 'node index.js'
          }
        };
    }
  }
}

export default DeploymentController; 