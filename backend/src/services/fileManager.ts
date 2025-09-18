import { prisma } from '../lib/prisma';
import { storage } from './storage';

export class FileManager {
  private static instance: FileManager;
  private uploadInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  private constructor() {
    // Start processing queue every minute
    this.uploadInterval = setInterval(() => {
      this.processUploadQueue();
    }, 60 * 1000); // 1 minute
  }

  static getInstance(): FileManager {
    if (!FileManager.instance) {
      FileManager.instance = new FileManager();
    }
    return FileManager.instance;
  }

  // Create files in database first
  async createFiles(projectId: string, files: { path: string; content: string; contentType: string }[]) {
    // Batch create files in database
    await prisma.projectFiles.createMany({
      data: files.map(file => ({
        projectId,
        path: file.path,
        content: file.content,
        contentType: file.contentType,
        size: Buffer.from(file.content).length,
        status: 'PENDING_UPLOAD'
      }))
    });

    // Trigger upload queue processing
    this.processUploadQueue();
  }

  // Process pending uploads
  private async processUploadQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingFiles = await prisma.projectFiles.findMany({
        where: { status: 'PENDING_UPLOAD' },
        take: 10 // Process 10 at a time
      });

      for (const file of pendingFiles) {
        try {
          if (!file.content) {
            throw new Error('No content found for pending file');
          }

          // Upload to R2
          const r2Key = await storage.saveFile(
            file.projectId,
            file.path,
            file.content,
            file.contentType
          );

          // Update database record
          await prisma.projectFiles.update({
            where: { id: file.id },
            data: {
              r2Key,
              status: 'UPLOADED',
              content: null // Clear temporary content
            }
          });
        } catch (error) {
          console.error(`Failed to upload file ${file.path}:`, error);
          
          // Mark as failed
          await prisma.projectFiles.update({
            where: { id: file.id },
            data: {
              status: 'FAILED',
              updatedAt: new Date()
            }
          });
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Force process specific files
  async forceUpload(fileIds: string[]) {
    const files = await prisma.projectFiles.findMany({
      where: {
        id: { in: fileIds },
        status: 'PENDING_UPLOAD'
      }
    });

    for (const file of files) {
      try {
        if (!file.content) {
          throw new Error('No content found for pending file');
        }

        const r2Key = await storage.saveFile(
          file.projectId,
          file.path,
          file.content,
          file.contentType
        );

        await prisma.projectFiles.update({
          where: { id: file.id },
          data: {
            r2Key,
            status: 'UPLOADED',
            content: null
          }
        });
      } catch (error) {
        console.error(`Failed to force upload file ${file.path}:`, error);
        throw error;
      }
    }
  }

  // Clean up
  cleanup() {
    if (this.uploadInterval) {
      clearInterval(this.uploadInterval);
    }
  }
}

// Handle cleanup
process.on('beforeExit', () => {
  FileManager.getInstance().cleanup();
});

// Export singleton instance
export const fileManager = FileManager.getInstance(); 