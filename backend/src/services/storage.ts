import { 
  S3Client, 
  GetObjectCommand, 
  DeleteObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

export class StorageService {
  private static instance: StorageService;
  private client: S3Client;
  private bucket: string;
  
  private constructor() {
    if (!process.env.R2_ACCOUNT_ID) throw new Error('R2_ACCOUNT_ID not set');
    if (!process.env.R2_ACCESS_KEY_ID) throw new Error('R2_ACCESS_KEY_ID not set');
    if (!process.env.R2_SECRET_ACCESS_KEY) throw new Error('R2_SECRET_ACCESS_KEY not set');
    if (!process.env.R2_BUCKET_NAME) throw new Error('R2_BUCKET_NAME not set');

    this.bucket = process.env.R2_BUCKET_NAME;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
      }
    });
  }

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Save a file to R2 storage
   * @param projectId - The project ID
   * @param path - File path within the project
   * @param content - File content as Buffer or string
   * @param contentType - MIME type of the file
   * @returns The R2 storage key
   */
  async saveFile(
    projectId: string, 
    path: string, 
    content: Buffer | string,
    contentType: string = 'text/plain'
  ): Promise<string> {
    const key = `${projectId}/${path}`;
    
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: contentType
      }
    });

    await upload.done();
    return key;
  }

  /**
   * Get a file from R2 storage
   * @param key - The R2 storage key
   * @returns File content as a Buffer
   */
  async getFile(key: string): Promise<Buffer> {
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    }));
    
    if (!response.Body) {
      throw new Error('File not found');
    }

    // Convert stream to buffer
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Delete a file from R2 storage
   * @param key - The R2 storage key
   */
  async deleteFile(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    }));
  }

  /**
   * Check if a file exists and get its metadata
   * @param key - The R2 storage key
   * @returns Object with file metadata or null if not found
   */
  async getFileMetadata(key: string): Promise<{
    size: number;
    contentType: string;
    lastModified: Date;
  } | null> {
    try {
      const response = await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      }));

      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date()
      };
    } catch (error) {
      if ((error as any).name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Generate a temporary URL for a file
   * @param key - The R2 storage key
   * @param _expiresIn - Number of seconds until the URL expires (not used yet as R2 doesn't support presigned URLs)
   * @returns Temporary URL for direct access
   */
  getTemporaryUrl(key: string, _expiresIn: number = 3600): string {
    // Note: R2 doesn't support presigned URLs yet
    // For now, we'll return a route that proxies through our API
    return `/api/files/${encodeURIComponent(key)}`;
  }
}

// Export a singleton instance
export const storage = StorageService.getInstance(); 