import { Response } from 'express';
import { AuthRequest } from '../types/express';
import { prisma } from '../lib/prisma';
import { AIAgent } from '../services/aiAgent';
import { randomUUID } from 'crypto';
import * as path from 'path';

export class VisualEditorController {
  /**
   * Update element content using AI to modify source code
   */
  static async updateElement(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        projectId,
        filePath,
        selector,
        elementType,
        oldContent,
        newContent,
        action
      } = req.body;

      if (!projectId || !filePath || !newContent || !action) {
        res.status(400).json({
          error: 'Missing required fields: projectId, filePath, newContent, action'
        });
        return;
      }

      // Get the current file content
      const file = await prisma.projectFiles.findFirst({
        where: {
          projectId,
          path: filePath
        }
      });

      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // Use AI to intelligently update the source code
      const aiAgent = AIAgent.getInstance();
      const updatedContent = await aiAgent.updateElementInCode(
        req.user.id,
        projectId,
        filePath,
        file.content || '',
        {
          selector,
          elementType,
          oldContent,
          newContent,
          action
        }
      );

      if (!updatedContent.success) {
        res.status(500).json({
          error: 'Failed to update element',
          message: updatedContent.error
        });
        return;
      }

      // Update the file in database
      await prisma.projectFiles.update({
        where: { id: file.id },
        data: {
          content: updatedContent.code,
          updatedAt: new Date()
        }
      });

