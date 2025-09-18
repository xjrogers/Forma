import Queue from 'bull';
import { prisma } from '../lib/prisma';
import { storage } from './storage';
import nodemailer from 'nodemailer';

interface FileUploadJob {
  fileId: string;
  projectId: string;
  path: string;
  content: string;
  contentType: string;
}

interface ProjectImportJob {
  importId: string;
  userId: string;
  repository: any;
  config: any;
  estimatedTokens: number;
}

interface EmailJob {
  notificationId: string;
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  metadata?: any;
}

class QueueService {
  private static instance: QueueService;
  private fileUploadQueue: Queue.Queue<FileUploadJob>;
  private projectImportQueue: Queue.Queue<ProjectImportJob>;
  private emailQueue: Queue.Queue<EmailJob>;
  private emailTransporter: nodemailer.Transporter;

  private constructor() {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      }
    });

    // Initialize file upload queue
    this.fileUploadQueue = new Queue<FileUploadJob>('file-uploads', process.env.REDIS_URL!, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000 // Start with 2 seconds, then 4, then 8
        },
        removeOnComplete: 100,
        removeOnFail: 100
      }
    });

    // Initialize project import queue
    this.projectImportQueue = new Queue<ProjectImportJob>('project-imports', process.env.REDIS_URL!, {
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: 50,
        removeOnFail: 50
      }
    });

    // Initialize email queue with optimized settings for email delivery
    this.emailQueue = new Queue<EmailJob>('email-notifications', process.env.REDIS_URL!, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000 // Start with 1 second, then 2, then 4
        },
        removeOnComplete: 100,
        removeOnFail: 100,
        timeout: 30000 // 30 second timeout for email sending
      }
    });

    // Process file uploads
    this.fileUploadQueue.process(async (job) => {
      const { fileId, projectId, path, content, contentType } = job.data;

      try {
        // Upload to R2
        const r2Key = await storage.saveFile(
          projectId,
          path,
          content,
          contentType
        );

        // Update database record
        await prisma.projectFiles.update({
          where: { id: fileId },
          data: {
            r2Key,
            status: 'UPLOADED',
            content: null // Clear temporary content
          }
        });

        return { success: true, r2Key };
      } catch (error) {
        console.error(`Failed to upload file ${path}:`, error);
        
        // Update database to mark as failed
        await prisma.projectFiles.update({
          where: { id: fileId },
          data: {
            status: 'FAILED',
            updatedAt: new Date()
          }
        });

        throw error; // Rethrow to trigger bull's retry mechanism
      }
    });

    // Log events
    this.fileUploadQueue.on('completed', (job) => {
      console.log(`File upload completed: ${job.data.path}`);
    });

    this.fileUploadQueue.on('failed', (job, error) => {
      console.error(`File upload failed: ${job.data.path}`, error);
    });

    this.fileUploadQueue.on('error', (error) => {
      console.error('Queue error:', error);
    });

    // Process project imports
    this.projectImportQueue.process(async (job) => {
      const { importId, userId, repository, config, estimatedTokens } = job.data;

      try {
        console.log(`🚀 Starting import job ${importId} for user ${userId}`);

        // CRITICAL: Re-validate user and tokens at execution time (prevent race conditions)
        const user = await prisma.users.findUnique({
          where: { id: userId },
          select: { 
            tokensUsed: true, 
            tokensLimit: true, 
            githubAccessToken: true,
            role: true,
            plan: true
          }
        });

        if (!user) {
          throw new Error('User account not found or deleted');
        }

        // Security check: Ensure user is still in good standing
        if (user.role === 'banned' || user.role === 'suspended') {
          throw new Error('User account has been suspended');
        }

        // Re-validate token balance using TokenService (critical security check)
        const { tokenService } = await import('./tokenService');
        const balance = await tokenService.getTokenBalance(userId);
        if (balance.totalAvailable < estimatedTokens) {
          throw new Error(`Insufficient tokens at execution time: need ${estimatedTokens}, have ${balance.totalAvailable}`);
        }

        // Validate GitHub access is still available
        if (!user.githubAccessToken) {
          throw new Error('GitHub account no longer connected');
        }

        // Verify project still belongs to user (prevent ownership changes)
        const projectOwnership = await prisma.projects.findFirst({
          where: {
            id: importId,
            userId: userId
          },
          select: { id: true, userId: true }
        });

        if (!projectOwnership) {
          throw new Error('Project not found or access denied');
        }

        console.log(`🔒 Security validation passed for import ${importId} - proceeding with ${estimatedTokens} tokens`);

        // Update import status to processing
        await prisma.projects.updateMany({
          where: { 
            id: importId,
            userId: userId 
          },
          data: { 
            description: 'Import in progress...' 
          }
        });

        // Import the project
        const { ProjectImportService } = await import('./projectImportService');
        const importService = new ProjectImportService(user.githubAccessToken);
        
        const result = await importService.importProject(userId, repository, config);

        console.log(`✅ Import job ${importId} completed successfully`);
        return { success: true, result };

      } catch (error) {
        console.error(`❌ Import job ${importId} failed:`, error);
        
        // Update project status to failed
        await prisma.projects.updateMany({
          where: { 
            id: importId,
            userId: userId 
          },
          data: { 
            description: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }
        });

        throw error;
      }
    });

    // Import queue events
    this.projectImportQueue.on('completed', (job) => {
      console.log(`📦 Import completed: ${job.data.repository.name}`);
    });

    this.projectImportQueue.on('failed', (job, error) => {
      console.error(`📦 Import failed: ${job.data.repository.name}`, error);
    });

    this.projectImportQueue.on('error', (error) => {
      console.error('Import queue error:', error);
    });

    // Process email notifications
    this.emailQueue.process(async (job) => {
      const { notificationId, toEmail, toName, subject, htmlContent, textContent } = job.data;

      try {
        // Send email
        const mailOptions = {
          from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
          to: toName ? `${toName} <${toEmail}>` : toEmail,
          subject,
          html: htmlContent,
          text: textContent
        };

        await this.emailTransporter.sendMail(mailOptions);

        // Update notification status
        await prisma.email_notifications.update({
          where: { id: notificationId },
          data: {
            status: 'sent',
            sentAt: new Date()
          }
        });

        console.log(`📧 Email sent successfully: ${subject} to ${toEmail}`);
        return { success: true };

      } catch (error) {
        console.error(`Failed to send email ${notificationId}:`, error);

        // Update notification as failed
        await prisma.email_notifications.update({
          where: { id: notificationId },
          data: {
            status: 'failed',
            failedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        });

        throw error; // Rethrow to trigger bull's retry mechanism
      }
    });

    // Email queue events
    this.emailQueue.on('completed', (job) => {
      console.log(`📧 Email sent: ${job.data.subject} to ${job.data.toEmail}`);
    });

    this.emailQueue.on('failed', (job, error) => {
      console.error(`📧 Email failed: ${job.data.subject} to ${job.data.toEmail}`, error);
    });

    this.emailQueue.on('error', (error) => {
      console.error('Email queue error:', error);
    });
  }

  static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  // Add a file to the upload queue
  async queueFileUpload(data: FileUploadJob) {
    return this.fileUploadQueue.add(data);
  }

  // Add a project import to the queue
  async queueProjectImport(data: ProjectImportJob) {
    return this.projectImportQueue.add(data, {
      delay: 1000, // Small delay to allow UI to update
      priority: 1 // High priority for imports
    });
  }

  // Add an email to the queue
  async queueEmail(data: EmailJob) {
    return this.emailQueue.add(data, {
      priority: 2 // Higher priority than file uploads but lower than imports
    });
  }

  // Get queue status (updated to include email queue)
  async getQueueStatus() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.fileUploadQueue.getWaitingCount(),
      this.fileUploadQueue.getActiveCount(),
      this.fileUploadQueue.getCompletedCount(),
      this.fileUploadQueue.getFailedCount()
    ]);

    const [importWaiting, importActive, importCompleted, importFailed] = await Promise.all([
      this.projectImportQueue.getWaitingCount(),
      this.projectImportQueue.getActiveCount(),
      this.projectImportQueue.getCompletedCount(),
      this.projectImportQueue.getFailedCount()
    ]);

    const [emailWaiting, emailActive, emailCompleted, emailFailed] = await Promise.all([
      this.emailQueue.getWaitingCount(),
      this.emailQueue.getActiveCount(),
      this.emailQueue.getCompletedCount(),
      this.emailQueue.getFailedCount()
    ]);

    return {
      fileUploads: {
        waiting,
        active,
        completed,
        failed
      },
      projectImports: {
        waiting: importWaiting,
        active: importActive,
        completed: importCompleted,
        failed: importFailed
      },
      emails: {
        waiting: emailWaiting,
        active: emailActive,
        completed: emailCompleted,
        failed: emailFailed
      }
    };
  }

  // Get import job status
  async getImportJobStatus(jobId: string) {
    const job = await this.projectImportQueue.getJob(jobId);
    if (!job) return null;

    return {
      id: job.id,
      status: await job.getState(),
      progress: job.progress(),
      data: job.data,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn
    };
  }

  // Clean up (updated to include email queue)
  async cleanup() {
    await this.fileUploadQueue.close();
    await this.projectImportQueue.close();
    await this.emailQueue.close();
  }
}

// Handle cleanup
process.on('beforeExit', async () => {
  await QueueService.getInstance().cleanup();
});

// Export singleton instance
export const queueService = QueueService.getInstance(); 