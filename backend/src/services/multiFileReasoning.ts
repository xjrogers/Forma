interface FileRelationship {
  sourceFile: string;
  targetFile: string;
  relationship: 'imports' | 'exports' | 'extends' | 'implements' | 'references' | 'calls' | 
               'uses_component' | 'uses_type' | 'uses_function' | 'uses_context' | 'defines_props';
  symbols: string[];
  confidence: number;
  metadata?: {
    sourceSize: number;
    targetSize: number;
    isCircular: boolean;
  };
}

interface ImpactAnalysis {
  changedFile: string;
  affectedFiles: Array<{
    filePath: string;
    impactType: 'breaking' | 'warning' | 'info';
    reason: string;
    suggestedAction?: string;
  }>;
  cascadeDepth: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface CrossFileContext {
  primaryFiles: string[];
  relatedFiles: string[];
  sharedTypes: Array<{
    name: string;
    definition: string;
    usages: Array<{ file: string; line: number }>;
  }>;
  componentHierarchy: Map<string, string[]>;
  dataFlow: Array<{
    from: string;
    to: string;
    dataType: string;
    flowType: 'props' | 'state' | 'context' | 'api';
  }>;
}

export class MultiFileReasoningEngine {
  private static instance: MultiFileReasoningEngine;
  private relationshipCache: Map<string, FileRelationship[]> = new Map();
  private impactCache: Map<string, ImpactAnalysis> = new Map();

  static getInstance(): MultiFileReasoningEngine {
    if (!MultiFileReasoningEngine.instance) {
      MultiFileReasoningEngine.instance = new MultiFileReasoningEngine();
    }
    return MultiFileReasoningEngine.instance;
  }

  /**
   * Analyze cross-file relationships and dependencies (Cursor-level intelligence)
   */
  async analyzeFileRelationships(projectContext: any): Promise<FileRelationship[]> {
    console.log('🔗 Analyzing cross-file relationships...');
    
    // Check cache first
    if (this.relationshipCache.has(projectContext.id)) {
      console.log('📋 Using cached relationships');
      return this.relationshipCache.get(projectContext.id)!;
    }
    
    const relationships: FileRelationship[] = [];
    const codeFiles = projectContext.files.filter((f: any) => 
      f.path.match(/\.(ts|tsx|js|jsx)$/)
    );

    // Create file map for quick lookups
    const fileMap = new Map<string, any>();
    for (const file of codeFiles) {
      fileMap.set(file.path, file);
    }

    console.log(`📁 Analyzing ${codeFiles.length} code files for relationships...`);

    for (const file of codeFiles) {
      try {
        const fileRelationships = await this.analyzeFileConnections(file, codeFiles, fileMap);
        relationships.push(...fileRelationships);
      } catch (error) {
        console.error(`❌ Error analyzing ${file.path}:`, error);
      }
    }

    // Deduplicate and enhance relationships
    const uniqueRelationships = this.deduplicateRelationships(relationships);
    const enhancedRelationships = this.enhanceRelationships(uniqueRelationships, fileMap);

    // Cache for performance
    this.relationshipCache.set(projectContext.id, enhancedRelationships);
    
    console.log(`🔗 Found ${enhancedRelationships.length} unique file relationships`);
    this.logRelationshipSummary(enhancedRelationships);
    
    return enhancedRelationships;
  }

