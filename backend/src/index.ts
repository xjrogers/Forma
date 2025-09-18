import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import hpp from 'hpp';
import { PrismaClient } from '@prisma/client';

// Import routes
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import projectsRoutes from './projects/projectsRoutes';
import fileRoutes from './routes/fileRoutes';
import builderRoutes from './routes/builderRoutes';
import conversationRoutes from './routes/conversationRoutes';
import previewRoutes from './routes/previewRoutes';
import usageRoutes from './routes/usageRoutes';
import billingRoutes from './routes/billingRoutes';
import webhookRoutes from './routes/webhookRoutes';
import githubRoutes from './routes/githubRoutes';
import visualEditorRoutes from './routes/visualEditorRoutes';
import deploymentRoutes from './routes/deploymentRoutes';
import contactRoutes from './routes/contactRoutes';

// Import WebSocket manager
import { WebSocketManager } from './services/websocketManager';

// Import security middleware
import { 
  securityHeaders, 
  securityLogger, 
  blockAttackPatterns 
} from './middleware/securityMiddleware';

// Load environment variables
dotenv.config();

// Initialize Prisma
const prisma = new PrismaClient();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Webhook endpoint needs raw body
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  // Additional security headers
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  permittedCrossDomainPolicies: false
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Stripe-Signature']
}));

// Logging
app.use(morgan('combined'));

// Body parsing middleware (after raw body handler for webhooks)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Additional security middleware
app.use(hpp()); // Prevent HTTP Parameter Pollution

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Slow down repeated requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 100, // Allow 100 requests per windowMs without delay
  delayMs: () => 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
});

// Apply rate limiting and speed limiting (except for webhooks)
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/webhooks/')) {
    globalLimiter(req, res, next);
  } else {
    next();
  }
});

app.use((req, res, next) => {
  if (!req.path.startsWith('/api/webhooks/')) {
    speedLimiter(req, res, next);
  } else {
    next();
  }
});

// Apply security middleware
app.use(securityHeaders);
app.use(securityLogger);
app.use(blockAttackPatterns);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/builder', builderRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/preview', previewRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/visual-editor', visualEditorRoutes);
app.use('/api/deployments', deploymentRoutes);
app.use('/api/contact', contactRoutes);

// Test database connection endpoint
app.get('/api/test', async (_req, res) => {
  try {
    await prisma.$connect();
    
    // Test query
    const userCount = await prisma.users.count();
    
    res.json({ 
      message: 'DevAssistant.io API is running!',
      database: 'Connected to PostgreSQL',
      userCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ 
      error: 'Database connection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 DevAssistant.io API server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? 'Set' : 'Missing!'}`);
  console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Configured' : 'Missing!'}`);
  console.log(`🔔 Stripe Webhooks: ${process.env.STRIPE_WEBHOOK_SECRET ? 'Configured' : 'Missing!'}`);
});

// Initialize WebSocket manager for bidirectional AI communication
WebSocketManager.initialize(server);
console.log(`🔌 WebSocket AI Agent server initialized on ws://localhost:${PORT}/ws/ai-agent`);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down gracefully`);
  
  server.close(async () => {
    console.log('HTTP server closed');
    
    try {
      await prisma.$disconnect();
      console.log('Database connection closed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app; 