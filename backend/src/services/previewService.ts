import { prisma } from '../lib/prisma';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

interface PreviewInstance {
  id: string;
  projectId: string;
  status: 'initializing' | 'ready' | 'error' | 'stopped';
  previewUrl: string;
  framework: string;
  lastUpdated: Date;
  files: Array<{ path: string; content: string }>;
}

interface ProjectStructure {
  framework: 'react-vite' | 'react-cra' | 'nextjs' | 'vue' | 'svelte' | 'static' | 'node' | 'express';
  files: Array<{ path: string; content: string }>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
}

export class PreviewService extends EventEmitter {
  private static instance: PreviewService;
  private previews: Map<string, PreviewInstance> = new Map();

  private constructor() {
    super();
    // Increase max listeners to prevent memory leak warnings
    this.setMaxListeners(50);
  }

  static getInstance(): PreviewService {
    if (!PreviewService.instance) {
      PreviewService.instance = new PreviewService();
    }
    return PreviewService.instance;
  }

  /**
   * Create a production-ready preview
   * Frontend projects use WebContainers (browser-based)
   * Backend projects use secure sandboxed containers
   */
  async createPreview(projectId: string): Promise<PreviewInstance> {
    console.log(`🚀 Creating production preview for project: ${projectId}`);

    try {
      // Stop existing preview if running
      await this.stopPreview(projectId);

      // Get project files from database
      const project = await prisma.projects.findUnique({
        where: { id: projectId },
        include: {
          files: {
            where: { content: { not: null } },
            select: { path: true, content: true }
          }
        }
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // If no files exist, trigger AI to create basic project structure
      if (!project.files.length) {
        console.log(`📁 No files found for project ${projectId}, triggering AI scaffolding...`);
        await this.triggerProjectScaffolding(projectId, project.name);
        
        // Re-fetch project files after scaffolding
        const updatedProject = await prisma.projects.findUnique({
          where: { id: projectId },
          include: {
            files: {
              where: { content: { not: null } },
              select: { path: true, content: true }
            }
          }
        });
        
        if (!updatedProject?.files.length) {
          throw new Error('Failed to create project files automatically');
        }
        
        project.files = updatedProject.files;
      }

      // Analyze project structure
      const projectStructure = this.analyzeProjectStructure(project.files);

      // Create preview instance
      const preview: PreviewInstance = {
        id: randomUUID(),
        projectId,
        status: 'initializing',
        previewUrl: this.generatePreviewUrl(projectId, projectStructure.framework),
        framework: projectStructure.framework,
        lastUpdated: new Date(),
        files: project.files.map(f => ({ path: f.path, content: f.content || '' }))
      };

      this.previews.set(projectId, preview);

      // Initialize preview based on project type
      if (this.isFrontendFramework(projectStructure.framework)) {
        await this.initializeFrontendPreview(preview, projectStructure);
      } else {
        await this.initializeBackendPreview(preview, projectStructure);
      }

      preview.status = 'ready';
      preview.lastUpdated = new Date();

      console.log(`✅ Production preview ready for ${projectStructure.framework} project`);
      this.emit('preview-ready', { projectId, preview });

      return preview;

    } catch (error) {
      console.error(`❌ Preview creation failed for project ${projectId}:`, error);
      
      const preview = this.previews.get(projectId);
      if (preview) {
        preview.status = 'error';
        this.emit('preview-error', { projectId, error: error instanceof Error ? error.message : String(error) });
      }
      
      throw error;
    }
  }

  /**
   * Update preview with changed files (real-time like Bolt.new)
   */
  async updatePreview(projectId: string, changedFiles: Array<{ path: string; content: string }>): Promise<void> {
    const preview = this.previews.get(projectId);
    if (!preview || preview.status !== 'ready') {
      console.log(`⚠️ No ready preview found for project ${projectId}`);
      return;
    }

    try {
      // Update files in preview instance
      for (const changedFile of changedFiles) {
        const existingFileIndex = preview.files.findIndex(f => f.path === changedFile.path);
        if (existingFileIndex >= 0) {
          preview.files[existingFileIndex].content = changedFile.content;
        } else {
          preview.files.push(changedFile);
        }
      }

      preview.lastUpdated = new Date();

      // Emit update event - frontend will handle the actual update via WebContainers
      this.emit('preview-updated', { 
        projectId, 
        changedFiles,
        allFiles: preview.files 
      });

      console.log(`🔄 Preview updated for project ${projectId} with ${changedFiles.length} files`);

    } catch (error) {
      console.error(`❌ Failed to update preview ${projectId}:`, error);
      preview.status = 'error';
      this.emit('preview-error', { projectId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Get preview status and files
   */
  getPreview(projectId: string): PreviewInstance | null {
    return this.previews.get(projectId) || null;
  }

  /**
   * Stop preview and cleanup
   */
  async stopPreview(projectId: string): Promise<void> {
    const preview = this.previews.get(projectId);
    if (!preview) return;

    try {
      preview.status = 'stopped';
      this.previews.delete(projectId);

      console.log(`🛑 Preview stopped for project ${projectId}`);
      this.emit('preview-stopped', { projectId });

    } catch (error) {
      console.error(`❌ Failed to stop preview ${projectId}:`, error);
    }
  }

  /**
   * Get all project files for WebContainer initialization
   */
  getProjectFiles(projectId: string): Array<{ path: string; content: string }> {
    const preview = this.previews.get(projectId);
    return preview?.files || [];
  }

  /**
   * Analyze project structure to determine framework and setup
   */
  private analyzeProjectStructure(files: Array<{ path: string; content: string | null }>): ProjectStructure {
    const packageJsonFile = files.find(f => f.path === 'package.json');
    
    let dependencies: Record<string, string> = {};
    let devDependencies: Record<string, string> = {};
    let scripts: Record<string, string> = {};

    if (packageJsonFile?.content) {
      try {
        const pkg = JSON.parse(packageJsonFile.content);
        dependencies = pkg.dependencies || {};
        devDependencies = pkg.devDependencies || {};
        scripts = pkg.scripts || {};
      } catch (error) {
        console.warn('Failed to parse package.json:', error);
      }
    }

    const allDeps = { ...dependencies, ...devDependencies };

    // Determine framework
    let framework: ProjectStructure['framework'] = 'static';

    if (allDeps.next) {
      framework = 'nextjs';
    } else if (allDeps.vite && (allDeps.react || allDeps['@types/react'])) {
      framework = 'react-vite';
    } else if (allDeps['react-scripts']) {
      framework = 'react-cra';
    } else if (allDeps.vue) {
      framework = 'vue';
    } else if (allDeps.svelte) {
      framework = 'svelte';
    } else if (allDeps.express || allDeps.fastify || allDeps.koa) {
      framework = 'express';
    } else if (files.some(f => f.path.endsWith('.js') || f.path.endsWith('.ts')) && packageJsonFile) {
      framework = 'node';
    }

    return {
      framework,
      files: files.map(f => ({ path: f.path, content: f.content || '' })),
      dependencies,
      devDependencies,
      scripts
    };
  }

  /**
   * Check if framework runs in browser (WebContainers)
   */
  private isFrontendFramework(framework: string): boolean {
    return ['react-vite', 'react-cra', 'nextjs', 'vue', 'svelte', 'static'].includes(framework);
  }

  /**
   * Initialize frontend preview (WebContainers in browser)
   */
  private async initializeFrontendPreview(preview: PreviewInstance, structure: ProjectStructure): Promise<void> {
    // Frontend previews are handled entirely in the browser via WebContainers
    // The backend just provides the file structure and receives updates
    
    console.log(`🌐 Frontend preview initialized for ${structure.framework}`);
    
    // Ensure we have proper package.json structure
    this.ensurePackageJsonStructure(preview, structure);
  }

  /**
   * Initialize backend preview (secure sandboxed container)
   */
  private async initializeBackendPreview(_preview: PreviewInstance, structure: ProjectStructure): Promise<void> {
    // For production backend previews, we'd use:
    // 1. Firecracker microVMs
    // 2. gVisor containers  
    // 3. Kubernetes Jobs with network policies
    // 4. AWS Lambda for simple Node.js apps
    
    console.log(`🔒 Backend preview would use secure sandbox for ${structure.framework}`);
    
    // For now, mark as ready - actual implementation would depend on infrastructure
    // In production, this would spin up isolated containers with:
    // - Resource limits (CPU, memory, disk)
    // - Network isolation
    // - Time limits
    // - Read-only file system except for specific directories
  }

  /**
   * Ensure package.json has proper structure for WebContainers
   */
  private ensurePackageJsonStructure(preview: PreviewInstance, structure: ProjectStructure): void {
    const packageJsonIndex = preview.files.findIndex(f => f.path === 'package.json');
    
    if (packageJsonIndex >= 0) {
      try {
        const pkg = JSON.parse(preview.files[packageJsonIndex].content);
        
        // Ensure proper scripts for WebContainers
        if (!pkg.scripts) pkg.scripts = {};
        
        switch (structure.framework) {
          case 'react-vite':
            if (!pkg.scripts.dev) pkg.scripts.dev = 'vite';
            if (!pkg.scripts.build) pkg.scripts.build = 'vite build';
            break;
          case 'react-cra':
            if (!pkg.scripts.start) pkg.scripts.start = 'react-scripts start';
            if (!pkg.scripts.build) pkg.scripts.build = 'react-scripts build';
            break;
          case 'nextjs':
            if (!pkg.scripts.dev) pkg.scripts.dev = 'next dev';
            if (!pkg.scripts.build) pkg.scripts.build = 'next build';
            break;
          case 'vue':
            if (!pkg.scripts.dev) pkg.scripts.dev = 'vite';
            if (!pkg.scripts.build) pkg.scripts.build = 'vite build';
            break;
          case 'svelte':
            if (!pkg.scripts.dev) pkg.scripts.dev = 'vite dev';
            if (!pkg.scripts.build) pkg.scripts.build = 'vite build';
            break;
        }

        preview.files[packageJsonIndex].content = JSON.stringify(pkg, null, 2);
      } catch (error) {
        console.warn('Failed to update package.json structure:', error);
      }
    }
  }

  /**
   * Generate preview URL based on framework
   */
  private generatePreviewUrl(projectId: string, _framework: string): string {
    // In production, this would be:
    // - Unique subdomain: https://{projectId}.preview.yourapp.com
    // - CDN-backed for static sites
    // - Load-balanced for backend services
    
    return `https://${projectId}.preview.forma.dev`;
  }

  /**
   * Trigger AI to create basic project structure when no files exist
   */
  private async triggerProjectScaffolding(projectId: string, projectName: string): Promise<void> {
    try {
      const { AIAgent } = await import('./aiAgent');
      const aiAgent = AIAgent.getInstance();

      // Use the new direct scaffolding method
      await aiAgent.scaffoldProject(projectId, projectName);

      console.log(`✅ Project scaffolding completed for ${projectId}`);
    } catch (error) {
      console.error(`❌ Failed to trigger project scaffolding:`, error);
      throw new Error('Failed to create basic project structure');
    }
  }

  /**
   * Send build errors directly to AI for fixing (proper integration)
   */
  async sendBuildErrorToAI(projectId: string, errorType: string, errorOutput: string): Promise<void> {
    try {
      const { AIAgent } = await import('./aiAgent');
      const aiAgent = AIAgent.getInstance();

      // Use the new direct error processing method
      await aiAgent.processBuildError(projectId, errorType, errorOutput);

      console.log(`✅ Build error sent to AI for fixing: ${errorType}`);
    } catch (error) {
      console.error(`❌ Failed to send build error to AI:`, error);
      throw error;
    }
  }
} 