import { prisma } from '../lib/prisma';
import * as babel from '@babel/parser';
import traverse from '@babel/traverse';

interface CodeSymbol {
  name: string;
  type: 'function' | 'class' | 'component' | 'variable' | 'interface' | 'type';
  filePath: string;
  startLine: number;
  endLine: number;
  signature?: string;
  documentation?: string;
  dependencies: string[];
  exports: string[];
}

interface FileAnalysis {
  filePath: string;
  language: 'typescript' | 'javascript' | 'tsx' | 'jsx' | 'json' | 'css' | 'html' | 'markdown';
  imports: Array<{ module: string; imports: string[]; from: string }>;
  exports: Array<{ name: string; type: string }>;
  symbols: CodeSymbol[];
  documentation: string;
  complexity: number;
}

interface ProjectIndex {
  projectId: string;
  files: Map<string, FileAnalysis>;
  dependencyGraph: Map<string, string[]>;
  symbolIndex: Map<string, CodeSymbol[]>;
  lastUpdated: Date;
}

export class CodebaseAnalyzer {
  private static instance: CodebaseAnalyzer;
  private projectIndexes: Map<string, ProjectIndex> = new Map();

  static getInstance(): CodebaseAnalyzer {
    if (!CodebaseAnalyzer.instance) {
      CodebaseAnalyzer.instance = new CodebaseAnalyzer();
    }
    return CodebaseAnalyzer.instance;
  }