  /**
   * Analyze impact of changes to a specific file (Cursor-level impact analysis)
   */
  async analyzeChangeImpact(
    changedFile: string,
    changeType: 'modify' | 'delete' | 'rename',
    projectContext: any,
    proposedChanges?: string
  ): Promise<ImpactAnalysis> {
    console.log(`📊 Analyzing impact of ${changeType} on ${changedFile}...`);

    const relationships = await this.analyzeFileRelationships(projectContext);
    const affectedFiles: ImpactAnalysis['affectedFiles'] = [];
    
    // Find files that depend on the changed file
    const dependentFiles = relationships.filter(rel => 
      rel.targetFile === changedFile || rel.sourceFile === changedFile
    );

    for (const relationship of dependentFiles) {
      const affectedFile = relationship.sourceFile === changedFile 
        ? relationship.targetFile 
        : relationship.sourceFile;

      const impact = await this.assessFileImpact(
        changedFile,
        affectedFile,
        relationship,
        changeType,
        proposedChanges
      );

      if (impact) {
        affectedFiles.push(impact);
      }
    }

    // Analyze cascade effects (changes that cause more changes)
    const cascadeAnalysis = await this.analyzeCascadeEffects(affectedFiles, relationships);
    
    const impactAnalysis: ImpactAnalysis = {
      changedFile,
      affectedFiles: [...affectedFiles, ...cascadeAnalysis.additionalAffected],
      cascadeDepth: cascadeAnalysis.maxDepth,
      riskLevel: this.calculateRiskLevel(affectedFiles, cascadeAnalysis.maxDepth)
    };

    // Cache for performance
    this.impactCache.set(`${projectContext.id}:${changedFile}`, impactAnalysis);
    
    return impactAnalysis;
  }

  /**
   * Build cross-file context for AI reasoning (Cursor-level context awareness)
   */
  async buildCrossFileContext(
    primaryFiles: string[],
    projectContext: any,
    userMessage: string
  ): Promise<CrossFileContext> {
    console.log('🧠 Building cross-file context for AI reasoning...');

    const relationships = await this.analyzeFileRelationships(projectContext);
    
    // Find all files related to primary files, filtered by user message context
    const relatedFiles = this.findRelatedFiles(primaryFiles, relationships);
    
    // Filter relationships based on user message keywords for more relevant context
    const messageKeywords = userMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const relevantRelationships = relationships.filter(rel =>
      messageKeywords.some(keyword =>
        rel.sourceFile.toLowerCase().includes(keyword) ||
        rel.targetFile.toLowerCase().includes(keyword) ||
        rel.symbols.some(symbol => symbol.toLowerCase().includes(keyword))
      )
    );
    
    // Use relevant relationships for more focused analysis
    const contextRelationships = relevantRelationships.length > 0 ? relevantRelationships : relationships;
    
    // Extract shared types and interfaces
    const sharedTypes = await this.extractSharedTypes(
      [...primaryFiles, ...relatedFiles],
      projectContext
    );
    
    // Build component hierarchy for React projects
    const componentHierarchy = await this.buildComponentHierarchy(
      projectContext.files,
      contextRelationships
    );
    
    // Analyze data flow between components
    const dataFlow = await this.analyzeDataFlow(
      [...primaryFiles, ...relatedFiles],
      projectContext,
      contextRelationships
    );

    return {
      primaryFiles,
      relatedFiles,
      sharedTypes,
      componentHierarchy,
      dataFlow
    };
  }

