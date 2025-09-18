import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { VisualEditorController } from '../controllers/visualEditorController';
import { asAuthMiddleware, asAuthHandler } from '../middleware/authMiddleware';
import multer from 'multer';
import rateLimit from 'express-rate-limit';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Rate limiting for Visual Editor operations
const visualEditorLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: {
    error: 'Too many visual editor requests',
    message: 'Please wait before making more requests'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const scanLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute  
  max: 5, // 5 scans per minute per IP (scanning is expensive)
  message: {
    error: 'Too many scan requests',
    message: 'Please wait before scanning again'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// All visual editor routes require authentication
router.use(asAuthMiddleware(authenticateToken));

// Apply rate limiting
router.use(visualEditorLimiter);

// Update element content (text, images, styles)
router.post('/update', asAuthHandler(VisualEditorController.updateElement));

// Direct file update (no AI)
router.post('/update-file', asAuthHandler(VisualEditorController.updateFileDirect));

// Upload and replace images
router.post('/upload-image', upload.single('image'), asAuthHandler(VisualEditorController.uploadImage));

// Analyze component structure for better editing
router.post('/analyze', asAuthHandler(VisualEditorController.analyzeComponent));

// Get editable elements from a file (with stricter rate limiting)
router.post('/scan', scanLimiter, asAuthHandler(VisualEditorController.scanElements));

// Apply bulk changes (color themes, fonts, etc.)
router.post('/bulk-update', asAuthHandler(VisualEditorController.bulkUpdate));

export default router; 