  /**
   * Analyze and index entire project (like Cursor)
   */
  async analyzeProject(projectId: string): Promise<ProjectIndex> {
    console.log(`🔍 Analyzing codebase for project: ${projectId}`);
    
    // Get all project files
    const project = await prisma.projects.findUnique({
      where: { id: projectId },
      include: {
        files: {
          where: { content: { not: null } },
          select: { path: true, content: true, contentType: true }
        }
      }
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const projectIndex: ProjectIndex = {
      projectId,
      files: new Map(),
      dependencyGraph: new Map(),
      symbolIndex: new Map(),
      lastUpdated: new Date()
    };

    // Analyze each file
    for (const file of project.files) {
      if (!file.content) continue;
      
      try {
        const analysis = await this.analyzeFile(file.path, file.content);
        projectIndex.files.set(file.path, analysis);
        
        // Build symbol index
        for (const symbol of analysis.symbols) {
          const existing = projectIndex.symbolIndex.get(symbol.name) || [];
          existing.push(symbol);
          projectIndex.symbolIndex.set(symbol.name, existing);
        }
        
        // Build dependency graph
        const deps = analysis.imports.map(imp => imp.from);
        projectIndex.dependencyGraph.set(file.path, deps);
        
      } catch (error) {
        console.error(`Failed to analyze ${file.path}:`, error);
      }
    }

    // Cache the index
    this.projectIndexes.set(projectId, projectIndex);
    
    console.log(`✅ Indexed ${projectIndex.files.size} files, ${projectIndex.symbolIndex.size} symbols`);
    return projectIndex;
  }

  /**
   * Analyze individual file (TypeScript/JavaScript/React)
   */
  private async analyzeFile(filePath: string, content: string): Promise<FileAnalysis> {
    const language = this.detectLanguage(filePath);
    
    const analysis: FileAnalysis = {
      filePath,
      language,
      imports: [],
      exports: [],
      symbols: [],
      documentation: this.extractDocumentation(content, language),
      complexity: 0
    };

    if (language === 'typescript' || language === 'javascript' || language === 'tsx' || language === 'jsx') {
      return this.analyzeJSFile(analysis, content);
    } else if (language === 'json') {
      return this.analyzeJSONFile(analysis, content);
    } else if (language === 'markdown') {
      return this.analyzeMarkdownFile(analysis, content);
    }

    return analysis;
  }

  /**
   * Analyze JavaScript/TypeScript files
   */
  private analyzeJSFile(analysis: FileAnalysis, content: string): FileAnalysis {
    try {
      // Parse with Babel for better JSX/TSX support
      const ast = babel.parse(content, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'functionBind'
        ]
      });

      // Traverse AST to extract information
      traverse(ast as any, {
        ImportDeclaration: (path: any) => {
          const importNode = path.node;
          const imports = importNode.specifiers.map((spec: any) => {
            if (spec.type === 'ImportDefaultSpecifier') {
              return spec.local.name;
            } else if (spec.type === 'ImportSpecifier') {
              return spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value;
            } else if (spec.type === 'ImportNamespaceSpecifier') {
              return `* as ${spec.local.name}`;
            }
            return '';
          }).filter(Boolean);

          analysis.imports.push({
            module: importNode.source.value,
            imports,
            from: importNode.source.value
          });
        },

        ExportNamedDeclaration: (path: any) => {
          const exportNode = path.node;
          if (exportNode.declaration) {
            if (exportNode.declaration.type === 'FunctionDeclaration') {
              analysis.exports.push({
                name: exportNode.declaration.id?.name || 'anonymous',
                type: 'function'
              });
            } else if (exportNode.declaration.type === 'VariableDeclaration') {
              exportNode.declaration.declarations.forEach((decl: any) => {
                if (decl.id.type === 'Identifier') {
                  analysis.exports.push({
                    name: decl.id.name,
                    type: 'variable'
                  });
                }
              });
            }
          }
        },

        FunctionDeclaration: (path: any) => {
          const func = path.node;
          if (func.id) {
            analysis.symbols.push({
              name: func.id.name,
              type: 'function',
              filePath: analysis.filePath,
              startLine: func.loc?.start.line || 0,
              endLine: func.loc?.end.line || 0,
              signature: this.extractFunctionSignature(func),
              documentation: this.extractLeadingComments(path),
              dependencies: [],
              exports: []
            });
          }
        },

        ClassDeclaration: (path: any) => {
          const cls = path.node;
          if (cls.id) {
            analysis.symbols.push({
              name: cls.id.name,
              type: 'class',
              filePath: analysis.filePath,
              startLine: cls.loc?.start.line || 0,
              endLine: cls.loc?.end.line || 0,
              documentation: this.extractLeadingComments(path),
              dependencies: [],
              exports: []
            });
          }
        },

        // React components (function components)
        VariableDeclarator: (path: any) => {
          const node = path.node;
          if (node.id.type === 'Identifier' && 
              (node.init?.type === 'ArrowFunctionExpression' || 
               node.init?.type === 'FunctionExpression')) {
            
            // Check if it looks like a React component (starts with capital letter)
            if (/^[A-Z]/.test(node.id.name)) {
              analysis.symbols.push({
                name: node.id.name,
                type: 'component',
                filePath: analysis.filePath,
                startLine: node.loc?.start.line || 0,
                endLine: node.loc?.end.line || 0,
                documentation: this.extractLeadingComments(path),
                dependencies: [],
                exports: []
              });
            }
          }
        }
      });

    } catch (error) {
      console.error(`Failed to parse ${analysis.filePath}:`, error);
    }

    return analysis;
  }

  /**
   * Analyze JSON files (package.json, tsconfig.json, etc.)
   */
  private analyzeJSONFile(analysis: FileAnalysis, content: string): FileAnalysis {
    try {
      const json = JSON.parse(content);
      
      if (analysis.filePath === 'package.json') {
        // Extract project metadata
        analysis.documentation = `Package: ${json.name || 'Unknown'}\nDescription: ${json.description || 'No description'}\nVersion: ${json.version || '0.0.0'}`;
        
        // Dependencies as symbols
        if (json.dependencies) {
          Object.keys(json.dependencies).forEach(dep => {
            analysis.symbols.push({
              name: dep,
              type: 'variable',
              filePath: analysis.filePath,
              startLine: 0,
              endLine: 0,
              documentation: `Dependency: ${dep}@${json.dependencies[dep]}`,
              dependencies: [],
              exports: []
            });
          });
        }
      }
    } catch (error) {
      console.error(`Failed to parse JSON ${analysis.filePath}:`, error);
    }

    return analysis;
  }

