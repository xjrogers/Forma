import { Octokit } from '@octokit/rest';
import { prisma } from '../lib/prisma';
import { randomUUID } from 'crypto';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  clone_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  size: number;
  updated_at: string;
  topics: string[];
}

interface ImportConfig {
  projectName: string;
  description: string;
  enableAIAnalysis: boolean;
  analyzeArchitecture: boolean;
  extractBusinessLogic: boolean;
  buildKnowledgeGraph: boolean;
  generateDocumentation: boolean;
  scanSecurity: boolean;
  optimizeForAI: boolean;
}

interface ImportProgress {
  step: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message: string;
  details?: string;
}

interface ProjectFile {
  path: string;
  content: string;
  contentType: string;
  size: number;
}

interface AnalysisResult {
  framework?: string;
  architecture?: any;
  dependencies?: any;
  businessLogic?: any;
  knowledgeGraph?: any;
  securityIssues?: any[];
  aiContext?: any;
  documentation?: string;
}

export class ProjectImportService {
  private octokit: Octokit;
  private progressCallback?: (progress: ImportProgress) => void;

  constructor(githubToken: string, progressCallback?: (progress: ImportProgress) => void) {
    this.octokit = new Octokit({
      auth: githubToken,
    });
    this.progressCallback = progressCallback;
  }