  /**
   * Generate intelligent suggestions based on cross-file analysis
   */
  async generateIntelligentSuggestions(
    userMessage: string,
    projectContext: any,
    activeFile?: string
  ): Promise<Array<{
    type: 'refactor' | 'optimize' | 'fix' | 'enhance';
    description: string;
    files: string[];
    confidence: number;
    reasoning: string;
  }>> {
    console.log('💡 Generating intelligent suggestions...');

    const suggestions: Array<{
      type: 'refactor' | 'optimize' | 'fix' | 'enhance';
      description: string;
      files: string[];
      confidence: number;
      reasoning: string;
    }> = [];
    
    const relationships = await this.analyzeFileRelationships(projectContext);
    
    // Focus suggestions on active file if provided
    const focusFiles = activeFile ? [activeFile] : [];
    
    // Generate basic suggestions based on user message context
    const messageKeywords = userMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    // Suggest circular dependency fixes if any exist
    const circularDeps = relationships.filter(rel => rel.metadata?.isCircular);
    if (circularDeps.length > 0) {
      // If we have focus files, only suggest fixes related to those files
      const relevantCircularDeps = focusFiles.length > 0 
        ? circularDeps.filter(dep => focusFiles.includes(dep.sourceFile) || focusFiles.includes(dep.targetFile))
        : circularDeps;
        
      if (relevantCircularDeps.length > 0) {
        suggestions.push({
          type: 'fix',
          description: 'Resolve circular dependencies between files',
          files: relevantCircularDeps.flatMap(dep => [dep.sourceFile, dep.targetFile]),
          confidence: 0.9,
          reasoning: 'Circular dependencies can cause build issues and make code harder to understand'
        });
      }
    }
    
    // Suggest type improvements if user mentions types
    if (messageKeywords.some(keyword => ['type', 'typescript', 'interface'].includes(keyword))) {
      let jsFiles = projectContext.files.filter((f: any) => f.path.match(/\.jsx?$/));
      
      // If we have focus files, prioritize those
      if (focusFiles.length > 0) {
        const focusJsFiles = jsFiles.filter((f: any) => focusFiles.includes(f.path));
        if (focusJsFiles.length > 0) {
          jsFiles = focusJsFiles;
        }
      }
      
      if (jsFiles.length > 0) {
        suggestions.push({
          type: 'enhance',
          description: 'Consider migrating JavaScript files to TypeScript for better type safety',
          files: jsFiles.map((f: any) => f.path).slice(0, 5), // Limit to 5 files
          confidence: 0.7,
          reasoning: 'TypeScript provides better developer experience and catches errors at compile time'
        });
      }
    }
    
    // Note: Complex analysis removed - AI can provide contextual suggestions when needed

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Private helper methods
   */
  private async analyzeFileConnections(
    file: any,
    allFiles: any[],
    fileMap: Map<string, any>
  ): Promise<FileRelationship[]> {
    const relationships: FileRelationship[] = [];
    
    try {
      // 1. Parse imports and exports
      const imports = this.extractImports(file.content);
      const exports = this.extractExports(file.content);
      
      // Track exports for cross-file analysis
      if (exports.length > 0) {
        console.log(`📤 File ${file.path} exports: ${exports.map(e => e.name).join(', ')}`);
      }
      
      // 2. Analyze import relationships
      for (const importInfo of imports) {
        const targetFile = this.resolveImportPath(importInfo.from, file.path, allFiles);
        
        if (targetFile) {
          relationships.push({
            sourceFile: file.path,
            targetFile: targetFile.path,
            relationship: 'imports',
            symbols: importInfo.symbols,
            confidence: 0.95
          });
        }
      }
      
      // 3. Analyze component usage (React-specific)
      if (file.path.match(/\.(tsx|jsx)$/)) {
        const componentUsages = this.extractComponentUsages(file.content, fileMap);
        relationships.push(...componentUsages.map(usage => ({
          sourceFile: file.path,
          targetFile: usage.file,
          relationship: 'uses_component' as const,
          symbols: [usage.component],
          confidence: 0.85
        })));
      }
      
      // 4. Analyze type dependencies (TypeScript-specific)
      if (file.path.match(/\.(ts|tsx)$/)) {
        const typeUsages = this.extractTypeUsages(file.content, file.path);
        for (const typeUsage of typeUsages) {
          const definingFile = this.findTypeDefinition(typeUsage.name, allFiles, fileMap);
          if (definingFile && definingFile !== file.path) {
            relationships.push({
              sourceFile: file.path,
              targetFile: definingFile,
              relationship: 'uses_type' as const,
              symbols: [typeUsage.name],
              confidence: 0.8
            });
          }
        }
      }
      
      // 5. Analyze function/hook usage
      const functionUsages = this.extractFunctionUsages(file.content, fileMap);
      // Set the source file for each relationship
      functionUsages.forEach(usage => usage.sourceFile = file.path);
      relationships.push(...functionUsages);
      
      // 6. Note: Data flow patterns are handled separately in buildCrossFileContext
      // since they have a different type structure
      
    } catch (error) {
      console.error(`❌ Error analyzing file connections for ${file.path}:`, error);
    }
    
    return relationships;
  }

  private async assessFileImpact(
    changedFile: string,
    affectedFile: string,
    relationship: FileRelationship,
    changeType: string,
    proposedChanges?: string
  ): Promise<ImpactAnalysis['affectedFiles'][0] | null> {
    // Analyze the specific impact based on relationship type and change
    let impactType: 'breaking' | 'warning' | 'info' = 'info';
    let reason = '';
    let suggestedAction = '';

    if (changeType === 'delete') {
      impactType = 'breaking';
      reason = `File ${changedFile} is imported by ${affectedFile}`;
      suggestedAction = 'Remove imports or find alternative implementation';
    } else if (relationship.relationship === 'imports') {
      if (proposedChanges && this.wouldBreakExports(proposedChanges, relationship.symbols)) {
        impactType = 'breaking';
        reason = `Exported symbols used by ${affectedFile} may be removed or changed`;
        suggestedAction = 'Update imports in affected file';
      } else {
        impactType = 'warning';
        reason = `Changes to ${changedFile} may affect imports in ${affectedFile}`;
        suggestedAction = 'Review and test affected file';
      }
    }

    return {
      filePath: affectedFile,
      impactType,
      reason,
      suggestedAction
    };
  }

  private async analyzeCascadeEffects(
    directlyAffected: ImpactAnalysis['affectedFiles'],
    relationships: FileRelationship[]
  ): Promise<{ additionalAffected: ImpactAnalysis['affectedFiles']; maxDepth: number }> {
    const additionalAffected: ImpactAnalysis['affectedFiles'] = [];
    let maxDepth = 1;
    
    // Find files that depend on directly affected files (cascade effect)
    for (const affected of directlyAffected) {
      const cascadeFiles = relationships.filter(rel => 
        rel.targetFile === affected.filePath && 
        !directlyAffected.some(da => da.filePath === rel.sourceFile)
      );
      
      for (const cascade of cascadeFiles) {
        additionalAffected.push({
          filePath: cascade.sourceFile,
          impactType: 'warning',
          reason: `Indirectly affected through ${affected.filePath}`,
          suggestedAction: 'Review for potential issues'
        });
        maxDepth = Math.max(maxDepth, 2);
      }
    }
    
    return { additionalAffected, maxDepth };
  }

  private findRelatedFiles(primaryFiles: string[], relationships: FileRelationship[]): string[] {
    const related = new Set<string>();
    
    for (const primaryFile of primaryFiles) {
      const directRelations = relationships.filter(rel => 
        rel.sourceFile === primaryFile || rel.targetFile === primaryFile
      );
      
      for (const relation of directRelations) {
        related.add(relation.sourceFile);
        related.add(relation.targetFile);
      }
    }
    
    // Remove primary files from related set
    primaryFiles.forEach(file => related.delete(file));
    
    return Array.from(related);
  }

  private async extractSharedTypes(
    files: string[],
    projectContext: any
  ): Promise<CrossFileContext['sharedTypes']> {
    const sharedTypes: CrossFileContext['sharedTypes'] = [];
    const typeDefinitions = new Map<string, { definition: string; file: string; line: number }>();
    const typeUsages = new Map<string, Array<{ file: string; line: number }>>();
    
    // Extract type definitions and usages
    for (const filePath of files) {
      const file = projectContext.files.find((f: any) => f.path === filePath);
      if (!file) continue;
      
      const types = this.extractTypeDefinitions(file.content, filePath);
      const usages = this.extractTypeUsages(file.content, filePath);
      
      types.forEach(type => typeDefinitions.set(type.name, {
        definition: type.definition,
        file: filePath,
        line: type.line
      }));
      usages.forEach(usage => {
        if (!typeUsages.has(usage.name)) {
          typeUsages.set(usage.name, []);
        }
        typeUsages.get(usage.name)!.push({ file: filePath, line: usage.line });
      });
    }
    
    // Find types that are used across multiple files
    for (const [typeName, definition] of Array.from(typeDefinitions)) {
      const usages = typeUsages.get(typeName) || [];
      const usedInMultipleFiles = new Set(usages.map(u => u.file)).size > 1;
      
      if (usedInMultipleFiles) {
        sharedTypes.push({
          name: typeName,
          definition: definition.definition,
          usages
        });
      }
    }
    
    return sharedTypes;
  }

  private async buildComponentHierarchy(
    files: any[],
    relationships: FileRelationship[]
  ): Promise<Map<string, string[]>> {
    const hierarchy = new Map<string, string[]>();
    
    // Analyze React component relationships
    for (const file of files) {
      if (!file.path.match(/\.(tsx|jsx)$/)) continue;
      
      const components = this.extractReactComponents(file.content);
      const childComponents = this.extractChildComponentUsages(file.content, relationships);
      
      for (const component of components) {
        hierarchy.set(`${file.path}:${component}`, childComponents);
      }
    }
    
    return hierarchy;
  }

  private async analyzeDataFlow(
    files: string[],
    projectContext: any,
    _relationships: FileRelationship[]
  ): Promise<CrossFileContext['dataFlow']> {
    const dataFlow: CrossFileContext['dataFlow'] = [];
    
    // Analyze props, state, and context flow between components
    for (const filePath of files) {
      const file = projectContext.files.find((f: any) => f.path === filePath);
      if (!file || !file.path.match(/\.(tsx|jsx)$/)) continue;
      
      const flows = this.extractDataFlowPatterns(file.content, filePath);
      dataFlow.push(...flows);
    }
    
    return dataFlow;
  }

  // Helper methods for parsing and analysis
  private extractImports(content: string): Array<{ from: string; symbols: string[]; type: 'named' | 'default' | 'namespace' }> {
    const imports: Array<{ from: string; symbols: string[]; type: 'named' | 'default' | 'namespace' }> = [];
    
    // Enhanced regex patterns for different import types
    const patterns = [
      // Named imports: import { a, b } from 'module'
      {
        regex: /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]([^'"]+)['"]/g,
        type: 'named' as const
      },
      // Default imports: import React from 'react'
      {
        regex: /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
        type: 'default' as const
      },
      // Namespace imports: import * as React from 'react'
      {
        regex: /import\s*\*\s*as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
        type: 'namespace' as const
      },
      // Mixed imports: import React, { useState } from 'react'
      {
        regex: /import\s+(\w+)\s*,\s*\{\s*([^}]+)\s*\}\s*from\s+['"]([^'"]+)['"]/g,
        type: 'mixed' as const
      },
      // Side effect imports: import 'module'
      {
        regex: /import\s+['"]([^'"]+)['"]/g,
        type: 'side-effect' as const
      }
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        if (pattern.type === 'named') {
          const [, namedImports, from] = match;
          const symbols = namedImports.split(',').map(s => s.trim().replace(/\s+as\s+\w+/, ''));
          imports.push({ from, symbols, type: 'named' });
        } else if (pattern.type === 'default') {
          const [, defaultImport, from] = match;
          imports.push({ from, symbols: [defaultImport], type: 'default' });
        } else if (pattern.type === 'namespace') {
          const [, namespaceImport, from] = match;
          imports.push({ from, symbols: [namespaceImport], type: 'namespace' });
        } else if (pattern.type === 'mixed') {
          const [, defaultImport, namedImports, from] = match;
          const symbols = [defaultImport, ...namedImports.split(',').map(s => s.trim())];
          imports.push({ from, symbols, type: 'named' });
        } else if (pattern.type === 'side-effect') {
          const [, from] = match;
          imports.push({ from, symbols: [], type: 'named' });
        }
      }
    }
    
    return imports;
  }

