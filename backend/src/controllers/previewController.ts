import { Response } from 'express';
import { AuthRequest } from '../types/express';
import { PreviewService } from '../services/previewService';

export class PreviewController {
  /**
   * Create or start preview for a project
   */
  static async createPreview(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      console.log(`🔨 Creating preview for project: ${projectId}`);
      
      const previewService = PreviewService.getInstance();
      const preview = await previewService.createPreview(projectId);

      return res.json({
        success: true,
        preview: {
          id: preview.id,
          projectId: preview.projectId,
          status: preview.status,
          previewUrl: preview.previewUrl,
          framework: preview.framework,
          files: preview.files,
          lastUpdated: preview.lastUpdated
        }
      });

    } catch (error) {
      console.error('Preview creation error:', error);
      return res.status(500).json({ 
        error: 'Failed to create preview',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get preview status and information
   */
  static async getPreview(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      const previewService = PreviewService.getInstance();
      const preview = previewService.getPreview(projectId);

      if (!preview) {
        return res.status(404).json({ error: 'Preview not found' });
      }

      return res.json({
        success: true,
        preview: {
          id: preview.id,
          projectId: preview.projectId,
          status: preview.status,
          previewUrl: preview.previewUrl,
          framework: preview.framework,
          files: preview.files,
          lastUpdated: preview.lastUpdated
        }
      });

    } catch (error) {
      console.error('Get preview error:', error);
      return res.status(500).json({ 
        error: 'Failed to get preview',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Stop preview for a project
   */
  static async stopPreview(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      console.log(`🛑 Stopping preview for project: ${projectId}`);
      
      const previewService = PreviewService.getInstance();
      await previewService.stopPreview(projectId);

      return res.json({
        success: true,
        message: 'Preview stopped successfully'
      });

    } catch (error) {
      console.error('Stop preview error:', error);
      return res.status(500).json({ 
        error: 'Failed to stop preview',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update preview with file changes (called by AI agent)
   */
  static async updatePreview(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { changedFiles } = req.body;
      
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      if (!changedFiles || !Array.isArray(changedFiles)) {
        return res.status(400).json({ error: 'Changed files array is required' });
      }

      console.log(`🔄 Updating preview for project: ${projectId} with ${changedFiles.length} files`);
      
      const previewService = PreviewService.getInstance();
      await previewService.updatePreview(projectId, changedFiles);

      return res.json({
        success: true,
        message: 'Preview updated successfully'
      });

    } catch (error) {
      console.error('Update preview error:', error);
      return res.status(500).json({ 
        error: 'Failed to update preview',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get preview logs for debugging
   */
  static async getPreviewLogs(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      const previewService = PreviewService.getInstance();
      const preview = previewService.getPreview(projectId);

      if (!preview) {
        return res.status(404).json({ error: 'Preview not found' });
      }

      return res.json({
        success: true,
        logs: [], // Build logs are now handled in frontend WebContainer
        status: preview.status,
        lastUpdated: preview.lastUpdated
      });

    } catch (error) {
      console.error('Get preview logs error:', error);
      return res.status(500).json({ 
        error: 'Failed to get preview logs',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Stream preview events (SSE for real-time updates)
   */
  static async streamPreviewEvents(req: AuthRequest, res: Response): Promise<void> {
    const { projectId } = req.params;
    
    if (!projectId) {
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const previewService = PreviewService.getInstance();
    
    // Send initial preview status
    const preview = previewService.getPreview(projectId);
    if (preview) {
      res.write(`data: ${JSON.stringify({
        type: 'status',
        status: preview.status,
        previewUrl: preview.previewUrl,
        framework: preview.framework
      })}\n\n`);
    }

    // Listen for preview events
    const onPreviewReady = (data: any) => {
      if (data.projectId === projectId) {
        res.write(`data: ${JSON.stringify({
          type: 'ready',
          previewUrl: data.preview.previewUrl,
          framework: data.preview.framework
        })}\n\n`);
      }
    };

    const onPreviewUpdated = (data: any) => {
      if (data.projectId === projectId) {
        res.write(`data: ${JSON.stringify({
          type: 'updated',
          changedFiles: data.changedFiles
        })}\n\n`);
      }
    };

    const onPreviewError = (data: any) => {
      if (data.projectId === projectId) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: data.error
        })}\n\n`);
      }
    };

    const onPreviewStopped = (data: any) => {
      if (data.projectId === projectId) {
        res.write(`data: ${JSON.stringify({
          type: 'stopped'
        })}\n\n`);
      }
    };

    // Register event listeners
    previewService.on('preview-ready', onPreviewReady);
    previewService.on('preview-updated', onPreviewUpdated);
    previewService.on('preview-error', onPreviewError);
    previewService.on('preview-stopped', onPreviewStopped);

    // Cleanup on client disconnect
    req.on('close', () => {
      previewService.off('preview-ready', onPreviewReady);
      previewService.off('preview-updated', onPreviewUpdated);
      previewService.off('preview-error', onPreviewError);
      previewService.off('preview-stopped', onPreviewStopped);
    });

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });
  }

  /**
   * Handle build errors from frontend and send to AI for fixing
   */
  static async handleBuildError(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { projectId } = req.params;
      const { errorType, errorOutput } = req.body;
      
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      if (!errorType || !errorOutput) {
        return res.status(400).json({ error: 'Error type and output are required' });
      }

      console.log(`🤖 Handling ${errorType} for project: ${projectId}`);
      
      const previewService = PreviewService.getInstance();
      await previewService.sendBuildErrorToAI(projectId, errorType, errorOutput);

      return res.json({
        success: true,
        message: 'Build error sent to AI for fixing'
      });

    } catch (error) {
      console.error('Handle build error failed:', error);
      return res.status(500).json({ 
        error: 'Failed to handle build error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
} 