  private updateProgress(step: string, status: ImportProgress['status'], message: string, details?: string) {
    const progress: ImportProgress = { step, status, message, details };
    console.log(`📊 Import Progress: ${step} - ${status} - ${message}`);
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  async importProject(userId: string, repository: GitHubRepo, config: ImportConfig): Promise<any> {
    let tokensUsed = 0;
    let projectId: string | null = null;

    try {
      this.updateProgress('Initialization', 'processing', 'Starting project import...');

      // 1. Estimate and reserve tokens
      const { TokenEstimationService } = await import('./tokenEstimationService');
      const estimate = TokenEstimationService.estimateImportTokens(repository, config);
      
      this.updateProgress('Token Reservation', 'processing', 
        `Reserving ${estimate.totalTokens.toLocaleString()} tokens for import...`);

      // 2. Create project in database
      const project = await this.createProject(userId, repository, config);
      projectId = project.id;
      
      // 3. Fetch repository contents
      this.updateProgress('Repository Fetch', 'processing', 'Downloading repository contents...');
      const files = await this.fetchRepositoryContents(repository);
      
      // Deduct base processing tokens
      tokensUsed += estimate.baseTokens;
      await this.deductTokens(userId, projectId, estimate.baseTokens, 'repository-processing');

      // 4. Security scanning (if enabled)
      if (config.scanSecurity) {
        this.updateProgress('Security Scan', 'processing', 'Scanning for security issues...');
        await this.performSecurityScan(files);
        
        if (estimate.breakdown.securityScan > 0) {
          tokensUsed += estimate.breakdown.securityScan;
          await this.deductTokens(userId, projectId, estimate.breakdown.securityScan, 'security-scan');
        }
      }

      // 5. Save files to database
      this.updateProgress('File Processing', 'processing', 'Processing and saving files...');
      await this.saveProjectFiles(projectId, files);

      // 6. AI Analysis (if enabled)
      let analysisResult: AnalysisResult = {};
      if (config.enableAIAnalysis) {
        analysisResult = await this.performAIAnalysis(files, config, estimate, userId, projectId);
        
        // Tokens are deducted within performAIAnalysis for each step
        tokensUsed += estimate.analysisTokens;
      }

      // 7. Save AI analysis results
      if (Object.keys(analysisResult).length > 0) {
        this.updateProgress('AI Context', 'processing', 'Saving AI analysis results...');
        await this.saveAIAnalysis(projectId, analysisResult);
      }

      // 8. Update project with final metadata
      await this.updateProjectMetadata(projectId, analysisResult, tokensUsed);

      this.updateProgress('Complete', 'completed', 'Project imported successfully!', 
        `Imported ${files.length} files using ${tokensUsed.toLocaleString()} tokens`);

      return {
        success: true,
        project: project,
        filesImported: files.length,
        analysisEnabled: config.enableAIAnalysis,
        tokensUsed: tokensUsed,
        estimate: estimate
      };

    } catch (error) {
      console.error('❌ Project import failed:', error);
      
      // Update project status if we created one
      if (projectId) {
        try {
          await prisma.projects.update({
            where: { id: projectId },
            data: { 
              description: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              tokensUsed: tokensUsed
            }
          });
        } catch (updateError) {
          console.error('Failed to update project status:', updateError);
        }
      }

      this.updateProgress('Error', 'error', 'Import failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async createProject(userId: string, repository: GitHubRepo, config: ImportConfig) {
    const project = await prisma.projects.create({
      data: {
        id: randomUUID(),
        name: config.projectName,
        description: config.description,
        userId: userId,
        githubRepoId: repository.id.toString(),
        githubRepoName: repository.name,
        githubPrivate: repository.private,
        repoUrl: repository.clone_url,
        branch: repository.default_branch,
        updatedAt: new Date()
      }
    });

    this.updateProgress('Project Creation', 'completed', 'Project created in database');
    return project;
  }

  private async fetchRepositoryContents(repository: GitHubRepo): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    const [owner, repo] = repository.full_name.split('/');

    try {
      // Get repository tree recursively
      const { data: tree } = await this.octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: repository.default_branch,
        recursive: 'true'
      });

      // Filter for files (not directories) and reasonable size
      const fileEntries = tree.tree.filter(item => 
        item.type === 'blob' && 
        item.size && 
        item.size < 1024 * 1024 && // Max 1MB per file
        !this.shouldIgnoreFile(item.path || '')
      );

      this.updateProgress('Repository Fetch', 'processing', 
        `Found ${fileEntries.length} files to import...`);

      // Fetch file contents in batches
      const batchSize = 10;
      for (let i = 0; i < fileEntries.length; i += batchSize) {
        const batch = fileEntries.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (file) => {
          try {
            const { data } = await this.octokit.rest.git.getBlob({
              owner,
              repo,
              file_sha: file.sha!
            });

            let content = '';
            if (data.encoding === 'base64') {
              content = Buffer.from(data.content, 'base64').toString('utf-8');
            } else {
              content = data.content;
            }

            return {
              path: file.path!,
              content,
              contentType: this.getContentType(file.path!),
              size: Buffer.byteLength(content, 'utf-8')
            };
          } catch (error) {
            console.error(`Failed to fetch file ${file.path}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        files.push(...batchResults.filter(f => f !== null) as ProjectFile[]);

        this.updateProgress('Repository Fetch', 'processing', 
          `Downloaded ${files.length}/${fileEntries.length} files...`);
      }

      this.updateProgress('Repository Fetch', 'completed', 
        `Successfully downloaded ${files.length} files`);

      return files;

    } catch (error) {
      console.error('Error fetching repository contents:', error);
      throw new Error('Failed to fetch repository contents');
    }
  }

  private shouldIgnoreFile(path: string): boolean {
    const ignoredPatterns = [
      /node_modules/,
      /\.git/,
      /\.next/,
      /dist/,
      /build/,
      /coverage/,
      /\.nyc_output/,
      /\.cache/,
      /\.DS_Store/,
      /Thumbs\.db/,
      /\.env/,
      /\.log$/,
      /\.(jpg|jpeg|png|gif|ico|svg|pdf|zip|tar|gz)$/i
    ];

    return ignoredPatterns.some(pattern => pattern.test(path));
  }

  private getContentType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const typeMap: Record<string, string> = {
      'js': 'application/javascript',
      'jsx': 'application/javascript',
      'ts': 'application/typescript',
      'tsx': 'application/typescript',
      'json': 'application/json',
      'html': 'text/html',
      'css': 'text/css',
      'scss': 'text/scss',
      'sass': 'text/sass',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'yml': 'application/yaml',
      'yaml': 'application/yaml',
      'xml': 'application/xml',
      'py': 'text/x-python',
      'java': 'text/x-java',
      'php': 'text/x-php',
      'rb': 'text/x-ruby',
      'go': 'text/x-go',
      'rs': 'text/x-rust',
      'c': 'text/x-c',
      'cpp': 'text/x-c++',
      'h': 'text/x-c',
      'hpp': 'text/x-c++'
    };

    return typeMap[ext || ''] || 'text/plain';
  }

  private async performSecurityScan(files: ProjectFile[]): Promise<void> {
    // Basic security scanning
    const securityIssues: any[] = [];

    for (const file of files) {
      // Check for common security issues
      if (file.path.includes('.env') && !file.path.includes('.example')) {
        securityIssues.push({
          type: 'sensitive_file',
          file: file.path,
          message: 'Environment file detected - may contain secrets'
        });
      }

      // Check for hardcoded secrets (basic patterns)
      const secretPatterns = [
        /password\s*=\s*["'][^"']+["']/i,
        /api[_-]?key\s*=\s*["'][^"']+["']/i,
        /secret\s*=\s*["'][^"']+["']/i,
        /token\s*=\s*["'][^"']+["']/i
      ];

      for (const pattern of secretPatterns) {
        if (pattern.test(file.content)) {
          securityIssues.push({
            type: 'potential_secret',
            file: file.path,
            message: 'Potential hardcoded secret detected'
          });
        }
      }
    }

    if (securityIssues.length > 0) {
      this.updateProgress('Security Scan', 'completed', 
        `Found ${securityIssues.length} potential security issues`, 
        'Review flagged files before deployment');
    } else {
      this.updateProgress('Security Scan', 'completed', 'No security issues detected');
    }
  }

  private async saveProjectFiles(projectId: string, files: ProjectFile[]): Promise<void> {
    const batchSize = 50;
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      await prisma.projectFiles.createMany({
        data: batch.map(file => ({
          id: randomUUID(),
          projectId,
          path: file.path,
          content: file.content,
          contentType: file.contentType,
          size: file.size,
          status: 'UPLOADED'
        }))
      });

      this.updateProgress('File Processing', 'processing', 
        `Saved ${Math.min(i + batchSize, files.length)}/${files.length} files...`);
    }

    this.updateProgress('File Processing', 'completed', 
      `Successfully saved ${files.length} files to database`);
  }

  private async performAIAnalysis(files: ProjectFile[], config: ImportConfig, estimate: any, userId: string, projectId: string): Promise<AnalysisResult> {
    const result: AnalysisResult = {};

    if (config.analyzeArchitecture) {
      this.updateProgress('Architecture Analysis', 'processing', 'Analyzing project structure...');
      result.architecture = await this.analyzeArchitecture(files);
      await this.deductTokens(userId, projectId, estimate.breakdown.architectureAnalysis, 'architecture-analysis');
      this.updateProgress('Architecture Analysis', 'completed', 'Architecture analysis complete');
    }

    if (config.extractBusinessLogic) {
      this.updateProgress('Business Logic', 'processing', 'Extracting business logic...');
      result.businessLogic = await this.extractBusinessLogic(files);
      await this.deductTokens(userId, projectId, estimate.breakdown.businessLogicExtraction, 'business-logic');
      this.updateProgress('Business Logic', 'completed', 'Business logic extraction complete');
    }

    if (config.buildKnowledgeGraph) {
      this.updateProgress('Knowledge Graph', 'processing', 'Building component relationships...');
      result.knowledgeGraph = await this.buildKnowledgeGraph(files);
      await this.deductTokens(userId, projectId, estimate.breakdown.knowledgeGraph, 'knowledge-graph');
      this.updateProgress('Knowledge Graph', 'completed', 'Knowledge graph built');
    }

    if (config.optimizeForAI) {
      this.updateProgress('AI Optimization', 'processing', 'Creating AI context and embeddings...');
      result.aiContext = await this.createAIContext(files, result);
      await this.deductTokens(userId, projectId, estimate.breakdown.aiOptimization, 'ai-optimization');
      this.updateProgress('AI Optimization', 'completed', 'AI optimization complete');
    }

    if (config.generateDocumentation) {
      this.updateProgress('Documentation', 'processing', 'Generating project documentation...');
      result.documentation = await this.generateDocumentation(files, result);
      await this.deductTokens(userId, projectId, estimate.breakdown.documentation, 'documentation');
      this.updateProgress('Documentation', 'completed', 'Documentation generated');
    }

    return result;
  }

  private async analyzeArchitecture(files: ProjectFile[]) {
    // Detect framework and architecture patterns
    const packageJson = files.find(f => f.path === 'package.json');
    let framework = 'unknown';
    let dependencies: any = {};

    if (packageJson) {
      try {
        const pkg = JSON.parse(packageJson.content);
        dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
        
        // Detect framework
        if (dependencies['next']) framework = 'Next.js';
        else if (dependencies['react']) framework = 'React';
        else if (dependencies['vue']) framework = 'Vue.js';
        else if (dependencies['angular']) framework = 'Angular';
        else if (dependencies['express']) framework = 'Express.js';
        else if (dependencies['fastify']) framework = 'Fastify';
      } catch (e) {
        console.error('Error parsing package.json:', e);
      }
    }

    // Analyze file structure
    const fileTypes = files.reduce((acc, file) => {
      const ext = file.path.split('.').pop() || 'unknown';
      acc[ext] = (acc[ext] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Find entry points
    const entryPoints = files.filter(f => 
      ['index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts', 'server.js', 'server.ts'].includes(f.path.split('/').pop() || '')
    ).map(f => f.path);

    return {
      framework,
      dependencies,
      fileTypes,
      entryPoints,
      totalFiles: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0)
    };
  }

  private async extractBusinessLogic(files: ProjectFile[]) {
    // Extract key business concepts and functions
    const businessConcepts: string[] = [];
    const apiEndpoints: string[] = [];
    const databaseModels: string[] = [];

    for (const file of files) {
      // Look for API routes
      if (file.path.includes('api/') || file.path.includes('routes/')) {
        const routeMatches = file.content.match(/\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi);
        if (routeMatches) {
          apiEndpoints.push(...routeMatches.map(match => `${file.path}: ${match}`));
        }
      }

      // Look for database models/schemas
      if (file.path.includes('model') || file.path.includes('schema') || file.path.includes('entity')) {
        const modelMatches = file.content.match(/(?:class|interface|type)\s+(\w+)/gi);
        if (modelMatches) {
          databaseModels.push(...modelMatches.map(match => `${file.path}: ${match}`));
        }
      }

      // Extract business domain concepts
      const conceptMatches = file.content.match(/(?:class|function|const)\s+(\w*(?:Service|Controller|Manager|Handler|Repository)\w*)/gi);
      if (conceptMatches) {
        businessConcepts.push(...conceptMatches.map(match => `${file.path}: ${match}`));
      }
    }

    return {
      businessConcepts: Array.from(new Set(businessConcepts)),
      apiEndpoints: Array.from(new Set(apiEndpoints)),
      databaseModels: Array.from(new Set(databaseModels))
    };
  }

  private async buildKnowledgeGraph(files: ProjectFile[]) {
    // Build relationships between files and components
    const imports: Record<string, string[]> = {};
    const exports: Record<string, string[]> = {};
    const components: Record<string, string[]> = {};

    for (const file of files) {
      // Extract imports
      const importMatches = file.content.match(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/gi);
      if (importMatches) {
        imports[file.path] = importMatches.map(match => {
          const fromMatch = match.match(/from\s+['"`]([^'"`]+)['"`]/i);
          return fromMatch ? fromMatch[1] : '';
        }).filter(Boolean);
      }

      // Extract exports
      const exportMatches = file.content.match(/export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/gi);
      if (exportMatches) {
        exports[file.path] = exportMatches.map(match => {
          const nameMatch = match.match(/(?:class|function|const|let|var)\s+(\w+)/i);
          return nameMatch ? nameMatch[1] : '';
        }).filter(Boolean);
      }

      // Extract React components
      if (file.contentType.includes('javascript') || file.contentType.includes('typescript')) {
        const componentMatches = file.content.match(/(?:function|const)\s+([A-Z]\w*)\s*(?:\(|=)/g);
        if (componentMatches) {
          components[file.path] = componentMatches.map(match => {
            const nameMatch = match.match(/(?:function|const)\s+([A-Z]\w*)/);
            return nameMatch ? nameMatch[1] : '';
          }).filter(Boolean);
        }
      }
    }

    return {
      imports,
      exports,
      components,
      relationships: this.calculateRelationships(imports, exports)
    };
  }

  private calculateRelationships(imports: Record<string, string[]>, exports: Record<string, string[]>) {
    const relationships: Array<{ from: string; to: string; type: string; details?: string }> = [];

    for (const [file, importList] of Object.entries(imports)) {
      for (const importPath of importList) {
        // Find matching export
        for (const [exportFile, exportList] of Object.entries(exports)) {
          if (exportFile.includes(importPath) || importPath.includes(exportFile)) {
            relationships.push({
              from: file,
              to: exportFile,
              type: 'imports',
              details: `Imports from ${exportList.length} exports`
            });
          }
        }
      }
    }

    return relationships;
  }

  private async createAIContext(files: ProjectFile[], analysis: AnalysisResult) {
    // Create AI-optimized context and summaries
    const context = {
      projectSummary: this.generateProjectSummary(files, analysis),
      keyFiles: this.identifyKeyFiles(files),
      codePatterns: this.extractCodePatterns(files),
      techStack: analysis.architecture?.dependencies ? Object.keys(analysis.architecture.dependencies) : [],
      complexity: this.calculateComplexity(files)
    };

    return context;
  }

  private generateProjectSummary(files: ProjectFile[], analysis: AnalysisResult): string {
    const framework = analysis.architecture?.framework || 'Unknown';
    const fileCount = files.length;
    const mainLanguages = Object.entries(analysis.architecture?.fileTypes || {})
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([ext]) => ext);

    return `This is a ${framework} project with ${fileCount} files, primarily using ${mainLanguages.join(', ')}. ` +
           `The project includes ${analysis.businessLogic?.apiEndpoints?.length || 0} API endpoints and ` +
           `${analysis.businessLogic?.databaseModels?.length || 0} data models.`;
  }

  private identifyKeyFiles(files: ProjectFile[]): string[] {
    const keyPatterns = [
      /package\.json$/,
      /README\.md$/i,
      /index\.(js|ts|jsx|tsx)$/,
      /app\.(js|ts|jsx|tsx)$/,
      /main\.(js|ts)$/,
      /server\.(js|ts)$/,
      /config/,
      /routes?/,
      /api/,
      /components?/
    ];

    return files
      .filter(file => keyPatterns.some(pattern => pattern.test(file.path)))
      .map(file => file.path)
      .slice(0, 20); // Limit to top 20 key files
  }

  private extractCodePatterns(files: ProjectFile[]): string[] {
    const patterns: Set<string> = new Set();

    for (const file of files) {
      // React patterns
      if (file.content.includes('useState')) patterns.add('React Hooks');
      if (file.content.includes('useEffect')) patterns.add('React Effects');
      if (file.content.includes('createContext')) patterns.add('React Context');
      
      // API patterns
      if (file.content.includes('fetch(') || file.content.includes('axios')) patterns.add('HTTP Requests');
      if (file.content.includes('express()')) patterns.add('Express Server');
      if (file.content.includes('app.get') || file.content.includes('app.post')) patterns.add('REST API');
      
      // Database patterns
      if (file.content.includes('prisma')) patterns.add('Prisma ORM');
      if (file.content.includes('mongoose')) patterns.add('Mongoose ODM');
      if (file.content.includes('SELECT') || file.content.includes('INSERT')) patterns.add('SQL Queries');
      
      // Authentication patterns
      if (file.content.includes('jwt') || file.content.includes('token')) patterns.add('JWT Authentication');
      if (file.content.includes('passport')) patterns.add('Passport.js');
      
      // Testing patterns
      if (file.content.includes('describe(') || file.content.includes('test(')) patterns.add('Unit Testing');
      if (file.content.includes('cy.')) patterns.add('Cypress Testing');
    }

    return Array.from(patterns);
  }

  private calculateComplexity(files: ProjectFile[]): { score: number; factors: string[] } {
    let score = 0;
    const factors: string[] = [];

    // File count complexity
    if (files.length > 100) {
      score += 2;
      factors.push('Large codebase (100+ files)');
    } else if (files.length > 50) {
      score += 1;
      factors.push('Medium codebase (50+ files)');
    }

    // Language diversity
    const languages = new Set(files.map(f => f.contentType));
    if (languages.size > 5) {
      score += 1;
      factors.push('Multiple languages/technologies');
    }

    // Deep nesting
    const maxDepth = Math.max(...files.map(f => f.path.split('/').length));
    if (maxDepth > 6) {
      score += 1;
      factors.push('Deep directory structure');
    }

    return { score, factors };
  }

  private async generateDocumentation(files: ProjectFile[], analysis: AnalysisResult): Promise<string> {
    // Generate comprehensive project documentation
    const sections = [
      '# Project Documentation\n',
      `## Overview\n${analysis.aiContext?.projectSummary || 'No summary available'}\n`,
      `## Architecture\n**Framework:** ${analysis.architecture?.framework || 'Unknown'}\n`,
      `**Total Files:** ${files.length}\n`,
      `**Main Languages:** ${Object.keys(analysis.architecture?.fileTypes || {}).join(', ')}\n`,
      '\n## Key Files\n',
      ...(analysis.aiContext?.keyFiles || []).map((file: any) => `- ${file}`),
      '\n## API Endpoints\n',
      ...(analysis.businessLogic?.apiEndpoints || []).map((endpoint: any) => `- ${endpoint}`),
      '\n## Code Patterns\n',
      ...(analysis.aiContext?.codePatterns || []).map((pattern: any) => `- ${pattern}`),
    ];

    return sections.join('\n');
  }

  private async saveAIAnalysis(projectId: string, analysis: AnalysisResult): Promise<void> {
    // Save analysis results as JSON metadata
    // This could be extended to save to a separate AI context table
    await prisma.projects.update({
      where: { id: projectId },
      data: {
        // Store analysis in a JSON field (would need to add this to schema)
        // For now, we'll store key insights in description
        description: analysis.aiContext?.projectSummary || undefined
      }
    });
  }

  private async deductTokens(userId: string, projectId: string, tokens: number, operation: string): Promise<void> {
    if (tokens <= 0) return;

    try {
      // Use the existing AI agent token deduction system
      
      await prisma.$transaction(async (tx) => {
        // SECURITY: Re-check user's token balance before deduction
        const user = await tx.users.findUnique({
          where: { id: userId },
          select: { 
            tokensUsed: true, 
            tokensLimit: true,
            role: true
          }
        });

        if (!user) {
          throw new Error('User not found during token deduction');
        }

        if (user.role === 'banned' || user.role === 'suspended') {
          throw new Error('User account suspended during import');
        }

        // Use TokenService for validation
        const { tokenService } = await import('./tokenService');
        const balance = await tokenService.getTokenBalance(userId);
        if (balance.totalAvailable < tokens) {
          throw new Error(`Insufficient tokens for ${operation}: need ${tokens}, have ${balance.totalAvailable}`);
        }

        // Use TokenService for token consumption
        const result = await tokenService.consumeTokens(
            userId,
            tokens,
          `import-${operation}`, 
          (tokens / 1000) * 0.003, // Approximate cost
          projectId
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to consume tokens');
        }

        console.log(`💰 Deducted ${tokens} tokens for ${operation} (user: ${userId}, remaining: ${result.newBalance.totalAvailable})`);
      });

    } catch (error) {
      console.error(`❌ Failed to deduct tokens for ${operation}:`, error);
      throw new Error(`Token deduction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async updateProjectMetadata(projectId: string, analysis: AnalysisResult, totalTokensUsed: number): Promise<void> {
    const updates: any = {
      updatedAt: new Date(),
      description: analysis.aiContext?.projectSummary || 'Successfully imported with AI analysis'
    };

    await prisma.projects.update({
      where: { id: projectId },
      data: updates
    });

    console.log(`📊 Updated project ${projectId} metadata. Total tokens used: ${totalTokensUsed}`);
  }
} 