  private extractExports(content: string): Array<{ name: string; type: 'default' | 'named'; kind: string }> {
    const exports: Array<{ name: string; type: 'default' | 'named'; kind: string }> = [];
    
    // Enhanced export patterns
    const patterns = [
      // Default exports: export default Component
      {
        regex: /export\s+default\s+(?:(class|function|interface|type)\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
        type: 'default' as const
      },
      // Named exports: export const/function/class/interface/type
      {
        regex: /export\s+(const|function|class|interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
        type: 'named' as const
      },
      // Re-exports: export { a, b } from 'module'
      {
        regex: /export\s*\{\s*([^}]+)\s*\}\s*(?:from\s*['"]([^'"]+)['"])?/g,
        type: 'named' as const
      },
      // Export all: export * from 'module'
      {
        regex: /export\s*\*\s*from\s*['"]([^'"]+)['"]/g,
        type: 'named' as const
      }
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        if (pattern.regex.source.includes('default')) {
          const [, kind, name] = match;
          if (name) {
            exports.push({ name, type: 'default', kind: kind || 'unknown' });
          }
        } else if (pattern.regex.source.includes('const|function|class')) {
          const [, kind, name] = match;
          exports.push({ name, type: 'named', kind });
        } else if (pattern.regex.source.includes('\\{')) {
          const [, namedExports] = match;
          const names = namedExports.split(',').map(s => s.trim().replace(/\s+as\s+\w+/, ''));
          for (const name of names) {
            if (name) {
              exports.push({ name, type: 'named', kind: 'unknown' });
            }
          }
        }
      }
    }
    
    return exports;
  }

