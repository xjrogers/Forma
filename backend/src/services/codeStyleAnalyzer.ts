interface StyleProfile {
  indentation: {
    type: 'spaces' | 'tabs';
    size: number;
    confidence: number;
  };
  quotes: {
    preference: 'single' | 'double' | 'mixed';
    confidence: number;
  };
  semicolons: {
    usage: 'always' | 'never' | 'mixed';
    confidence: number;
  };
  imports: {
    organization: 'grouped' | 'mixed';
    groupOrder: string[];
    spacing: boolean;
    confidence: number;
  };
  naming: {
    variables: 'camelCase' | 'snake_case' | 'mixed';
    functions: 'camelCase' | 'snake_case' | 'mixed';
    components: 'PascalCase' | 'mixed';
    constants: 'UPPER_CASE' | 'camelCase' | 'mixed';
    confidence: number;
  };
  formatting: {
    lineLength: number;
    trailingCommas: 'always' | 'never' | 'es5' | 'mixed';
    bracketSpacing: boolean;
    arrowParens: 'always' | 'avoid' | 'mixed';
    confidence: number;
  };
  frameworks: {
    react: {
      componentStyle: 'arrow' | 'function' | 'mixed';
      hooksPattern: string[];
      propsDestructuring: boolean;
    };
    typescript: {
      interfaceStyle: 'interface' | 'type' | 'mixed';
      exportStyle: 'named' | 'default' | 'mixed';
    };
  };
}

interface ProjectContext {
  id: string;
  name: string;
  description: string;
  files: Array<{
    path: string;
    content: string;
    contentType: string;
    size: number;
  }>;
  dependencies: Record<string, string>;
  framework: string;
  language: string;
}

export class CodeStyleAnalyzer {
  private static instance: CodeStyleAnalyzer;

  public static getInstance(): CodeStyleAnalyzer {
    if (!CodeStyleAnalyzer.instance) {
      CodeStyleAnalyzer.instance = new CodeStyleAnalyzer();
    }
    return CodeStyleAnalyzer.instance;
  }

  /**
   * Analyze project code style and generate a comprehensive style profile
   */
  public analyzeProjectStyle(projectContext: ProjectContext): StyleProfile {
    console.log('🎨 Analyzing project code style patterns...');
    
    const codeFiles = this.getCodeFiles(projectContext.files);
    
    if (codeFiles.length === 0) {
      return this.getDefaultStyleProfile();
    }

    const styleProfile: StyleProfile = {
      indentation: this.analyzeIndentation(codeFiles),
      quotes: this.analyzeQuoteStyle(codeFiles),
      semicolons: this.analyzeSemicolonUsage(codeFiles),
      imports: this.analyzeImportPatterns(codeFiles),
      naming: this.analyzeNamingConventions(codeFiles),
      formatting: this.analyzeFormattingPatterns(codeFiles),
      frameworks: this.analyzeFrameworkPatterns(codeFiles)
    };

    console.log('🎨 Style analysis complete:', {
      indentation: `${styleProfile.indentation.size} ${styleProfile.indentation.type}`,
      quotes: styleProfile.quotes.preference,
      semicolons: styleProfile.semicolons.usage,
      confidence: this.calculateOverallConfidence(styleProfile)
    });

    return styleProfile;
  }