  /**
   * Analyze Markdown files (README, docs)
   */
  private analyzeMarkdownFile(analysis: FileAnalysis, content: string): FileAnalysis {
    // Extract headings as symbols
    const headings = content.match(/^#+\s+(.+)$/gm) || [];
    headings.forEach((heading, index) => {
      const level = heading.match(/^#+/)?.[0].length || 1;
      const title = heading.replace(/^#+\s+/, '');
      
      analysis.symbols.push({
        name: title,
        type: 'variable', // Use variable for headings
        filePath: analysis.filePath,
        startLine: index + 1,
        endLine: index + 1,
        documentation: `Heading level ${level}: ${title}`,
        dependencies: [],
        exports: []
      });
    });

    analysis.documentation = content.slice(0, 500); // First 500 chars as summary
    return analysis;
  }

  /**
   * Semantic search across codebase
   */
  async searchCodebase(projectId: string, query: string, limit: number = 10): Promise<CodeSymbol[]> {
    const index = this.projectIndexes.get(projectId);
    if (!index) {
      // Analyze project if not indexed
      await this.analyzeProject(projectId);
      return this.searchCodebase(projectId, query, limit);
    }

    const results: Array<{ symbol: CodeSymbol; score: number }> = [];
    const queryLower = query.toLowerCase();

    // Search through all symbols
    for (const [, symbols] of Array.from(index.symbolIndex.entries())) {
      for (const symbol of symbols) {
        let score = 0;
        
        // Exact name match (highest score)
        if (symbol.name.toLowerCase() === queryLower) {
          score += 100;
        }
        // Name contains query
        else if (symbol.name.toLowerCase().includes(queryLower)) {
          score += 50;
        }
        // Documentation contains query
        else if (symbol.documentation?.toLowerCase().includes(queryLower)) {
          score += 25;
        }
        // File path contains query
        else if (symbol.filePath.toLowerCase().includes(queryLower)) {
          score += 10;
        }

        if (score > 0) {
          results.push({ symbol, score });
        }
      }
    }

    // Sort by score and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => r.symbol);
  }

  /**
   * Get file dependencies and relationships
   */
  getFileDependencies(projectId: string, filePath: string): string[] {
    const index = this.projectIndexes.get(projectId);
    return index?.dependencyGraph.get(filePath) || [];
  }

  /**
   * Get symbols in a specific file
   */
  getFileSymbols(projectId: string, filePath: string): CodeSymbol[] {
    const index = this.projectIndexes.get(projectId);
    const fileAnalysis = index?.files.get(filePath);
    return fileAnalysis?.symbols || [];
  }

  // Helper methods
  private detectLanguage(filePath: string): FileAnalysis['language'] {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': return 'typescript';
      case 'tsx': return 'tsx';
      case 'js': return 'javascript';
      case 'jsx': return 'jsx';
      case 'json': return 'json';
      case 'css': case 'scss': case 'sass': return 'css';
      case 'html': return 'html';
      case 'md': case 'markdown': return 'markdown';
      default: return 'javascript';
    }
  }

  private extractDocumentation(content: string, language: FileAnalysis['language']): string {
    if (language === 'markdown') {
      return content.slice(0, 500);
    }
    
    // Extract leading comments
    const commentMatch = content.match(/^\/\*\*([\s\S]*?)\*\//);
    if (commentMatch) {
      return commentMatch[1].replace(/^\s*\*\s?/gm, '').trim();
    }
    
    return '';
  }

  private extractFunctionSignature(func: any): string {
    // Simple signature extraction - could be enhanced
    const params = func.params?.map((p: any) => p.name || 'param').join(', ') || '';
    return `${func.id?.name || 'anonymous'}(${params})`;
  }

  private extractLeadingComments(path: any): string {
    const comments = path.node.leadingComments || [];
    return comments.map((c: any) => c.value.trim()).join('\n');
  }
} 