      res.json({
        success: true,
        updatedContent: updatedContent.code,
        explanation: updatedContent.explanation,
        tokensUsed: updatedContent.tokensUsed
      });

    } catch (error) {
      console.error('❌ Error in updateElement:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update element'
      });
    }
  }

  /**
   * Upload and replace images in the project
   */
  static async uploadImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId } = req.body;
      const file = req.file;

      if (!projectId || !file) {
        res.status(400).json({
          error: 'Missing required fields: projectId and image file'
        });
        return;
      }

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const fileName = `${randomUUID()}${fileExtension}`;
      const imagePath = `public/images/${fileName}`;

      // Save image to project files
      await prisma.projectFiles.create({
        data: {
          projectId,
          path: imagePath,
          content: file.buffer.toString('base64'),
          contentType: file.mimetype,
          size: file.size
        }
      });

      // Return the image URL for use in the component
      const imageUrl = `/images/${fileName}`;

      res.json({
        success: true,
        imageUrl,
        imagePath,
        fileName
      });

    } catch (error) {
      console.error('❌ Error in uploadImage:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to upload image'
      });
    }
  }

  /**
   * Analyze component structure for better editing capabilities
   */
  static async analyzeComponent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId, filePath } = req.body;

      if (!projectId || !filePath) {
        res.status(400).json({
          error: 'Missing required fields: projectId, filePath'
        });
        return;
      }

      // Get the file content
      const file = await prisma.projectFiles.findFirst({
        where: {
          projectId,
          path: filePath
        }
      });

      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // Use AI to analyze the component structure
      const aiAgent = AIAgent.getInstance();
      const analysis = await aiAgent.analyzeComponentStructure(
        req.user.id,
        projectId,
        filePath,
        file.content || ''
      );

      res.json({
        success: true,
        analysis: analysis.structure,
        editableElements: analysis.editableElements,
        suggestions: analysis.suggestions
      });

    } catch (error) {
      console.error('❌ Error in analyzeComponent:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to analyze component'
      });
    }
  }

  /**
   * Scan for editable elements in project files
   */
  static async scanElements(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { projectId } = req.body;

      if (!projectId) {
        res.status(400).json({
          error: 'Missing required field: projectId'
        });
        return;
      }

      // Get all React/HTML files from the project
      const files = await prisma.projectFiles.findMany({
        where: {
          projectId,
          OR: [
            { path: { endsWith: '.tsx' } },
            { path: { endsWith: '.jsx' } },
            { path: { endsWith: '.html' } }
          ]
        }
      });

      const editableElements = [];

      // Analyze each file for editable elements
      for (const file of files) {
        if (!file.content) continue;

        const elements = await VisualEditorController.extractEditableElements(file.content, file.path);
        editableElements.push(...elements);
      }

      res.json({
        success: true,
        elements: editableElements,
        totalFiles: files.length,
        totalElements: editableElements.length
      });

    } catch (error) {
      console.error('❌ Error in scanElements:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to scan elements'
      });
    }
  }

  /**
   * Extract editable elements from file content
   */
  private static async extractEditableElements(content: string, filePath: string) {
    const elements = [];
    
    try {
      // Helper function to check if text is likely user-facing content
      const isUserFacingText = (text: string): boolean => {
        const trimmed = text.trim();
        
        // Must be long enough and contain spaces
        if (trimmed.length < 6 || !trimmed.includes(' ')) return false;
        
        // Skip code patterns
        const codePatterns = [
          'setState', 'window.', 'location.', 'Element', '${', 'href', 
          'not found', 'hasError', 'error', 'undefined', 'reload', 
          'Page', 'className', 'import', 'from', '{', '$'
        ];
        
        if (codePatterns.some(pattern => trimmed.includes(pattern))) return false;
        
        // Skip React/JS patterns
        if (/this\./.test(trimmed) || /\$\{/.test(trimmed)) return false;
        
        // Skip CSS-like patterns
        if (/^[a-z-\s]+:[a-z-\s]+$/i.test(trimmed)) return false;
        if (/^[a-z-]+(\s[a-z-]+)*$/i.test(trimmed)) return false;
        
        // Must have either uppercase letters (proper nouns/sentences) or be long enough
        return (/[A-Z]/.test(trimmed) && trimmed.split(' ').length > 1) || 
               trimmed.split(' ').length > 3;
      };

      // Basic regex patterns for common editable elements
      const patterns = {
        // React/JSX text content - more specific to avoid code
        jsxText: /<(h[1-6]|p|span|div|button|a|li|td|th)[^>]*>([^<]+)<\/\1>/gi,
        // String literals that might be text content (excluding CSS classes)
        stringLiterals: /['"`]([^'"`\n]{8,100})['"`]/g,
        // Image sources
        imageSrc: /src=['"`]([^'"`]+\.(jpg|jpeg|png|gif|svg|webp))['"`]/gi,
        // CSS classes (Tailwind and custom)
        cssClasses: /className=['"`]([^'"`]+)['"`]/gi,
        // Inline styles
        inlineStyles: /style=\{?\{?['"]*([^}'"]+)['"]*\}?\}?/gi,
      };

      let match;

      // Extract CSS classes FIRST (before string literals to avoid conflicts)
      while ((match = patterns.cssClasses.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);
        const classes = match[1].trim();
        
        // Only include classes that contain styling properties
        if (this.containsEditableStyles(classes)) {
          elements.push({
            type: 'styling',
            content: classes,
            selector: 'className',
            filePath,
            line: lineNum,
            element: 'css-classes',
            styleCategories: this.categorizeStyles(classes)
          });
        }
      }

      // Extract JSX/HTML text elements
      while ((match = patterns.jsxText.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);
        const textContent = match[2].trim();
        
        if (isUserFacingText(textContent)) {
          elements.push({
            type: 'text',
            content: textContent,
            selector: match[1].toLowerCase(),
            filePath,
            line: lineNum,
            element: match[1]
          });
        }
      }

      // Extract image sources
      while ((match = patterns.imageSrc.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);
        elements.push({
          type: 'image',
          content: match[1],
          selector: 'img',
          filePath,
          line: lineNum,
          element: 'img'
        });
      }

      // Extract string literals that might be editable text (but exclude CSS classes)
      while ((match = patterns.stringLiterals.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);
        const text = match[1].trim();
        
        // Skip if this looks like CSS classes
        if (this.containsEditableStyles(text)) {
          continue;
        }
        
        if (isUserFacingText(text)) {
          elements.push({
            type: 'text',
            content: text,
            selector: 'string-literal',
            filePath,
            line: lineNum,
            element: 'text'
          });
        }
      }

      // Extract inline styles
      while ((match = patterns.inlineStyles.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);
        const styles = match[1].trim();
        
        elements.push({
          type: 'styling',
          content: styles,
          selector: 'style',
          filePath,
          line: lineNum,
          element: 'inline-styles'
        });
      }

    } catch (error) {
      console.error(`Error extracting elements from ${filePath}:`, error);
    }

    return elements;
  }

  /**
   * Apply bulk changes across multiple files
   */
  static async bulkUpdate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        projectId,
        changes // Array of { filePath, updates }
      } = req.body;

      if (!projectId || !changes || !Array.isArray(changes)) {
        res.status(400).json({
          error: 'Missing required fields: projectId, changes array'
        });
        return;
      }

      const results = [];

      // Process each file change
      for (const change of changes) {
        try {
          const file = await prisma.projectFiles.findFirst({
            where: {
              projectId,
              path: change.filePath
            }
          });

          if (!file) {
            results.push({
              filePath: change.filePath,
              success: false,
              error: 'File not found'
            });
            continue;
          }

          // Use AI to apply bulk changes
          const aiAgent = AIAgent.getInstance();
          const updatedContent = await aiAgent.applyBulkChanges(
            req.user.id,
            projectId,
            change.filePath,
            file.content || '',
            change.updates
          );

          if (updatedContent.success) {
            // Update the file
            await prisma.projectFiles.update({
              where: { id: file.id },
              data: {
                content: updatedContent.code,
                updatedAt: new Date()
              }
            });

            results.push({
              filePath: change.filePath,
              success: true,
              tokensUsed: updatedContent.tokensUsed
            });
          } else {
            results.push({
              filePath: change.filePath,
              success: false,
              error: updatedContent.error
            });
          }

        } catch (error) {
          results.push({
            filePath: change.filePath,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const successCount = results.filter(r => r.success).length;

      res.json({
        success: true,
        results,
        summary: {
          total: changes.length,
          successful: successCount,
          failed: changes.length - successCount
        }
      });

    } catch (error) {
      console.error('❌ Error in bulkUpdate:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to apply bulk updates'
      });
    }
  }

  /**
   * Update file directly without AI processing
   */
  static async updateFileDirect(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        projectId,
        filePath,
        lineNumber,
        oldContent,
        newContent,
        elementType
      } = req.body;

      if (!projectId || !filePath || !newContent) {
        res.status(400).json({
          error: 'Missing required fields: projectId, filePath, newContent'
        });
        return;
      }

      // Find the file
      const file = await prisma.projectFiles.findFirst({
        where: {
          projectId,
          path: filePath
        }
      });

      if (!file) {
        res.status(404).json({
          error: 'File not found'
        });
        return;
      }

      let updatedContent = file.content || '';

      // Simple string replacement for text content
      if (elementType === 'text' && oldContent) {
        // Replace the old content with new content
        updatedContent = updatedContent.replace(oldContent, newContent);
      } else if (elementType === 'image' && oldContent) {
        // Replace image src
        updatedContent = updatedContent.replace(oldContent, newContent);
      } else {
        // If no old content specified, try to find and replace at line number
        if (lineNumber) {
          const lines = updatedContent.split('\n');
          if (lines[lineNumber - 1]) {
            // Simple replacement - find the line and replace content
            const line = lines[lineNumber - 1];
            if (elementType === 'text') {
              // Replace text content within HTML tags
              lines[lineNumber - 1] = line.replace(/>([^<]+)</, `>${newContent}<`);
            } else {
              // For other types, replace the whole line
              lines[lineNumber - 1] = newContent;
            }
            updatedContent = lines.join('\n');
          }
        }
      }

      // Update the file in database
      await prisma.projectFiles.update({
        where: { id: file.id },
        data: {
          content: updatedContent,
          updatedAt: new Date()
        }
      });

      res.json({
        success: true,
        message: 'File updated successfully',
        updatedContent
      });

    } catch (error) {
      console.error('❌ Error in updateFileDirect:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update file'
      });
    }
  }

  /**
   * Get line number for a given character index
   */
  private static getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private static containsEditableStyles(classes: string): boolean {
    const editablePatterns = [
      // Colors
      /\b(bg-|text-|border-|ring-)/,
      // Sizing
      /\b(w-|h-|max-w-|max-h-|min-w-|min-h-)/,
      // Spacing
      /\b(p-|px-|py-|pt-|pb-|pl-|pr-|m-|mx-|my-|mt-|mb-|ml-|mr-|gap-|space-)/,
      // Typography
      /\b(text-|font-|leading-|tracking-|antialiased)/,
      // Layout
      /\b(flex|grid|block|inline|hidden|visible)/,
      // Borders & Radius
      /\b(rounded|border)/,
      // Shadows & Effects
      /\b(shadow|opacity|blur)/
    ];
    
    return editablePatterns.some(pattern => pattern.test(classes));
  }

  private static categorizeStyles(classes: string): string[] {
    const categories = [];
    
    if (/\b(bg-|text-|border-|ring-)/.test(classes)) categories.push('colors');
    if (/\b(w-|h-|max-w-|max-h-|min-w-|min-h-)/.test(classes)) categories.push('sizing');
    if (/\b(p-|px-|py-|pt-|pb-|pl-|pr-|m-|mx-|my-|mt-|mb-|ml-|mr-|gap-|space-)/.test(classes)) categories.push('spacing');
    if (/\b(text-|font-|leading-|tracking-|antialiased)/.test(classes)) categories.push('typography');
    if (/\b(flex|grid|block|inline|hidden|visible)/.test(classes)) categories.push('layout');
    if (/\b(rounded|border)/.test(classes)) categories.push('borders');
    if (/\b(shadow|opacity|blur)/.test(classes)) categories.push('effects');
    
    return categories;
  }
} 