  /**
   * Generate style-aware instructions for the AI agent
   */
  public generateStyleInstructions(styleProfile: StyleProfile): string {
    const instructions = [];

    // Indentation
    if (styleProfile.indentation.confidence > 0.7) {
      instructions.push(`Use ${styleProfile.indentation.size} ${styleProfile.indentation.type} for indentation`);
    }

    // Quotes
    if (styleProfile.quotes.confidence > 0.7) {
      instructions.push(`Use ${styleProfile.quotes.preference} quotes for strings`);
    }

    // Semicolons
    if (styleProfile.semicolons.confidence > 0.7) {
      const semicolonRule = styleProfile.semicolons.usage === 'always' 
        ? 'Always use semicolons' 
        : 'Omit semicolons where possible';
      instructions.push(semicolonRule);
    }

    // Imports
    if (styleProfile.imports.confidence > 0.7) {
      if (styleProfile.imports.organization === 'grouped') {
        instructions.push(`Organize imports in groups: ${styleProfile.imports.groupOrder.join(' → ')}`);
        if (styleProfile.imports.spacing) {
          instructions.push('Add blank lines between import groups');
        }
      }
    }

    // Naming conventions
    if (styleProfile.naming.confidence > 0.7) {
      instructions.push(`Use ${styleProfile.naming.variables} for variables`);
      instructions.push(`Use ${styleProfile.naming.functions} for functions`);
      instructions.push(`Use ${styleProfile.naming.components} for React components`);
      instructions.push(`Use ${styleProfile.naming.constants} for constants`);
    }

    // Formatting
    if (styleProfile.formatting.confidence > 0.7) {
      instructions.push(`Keep lines under ${styleProfile.formatting.lineLength} characters`);
      if (styleProfile.formatting.trailingCommas !== 'mixed') {
        instructions.push(`${styleProfile.formatting.trailingCommas === 'always' ? 'Always use' : 'Avoid'} trailing commas`);
      }
    }

    // Framework-specific
    if (styleProfile.frameworks.react.componentStyle !== 'mixed') {
      instructions.push(`Use ${styleProfile.frameworks.react.componentStyle} function components`);
    }

    if (styleProfile.frameworks.typescript.interfaceStyle !== 'mixed') {
      instructions.push(`Prefer ${styleProfile.frameworks.typescript.interfaceStyle} for type definitions`);
    }

    return instructions.length > 0 
      ? `\nCODE STYLE REQUIREMENTS (match existing project patterns):\n${instructions.map(i => `- ${i}`).join('\n')}\n`
      : '';
  }

  /**
   * Filter to only code files for analysis
   */
  private getCodeFiles(files: Array<{ path: string; content: string; contentType: string; size: number }>) {
    return files.filter(file => {
      const ext = file.path.split('.').pop()?.toLowerCase();
      return ['ts', 'tsx', 'js', 'jsx', 'vue', 'svelte'].includes(ext || '');
    });
  }

  /**
   * Analyze indentation patterns
   */
  private analyzeIndentation(files: Array<{ path: string; content: string }>): StyleProfile['indentation'] {
    let spaceCount = 0;
    let tabCount = 0;
    let spaceSizes: number[] = [];

    for (const file of files) {
      const lines = file.content.split('\n');
      
      for (const line of lines) {
        if (line.trim().length === 0) continue;
        
        const leadingWhitespace = line.match(/^(\s*)/)?.[1] || '';
        
        if (leadingWhitespace.includes('\t')) {
          tabCount++;
        } else if (leadingWhitespace.length > 0) {
          spaceCount++;
          spaceSizes.push(leadingWhitespace.length);
        }
      }
    }

    const totalIndentedLines = spaceCount + tabCount;
    if (totalIndentedLines === 0) {
      return { type: 'spaces', size: 2, confidence: 0 };
    }

    const usesTabs = tabCount > spaceCount;
    
    if (usesTabs) {
      return {
        type: 'tabs',
        size: 1,
        confidence: tabCount / totalIndentedLines
      };
    }

    // Analyze space sizes
    const commonSize = this.findMostCommonNumber(spaceSizes.filter(s => s <= 8));
    
    return {
      type: 'spaces',
      size: commonSize || 2,
      confidence: spaceCount / totalIndentedLines
    };
  }

  /**
   * Analyze quote style preferences
   */
  private analyzeQuoteStyle(files: Array<{ path: string; content: string }>): StyleProfile['quotes'] {
    let singleQuotes = 0;
    let doubleQuotes = 0;

    for (const file of files) {
      // Count string literals (basic regex - could be improved)
      const singleMatches = file.content.match(/'[^']*'/g) || [];
      const doubleMatches = file.content.match(/"[^"]*"/g) || [];
      
      singleQuotes += singleMatches.length;
      doubleQuotes += doubleMatches.length;
    }

    const total = singleQuotes + doubleQuotes;
    if (total === 0) {
      return { preference: 'single', confidence: 0 };
    }

    const singleRatio = singleQuotes / total;
    
    if (singleRatio > 0.7) {
      return { preference: 'single', confidence: singleRatio };
    } else if (singleRatio < 0.3) {
      return { preference: 'double', confidence: 1 - singleRatio };
    } else {
      return { preference: 'mixed', confidence: 0.5 };
    }
  }

