import { getWebSocketClient, WSMessage, WSResponse, ActiveRequest } from './websocket';

export type ConnectionType = 'websocket' | 'sse' | 'disconnected';

export interface SmartAIClientOptions {
  projectId?: string;
  activeFile?: string;
  selectedCode?: string;
  model?: string;
  mode?: 'coding' | 'conversation';
  approvedActions?: string[];
  rejectedActions?: string[];
}

export interface AIResponse {
  type: string;
  requestId: string;
  message?: string;
  content?: string;
  data?: any;
  canRetry?: boolean;
  suggestions?: string[];
  errorContext?: string;
  stats?: any;
  // WebSocket-specific
  action?: string;
  details?: any;
  timestamp?: number;
  // File operations
  file?: {
    id: string;
    path: string;
    content: string;
    contentType: string;
    size: number;
  };
}

type EventHandler = (response: AIResponse) => void;
type ConnectionHandler = (type: ConnectionType) => void;
type ErrorHandler = (error: any) => void;

export class SmartAIClient {
  private wsClient?: any;
  private connectionType: ConnectionType = 'disconnected';
  private isConnecting = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;

  // Event handlers
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private connectionHandlers: ConnectionHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];

  // Feature capabilities
  private capabilities = {
    cancel: false,
    modify: false,
    pause: false,
    resume: false,
    multiRequest: false,
    permissions: false,
    internalActions: false
  };

  constructor() {
    console.log('🤖 SmartAIClient initialized');
  }

  // Connection management
  public async connect(): Promise<ConnectionType> {
    if (this.isConnecting) {
      return this.connectionType;
    }

    this.isConnecting = true;
    this.connectionAttempts++;

    try {
      await this.connectWebSocket();
      
      this.connectionType = 'websocket';
      this.updateCapabilities('websocket');
      this.notifyConnectionHandlers();
      
      return this.connectionType;
      
    } catch (wsError) {
      console.warn('⚠️ WebSocket failed, trying SSE fallback:', wsError);
      
      try {
        // Fall back to SSE (basic streaming)
        await this.connectSSE();
        
        this.connectionType = 'sse';
        this.updateCapabilities('sse');
        
        console.log('✅ Connected via SSE (basic features)');
        this.notifyConnectionHandlers();
        
        return this.connectionType;
        
      } catch (sseError) {
        console.error('❌ Both WebSocket and SSE failed:', sseError);
        
        this.connectionType = 'disconnected';
        this.updateCapabilities('disconnected');
        
        this.notifyErrorHandlers(new Error('All connection methods failed'));
        
        return this.connectionType;
      }
    } finally {
      this.isConnecting = false;
    }
  }

  private async connectWebSocket(): Promise<void> {
    this.wsClient = getWebSocketClient();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      this.wsClient.onConnection(() => {
        clearTimeout(timeout);
        
        // Set up WebSocket event forwarding
        this.wsClient.on('*', (response: WSResponse) => {
          console.log(`🔗 WebSocket -> SmartAIClient:`, response.type, response.requestId);
          this.forwardEvent(this.convertWSResponse(response));
        });
        
        resolve();
      });

      this.wsClient.onError((error: any) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.wsClient.connect().catch(reject);
    });
  }

  private async connectSSE(): Promise<void> {
    // SSE doesn't need persistent connection setup
    // We'll handle it per-request
    return Promise.resolve();
  }

  private updateCapabilities(type: ConnectionType): void {
    switch (type) {
      case 'websocket':
        this.capabilities = {
          cancel: true,
          modify: true,
          pause: true,
          resume: true,
          multiRequest: true,
          permissions: true,
          internalActions: true
        };
        break;
      case 'sse':
        this.capabilities = {
          cancel: false,
          modify: false,
          pause: false,
          resume: false,
          multiRequest: false,
          permissions: true, // SSE supports permissions
          internalActions: true // SSE supports internal actions
        };
        break;
      case 'disconnected':
        this.capabilities = {
          cancel: false,
          modify: false,
          pause: false,
          resume: false,
          multiRequest: false,
          permissions: false,
          internalActions: false
        };
        break;
    }
  }

  // Unified API methods
  public async generateCode(requestId: string, message: string, options: SmartAIClientOptions = {}): Promise<void> {
    if (this.connectionType === 'disconnected') {
      await this.connect();
    }

    if (this.connectionType === 'websocket') {
      return this.generateViaWebSocket(requestId, message, options);
    } else if (this.connectionType === 'sse') {
      return this.generateViaSSE(requestId, message, options);
    } else {
      throw new Error('No connection available');
    }
  }

  private async generateViaWebSocket(requestId: string, message: string, options: SmartAIClientOptions): Promise<void> {
    this.wsClient.generateCode(requestId, message, {
      projectId: options.projectId,
      activeFile: options.activeFile,
      selectedCode: options.selectedCode,
      model: options.model || 'claude-4-sonnet-20250514',
      mode: options.mode || 'coding',
      approvedActions: options.approvedActions || [],
      rejectedActions: options.rejectedActions || []
    });
  }

  private async generateViaSSE(requestId: string, message: string, options: SmartAIClientOptions): Promise<void> {
    try {
      const response = await fetch('/api/builder/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          projectId: options.projectId || null,
          activeFile: options.activeFile || null,
          selectedCode: options.selectedCode || null,
          model: options.model || 'claude-4-sonnet-20250514',
          mode: options.mode || 'coding',
          approvedActions: options.approvedActions || [],
          rejectedActions: options.rejectedActions || []
        })
      });

      if (!response.ok) {
        throw new Error(`SSE request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      // Process SSE stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataContent = line.slice(6);
            if (dataContent === '[DONE]') continue;

            try {
              const data = JSON.parse(dataContent);
              this.forwardEvent(this.convertSSEResponse(data, requestId));
            } catch (error) {
              console.error('Error parsing SSE data:', error);
            }
          }
        }
      }
    } catch (error) {
      this.notifyErrorHandlers(error);
      throw error;
    }
  }

  // Advanced features (WebSocket only)
  public cancelRequest(requestId: string): void {
    if (!this.capabilities.cancel) {
      throw new Error('Cancel not supported with current connection');
    }
    this.wsClient.cancelRequest(requestId);
  }

  public modifyRequest(requestId: string, modification: string): void {
    if (!this.capabilities.modify) {
      throw new Error('Modify not supported with current connection');
    }
    this.wsClient.modifyRequest(requestId, modification);
  }

  public pauseRequest(requestId: string): void {
    if (!this.capabilities.pause) {
      throw new Error('Pause not supported with current connection');
    }
    this.wsClient.pauseRequest(requestId);
  }

  public resumeRequest(requestId: string): void {
    if (!this.capabilities.resume) {
      throw new Error('Resume not supported with current connection');
    }
    this.wsClient.resumeRequest(requestId);
  }

  public approvePermissions(requestId: string, permissions: string[]): void {
    if (!this.capabilities.permissions) {
      throw new Error('Permissions not supported with current connection');
    }
    
    if (this.connectionType === 'websocket') {
      this.wsClient.approvePermissions(requestId, permissions);
    } else {
      // For SSE, we'd need to send a separate request
      // This is a simplified implementation
      console.log('SSE permission approval not fully implemented');
    }
  }

  public rejectPermissions(requestId: string, permissions: string[]): void {
    if (!this.capabilities.permissions) {
      throw new Error('Permissions not supported with current connection');
    }
    
    if (this.connectionType === 'websocket') {
      this.wsClient.rejectPermissions(requestId, permissions);
    } else {
      // For SSE, we'd need to send a separate request
      console.log('SSE permission rejection not fully implemented');
    }
  }

  // Event handling
  public on(eventType: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  public off(eventType: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  public onConnection(handler: ConnectionHandler): void {
    this.connectionHandlers.push(handler);
  }

  public onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  // Status methods
  public getConnectionType(): ConnectionType {
    return this.connectionType;
  }

  public getCapabilities() {
    return { ...this.capabilities };
  }

  public isConnected(): boolean {
    return this.connectionType !== 'disconnected';
  }

  public getActiveRequests(): ActiveRequest[] {
    if (this.connectionType === 'websocket') {
      return this.wsClient.getActiveRequests();
    }
    return []; // SSE doesn't track active requests
  }

  // Helper methods
  private convertWSResponse(wsResponse: WSResponse): AIResponse {
    return {
      type: wsResponse.type,
      requestId: wsResponse.requestId,
      message: wsResponse.message,
      content: wsResponse.content,
      data: wsResponse.data,
      canRetry: wsResponse.canRetry,
      suggestions: wsResponse.suggestions,
      errorContext: wsResponse.errorContext,
      stats: wsResponse.stats,
      action: wsResponse.action,
      details: wsResponse.details,
      timestamp: wsResponse.timestamp
    };
  }

  private convertSSEResponse(sseData: any, requestId: string): AIResponse {
    return {
      type: sseData.type || 'progress',
      requestId: requestId,
      message: sseData.message,
      content: sseData.content,
      data: sseData,
      canRetry: sseData.canRetry,
      suggestions: sseData.suggestions,
      errorContext: sseData.errorContext,
      stats: sseData.stats
    };
  }

  private forwardEvent(response: AIResponse): void {
    console.log(`🔄 SmartAIClient forwardEvent:`, response.type, response.requestId);
    
    // Call specific event handlers
    const handlers = this.eventHandlers.get(response.type) || [];
    console.log(`📋 Specific handlers for ${response.type}:`, handlers.length);
    handlers.forEach(handler => handler(response));

    // Call global handlers
    const globalHandlers = this.eventHandlers.get('*') || [];
    console.log(`🌐 Global handlers:`, globalHandlers.length);
    globalHandlers.forEach(handler => handler(response));
  }

  private notifyConnectionHandlers(): void {
    this.connectionHandlers.forEach(handler => handler(this.connectionType));
  }

  private notifyErrorHandlers(error: any): void {
    this.errorHandlers.forEach(handler => handler(error));
  }

  public disconnect(): void {
    if (this.wsClient) {
      this.wsClient.disconnect();
    }
    this.connectionType = 'disconnected';
    this.updateCapabilities('disconnected');
  }
}

// Singleton instance
let smartAIClient: SmartAIClient | null = null;

export const getSmartAIClient = (): SmartAIClient => {
  if (!smartAIClient) {
    smartAIClient = new SmartAIClient();
  }
  return smartAIClient;
};

export default getSmartAIClient; 