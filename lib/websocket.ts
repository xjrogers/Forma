

export interface WSMessage {
  type: 'generate' | 'modify' | 'cancel' | 'pause' | 'resume' | 'answer' | 'approve' | 'reject' | 'ping';
  requestId: string;
  message?: string;
  projectId?: string;
  activeFile?: string;
  selectedCode?: string;
  model?: string;
  mode?: 'coding' | 'conversation';
  approvedActions?: string[];
  rejectedActions?: string[];
  // Permission handling
  permissionId?: string;
  permissions?: string[];
}

export interface WSResponse {
  type: 'progress' | 'code' | 'complete' | 'error' | 'question' | 'typing_start' | 'typing_stop' | 'request_started' | 'request_cancelled' | 'internal_action' | 'pong' | 'subscription_updated';
  requestId: string;
  message?: string;
  content?: string;
  data?: any;
  canRetry?: boolean;
  suggestions?: string[];
  errorContext?: string;
  stats?: {
    duration: number;
    tokensUsed: number;
    filesProcessed: number;
  };
  // Enhanced data from backend
  permissions?: any[];
  permissionIds?: string[];
  requiresApproval?: boolean;
  tokensUsed?: number;
  tokensLimit?: number;
  remainingTokens?: number;
  estimatedTokens?: number;
  queuePosition?: number;
  stage?: string;
  progress?: number;
  originalType?: string;
  // Internal actions (Cursor-style)
  action?: string;
  details?: any;
  timestamp?: number;
}

export interface ActiveRequest {
  id: string;
  status: 'running' | 'paused' | 'cancelled' | 'completed' | 'awaiting_permission';
  message: string;
  startTime: Date;
  projectId?: string;
  // Enhanced tracking
  estimatedTokens?: number;
  remainingTokens?: number;
  progress?: number;
  stage?: string;
  queuePosition?: number;
  pendingPermissions?: any[];
}