  /**
   * Analyze semicolon usage patterns
   */
  private analyzeSemicolonUsage(files: Array<{ path: string; content: string }>): StyleProfile['semicolons'] {
    let withSemicolon = 0;
    let withoutSemicolon = 0;

    for (const file of files) {
      const lines = file.content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip comments, empty lines, and certain statements
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || 
            trimmed.startsWith('*') || trimmed.includes('{') || trimmed.includes('}')) {
          continue;
        }

        // Check for statements that should end with semicolon
        if (trimmed.match(/^(const|let|var|return|import|export|throw)\s/) ||
            trimmed.match(/\w+\s*\([^)]*\)\s*$/) || // function calls
            trimmed.match(/\w+\s*=\s*/) // assignments
        ) {
          if (trimmed.endsWith(';')) {
            withSemicolon++;
          } else {
            withoutSemicolon++;
          }
        }
      }
    }

    const total = withSemicolon + withoutSemicolon;
    if (total === 0) {
      return { usage: 'always', confidence: 0 };
    }

    const semicolonRatio = withSemicolon / total;
    
    if (semicolonRatio > 0.8) {
      return { usage: 'always', confidence: semicolonRatio };
    } else if (semicolonRatio < 0.2) {
      return { usage: 'never', confidence: 1 - semicolonRatio };
    } else {
      return { usage: 'mixed', confidence: 0.5 };
    }
  }

  /**
   * Analyze import organization patterns
   */
  private analyzeImportPatterns(files: Array<{ path: string; content: string }>): StyleProfile['imports'] {
    let groupedImports = 0;
    let mixedImports = 0;
    let hasSpacing = 0;
    let totalFiles = 0;

    const groupOrder = ['react', 'third-party', 'internal', 'relative'];

    for (const file of files) {
      const lines = file.content.split('\n');
      const importLines = lines.filter(line => line.trim().startsWith('import'));
      
      if (importLines.length < 2) continue;
      
      totalFiles++;
      
      // Check for grouping patterns
      let currentGroup = '';
      let isGrouped = true;
      let hasBlankLinesBetweenGroups = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('import')) {
          const group = this.categorizeImport(line);
          
          if (currentGroup && group !== currentGroup) {
            // Check if there's a blank line before this group
            if (i > 0 && lines[i - 1].trim() === '') {
              hasBlankLinesBetweenGroups = true;
            } else if (currentGroup !== group) {
              isGrouped = false;
            }
          }
          
          currentGroup = group;
        } else if (line === '' && currentGroup) {
          // Blank line after imports
          hasBlankLinesBetweenGroups = true;
        } else if (line && !line.startsWith('import') && currentGroup) {
          // End of imports
          break;
        }
      }
      
      if (isGrouped) {
        groupedImports++;
      } else {
        mixedImports++;
      }
      
      if (hasBlankLinesBetweenGroups) {
        hasSpacing++;
      }
    }

    if (totalFiles === 0) {
      return {
        organization: 'grouped',
        groupOrder,
        spacing: true,
        confidence: 0
      };
    }

    const groupedRatio = groupedImports / totalFiles;
    const spacingRatio = hasSpacing / totalFiles;

    return {
      organization: groupedRatio > 0.6 ? 'grouped' : 'mixed',
      groupOrder,
      spacing: spacingRatio > 0.5,
      confidence: Math.max(groupedRatio, 1 - groupedRatio)
    };
  }

  /**
   * Analyze naming convention patterns
   */
  private analyzeNamingConventions(files: Array<{ path: string; content: string }>): StyleProfile['naming'] {
    const patterns = {
      variables: { camelCase: 0, snake_case: 0, mixed: 0 },
      functions: { camelCase: 0, snake_case: 0, mixed: 0 },
      components: { PascalCase: 0, mixed: 0 },
      constants: { UPPER_CASE: 0, camelCase: 0, mixed: 0 }
    };

    for (const file of files) {
      // Variable declarations
      const varMatches = file.content.match(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
      for (const match of varMatches) {
        const name = match.split(/\s+/)[1];
        if (this.isCamelCase(name)) patterns.variables.camelCase++;
        else if (this.isSnakeCase(name)) patterns.variables.snake_case++;
        else patterns.variables.mixed++;
      }

      // Function declarations
      const funcMatches = file.content.match(/(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:\([^)]*\)\s*=>|async\s*\([^)]*\)\s*=>))/g) || [];
      for (const match of funcMatches) {
        const name = match.includes('function') 
          ? match.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/)?.[1]
          : match.match(/const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/)?.[1];
        
        if (name) {
          if (this.isCamelCase(name)) patterns.functions.camelCase++;
          else if (this.isSnakeCase(name)) patterns.functions.snake_case++;
          else patterns.functions.mixed++;
        }
      }

      // React components
      const componentMatches = file.content.match(/(?:function\s+([A-Z][a-zA-Z0-9]*)|const\s+([A-Z][a-zA-Z0-9]*)\s*=|export\s+(?:default\s+)?(?:function\s+)?([A-Z][a-zA-Z0-9]*))/g) || [];
      for (const match of componentMatches) {
        const name = match.match(/([A-Z][a-zA-Z0-9]*)/)?.[1];
        if (name) {
          if (this.isPascalCase(name)) patterns.components.PascalCase++;
          else patterns.components.mixed++;
        }
      }

      // Constants
      const constMatches = file.content.match(/const\s+([A-Z_][A-Z0-9_]*)\s*=/g) || [];
      for (const match of constMatches) {
        const name = match.match(/const\s+([A-Z_][A-Z0-9_]*)/)?.[1];
        if (name) {
          if (this.isUpperCase(name)) patterns.constants.UPPER_CASE++;
          else patterns.constants.camelCase++;
        }
      }
    }

    return {
      variables: this.getDominantPattern(patterns.variables) as any,
      functions: this.getDominantPattern(patterns.functions) as any,
      components: this.getDominantPattern(patterns.components) as any,
      constants: this.getDominantPattern(patterns.constants) as any,
      confidence: this.calculateNamingConfidence(patterns)
    };
  }

  /**
   * Analyze formatting patterns
   */
  private analyzeFormattingPatterns(files: Array<{ path: string; content: string }>): StyleProfile['formatting'] {
    let totalLines = 0;
    let longLines = 0;
    let trailingCommas = { always: 0, never: 0, es5: 0 };
    let bracketSpacing = { with: 0, without: 0 };
    let arrowParens = { always: 0, avoid: 0 };

    for (const file of files) {
      const lines = file.content.split('\n');
      
      for (const line of lines) {
        totalLines++;
        if (line.length > 100) longLines++;
        
        // Analyze trailing commas
        if (line.includes(',') && line.trim().endsWith(',')) {
          if (line.includes('}') || line.includes(']')) {
            trailingCommas.always++;
          } else {
            trailingCommas.es5++;
          }
        }
        
        // Analyze bracket spacing
        const objectMatches = line.match(/\{[^}]*\}/g) || [];
        for (const match of objectMatches) {
          if (match.match(/\{\s+.*\s+\}/)) {
            bracketSpacing.with++;
          } else if (match.match(/\{.*\}/)) {
            bracketSpacing.without++;
          }
        }
        
        // Analyze arrow function parentheses
        const arrowMatches = line.match(/\([^)]*\)\s*=>/g) || [];
        for (const match of arrowMatches) {
          if (match.match(/\(\w+\)\s*=>/)) {
            arrowParens.always++;
          } else if (match.match(/\w+\s*=>/)) {
            arrowParens.avoid++;
          }
        }
      }
    }

    const avgLineLength = totalLines > 0 ? Math.round((longLines / totalLines) * 120 + 80) : 100;
    
    return {
      lineLength: Math.min(120, Math.max(80, avgLineLength)),
      trailingCommas: this.getDominantPattern(trailingCommas) as any,
      bracketSpacing: bracketSpacing.with > bracketSpacing.without,
      arrowParens: this.getDominantPattern(arrowParens) as any,
      confidence: 0.8 // Formatting patterns are generally reliable
    };
  }

  /**
   * Analyze framework-specific patterns
   */
  private analyzeFrameworkPatterns(files: Array<{ path: string; content: string }>): StyleProfile['frameworks'] {
    let arrowComponents = 0;
    let functionComponents = 0;
    let interfaceDeclarations = 0;
    let typeDeclarations = 0;
    let namedExports = 0;
    let defaultExports = 0;

    const hooksPattern: string[] = [];

    for (const file of files) {
      // React component styles
      const arrowComponentMatches = file.content.match(/const\s+[A-Z][a-zA-Z0-9]*\s*=\s*\([^)]*\)\s*=>/g) || [];
      arrowComponents += arrowComponentMatches.length;

      const functionComponentMatches = file.content.match(/function\s+[A-Z][a-zA-Z0-9]*\s*\([^)]*\)/g) || [];
      functionComponents += functionComponentMatches.length;

      // TypeScript patterns
      const interfaceMatches = file.content.match(/interface\s+[A-Z][a-zA-Z0-9]*/g) || [];
      interfaceDeclarations += interfaceMatches.length;

      const typeMatches = file.content.match(/type\s+[A-Z][a-zA-Z0-9]*\s*=/g) || [];
      typeDeclarations += typeMatches.length;

      // Export patterns
      const namedExportMatches = file.content.match(/export\s+(?:const|function|class|interface|type)/g) || [];
      namedExports += namedExportMatches.length;

      const defaultExportMatches = file.content.match(/export\s+default/g) || [];
      defaultExports += defaultExportMatches.length;

      // Hook patterns
      const hookMatches = file.content.match(/use[A-Z][a-zA-Z0-9]*/g) || [];
      for (const hook of hookMatches) {
        if (!hooksPattern.includes(hook)) {
          hooksPattern.push(hook);
        }
      }
    }

    return {
      react: {
        componentStyle: arrowComponents > functionComponents ? 'arrow' : 
                      functionComponents > arrowComponents ? 'function' : 'mixed',
        hooksPattern: hooksPattern.slice(0, 10), // Top 10 most common hooks
        propsDestructuring: true // Default assumption
      },
      typescript: {
        interfaceStyle: interfaceDeclarations > typeDeclarations ? 'interface' :
                      typeDeclarations > interfaceDeclarations ? 'type' : 'mixed',
        exportStyle: namedExports > defaultExports ? 'named' :
                    defaultExports > namedExports ? 'default' : 'mixed'
      }
    };
  }

  /**
   * Helper methods for pattern analysis
   */
  private isCamelCase(name: string): boolean {
    return /^[a-z][a-zA-Z0-9]*$/.test(name);
  }

  private isSnakeCase(name: string): boolean {
    return /^[a-z][a-z0-9_]*$/.test(name);
  }

  private isPascalCase(name: string): boolean {
    return /^[A-Z][a-zA-Z0-9]*$/.test(name);
  }

  private isUpperCase(name: string): boolean {
    return /^[A-Z][A-Z0-9_]*$/.test(name);
  }

  private findMostCommonNumber(numbers: number[]): number {
    const frequency: Record<number, number> = {};
    
    for (const num of numbers) {
      frequency[num] = (frequency[num] || 0) + 1;
    }
    
    let maxCount = 0;
    let mostCommon = 2;
    
    for (const [num, count] of Object.entries(frequency)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = parseInt(num);
      }
    }
    
    return mostCommon;
  }

  private getDominantPattern(patterns: Record<string, number>): string {
    let maxCount = 0;
    let dominant = 'mixed';
    
    for (const [pattern, count] of Object.entries(patterns)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = pattern;
      }
    }
    
    const total = Object.values(patterns).reduce((sum, count) => sum + count, 0);
    return total > 0 && maxCount / total > 0.6 ? dominant : 'mixed';
  }

  private calculateNamingConfidence(patterns: any): number {
    const totals = Object.values(patterns).map((p: any) => 
      Object.values(p as Record<string, number>).reduce((sum: number, count: number) => sum + count, 0)
    );
    
    const avgTotal = totals.reduce((sum: number, total: number) => sum + total, 0) / totals.length;
    return avgTotal > 10 ? 0.8 : avgTotal > 5 ? 0.6 : 0.4;
  }

  private calculateOverallConfidence(styleProfile: StyleProfile): number {
    const confidences = [
      styleProfile.indentation.confidence,
      styleProfile.quotes.confidence,
      styleProfile.semicolons.confidence,
      styleProfile.imports.confidence,
      styleProfile.naming.confidence,
      styleProfile.formatting.confidence
    ];
    
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  private categorizeImport(importLine: string): string {
    if (importLine.includes('react')) return 'react';
    if (importLine.includes('./') || importLine.includes('../')) return 'relative';
    if (importLine.includes('@/') || importLine.includes('~/')) return 'internal';
    return 'third-party';
  }

  private getDefaultStyleProfile(): StyleProfile {
    return {
      indentation: { type: 'spaces', size: 2, confidence: 0 },
      quotes: { preference: 'single', confidence: 0 },
      semicolons: { usage: 'always', confidence: 0 },
      imports: { organization: 'grouped', groupOrder: ['react', 'third-party', 'internal', 'relative'], spacing: true, confidence: 0 },
      naming: { variables: 'camelCase', functions: 'camelCase', components: 'PascalCase', constants: 'UPPER_CASE', confidence: 0 },
      formatting: { lineLength: 100, trailingCommas: 'es5', bracketSpacing: true, arrowParens: 'avoid', confidence: 0 },
      frameworks: {
        react: { componentStyle: 'arrow', hooksPattern: [], propsDestructuring: true },
        typescript: { interfaceStyle: 'interface', exportStyle: 'named' }
      }
    };
  }
} 