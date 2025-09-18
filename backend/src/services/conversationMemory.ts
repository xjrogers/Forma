interface ConversationContext {
  conversationId: string;
  userId: string;
  projectId: string | null;
  decisions: Array<{
    timestamp: Date;
    userMessage: string;
    aiResponse: string;
    actions: any[];
    context: string;
    outcome: 'success' | 'error' | 'partial';
  }>;
  learnings: Array<{
    pattern: string;
    confidence: number;
    examples: string[];
    lastSeen: Date;
  }>;
  preferences: {
    codeStyle: any;
    frameworkPreferences: string[];
    commonPatterns: string[];
    avoidedPatterns: string[];
  };
  projectKnowledge: {
    architecture: string;
    keyFiles: string[];
    commonWorkflows: string[];
    problemAreas: string[];
  };
  successfulResponses?: Array<{
    userMessage: string;
    aiResponse: string;
    actions: any[];
    timestamp: Date;
  }>;
}

interface IncrementalUpdate {
  type: 'file_change' | 'new_decision' | 'pattern_learned' | 'preference_updated';
  data: any;
  confidence: number;
  timestamp: Date;
}

export class ConversationMemoryEngine {
  private static instance: ConversationMemoryEngine;
  private memoryCache: Map<string, ConversationContext> = new Map();
  // @ts-ignore - TODO: Implement incremental updates feature
  private recentUpdates: Map<string, IncrementalUpdate[]> = new Map(); // TODO: Implement incremental updates

  static getInstance(): ConversationMemoryEngine {
    if (!ConversationMemoryEngine.instance) {
      ConversationMemoryEngine.instance = new ConversationMemoryEngine();
    }
    return ConversationMemoryEngine.instance;
  }

  /**
   * Load or create conversation context with incremental intelligence
   */
  async loadConversationContext(
    conversationId: string,
    userId: string,
    projectId: string | null
  ): Promise<ConversationContext> {
    console.log('🧠 Loading conversation context with memory...');

    // Check cache first
    if (this.memoryCache.has(conversationId)) {
      return this.memoryCache.get(conversationId)!;
    }

    // Load from database
    const context = await this.loadFromDatabase(conversationId, userId, projectId);
    
    // Cache for performance
    this.memoryCache.set(conversationId, context);
    
    return context;
  }

  /**
   * Update conversation context with new learning (Cursor-style incremental intelligence)
   */
  async updateConversationContext(
    conversationId: string,
    userMessage: string,
    aiResponse: string,
    actions: any[],
    outcome: 'success' | 'error' | 'partial',
    context: string
  ): Promise<void> {
    console.log('📚 Updating conversation context with new learning...');

    const conversationContext = this.memoryCache.get(conversationId);
    if (!conversationContext) return;

    // Add new decision
    conversationContext.decisions.push({
      timestamp: new Date(),
      userMessage,
      aiResponse,
      actions,
      context,
      outcome
    });

    // Extract and learn patterns
    await this.extractPatterns(conversationContext, userMessage, aiResponse, actions, outcome);
    
    // Update preferences based on user feedback
    await this.updatePreferences(conversationContext, userMessage, actions, outcome);
    
    // Update project knowledge
    await this.updateProjectKnowledge(conversationContext, actions, outcome);

    // Save to database (async)
    this.saveToDatabase(conversationContext);
  }

