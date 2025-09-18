interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  size: number; // Repository size in KB
  language: string | null;
  stargazers_count: number;
}

interface ImportConfig {
  enableAIAnalysis: boolean;
  analyzeArchitecture: boolean;
  extractBusinessLogic: boolean;
  buildKnowledgeGraph: boolean;
  generateDocumentation: boolean;
  scanSecurity: boolean;
  optimizeForAI: boolean;
}

interface TokenEstimate {
  baseTokens: number;
  analysisTokens: number;
  totalTokens: number;
  breakdown: {
    repositoryProcessing: number;
    architectureAnalysis: number;
    businessLogicExtraction: number;
    knowledgeGraph: number;
    documentation: number;
    securityScan: number;
    aiOptimization: number;
  };
  estimatedCost: number; // In USD
}

export class TokenEstimationService {
  private static readonly BASE_TOKENS_PER_KB = 50; // Base tokens per KB of code
  private static readonly ANALYSIS_MULTIPLIERS = {
    architecture: 2.0,
    businessLogic: 1.5,
    knowledgeGraph: 3.0,
    documentation: 2.5,
    security: 1.0,
    aiOptimization: 4.0
  };

  private static readonly LANGUAGE_MULTIPLIERS = {
    'TypeScript': 1.2,
    'JavaScript': 1.0,
    'Python': 1.1,
    'Java': 1.3,
    'C++': 1.4,
    'Go': 1.0,
    'Rust': 1.2,
    'PHP': 0.9,
    'Ruby': 0.9,
    'HTML': 0.5,
    'CSS': 0.3
  };

  private static readonly TOKEN_COST_PER_1K = 0.003; // $0.003 per 1K tokens (Claude pricing)

  static estimateImportTokens(repository: GitHubRepo, config: ImportConfig): TokenEstimate {
    // Base processing tokens (repository download, file processing, basic indexing)
    const languageMultiplier = this.LANGUAGE_MULTIPLIERS[repository.language as keyof typeof this.LANGUAGE_MULTIPLIERS] || 1.0;
    const sizeMultiplier = Math.min(repository.size / 1024, 10); // Cap at 10MB equivalent
    const popularityMultiplier = Math.min(1 + (repository.stargazers_count / 10000), 2); // Popular repos are more complex
    
    const baseTokens = Math.ceil(
      repository.size * 
      this.BASE_TOKENS_PER_KB * 
      languageMultiplier * 
      sizeMultiplier * 
      popularityMultiplier
    );

    const breakdown = {
      repositoryProcessing: baseTokens,
      architectureAnalysis: 0,
      businessLogicExtraction: 0,
      knowledgeGraph: 0,
      documentation: 0,
      securityScan: 0,
      aiOptimization: 0
    };

    let analysisTokens = 0;

    if (config.enableAIAnalysis) {
      if (config.analyzeArchitecture) {
        const tokens = Math.ceil(baseTokens * this.ANALYSIS_MULTIPLIERS.architecture);
        breakdown.architectureAnalysis = tokens;
        analysisTokens += tokens;
      }

      if (config.extractBusinessLogic) {
        const tokens = Math.ceil(baseTokens * this.ANALYSIS_MULTIPLIERS.businessLogic);
        breakdown.businessLogicExtraction = tokens;
        analysisTokens += tokens;
      }

      if (config.buildKnowledgeGraph) {
        const tokens = Math.ceil(baseTokens * this.ANALYSIS_MULTIPLIERS.knowledgeGraph);
        breakdown.knowledgeGraph = tokens;
        analysisTokens += tokens;
      }

      if (config.generateDocumentation) {
        const tokens = Math.ceil(baseTokens * this.ANALYSIS_MULTIPLIERS.documentation);
        breakdown.documentation = tokens;
        analysisTokens += tokens;
      }

      if (config.scanSecurity) {
        const tokens = Math.ceil(baseTokens * this.ANALYSIS_MULTIPLIERS.security);
        breakdown.securityScan = tokens;
        analysisTokens += tokens;
      }

      if (config.optimizeForAI) {
        const tokens = Math.ceil(baseTokens * this.ANALYSIS_MULTIPLIERS.aiOptimization);
        breakdown.aiOptimization = tokens;
        analysisTokens += tokens;
      }
    }

    const totalTokens = baseTokens + analysisTokens;
    const estimatedCost = (totalTokens / 1000) * this.TOKEN_COST_PER_1K;

    return {
      baseTokens,
      analysisTokens,
      totalTokens,
      breakdown,
      estimatedCost
    };
  }

  static formatTokenEstimate(estimate: TokenEstimate): string {
    const parts = [];
    
    parts.push(`Base Processing: ${estimate.baseTokens.toLocaleString()} tokens`);
    
    if (estimate.breakdown.architectureAnalysis > 0) {
      parts.push(`Architecture Analysis: ${estimate.breakdown.architectureAnalysis.toLocaleString()} tokens`);
    }
    
    if (estimate.breakdown.businessLogicExtraction > 0) {
      parts.push(`Business Logic: ${estimate.breakdown.businessLogicExtraction.toLocaleString()} tokens`);
    }
    
    if (estimate.breakdown.knowledgeGraph > 0) {
      parts.push(`Knowledge Graph: ${estimate.breakdown.knowledgeGraph.toLocaleString()} tokens`);
    }
    
    if (estimate.breakdown.documentation > 0) {
      parts.push(`Documentation: ${estimate.breakdown.documentation.toLocaleString()} tokens`);
    }
    
    if (estimate.breakdown.securityScan > 0) {
      parts.push(`Security Scan: ${estimate.breakdown.securityScan.toLocaleString()} tokens`);
    }
    
    if (estimate.breakdown.aiOptimization > 0) {
      parts.push(`AI Optimization: ${estimate.breakdown.aiOptimization.toLocaleString()} tokens`);
    }

    return parts.join('\n');
  }

  static getEstimateLevel(totalTokens: number): 'low' | 'medium' | 'high' | 'very-high' {
    if (totalTokens < 10000) return 'low';
    if (totalTokens < 50000) return 'medium';
    if (totalTokens < 200000) return 'high';
    return 'very-high';
  }

  static getEstimateColor(level: string): string {
    switch (level) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-orange-500';
      case 'very-high': return 'text-red-500';
      default: return 'text-gray-500';
    }
  }
} 