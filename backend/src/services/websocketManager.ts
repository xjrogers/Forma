import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { AIAgent } from './aiAgent';
import { authenticateTokenWS } from '../middleware/authMiddleware';


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
}

interface ActiveRequest {
  id: string;
  status: 'running' | 'paused' | 'cancelled' | 'completed' | 'awaiting_permission';
  userId: string;
  projectId?: string;
  message: string;
  startTime: Date;
  aiAgent?: AIAgent;
  abortController?: AbortController;
  // SSE compatibility fields
  activeFile?: string;
  selectedCode?: string;
  model?: string;
  mode?: 'coding' | 'conversation';
  // Permission tracking (like SSE)
  approvedActions: string[];
  rejectedActions: string[];
  pendingPermissions?: any[];
}

export class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private wss: WebSocketServer;
  private clients: Map<string, WebSocket> = new Map(); // userId -> WebSocket
  private activeRequests: Map<string, ActiveRequest> = new Map(); // requestId -> Request
  private userRequests: Map<string, Set<string>> = new Map(); // userId -> Set<requestId>

  constructor(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/ai-agent',
      // ✅ Add CORS-like origin verification for WebSocket
      verifyClient: (info: any) => {
        const allowedOrigins = [
          process.env.FRONTEND_URL || 'http://localhost:3000',
          'https://localhost:3000',
          'http://127.0.0.1:3000',
          'https://127.0.0.1:3000'
        ];
        
        const origin = info.origin;
        console.log(`🔍 WebSocket origin check: ${origin}`);
        
        // Allow connections from allowed origins or if no origin (for development)
        if (!origin || allowedOrigins.includes(origin)) {
          return true;
        }
        
        console.warn(`❌ WebSocket connection rejected from origin: ${origin}`);
        return false;
      }
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    console.log('🔌 WebSocket AI Agent server initialized with CORS protection (no queue)');
    
    // Set singleton instance
    WebSocketManager.instance = this;
  }

  // Singleton pattern methods
  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      throw new Error('WebSocketManager not initialized. Call constructor first.');
    }
    return WebSocketManager.instance;
  }

  public static initialize(server: any): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager(server);
    }
    return WebSocketManager.instance;
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage) {
    console.log('🔌 New WebSocket connection attempt');

    try {
      // Extract token from query params or headers
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const token = url.searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        ws.close(1008, 'Authentication required');
        return;
      }

      // Authenticate user
      const user = await authenticateTokenWS(token);
      if (!user) {
        ws.close(1008, 'Invalid authentication');
        return;
      }

      const userId = user.id;
      console.log(`✅ WebSocket authenticated for user: ${userId}`);

      // Store client connection
      this.clients.set(userId, ws);
      if (!this.userRequests.has(userId)) {
        this.userRequests.set(userId, new Set());
      }

      // Send connection confirmation
      this.sendToClient(userId, {
        type: 'complete',
        requestId: 'connection',
        message: 'WebSocket connected successfully'
      });

      // Handle messages
      ws.on('message', (data) => {
        console.log(`📨 Raw WebSocket message received from ${userId}:`, data.toString());
        try {
          const message: WSMessage = JSON.parse(data.toString());
          console.log(`📨 Parsed WebSocket message:`, message);
          this.handleMessage(userId, message);
        } catch (error) {
          console.error('❌ Invalid WebSocket message:', error);
          this.sendToClient(userId, {
            type: 'error',
            requestId: 'parse-error',
            message: 'Invalid message format',
            errorContext: 'Message must be valid JSON'
          });
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        console.log(`🔌 WebSocket disconnected for user: ${userId}`);
        this.handleDisconnection(userId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for user ${userId}:`, error);
        this.handleDisconnection(userId);
      });

    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  private async handleMessage(userId: string, message: WSMessage) {
    console.log(`📨 Received message from ${userId}:`, message.type, message.requestId);

    try {
      switch (message.type) {
        case 'generate':
          await this.handleGenerateRequest(userId, message);
          break;
        
        case 'modify':
          await this.handleModifyRequest(userId, message);
          break;
        
        case 'cancel':
          await this.handleCancelRequest(userId, message);
          break;
        
        case 'pause':
          await this.handlePauseRequest(userId, message);
          break;
        
        case 'resume':
          await this.handleResumeRequest(userId, message);
          break;
        
        case 'answer':
          await this.handleAnswerRequest(userId, message);
          break;
        
        case 'approve':
          await this.handleApproveRequest(userId, message);
          break;
        
        case 'reject':
          await this.handleRejectRequest(userId, message);
          break;
        
        case 'ping':
          this.sendToClient(userId, {
            type: 'pong',
            requestId: message.requestId
          });
          break;
        
        default:
          this.sendToClient(userId, {
            type: 'error',
            requestId: message.requestId,
            message: `Unknown message type: ${(message as any).type}`
          });
      }
    } catch (error) {
      console.error(`❌ Error handling message from ${userId}:`, error);
      this.sendToClient(userId, {
        type: 'error',
        requestId: message.requestId,
        message: 'Internal server error',
        errorContext: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleGenerateRequest(userId: string, message: WSMessage) {
    if (!message.message?.trim()) {
      this.sendToClient(userId, {
        type: 'error',
        requestId: message.requestId,
        message: 'Message content is required'
      });
      return;
    }

    try {
      // 🔐 TOKEN VALIDATION using new TokenService
      const { tokenService } = await import('./tokenService');
      const balance = await tokenService.getTokenBalance(userId);

      console.log(`💰 Token check: ${balance.totalAvailable} total available for user ${userId} (plan: ${balance.plan})`);

      if (balance.totalAvailable <= 0) {
        this.sendToClient(userId, {
          type: 'error',
          requestId: message.requestId,
          message: 'Insufficient tokens',
          errorContext: 'You have exceeded your token limit. Please upgrade your plan or wait for your tokens to reset.',
          data: balance
        });
        return;
      }

      // Estimate tokens needed (rough estimate: ~4 chars per token)
      const estimatedTokens = Math.ceil(message.message.length / 4) + 500; // Add buffer for response
      if (balance.totalAvailable < estimatedTokens) {
        this.sendToClient(userId, {
          type: 'error',
          requestId: message.requestId,
          message: 'Insufficient tokens for request',
          errorContext: `This request may use ~${estimatedTokens} tokens, but you only have ${balance.totalAvailable} remaining.`,
          data: {
            ...balance,
            estimatedTokens: estimatedTokens
          }
        });
        return;
      }

      // Create new request for immediate processing (Cursor-style)
      const request: ActiveRequest = {
        id: message.requestId,
        status: 'running',
        userId,
        projectId: message.projectId,
        message: message.message,
        startTime: new Date(),
        // SSE compatibility fields
        activeFile: message.activeFile,
        selectedCode: message.selectedCode,
        model: message.model,
        mode: message.mode,
        approvedActions: message.approvedActions || [],
        rejectedActions: message.rejectedActions || []
      };

      // Add to tracking
      this.activeRequests.set(message.requestId, request);
      this.userRequests.get(userId)?.add(message.requestId);

      console.log(`🚀 Processing request ${message.requestId} immediately for user ${userId} (${balance.totalAvailable} tokens available)`);
      
      // Send immediate start notification
      this.sendToClient(userId, {
        type: 'request_started',
        requestId: message.requestId,
        message: 'Processing request...',
        data: {
          estimatedTokens: estimatedTokens,
          balance: balance
        }
      });

      // Process immediately (no queue)
      this.processRequest(request);

    } catch (error) {
      console.error(`❌ Error in handleGenerateRequest for ${userId}:`, error);
      this.sendToClient(userId, {
        type: 'error',
        requestId: message.requestId,
        message: 'Failed to process request',
        errorContext: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleModifyRequest(userId: string, message: WSMessage) {
    const request = this.activeRequests.get(message.requestId);
    
    if (!request || request.userId !== userId) {
      this.sendToClient(userId, {
        type: 'error',
        requestId: message.requestId,
        message: 'Request not found or unauthorized'
      });
      return;
    }

    if (request.status === 'running' && request.aiAgent) {
      // Send modification to running AI agent
      console.log(`🔄 Modifying running request ${message.requestId}`);
      
      // For now, we'll queue a new request with the modification
      // In a full implementation, we'd need to modify the AI agent's context
      const modifiedMessage = `${request.message}\n\nMODIFICATION: ${message.message}`;
      
      // Cancel current and start new with modified message
      await this.handleCancelRequest(userId, message);
      
      const newMessage: WSMessage = {
        ...message,
        type: 'generate',
        message: modifiedMessage,
        requestId: `${message.requestId}-modified-${Date.now()}`
      };
      
      await this.handleGenerateRequest(userId, newMessage);
    } else {
      // Modify queued request
      request.message = `${request.message}\n\nMODIFICATION: ${message.message}`;
      
      this.sendToClient(userId, {
        type: 'complete',
        requestId: message.requestId,
        message: 'Request modified successfully'
      });
    }
  }

  private async handleCancelRequest(userId: string, message: WSMessage) {
    const request = this.activeRequests.get(message.requestId);
    
    if (!request || request.userId !== userId) {
      this.sendToClient(userId, {
        type: 'error',
        requestId: message.requestId,
        message: 'Request not found or unauthorized'
      });
      return;
    }

    // Cancel the request
    request.status = 'cancelled';
    
    if (request.abortController) {
      request.abortController.abort();
    }

    // Mark as cancelled (no queue to remove from since we process immediately)

    console.log(`🛑 Cancelled request ${message.requestId} for user ${userId}`);
    
    this.sendToClient(userId, {
      type: 'request_cancelled',
      requestId: message.requestId,
      message: 'Request cancelled successfully'
    });

    // Clean up
    this.activeRequests.delete(message.requestId);
    this.userRequests.get(userId)?.delete(message.requestId);
  }

  private async handlePauseRequest(userId: string, message: WSMessage) {
    const request = this.activeRequests.get(message.requestId);
    
    if (!request || request.userId !== userId) {
      this.sendToClient(userId, {
        type: 'error',
        requestId: message.requestId,
        message: 'Request not found or unauthorized'
      });
      return;
    }

    if (request.status === 'running') {
      request.status = 'paused';
      // In a full implementation, we'd pause the AI generation
      // For now, we'll just mark it as paused
      
      this.sendToClient(userId, {
        type: 'complete',
        requestId: message.requestId,
        message: 'Request paused'
      });
    }
  }

  private async handleResumeRequest(userId: string, message: WSMessage) {
    const request = this.activeRequests.get(message.requestId);
    
    if (!request || request.userId !== userId) {
      this.sendToClient(userId, {
        type: 'error',
        requestId: message.requestId,
        message: 'Request not found or unauthorized'
      });
      return;
    }

    if (request.status === 'paused') {
      request.status = 'running';
      
      this.sendToClient(userId, {
        type: 'request_started',
        requestId: message.requestId,
        message: 'Request resumed and processing'
      });
      
      // Resume processing immediately (no queue)
      this.processRequest(request);
    }
  }

  private async handleAnswerRequest(userId: string, message: WSMessage) {
    const request = this.activeRequests.get(message.requestId);
    
    if (!request || request.userId !== userId) {
      this.sendToClient(userId, {
        type: 'error',
        requestId: message.requestId,
        message: 'Request not found or unauthorized'
      });
      return;
    }

    // In a full implementation, we'd pass this answer to the AI agent
    // For now, we'll just acknowledge it
    console.log(`💬 Received answer for ${message.requestId}: ${message.message}`);
    
    this.sendToClient(userId, {
      type: 'complete',
      requestId: message.requestId,
      message: 'Answer received, continuing generation...'
    });
  }

  private async handleApproveRequest(userId: string, message: WSMessage) {
    const request = this.activeRequests.get(message.requestId);
    
    if (!request || request.userId !== userId) {
      this.sendToClient(userId, {
        type: 'error',
        requestId: message.requestId,
        message: 'Request not found or unauthorized'
      });
      return;
    }

    // Add approved permissions (like SSE implementation)
    if (message.permissions) {
      request.approvedActions.push(...message.permissions);
      console.log(`✅ Approved permissions for ${message.requestId}:`, message.permissions);
    }

    // If request is awaiting permission, resume it
    if (request.status === 'awaiting_permission') {
      request.status = 'running';
      
      this.sendToClient(userId, {
        type: 'request_started',
        requestId: message.requestId,
        message: 'Permissions approved, resuming request...'
      });
      
      // Resume processing immediately (no queue)
      this.processRequest(request);
    } else {
      this.sendToClient(userId, {
        type: 'complete',
        requestId: message.requestId,
        message: 'Permissions approved'
      });
    }
  }

  private async handleRejectRequest(userId: string, message: WSMessage) {
    const request = this.activeRequests.get(message.requestId);
    
    if (!request || request.userId !== userId) {
      this.sendToClient(userId, {
        type: 'error',
        requestId: message.requestId,
        message: 'Request not found or unauthorized'
      });
      return;
    }

    // Add rejected permissions (like SSE implementation)
    if (message.permissions) {
      request.rejectedActions.push(...message.permissions);
      console.log(`❌ Rejected permissions for ${message.requestId}:`, message.permissions);
    }

    // If request is awaiting permission, resume it (it will skip rejected actions)
    if (request.status === 'awaiting_permission') {
      request.status = 'running';
      
      this.sendToClient(userId, {
        type: 'request_started',
        requestId: message.requestId,
        message: 'Permissions processed, resuming request...'
      });
      
      // Resume processing immediately (no queue)
      this.processRequest(request);
    } else {
      this.sendToClient(userId, {
        type: 'complete',
        requestId: message.requestId,
        message: 'Permissions rejected'
      });
    }
  }

  private async processRequest(request: ActiveRequest) {
    console.log(`🚀 Processing request ${request.id} for user ${request.userId}`);

    try {
      // Create AI agent and abort controller
      const aiAgent = new AIAgent();
      const abortController = new AbortController();
      
      request.aiAgent = aiAgent;
      request.abortController = abortController;

      // 🔄 Enhanced streaming callback with ALL SSE features
      const streamCallback = (data: any) => {
        if (request.status === 'cancelled') {
          return; // Don't send data for cancelled requests
        }

        // Map SSE event types to WebSocket response types
        let wsType = data.type;
        let wsMessage = data.message;
        let wsContent = data.content;
        let wsData = data.data;

        // Handle specific SSE event types
        switch (data.type) {
          case 'content_stream':
            wsType = 'code';
            wsContent = data.content;
            break;
          case 'progress_update':
            wsType = 'progress';
            wsMessage = data.message;
            wsData = {
              stage: data.stage,
              progress: data.progress
            };
            break;
          case 'progress':
            // Handle basic progress events (like "Creating file...")
            wsType = 'progress';
            wsMessage = data.message;
            wsData = {
              stage: 'processing',
              progress: undefined
            };
            break;
          case 'typing_start':
            // AI thinking indicators (like Cursor)
            wsType = 'typing_start';
            wsMessage = 'AI is thinking...';
            wsData = {
              stage: 'thinking'
            };
            break;
          case 'typing_stop':
            // Stop thinking indicators
            wsType = 'typing_stop';
            wsMessage = 'AI ready';
            wsData = {
              stage: 'ready'
            };
            break;
          case 'file_created':
            // Enhanced file creation handling
            wsType = 'progress';
            wsMessage = `Created ${data.file?.path || 'file'}`;
            wsData = {
              ...data,
              originalType: data.type,
              stage: 'file_created',
              file: data.file, // Include full file object
              action: data.action // Include action type (create_file/modify_file)
            };
            break;
          case 'file_deleted':
            // Enhanced file deletion handling
            wsType = 'progress';
            wsMessage = `Deleted ${data.path}`;
            wsData = {
              ...data,
              originalType: data.type,
              stage: 'file_deleted',
              path: data.path
            };
            break;
          case 'project_updated':
            // Enhanced project update handling
            wsType = 'progress';
            wsMessage = `Project updated (${data.project?.files?.length || 0} files)`;
            wsData = {
              ...data,
              originalType: data.type,
              stage: 'project_updated',
              project: {
                id: data.project?.id,
                name: data.project?.name,
                fileCount: data.project?.files?.length || 0,
                // Don't send full file contents to avoid large payloads
                files: data.project?.files?.map((f: any) => ({
                  id: f.id,
                  path: f.path,
                  contentType: f.contentType,
                  size: f.size
                })) || []
              }
            };
            break;
          case 'file_diff':
            // Enhanced file diff handling
            wsType = 'progress';
            wsMessage = `Modified ${data.path}`;
            wsData = {
              ...data,
              originalType: data.type,
              stage: 'file_modified',
              diff: data.diff // Include actual diff content
            };
            break;
          case 'git_result':
            // Enhanced git result handling
            wsType = 'progress';
            wsMessage = `Git ${data.action}: ${data.content?.split('\n')[0] || 'completed'}`;
            wsData = {
              ...data,
              originalType: data.type,
              stage: 'git_operation',
              output: data.content // Include git command output
            };
            break;
          case 'complete':
            // Enhanced completion with full stats
            wsType = 'complete';
            wsMessage = data.message || 'Request completed successfully';
            wsData = {
              duration: data.duration,
              stats: data.stats,
              stage: 'complete'
            };
            break;
          case 'permission_request':
            // Handle permission requests (pause processing until approved/rejected)
            request.status = 'awaiting_permission';
            request.pendingPermissions = data.permissions;
            
            wsType = 'question';
            wsMessage = `Permission required: ${data.permissions?.[0]?.message || 'Action needs approval'}`;
            wsData = {
              permissions: data.permissions,
              requiresApproval: true,
              permissionIds: data.permissions?.map((p: any) => p.id) || []
            };
            
            // Don't continue processing until permission is granted
            console.log(`⏸️ Request ${request.id} paused for permission approval`);
            break;
          case 'internal_action':
            // Handle Cursor-style internal AI actions
            wsType = 'internal_action';
            wsMessage = data.details?.message || data.action;
            wsData = {
              action: data.action,
              details: data.details,
              timestamp: data.timestamp
            };
            break;
        }

        this.sendToClient(request.userId, {
          type: wsType,
          requestId: request.id,
          message: wsMessage,
          content: wsContent,
          data: wsData
        });
      };

      // 🚀 Process the AI request with FULL SSE compatibility
      let completionStats = { tokensUsed: 0, filesProcessed: 0 };
      
      // Enhanced streamCallback to capture completion stats
      const enhancedStreamCallback = (data: any) => {
        // Capture completion stats when available
        if (data.type === 'complete' && data.stats) {
          completionStats = {
            tokensUsed: data.stats.tokensUsed || 0,
            filesProcessed: data.stats.filesProcessed || 0
          };
        }
        
        // Call original streamCallback
        streamCallback(data);
      };
      
      await aiAgent.processMessageStreaming(
        request.userId, // Add userId (required by SSE version)
        request.projectId || null,
        request.message,
        {
          activeFile: request.activeFile || null,        // ✅ Support activeFile from WebSocket message
          selectedCode: request.selectedCode || null,    // ✅ Support selectedCode from WebSocket message
          model: request.model || 'claude-4-sonnet-20250514', // ✅ Support dynamic model selection
          mode: request.mode || 'coding',                // ✅ Support dynamic mode selection
          approvedActions: request.approvedActions,      // ✅ Pass approved actions from WebSocket state
          rejectedActions: request.rejectedActions       // ✅ Pass rejected actions from WebSocket state
        },
        enhancedStreamCallback
      );

      // ✅ Send final SSE-compatible complete event (like SSE implementation)
      if (request.status !== 'cancelled') {
        this.sendToClient(request.userId, {
          type: 'complete',
          requestId: request.id,
          message: 'Stream processing complete'
        });
      }

      // Mark as completed with real stats
      if (request.status !== 'cancelled') {
        request.status = 'completed';
        
        const duration = Date.now() - request.startTime.getTime();
        
        this.sendToClient(request.userId, {
          type: 'complete',
          requestId: request.id,
          message: 'Request completed successfully',
          stats: {
            duration,
            tokensUsed: completionStats.tokensUsed, // ✅ Real token usage from AI agent
            filesProcessed: completionStats.filesProcessed // ✅ Real file count from AI agent
          }
        });
      }

    } catch (error) {
      console.error(`❌ Error processing request ${request.id}:`, error);
      
      if (request.status !== 'cancelled') {
        this.sendToClient(request.userId, {
          type: 'error',
          requestId: request.id,
          message: 'Request failed',
          errorContext: error instanceof Error ? error.message : 'Unknown error',
          canRetry: true
        });
      }
    } finally {
      // Clean up
      this.activeRequests.delete(request.id);
      this.userRequests.get(request.userId)?.delete(request.id);
    }
  }

  private handleDisconnection(userId: string) {
    // Cancel all active requests for this user
    const userRequestIds = this.userRequests.get(userId);
    if (userRequestIds) {
      for (const requestId of Array.from(userRequestIds)) {
        const request = this.activeRequests.get(requestId);
        if (request) {
          request.status = 'cancelled';
          if (request.abortController) {
            request.abortController.abort();
          }
          this.activeRequests.delete(requestId);
        }
      }
      this.userRequests.delete(userId);
    }

    // No queue to clean up (immediate processing)

    // Remove client
    this.clients.delete(userId);
    
    console.log(`🔌 Cleaned up WebSocket resources for user: ${userId}`);
  }

  private sendToClient(userId: string, message: WSResponse) {
    const client = this.clients.get(userId);
    console.log(`📤 Attempting to send ${message.type} to ${userId}, client exists: ${!!client}, ready: ${client?.readyState === WebSocket.OPEN}`);
    if (client && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
        console.log(`✅ Sent ${message.type} message to ${userId}`);
      } catch (error) {
        console.error(`❌ Error sending message to ${userId}:`, error);
        this.handleDisconnection(userId);
      }
    } else {
      console.warn(`⚠️ Cannot send ${message.type} to ${userId}: client not ready`);
    }
  }

  // Public methods for external use
  public getActiveRequests(userId: string): ActiveRequest[] {
    const userRequestIds = this.userRequests.get(userId) || new Set();
    return Array.from(userRequestIds)
      .map(id => this.activeRequests.get(id))
      .filter(Boolean) as ActiveRequest[];
  }

  public getActiveRequestsCount(): number {
    return this.activeRequests.size;
  }

  // Broadcast subscription updates to a specific user
  public broadcastSubscriptionUpdate(userId: string, subscriptionData: any) {
    console.log(`📢 Broadcasting subscription update to user ${userId}:`, subscriptionData);
    this.sendToClient(userId, {
      type: 'subscription_updated',
      requestId: `subscription_${Date.now()}`,
      data: subscriptionData
    });
  }
} 