type EventHandler = (response: WSResponse) => void;
type ConnectionHandler = () => void;
type ErrorHandler = (error: Event) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private isManuallyDisconnected = false;

  // Event handlers
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private connectionHandlers: ConnectionHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];

  // Request tracking
  private activeRequests: Map<string, ActiveRequest> = new Map();
  private pendingRequests: WSMessage[] = [];

  constructor() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NODE_ENV === 'production' 
      ? window.location.host 
      : 'localhost:3001';
    this.url = `${protocol}//${host}/ws/ai-agent`;
  }

  // Connection management
  public async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    this.isManuallyDisconnected = false;

    try {
      // Get authentication token from API endpoint (since accessToken is HTTP-only)
      const tokenResponse = await fetch('/api/auth/ws-token', {
        credentials: 'include' // Include HTTP-only cookies
      });
      
      if (!tokenResponse.ok) {
        throw new Error('Failed to get WebSocket authentication token');
      }
      
      const { token } = await tokenResponse.json();
      this.token = token;

      // Create WebSocket connection with token
      const wsUrl = `${this.url}?token=${encodeURIComponent(this.token || '')}`;
      console.log('🔌 Connecting to WebSocket:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      // Set up event handlers
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Send any pending requests
        this.processPendingRequests();
        
        // Notify connection handlers
        this.connectionHandlers.forEach(handler => handler());
      };

      this.ws.onmessage = (event) => {
        console.log('📨 Frontend received WebSocket message:', event.data);
        try {
          const response: WSResponse = JSON.parse(event.data);
          console.log('📨 Frontend parsed message:', response.type, response.requestId);
          
          // Update request status
          this.updateRequestStatus(response);
          
          // Call event handlers
          const handlers = this.eventHandlers.get(response.type) || [];
          handlers.forEach(handler => handler(response));
          
          // Call global handlers
          const globalHandlers = this.eventHandlers.get('*') || [];
          globalHandlers.forEach(handler => handler(response));
          
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        
        if (!this.isManuallyDisconnected && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnecting = false;
        
        // Notify error handlers
        this.errorHandlers.forEach(handler => handler(error));
      };

    } catch (error) {
      console.error('❌ Failed to connect WebSocket:', error);
      this.isConnecting = false;
      throw error;
    }
  }

  public disconnect(): void {
    this.isManuallyDisconnected = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.isManuallyDisconnected) {
        this.connect().catch(error => {
          console.error('❌ Reconnect failed:', error);
        });
      }
    }, delay);
  }

  // Message sending
  public send(message: WSMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('📤 Sending WebSocket message:', message.type, message.requestId);
      this.ws.send(JSON.stringify(message));
      
      // Track request if it's a generate request
      if (message.type === 'generate') {
        this.activeRequests.set(message.requestId, {
          id: message.requestId,
          status: 'running',
          message: message.message || '',
          startTime: new Date(),
          projectId: message.projectId
        });
      }
    } else {
      // Queue message for when connection is ready
      console.log('📋 Queueing message for later:', message.type, message.requestId);
      this.pendingRequests.push(message);
      
      // Try to connect if not connected
      if (!this.isConnecting) {
        this.connect().catch(error => {
          console.error('❌ Failed to connect for queued message:', error);
        });
      }
    }
  }

  private processPendingRequests(): void {
    if (this.pendingRequests.length > 0) {
      console.log(`📤 Processing ${this.pendingRequests.length} pending requests`);
      
      const requests = [...this.pendingRequests];
      this.pendingRequests = [];
      
      requests.forEach(request => this.send(request));
    }
  }

  private updateRequestStatus(response: WSResponse): void {
    const request = this.activeRequests.get(response.requestId);
    if (!request) return;

    // Update enhanced tracking data
    if (response.data) {
      if (response.data.queuePosition !== undefined) request.queuePosition = response.data.queuePosition;
      if (response.data.estimatedTokens !== undefined) request.estimatedTokens = response.data.estimatedTokens;
      if (response.data.remainingTokens !== undefined) request.remainingTokens = response.data.remainingTokens;
      if (response.data.progress !== undefined) request.progress = response.data.progress;
      if (response.data.stage !== undefined) request.stage = response.data.stage;
      if (response.data.permissions !== undefined) request.pendingPermissions = response.data.permissions;
    }

    switch (response.type) {
      case 'request_started':
        request.status = 'running';
        break;
      case 'request_cancelled':
        request.status = 'cancelled';
        this.activeRequests.delete(response.requestId);
        break;
      case 'complete':
        request.status = 'completed';
        this.activeRequests.delete(response.requestId);
        break;
      case 'error':
        request.status = 'cancelled'; // Treat errors as cancelled
        this.activeRequests.delete(response.requestId);
        break;
      case 'question':
        if (response.requiresApproval) {
          request.status = 'awaiting_permission';
        }
        break;
      case 'progress':
        // Update progress without changing status
        if (response.data?.progress !== undefined) request.progress = response.data.progress;
        if (response.data?.stage !== undefined) request.stage = response.data.stage;
        break;
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

  // Convenience methods for common operations
  public generateCode(requestId: string, message: string, options: {
    projectId?: string;
    activeFile?: string;
    selectedCode?: string;
    model?: string;
    mode?: 'coding' | 'conversation';
    approvedActions?: string[];
    rejectedActions?: string[];
  } = {}): void {
    this.send({
      type: 'generate',
      requestId,
      message,
      projectId: options.projectId,
      activeFile: options.activeFile,
      selectedCode: options.selectedCode,
      model: options.model || 'claude-4-sonnet-20250514',
      mode: options.mode || 'coding',
      approvedActions: options.approvedActions || [],
      rejectedActions: options.rejectedActions || []
    });
  }

  public modifyRequest(requestId: string, modification: string): void {
    this.send({
      type: 'modify',
      requestId,
      message: modification
    });
  }

  public cancelRequest(requestId: string): void {
    this.send({
      type: 'cancel',
      requestId
    });
  }

  public pauseRequest(requestId: string): void {
    this.send({
      type: 'pause',
      requestId
    });
  }

  public resumeRequest(requestId: string): void {
    this.send({
      type: 'resume',
      requestId
    });
  }

  public answerQuestion(requestId: string, answer: string): void {
    this.send({
      type: 'answer',
      requestId,
      message: answer
    });
  }

  public ping(requestId: string = 'ping'): void {
    this.send({
      type: 'ping',
      requestId
    });
  }

  public approvePermissions(requestId: string, permissions: string[]): void {
    this.send({
      type: 'approve',
      requestId,
      permissions
    });
  }

  public rejectPermissions(requestId: string, permissions: string[]): void {
    this.send({
      type: 'reject',
      requestId,
      permissions
    });
  }

  // Status methods
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public getActiveRequests(): ActiveRequest[] {
    return Array.from(this.activeRequests.values());
  }

  public getRequest(requestId: string): ActiveRequest | undefined {
    return this.activeRequests.get(requestId);
  }
}

// Singleton instance
let wsClient: WebSocketClient | null = null;

export const getWebSocketClient = (): WebSocketClient => {
  if (!wsClient) {
    wsClient = new WebSocketClient();
  }
  return wsClient;
};

export default getWebSocketClient; 