  /**
   * Extract component usages in React files
   */
  private extractComponentUsages(content: string, fileMap: Map<string, any>): Array<{ component: string; file: string }> {
    const usages: Array<{ component: string; file: string }> = [];
    
    // Find JSX component usage patterns
    const componentRegex = /<([A-Z][a-zA-Z0-9]*)/g;
    let match;
    
    while ((match = componentRegex.exec(content)) !== null) {
      const componentName = match[1];
      
      // Find which file defines this component
      for (const [filePath, file] of Array.from(fileMap)) {
        if (filePath.match(/\.(tsx|jsx)$/) && file.content) {
          // Check if this file exports the component
          const exports = this.extractExports(file.content);
          if (exports.some(exp => exp.name === componentName)) {
            usages.push({ component: componentName, file: filePath });
            break;
          }
        }
      }
    }
    
    return usages;
  }

  /**
   * Extract function/hook usages
   */
  private extractFunctionUsages(content: string, fileMap: Map<string, any>): FileRelationship[] {
    const relationships: FileRelationship[] = [];
    
    // Find function calls and hook usage
    const functionCallRegex = /(?:const|let|var)\s+\w+\s*=\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    const hookRegex = /use[A-Z][a-zA-Z0-9]*/g;
    
    const functionCalls = new Set<string>();
    let match;
    
    // Extract function calls
    while ((match = functionCallRegex.exec(content)) !== null) {
      functionCalls.add(match[1]);
    }
    
    // Extract hook usage
    while ((match = hookRegex.exec(content)) !== null) {
      functionCalls.add(match[0]);
    }
    
    // Find defining files for these functions/hooks
    for (const functionName of Array.from(functionCalls)) {
      for (const [filePath, file] of Array.from(fileMap)) {
        if (file.content && file.content.includes(`export`) && file.content.includes(functionName)) {
          const exports = this.extractExports(file.content);
          if (exports.some(exp => exp.name === functionName)) {
                         relationships.push({
               sourceFile: '', // Will be set by caller
               targetFile: filePath,
               relationship: 'uses_function' as const,
               symbols: [functionName],
               confidence: 0.7
             });
            break;
          }
        }
      }
    }
    
    return relationships;
  }

