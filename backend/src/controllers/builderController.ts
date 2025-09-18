import { Response } from 'express';
import { AuthRequest } from '../types/express';
import { prisma } from '../lib/prisma';
import * as yazl from 'yazl';
import { GitHubService } from '../services/github';

import { AIAgent } from '../services/aiAgent';

export class BuilderController {
  // TRUE streaming chat (like Cursor/Bolt)
  static async chatWithAgentStreaming(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { 
        message, 
        projectId, 
        activeFile, 
        selectedCode,
        model = 'claude-4-sonnet-20250514',
        mode = 'coding',
        approvedActions = [],
        rejectedActions = []
      } = req.body;

      if (!message) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      console.log('🔐 Controller received approvedActions:', approvedActions);
      console.log('❌ Controller received rejectedActions:', rejectedActions);
      
      // Check user's token balance BEFORE starting streaming using new TokenService
      const { tokenService } = await import('../services/tokenService');
      const balance = await tokenService.getTokenBalance(req.user.id);

      console.log(`💰 Token check: ${balance.totalAvailable} total available for user ${req.user.id} (plan: ${balance.plan})`);

      if (balance.totalAvailable <= 0) {
        res.status(429).json({ 
          error: 'Insufficient tokens',
          message: 'You have exceeded your token limit. Please upgrade your plan or wait for your tokens to reset.',
          balance: balance
        });
        return;
      }

      // Estimate tokens needed (rough estimate: ~4 chars per token)
      const estimatedTokens = Math.ceil(message.length / 4) + 500; // Add buffer for response
      if (balance.totalAvailable < estimatedTokens) {
        res.status(429).json({
          error: 'Insufficient tokens for request',
          message: `This request may use ~${estimatedTokens} tokens, but you only have ${balance.totalAvailable} remaining.`,
          balance: balance
        });
        return;
      }

      // Token validation passed - now set up streaming
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      const agent = AIAgent.getInstance();
      console.log('🚀 Using TRUE STREAMING mode (like Cursor/Bolt)');
      
      await agent.processMessageStreaming(
        req.user.id,
        projectId,
        message,
        { activeFile, selectedCode, model, mode, approvedActions, rejectedActions },
        (data) => {
          // Stream data to frontend in real-time
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      );
      
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();

    } catch (error) {
      console.error('Streaming chat error:', error);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: 'Failed to process request' 
      })}\n\n`);
      res.end();
    }
  }

  // AI Quick Fix (like Cursor)
  static async generateQuickFix(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { 
        errorMessage, 
        filePath, 
        fileContent, 
        projectId,
        errorLine,
        errorColumn 
      } = req.body;

      if (!errorMessage || !filePath || !fileContent || !projectId) {
        res.status(400).json({ 
          error: 'Missing required fields: errorMessage, filePath, fileContent, projectId' 
        });
        return;
      }

      // Check user's token balance using new TokenService
      const { tokenService } = await import('../services/tokenService');
      const balance = await tokenService.getTokenBalance(req.user.id);

      if (balance.totalAvailable <= 0) {
        res.status(429).json({ 
          error: 'Insufficient tokens',
          message: 'You have exceeded your token limit. Please upgrade your plan or wait for your tokens to reset.',
          balance: balance
        });
        return;
      }

      // Generate AI quick fix
      const aiAgent = AIAgent.getInstance();
      const result = await aiAgent.generateQuickFix(
        req.user.id,
        projectId,
        errorMessage,
        filePath,
        fileContent,
        errorLine,
        errorColumn
      );

      if (!result.success) {
        res.status(500).json({ 
          error: 'Failed to generate quick fix',
          message: 'AI was unable to generate a fix for this error.'
        });
        return;
      }

      res.json({
        success: true,
        fix: result.fix,
        explanation: result.explanation,
        tokensUsed: result.tokensUsed,
        cost: result.cost
      });

    } catch (error) {
      console.error('❌ Error in generateQuickFix:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to generate quick fix'
      });
    }
  }

  // Legacy generateProject method (kept for backward compatibility)
  static async generateProject(req: AuthRequest, res: Response): Promise<void> {
    // Redirect to new chat system
    await BuilderController.chatWithAgentStreaming(req, res);
  }

  /**
   * Deploy project to production (Railway integration)
   */
  static async deployProject(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      
      // Redirect to new deployment system
      req.body = { projectId };
      
      // Import and use the new deployment controller
      const DeploymentController = (await import('./deploymentController')).default;
      return await DeploymentController.deployProject(req, res);
      
    } catch (error) {
      console.error('Deployment error:', error);
      return res.status(500).json({ error: 'Deployment failed' });
    }
  }

  /**
   * Push project files to GitHub repository
   */
  static async pushToGitHub(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { projectId } = req.body;
      const userId = req.user.id;

      console.log(`📤 GitHub push request for project: ${projectId} by user: ${userId}`);

      // Get project with GitHub info
      console.log(`🔍 Looking for project with ID: ${projectId} owned by user: ${userId}`);
      const project = await prisma.projects.findFirst({
        where: {
          id: projectId,
          userId: userId
        },
        select: {
          id: true,
          name: true,
          githubRepoId: true,
          githubRepoName: true,
          branch: true,
          users: {
            select: {
              githubAccessToken: true,
              githubUsername: true
            }
          },
          files: {
            select: {
              path: true,
              content: true
            }
          }
        }
      });

      if (!project) {
        console.log(`❌ Project not found: projectId=${projectId}, userId=${userId}`);
        return res.status(404).json({ error: 'Project not found or access denied' });
      }

      console.log(`✅ Project found: ${project.name}, GitHub repo: ${project.githubRepoName}`);
      console.log(`🔑 User GitHub token exists: ${!!project.users?.githubAccessToken}`);

      // Check if user has GitHub access token
      const user = project.users;
      if (!user.githubAccessToken) {
        return res.status(401).json({ 
          error: 'GitHub authentication required',
          code: 'GITHUB_AUTH_REQUIRED'
        });
      }

      // Auto-create GitHub repository if not configured
      let repoName = project.githubRepoName;
      if (!repoName) {
        console.log(`🚀 Auto-creating GitHub repository for project: ${project.name}`);
        
        const github = GitHubService.getInstance(user.githubAccessToken);
        
        try {
          const githubRepo = await github.createRepository({
            name: project.name,
            description: `Auto-generated repository for ${project.name}`,
            private: false
          });
          
          console.log(`✅ Repository created: ${githubRepo.name}`);
          
          // Update project with GitHub repo info
          await prisma.projects.update({
            where: { id: projectId },
            data: {
              githubRepoId: githubRepo.id.toString(),
              githubRepoName: githubRepo.name,
              repoUrl: githubRepo.html_url,
              githubPrivate: false
            }
          });
          
          repoName = githubRepo.name;
          console.log(`✅ Repository connected to project`);
          
        } catch (error) {
          console.error('Failed to create GitHub repository:', error);
          return res.status(422).json({ 
            error: 'Failed to create GitHub repository',
            code: 'GITHUB_REPO_CREATION_FAILED',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Get GitHub username (repo owner) and repository name
      const repoOwner = user.githubUsername;
      if (!repoOwner) {
        return res.status(422).json({ 
          error: 'GitHub username not found',
          code: 'GITHUB_USERNAME_MISSING'
        });
      }

      // Extract just the repository name from the full name (e.g., "xjrogers/hi" -> "hi")
      const finalRepoName = repoName.includes('/') 
        ? repoName.split('/')[1] 
        : repoName;

      // Prepare files for GitHub
      const filesToPush = project.files
        .filter(file => file.content !== null && file.content !== undefined)
        .map(file => ({
          path: file.path,
          content: file.content as string
        }));

      if (filesToPush.length === 0) {
        return res.status(400).json({ 
          error: 'No files to push to GitHub',
          code: 'NO_FILES_TO_PUSH'
        });
      }

      console.log(`📁 Preparing to push ${filesToPush.length} files to ${repoOwner}/${finalRepoName}`);

      // Initialize GitHub service with user's access token
      const github = GitHubService.getInstance(user.githubAccessToken);

      // Push files to GitHub
      const result = await github.pushFilesToRepository(
        repoOwner,
        finalRepoName,
        filesToPush,
        project.branch || 'main'
      );

      console.log(`✅ Successfully processed GitHub push:`, result);

      // Handle no changes case
      if (result.noChanges) {
        return res.json({
          success: true,
          message: 'No changes detected - repository is already up to date',
          result: {
            commitSha: result.commitSha,
            commitUrl: result.commitUrl,
            filesUpdated: result.filesUpdated,
            repositoryUrl: `https://github.com/${repoOwner}/${repoName}`,
            noChanges: true
          }
        });
      }

      return res.json({
        success: true,
        message: 'Files successfully pushed to GitHub',
        result: {
          commitSha: result.commitSha,
          commitUrl: result.commitUrl,
          filesUpdated: result.filesUpdated,
          repositoryUrl: `https://github.com/${repoOwner}/${repoName}`,
          noChanges: false
        }
      });

    } catch (error) {
      console.error('GitHub push error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('GitHub authentication failed')) {
          return res.status(401).json({ 
            error: 'GitHub authentication failed. Please reconnect your GitHub account.',
            code: 'GITHUB_AUTH_FAILED'
          });
        }
        if (error.message.includes('Not Found')) {
          return res.status(404).json({ 
            error: 'GitHub repository not found. Please check repository settings.',
            code: 'GITHUB_REPO_NOT_FOUND'
          });
        }
      }

      return res.status(500).json({ 
        error: 'Failed to push to GitHub',
        code: 'GITHUB_PUSH_FAILED'
      });
    }
  }





  // Export project as ZIP
  static async exportProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.user.id;

      console.log(`📦 Exporting project: ${projectId} for user: ${userId}`);

      // Verify project ownership
      const project = await prisma.projects.findFirst({
        where: {
          id: projectId,
          userId: userId
        },
        select: {
          id: true,
          name: true,
          description: true
        }
      });

      if (!project) {
        res.status(404).json({ error: 'Project not found or access denied' });
        return;
      }

      // Get all project files
      const files = await prisma.projectFiles.findMany({
        where: {
          projectId: projectId
        },
        select: {
          path: true,
          content: true,
          contentType: true
        },
        orderBy: {
          path: 'asc'
        }
      });

      if (files.length === 0) {
        res.status(400).json({ error: 'No files found in project' });
        return;
      }

      console.log(`📁 Found ${files.length} files to export`);

      // Set response headers BEFORE creating archive
      const zipFileName = `${project.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.zip`;
      console.log(`🏷️ ZIP filename: ${zipFileName}`);
      
      // Force binary content type and prevent text conversion
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Content-Encoding', 'identity');
      res.setHeader('Cache-Control', 'no-transform');
      console.log(`📤 Response headers set with binary mode`);

      // Create ZIP archive using yazl (more reliable)
      const zipFile = new yazl.ZipFile();
      console.log(`📦 ZipFile created`);

      let totalBytesWritten = 0;
      let chunkCount = 0;

      // Set up proper error handling before piping
      zipFile.outputStream.on('error', (err: any) => {
        console.error('❌ Archive error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Archive creation failed' });
        }
      });

      // Add logging to track data flow
      zipFile.outputStream.on('data', (chunk: Buffer) => {
        totalBytesWritten += chunk.length;
        chunkCount++;
        console.log(`📊 Chunk ${chunkCount}: ${chunk.length} bytes (total: ${totalBytesWritten})`);
        
        // Log first few bytes of first chunk to verify ZIP signature
        if (chunkCount === 1) {
          const signature = chunk.slice(0, 4);
          console.log(`🔍 ZIP signature (first 4 bytes):`, signature, `as hex: ${signature.toString('hex')}`);
        }
      });

      zipFile.outputStream.on('end', () => {
        console.log(`✅ ZIP stream ended. Total: ${totalBytesWritten} bytes in ${chunkCount} chunks`);
      });

      // Pipe archive directly to response
      zipFile.outputStream.pipe(res);
      console.log(`🔗 Stream piped to response`);

      // Add project metadata file
      const metadata = {
        name: project.name,
        description: project.description,
        exportedAt: new Date().toISOString(),
        totalFiles: files.length,
        generatedBy: 'Forge - AI Code Generator'
      };
      
      const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2), 'utf8');
      console.log(`📄 Adding metadata file: ${metadataBuffer.length} bytes`);
      zipFile.addBuffer(metadataBuffer, 'project-info.json');

      // Add README with project info
      const readme = `# ${project.name}

${project.description || 'No description provided'}

## Project Information
- **Exported from:** Forge AI Code Generator
- **Export Date:** ${new Date().toLocaleString()}
- **Total Files:** ${files.length}

## Getting Started
This project was exported from Forge. To run it:

1. Extract this ZIP file
2. Navigate to the project directory
3. Install dependencies (if applicable):
   \`\`\`bash
   npm install
   \`\`\`
4. Start the development server (if applicable):
   \`\`\`bash
   npm run dev
   \`\`\`

---
Generated by [Forge](https://forge.ai) - AI-powered code generation platform
`;

      const readmeBuffer = Buffer.from(readme, 'utf8');
      console.log(`📖 Adding README file: ${readmeBuffer.length} bytes`);
      zipFile.addBuffer(readmeBuffer, 'README.md');

      // Add all project files
      for (const file of files) {
        try {
          // Ensure file path doesn't start with slash and is safe
          const safePath = file.path.replace(/^\/+/, '').replace(/\.\./g, '');
          
          if (safePath && file.content !== null && file.content !== undefined) {
            // Ensure content is a string
            const content = typeof file.content === 'string' ? file.content : String(file.content);
            zipFile.addBuffer(Buffer.from(content, 'utf8'), safePath);
            console.log(`✅ Added file: ${safePath} (${content.length} bytes)`);
          } else {
            console.warn(`⚠️ Skipping file with invalid path or content: ${file.path}`);
          }
        } catch (fileError) {
          console.error(`❌ Error adding file ${file.path}:`, fileError);
          // Continue with other files
        }
      }

      // Finalize the ZIP file - this triggers the stream to complete
      console.log(`🏁 Finalizing ZIP file with ${files.length + 2} total entries`);
      zipFile.end();
      console.log(`🎉 ZIP file finalized, streaming to client`);

    } catch (error) {
      console.error('❌ Export project error:', error);
      if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to export project' });
      }
    }
  }



} 