  /**
   * Generate context-aware suggestions based on conversation history
   */
  async generateContextAwareSuggestions(
    conversationId: string,
    currentMessage: string,
    projectContext: any
  ): Promise<Array<{
    type: 'continuation' | 'improvement' | 'alternative' | 'next_step';
    suggestion: string;
    confidence: number;
    reasoning: string;
  }>> {
    console.log('💡 Generating context-aware suggestions...');

    const context = this.memoryCache.get(conversationId);
    if (!context) return [];

    const suggestions = [];

    // Analyze conversation patterns
    const patterns = this.analyzeConversationPatterns(context, currentMessage);
    suggestions.push(...patterns);

    // Suggest continuations based on previous decisions
    const continuations = this.suggestContinuations(context, currentMessage);
    suggestions.push(...continuations);

    // Suggest improvements based on past errors
    const improvements = this.suggestImprovements(context, currentMessage);
    suggestions.push(...improvements);

    // Suggest next steps based on project knowledge
    const nextSteps = this.suggestNextSteps(context, currentMessage, projectContext);
    suggestions.push(...nextSteps);

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get incremental context (only what's changed since last interaction)
   */
  async getIncrementalContext(
    conversationId: string,
    lastUpdateTime?: Date
  ): Promise<{
    newDecisions: any[];
    newLearnings: any[];
    changedPreferences: any;
    contextSummary: string;
  }> {
    const context = this.memoryCache.get(conversationId);
    if (!context) {
      return {
        newDecisions: [],
        newLearnings: [],
        changedPreferences: {},
        contextSummary: 'No conversation context available'
      };
    }

    const cutoffTime = lastUpdateTime || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    const newDecisions = context.decisions.filter(d => d.timestamp > cutoffTime);
    const newLearnings = context.learnings.filter(l => l.lastSeen > cutoffTime);

    const contextSummary = this.generateContextSummary(context, newDecisions, newLearnings);

    return {
      newDecisions,
      newLearnings,
      changedPreferences: context.preferences,
      contextSummary
    };
  }

  /**
   * Analyze user patterns and preferences (Cursor-style learning)
   */
  private async extractPatterns(
    context: ConversationContext,
    userMessage: string,
    aiResponse: string,
    actions: any[],
    outcome: 'success' | 'error' | 'partial'
  ): Promise<void> {
    // Extract successful patterns
    if (outcome === 'success') {
      const patterns = this.identifySuccessPatterns(userMessage, actions);
      
      for (const pattern of patterns) {
        const existing = context.learnings.find(l => l.pattern === pattern.pattern);
        
        if (existing) {
          existing.confidence = Math.min(1.0, existing.confidence + 0.1);
          existing.examples.push(userMessage);
          existing.lastSeen = new Date();
        } else {
          context.learnings.push({
            pattern: pattern.pattern,
            confidence: 0.6,
            examples: [userMessage],
            lastSeen: new Date()
          });
        }
      }
      
      // Store successful AI response patterns for future reference
      context.successfulResponses = context.successfulResponses || [];
      context.successfulResponses.push({
        userMessage,
        aiResponse,
        actions,
        timestamp: new Date()
      });
      
      // Keep only last 50 successful responses to prevent memory bloat
      if (context.successfulResponses.length > 50) {
        context.successfulResponses = context.successfulResponses.slice(-50);
      }
    }

    // Learn from errors
    if (outcome === 'error') {
      const errorPatterns = this.identifyErrorPatterns(userMessage, actions);
      
      for (const pattern of errorPatterns) {
        context.preferences.avoidedPatterns.push(pattern);
      }
    }
  }

  /**
   * Update user preferences based on interaction patterns
   */
  private async updatePreferences(
    context: ConversationContext,
    userMessage: string,
    actions: any[],
    outcome: 'success' | 'error' | 'partial'
  ): Promise<void> {
    if (outcome !== 'success') return;

    // Detect framework preferences
    const frameworks = this.detectFrameworkUsage(actions);
    for (const framework of frameworks) {
      if (!context.preferences.frameworkPreferences.includes(framework)) {
        context.preferences.frameworkPreferences.push(framework);
      }
    }

    // Detect common patterns
    const patterns = this.detectCommonPatterns(userMessage, actions);
    for (const pattern of patterns) {
      if (!context.preferences.commonPatterns.includes(pattern)) {
        context.preferences.commonPatterns.push(pattern);
      }
    }
  }

  /**
   * Update project-specific knowledge
   */
  private async updateProjectKnowledge(
    context: ConversationContext,
    actions: any[],
    outcome: 'success' | 'error' | 'partial'
  ): Promise<void> {
    // Update key files based on frequently modified files
    const modifiedFiles = actions
      .filter(a => a.type === 'modify_file' || a.type === 'create_file')
      .map(a => a.path);

    for (const file of modifiedFiles) {
      if (!context.projectKnowledge.keyFiles.includes(file)) {
        context.projectKnowledge.keyFiles.push(file);
      }
    }

    // Track problem areas
    if (outcome === 'error') {
      const problemFiles = actions.map(a => a.path).filter(Boolean);
      for (const file of problemFiles) {
        if (!context.projectKnowledge.problemAreas.includes(file)) {
          context.projectKnowledge.problemAreas.push(file);
        }
      }
    }

    // Update common workflows
    if (outcome === 'success' && actions.length > 1) {
      const workflow = actions.map(a => a.type).join(' → ');
      if (!context.projectKnowledge.commonWorkflows.includes(workflow)) {
        context.projectKnowledge.commonWorkflows.push(workflow);
      }
    }
  }

  /**
   * Analyze conversation patterns for suggestions
   */
  private analyzeConversationPatterns(
    context: ConversationContext,
    currentMessage: string
  ): Array<{
    type: 'continuation' | 'improvement' | 'alternative' | 'next_step';
    suggestion: string;
    confidence: number;
    reasoning: string;
  }> {
    const suggestions = [];
    
    // Look for similar past messages
    const similarDecisions = context.decisions.filter(d => 
      this.calculateSimilarity(d.userMessage, currentMessage) > 0.7
    );

    for (const decision of similarDecisions.slice(0, 3)) {
      if (decision.outcome === 'success') {
        suggestions.push({
          type: 'continuation' as const,
          suggestion: `Based on previous success, consider: ${decision.actions.map(a => a.type).join(', ')}`,
          confidence: 0.8,
          reasoning: `Similar request succeeded before with these actions`
        });
      }
    }

    return suggestions;
  }

  /**
   * Suggest continuations based on conversation flow
   */
  private suggestContinuations(
    context: ConversationContext,
    currentMessage: string
  ): Array<{
    type: 'continuation';
    suggestion: string;
    confidence: number;
    reasoning: string;
  }> {
    const suggestions = [];
    
    // Look at recent successful workflows that are similar to current message
    const recentSuccesses = context.decisions
      .filter(d => d.outcome === 'success' && 
        this.calculateSimilarity(d.userMessage, currentMessage) > 0.5)
      .slice(-5);

    for (const success of recentSuccesses) {
      const workflow = success.actions.map(a => a.type);
      if (workflow.length > 1) {
        suggestions.push({
          type: 'continuation' as const,
          suggestion: `Continue with workflow: ${workflow.join(' → ')}`,
          confidence: 0.7,
          reasoning: 'This workflow was successful recently'
        });
      }
    }

    return suggestions;
  }

  /**
   * Suggest improvements based on past errors
   */
  private suggestImprovements(
    context: ConversationContext,
    currentMessage: string
  ): Array<{
    type: 'improvement';
    suggestion: string;
    confidence: number;
    reasoning: string;
  }> {
    const suggestions = [];
    
    // Look for patterns that led to errors, especially those similar to current message
    const errorPatterns = context.preferences.avoidedPatterns;
    
    for (const pattern of errorPatterns.slice(0, 3)) {
      // Check if current message might trigger this pattern
      const similarity = this.calculateSimilarity(currentMessage.toLowerCase(), pattern.toLowerCase());
      if (similarity > 0.3) {
        suggestions.push({
          type: 'improvement' as const,
          suggestion: `Avoid pattern: ${pattern} (detected similarity: ${Math.round(similarity * 100)}%)`,
          confidence: 0.6 + (similarity * 0.3),
          reasoning: 'This pattern caused errors in the past and current message shows similarity'
        });
      }
    }

    return suggestions;
  }

  /**
   * Suggest next steps based on project knowledge
   */
  private suggestNextSteps(
    context: ConversationContext,
    currentMessage: string,
    projectContext: any
  ): Array<{
    type: 'next_step';
    suggestion: string;
    confidence: number;
    reasoning: string;
  }> {
    const suggestions = [];
    
    // Suggest based on common workflows, considering current message and project context
    for (const workflow of context.projectKnowledge.commonWorkflows.slice(0, 3)) {
      const relevance = this.calculateSimilarity(currentMessage, workflow);
      const contextRelevance = projectContext?.currentTask ? 
        this.calculateSimilarity(projectContext.currentTask, workflow) : 0;
      
      suggestions.push({
        type: 'next_step' as const,
        suggestion: `Consider workflow: ${workflow}${projectContext?.currentTask ? ` (related to: ${projectContext.currentTask})` : ''}`,
        confidence: 0.5 + (relevance * 0.3) + (contextRelevance * 0.2),
        reasoning: 'This is a common workflow in this project'
      });
    }

    return suggestions;
  }

  /**
   * Helper methods
   */
  private async loadFromDatabase(
    conversationId: string,
    userId: string,
    projectId: string | null
  ): Promise<ConversationContext> {
    // Load conversation context from database
    // For now, return default context
    return {
      conversationId,
      userId,
      projectId,
      decisions: [],
      learnings: [],
      preferences: {
        codeStyle: {},
        frameworkPreferences: [],
        commonPatterns: [],
        avoidedPatterns: []
      },
      projectKnowledge: {
        architecture: 'unknown',
        keyFiles: [],
        commonWorkflows: [],
        problemAreas: []
      }
    };
  }

  private async saveToDatabase(context: ConversationContext): Promise<void> {
    // Save conversation context to database
    // Implementation would depend on database schema
    console.log(`💾 Saving conversation context to database for user ${context.userId}, project ${context.projectId}...`);
    console.log(`Context includes ${context.decisions.length} decisions, ${context.learnings.length} learnings`);
    // TODO: Implement actual database persistence when conversation_memory table is added
  }

  private generateContextSummary(
    context: ConversationContext,
    newDecisions: any[],
    newLearnings: any[]
  ): string {
    return `
CONVERSATION MEMORY (Incremental Intelligence):
- Total Decisions: ${context.decisions.length} (${newDecisions.length} new)
- Learned Patterns: ${context.learnings.length} (${newLearnings.length} new)
- Framework Preferences: ${context.preferences.frameworkPreferences.join(', ')}
- Key Project Files: ${context.projectKnowledge.keyFiles.slice(0, 5).join(', ')}
- Common Workflows: ${context.projectKnowledge.commonWorkflows.slice(0, 3).join('; ')}
`;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple similarity calculation (could be improved with better algorithms)
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = Array.from(new Set([...words1, ...words2]));
    
    return intersection.length / union.length;
  }

  private identifySuccessPatterns(userMessage: string, actions: any[]): Array<{ pattern: string }> {
    const patterns = [];
    
    // Identify patterns in successful interactions
    if (actions.length > 0) {
      const actionTypes = actions.map(a => a.type);
      patterns.push({ pattern: `action_sequence:${actionTypes.join(',')}` });
    }
    
    // Identify message patterns
    const messageWords = userMessage.toLowerCase().split(/\s+/);
    if (messageWords.length > 2) {
      patterns.push({ pattern: `message_pattern:${messageWords.slice(0, 3).join(' ')}` });
    }
    
    return patterns;
  }

  private identifyErrorPatterns(userMessage: string, actions: any[]): string[] {
    const patterns = [];
    
    // Identify patterns that led to errors based on user message content
    const messageLower = userMessage.toLowerCase();
    
    // Check for common error-prone patterns in user messages
    if (messageLower.includes('delete') || messageLower.includes('remove')) {
      patterns.push('destructive_operation');
    }
    
    if (messageLower.includes('all') || messageLower.includes('everything')) {
      patterns.push('broad_scope_request');
    }
    
    // Identify patterns from failed actions
    if (actions.length > 0) {
      patterns.push(`error_action:${actions[0].type}`);
    }
    
    return patterns;
  }

  private detectFrameworkUsage(actions: any[]): string[] {
    const frameworks = [];
    
    for (const action of actions) {
      if (action.content) {
        if (action.content.includes('React')) frameworks.push('React');
        if (action.content.includes('Vue')) frameworks.push('Vue');
        if (action.content.includes('Angular')) frameworks.push('Angular');
        if (action.content.includes('Tailwind')) frameworks.push('TailwindCSS');
      }
    }
    
    return Array.from(new Set(frameworks));
  }

  private detectCommonPatterns(userMessage: string, actions: any[]): string[] {
    const patterns = [];
    
    // Detect common request patterns from user message
    if (userMessage.toLowerCase().includes('create component')) {
      patterns.push('component_creation');
    }
    
    if (userMessage.toLowerCase().includes('fix bug')) {
      patterns.push('bug_fixing');
    }
    
    if (userMessage.toLowerCase().includes('add feature')) {
      patterns.push('feature_addition');
    }
    
    // Detect patterns from actions taken
    for (const action of actions) {
      if (action.type === 'file_create') {
        patterns.push('file_creation_workflow');
      }
      if (action.type === 'code_edit') {
        patterns.push('code_modification_workflow');
      }
      if (action.type === 'dependency_install') {
        patterns.push('dependency_management_workflow');
      }
    }
    
    return patterns;
  }
} 