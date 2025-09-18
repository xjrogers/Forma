import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';

export interface ImageProcessingOptions {
  // Resizing options
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  
  // Quality and optimization
  quality?: number; // 1-100
  progressive?: boolean;
  
  // Format conversion
  format?: 'jpeg' | 'png' | 'webp' | 'avif' | 'gif';
  
  // Thumbnails
  generateThumbnail?: boolean;
  thumbnailSize?: number; // Default 150px
  
  // Optimization
  optimize?: boolean;
  stripMetadata?: boolean;
}

export interface ProcessedImage {
  original: {
    buffer: Buffer;
    format: string;
    width: number;
    height: number;
    size: number;
  };
  processed?: {
    buffer: Buffer;
    format: string;
    width: number;
    height: number;
    size: number;
  };
  thumbnail?: {
    buffer: Buffer;
    format: string;
    width: number;
    height: number;
    size: number;
  };
}

export class ImageProcessor {
  private static instance: ImageProcessor;

  static getInstance(): ImageProcessor {
    if (!ImageProcessor.instance) {
      ImageProcessor.instance = new ImageProcessor();
    }
    return ImageProcessor.instance;
  }

  /**
   * Process image with various options
   */
  async processImage(
    inputBuffer: Buffer, 
    options: ImageProcessingOptions = {}
  ): Promise<ProcessedImage> {
    try {
      // Get original image info
      const originalImage = sharp(inputBuffer);
      const originalMetadata = await originalImage.metadata();
      
      const result: ProcessedImage = {
        original: {
          buffer: inputBuffer,
          format: originalMetadata.format || 'jpeg',
          width: originalMetadata.width || 0,
          height: originalMetadata.height || 0,
          size: inputBuffer.length
        }
      };

      // Process main image if any processing options are specified
      if (this.shouldProcessImage(options)) {
        const processedBuffer = await this.applyImageProcessing(originalImage, options);
        const processedMetadata = await sharp(processedBuffer).metadata();
        
        result.processed = {
          buffer: processedBuffer,
          format: options.format || originalMetadata.format || 'jpeg',
          width: processedMetadata.width || 0,
          height: processedMetadata.height || 0,
          size: processedBuffer.length
        };
      }

      // Generate thumbnail if requested
      if (options.generateThumbnail) {
        const thumbnailSize = options.thumbnailSize || 150;
        const thumbnailBuffer = await originalImage
          .clone()
          .resize(thumbnailSize, thumbnailSize, { 
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 80 })
          .toBuffer();
          
        const thumbnailMetadata = await sharp(thumbnailBuffer).metadata();
        
        result.thumbnail = {
          buffer: thumbnailBuffer,
          format: 'jpeg',
          width: thumbnailMetadata.width || thumbnailSize,
          height: thumbnailMetadata.height || thumbnailSize,
          size: thumbnailBuffer.length
        };
      }

      return result;
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply image processing transformations
   */
  private async applyImageProcessing(
    image: sharp.Sharp, 
    options: ImageProcessingOptions
  ): Promise<Buffer> {
    let pipeline = image.clone();

    // Resize if dimensions specified
    if (options.width || options.height) {
      pipeline = pipeline.resize(options.width, options.height, {
        fit: options.fit || 'cover',
        withoutEnlargement: true
      });
    }

    // Strip metadata if requested
    if (options.stripMetadata) {
      pipeline = pipeline.withMetadata({});
    }

    // Apply format-specific optimizations
    const format = options.format || 'jpeg';
    switch (format) {
      case 'jpeg':
        pipeline = pipeline.jpeg({
          quality: options.quality || 85,
          progressive: options.progressive !== false,
          mozjpeg: options.optimize !== false
        });
        break;
        
      case 'png':
        pipeline = pipeline.png({
          quality: options.quality || 90,
          progressive: options.progressive !== false,
          compressionLevel: options.optimize !== false ? 9 : 6
        });
        break;
        
      case 'webp':
        pipeline = pipeline.webp({
          quality: options.quality || 85,
          effort: options.optimize !== false ? 6 : 4
        });
        break;
        
      case 'avif':
        pipeline = pipeline.avif({
          quality: options.quality || 80,
          effort: options.optimize !== false ? 9 : 4
        });
        break;
        
      case 'gif':
        // GIF processing is limited in Sharp
        pipeline = pipeline.gif();
        break;
    }

    return await pipeline.toBuffer();
  }

  /**
   * Check if image processing is needed
   */
  private shouldProcessImage(options: ImageProcessingOptions): boolean {
    return !!(
      options.width || 
      options.height || 
      options.format || 
      options.quality || 
      options.optimize || 
      options.stripMetadata
    );
  }

  /**
   * Save processed image to project with multiple variants
   */
  async saveProcessedImageToProject(
    projectId: string,
    basePath: string,
    processedImage: ProcessedImage,
    altText?: string
  ): Promise<{
    originalUrl: string;
    processedUrl?: string;
    thumbnailUrl?: string;
    paths: {
      original: string;
      processed?: string;
      thumbnail?: string;
    };
  }> {
    const baseFileName = basePath.split('/').pop()?.split('.')[0] || randomUUID();
    const paths: any = {};
    const urls: any = {};

    try {
      // Save original
      const originalFileName = `${baseFileName}-original.${processedImage.original.format}`;
      const originalPath = `public/images/${originalFileName}`;
      
              await prisma.projectFiles.create({
          data: {
            projectId,
            path: originalPath,
            content: processedImage.original.buffer.toString('base64'),
            contentType: `image/${processedImage.original.format}`,
            size: processedImage.original.size,
            metadata: altText ? JSON.stringify({ altText }) : undefined
          }
        });
      
      paths.original = originalPath;
      urls.originalUrl = `/images/${originalFileName}`;

      // Save processed version if exists
      if (processedImage.processed) {
        const processedFileName = `${baseFileName}.${processedImage.processed.format}`;
        const processedPath = `public/images/${processedFileName}`;
        
        await prisma.projectFiles.create({
          data: {
            projectId,
            path: processedPath,
            content: processedImage.processed.buffer.toString('base64'),
            contentType: `image/${processedImage.processed.format}`,
            size: processedImage.processed.size
          }
        });
        
        paths.processed = processedPath;
        urls.processedUrl = `/images/${processedFileName}`;
      }

      // Save thumbnail if exists
      if (processedImage.thumbnail) {
        const thumbnailFileName = `${baseFileName}-thumb.${processedImage.thumbnail.format}`;
        const thumbnailPath = `public/images/${thumbnailFileName}`;
        
        await prisma.projectFiles.create({
          data: {
            projectId,
            path: thumbnailPath,
            content: processedImage.thumbnail.buffer.toString('base64'),
            contentType: `image/${processedImage.thumbnail.format}`,
            size: processedImage.thumbnail.size
          }
        });
        
        paths.thumbnail = thumbnailPath;
        urls.thumbnailUrl = `/images/${thumbnailFileName}`;
      }

      return { ...urls, paths };
    } catch (error) {
      console.error('Error saving processed image:', error);
      throw error;
    }
  }

  /**
   * Get optimal image format based on content and browser support
   */
  getOptimalFormat(originalFormat: string, hasTransparency: boolean = false): string {
    // Modern format priority: AVIF > WebP > Original
    if (hasTransparency && originalFormat === 'png') {
      return 'webp'; // WebP supports transparency better than AVIF in most cases
    }
    
    if (originalFormat === 'gif') {
      return 'gif'; // Keep GIFs as GIFs for animation
    }
    
    return 'webp'; // Default to WebP for best compression/quality ratio
  }

  /**
   * Generate responsive image variants
   */
  async generateResponsiveImages(
    inputBuffer: Buffer,
    breakpoints: number[] = [320, 640, 768, 1024, 1280, 1920]
  ): Promise<{ [key: string]: Buffer }> {
    const variants: { [key: string]: Buffer } = {};
    
    for (const width of breakpoints) {
      const processed = await this.processImage(inputBuffer, {
        width,
        format: 'webp',
        quality: 85,
        optimize: true
      });
      
      if (processed.processed) {
        variants[`${width}w`] = processed.processed.buffer;
      }
    }
    
    return variants;
  }

  /**
   * Analyze image and suggest optimizations
   */
  async analyzeImage(inputBuffer: Buffer): Promise<{
    metadata: sharp.Metadata;
    suggestions: string[];
    estimatedSavings?: number;
  }> {
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();
    const suggestions: string[] = [];
    let estimatedSavings = 0;

    // Size suggestions
    if (metadata.width && metadata.width > 1920) {
      suggestions.push(`Consider resizing from ${metadata.width}px to 1920px max width`);
      estimatedSavings += 30; // Estimate 30% savings
    }

    // Format suggestions
    if (metadata.format === 'png' && !metadata.hasAlpha) {
      suggestions.push('Convert PNG to JPEG or WebP for better compression (no transparency detected)');
      estimatedSavings += 40;
    }

    if (metadata.format === 'jpeg' || metadata.format === 'png') {
      suggestions.push('Convert to WebP for ~25-35% better compression');
      estimatedSavings += 30;
    }

    // Quality suggestions
    if (metadata.density && metadata.density > 150) {
      suggestions.push('High DPI detected - consider generating multiple resolutions');
    }

    return {
      metadata,
      suggestions,
      estimatedSavings: Math.min(estimatedSavings, 70) // Cap at 70%
    };
  }
}

// Export singleton instance
export const imageProcessor = ImageProcessor.getInstance(); 