import express from 'express';
import { PreviewController } from '../controllers/previewController';
import { asAuthHandler } from '../middleware/authMiddleware';

const router = express.Router();

// Create or start preview for a project
router.post('/create/:projectId', asAuthHandler(PreviewController.createPreview));

// Get preview status and information
router.get('/:projectId', asAuthHandler(PreviewController.getPreview));

// Stop preview for a project
router.delete('/:projectId', asAuthHandler(PreviewController.stopPreview));

// Update preview with file changes (used by AI agent)
router.put('/update/:projectId', asAuthHandler(PreviewController.updatePreview));

// Get preview logs for debugging
router.get('/logs/:projectId', asAuthHandler(PreviewController.getPreviewLogs));

// Stream preview events (SSE for real-time updates)
router.get('/stream/:projectId', asAuthHandler(PreviewController.streamPreviewEvents));

// Handle build errors from frontend
router.post('/error/:projectId', asAuthHandler(PreviewController.handleBuildError));

// Catch-all handler for malformed preview requests
router.post('/:projectId', (req, res) => {
  console.warn(`⚠️ Malformed POST request to /api/preview/${req.params.projectId}`);
  console.warn('Request body:', req.body);
  console.warn('Request headers:', req.headers['content-type']);
  
  return res.status(400).json({ 
    error: 'Invalid request. Use /create/:projectId to create a preview or /error/:projectId to report errors.',
    availableEndpoints: [
      'POST /api/preview/create/:projectId',
      'GET /api/preview/:projectId', 
      'DELETE /api/preview/:projectId',
      'PUT /api/preview/update/:projectId',
      'POST /api/preview/error/:projectId'
    ]
  });
});

export default router; 