  /**
   * Extract data flow patterns (props, context, etc.)
   */
  private extractDataFlowPatterns(content: string, filePath: string): Array<{
    from: string;
    to: string;
    dataType: string;
    flowType: 'props' | 'state' | 'context' | 'api';
  }> {
    const dataFlows: Array<{
      from: string;
      to: string;
      dataType: string;
      flowType: 'props' | 'state' | 'context' | 'api';
    }> = [];
    
    // Analyze props flow in React components
    if (filePath.match(/\.(tsx|jsx)$/)) {
      // Find prop types and interfaces
      const propTypeRegex = /(?:interface|type)\s+(\w+Props)/g;
      let match;
      
      while ((match = propTypeRegex.exec(content)) !== null) {
        dataFlows.push({
          from: filePath,
          to: 'child-components', // Generic target for props
          dataType: match[1],
          flowType: 'props'
        });
      }
      
      // Find context usage
      const contextRegex = /useContext\s*\(\s*(\w+Context)\s*\)/g;
      while ((match = contextRegex.exec(content)) !== null) {
        dataFlows.push({
          from: 'context-provider', // Generic source for context
          to: filePath,
          dataType: match[1],
          flowType: 'context'
        });
      }
      
      // Find state usage
      const stateRegex = /useState\s*<\s*([^>]+)\s*>/g;
      while ((match = stateRegex.exec(content)) !== null) {
        dataFlows.push({
          from: filePath,
          to: filePath,
          dataType: match[1],
          flowType: 'state'
        });
      }
      
      // Find API calls
      const apiRegex = /(?:fetch|axios\.(?:get|post|put|delete))\s*\(\s*['"`]([^'"`]+)['"`]/g;
      while ((match = apiRegex.exec(content)) !== null) {
        dataFlows.push({
          from: match[1], // API endpoint
          to: filePath,
          dataType: 'ApiResponse',
          flowType: 'api'
        });
      }
    }
    
    return dataFlows;
  }

  /**
   * Find type definition location
   */
  private findTypeDefinition(typeName: string, _allFiles: any[], fileMap: Map<string, any>): string | null {
    for (const [filePath, file] of Array.from(fileMap)) {
      if (file.content && filePath.match(/\.(ts|tsx)$/)) {
        // Check for type/interface definitions
        const typeDefRegex = new RegExp(`(?:interface|type)\\s+${typeName}\\b`);
        if (typeDefRegex.test(file.content)) {
          return filePath;
        }
      }
    }
    return null;
  }

  /**
   * Deduplicate relationships
   */
  private deduplicateRelationships(relationships: FileRelationship[]): FileRelationship[] {
    const seen = new Set<string>();
    const unique: FileRelationship[] = [];
    
    for (const rel of relationships) {
      const key = `${rel.sourceFile}:${rel.targetFile}:${rel.relationship}:${rel.symbols.join(',')}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(rel);
      }
    }
    
    return unique;
  }

  /**
   * Enhance relationships with additional metadata
   */
  private enhanceRelationships(relationships: FileRelationship[], fileMap: Map<string, any>): FileRelationship[] {
    return relationships.map(rel => {
      // Add file size information for impact analysis
      const sourceFile = fileMap.get(rel.sourceFile);
      const targetFile = fileMap.get(rel.targetFile);
      
      return {
        ...rel,
        metadata: {
          sourceSize: sourceFile?.content?.length || 0,
          targetSize: targetFile?.content?.length || 0,
          isCircular: this.detectCircularDependency(rel, relationships)
        }
      };
    });
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependency(relationship: FileRelationship, allRelationships: FileRelationship[]): boolean {
    // Simple circular dependency detection
    return allRelationships.some(rel => 
      rel.sourceFile === relationship.targetFile && 
      rel.targetFile === relationship.sourceFile &&
      rel.relationship === relationship.relationship
    );
  }

  /**
   * Log relationship summary for debugging
   */
  private logRelationshipSummary(relationships: FileRelationship[]): void {
    const summary = relationships.reduce((acc, rel) => {
      acc[rel.relationship] = (acc[rel.relationship] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('📊 Relationship Summary:', summary);
    
    // Log circular dependencies
    const circular = relationships.filter(rel => rel.metadata?.isCircular);
    if (circular.length > 0) {
      console.log(`⚠️ Found ${circular.length} circular dependencies`);
    }
  }



  private resolveImportPath(importPath: string, currentFile: string, allFiles: any[]): any | null {
    // Resolve relative imports to actual file paths
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const currentDir = currentFile.split('/').slice(0, -1).join('/');
      const resolvedPath = this.resolvePath(currentDir, importPath);
      
      // Try different extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
      for (const ext of extensions) {
        const fullPath = resolvedPath + ext;
        const file = allFiles.find(f => f.path === fullPath);
        if (file) return file;
      }
    }
    
    return null;
  }

  private resolvePath(basePath: string, relativePath: string): string {
    const parts = basePath.split('/');
    const relativeParts = relativePath.split('/');
    
    for (const part of relativeParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }
    
    return parts.join('/');
  }

  private wouldBreakExports(proposedChanges: string, exportedSymbols: string[]): boolean {
    // Analyze if proposed changes would break exported symbols
    for (const symbol of exportedSymbols) {
      if (!proposedChanges.includes(`export`) || !proposedChanges.includes(symbol)) {
        return true;
      }
    }
    return false;
  }

  private calculateRiskLevel(
    affectedFiles: ImpactAnalysis['affectedFiles'],
    cascadeDepth: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const breakingChanges = affectedFiles.filter(f => f.impactType === 'breaking').length;
    const totalAffected = affectedFiles.length;
    
    if (breakingChanges > 5 || cascadeDepth > 3) return 'critical';
    if (breakingChanges > 2 || totalAffected > 10) return 'high';
    if (breakingChanges > 0 || totalAffected > 5) return 'medium';
    return 'low';
  }

  private extractTypeDefinitions(content: string, _filePath: string): Array<{ name: string; definition: string; line: number }> {
    // Extract TypeScript interface and type definitions
    const types: Array<{ name: string; definition: string; line: number }> = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const interfaceMatch = line.match(/(?:export\s+)?interface\s+([A-Z][a-zA-Z0-9]*)/);
      const typeMatch = line.match(/(?:export\s+)?type\s+([A-Z][a-zA-Z0-9]*)\s*=/);
      
      if (interfaceMatch) {
        types.push({
          name: interfaceMatch[1],
          definition: line,
          line: i + 1
        });
      } else if (typeMatch) {
        types.push({
          name: typeMatch[1],
          definition: line,
          line: i + 1
        });
      }
    }
    
    return types;
  }

  private extractTypeUsages(content: string, _filePath: string): Array<{ name: string; line: number }> {
    // Extract type usages (simplified)
    const usages: Array<{ name: string; line: number }> = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Look for type annotations
      const typeMatches = line.match(/:\s*([A-Z][a-zA-Z0-9]*)/g);
      
      if (typeMatches) {
        for (const match of typeMatches) {
          const typeName = match.replace(':', '').trim();
          usages.push({ name: typeName, line: i + 1 });
        }
      }
    }
    
    return usages;
  }

  private extractReactComponents(content: string): string[] {
    const components: string[] = [];
    const componentRegex = /(?:function|const)\s+([A-Z][a-zA-Z0-9]*)/g;
    
    let match;
    while ((match = componentRegex.exec(content)) !== null) {
      components.push(match[1]);
    }
    
    return components;
  }

  private extractChildComponentUsages(content: string, _relationships: FileRelationship[]): string[] {
    // Extract JSX component usages
    const usages: string[] = [];
    const jsxRegex = /<([A-Z][a-zA-Z0-9]*)/g;
    
    let match;
    while ((match = jsxRegex.exec(content)) !== null) {
      usages.push(match[1]);
    }
    
    return usages;
  }











} 