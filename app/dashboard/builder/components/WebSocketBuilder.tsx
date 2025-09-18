'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  Play, 
  Square, 
  Pause, 
  RotateCcw, 
  MessageSquare, 
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit3,
  Send,
  ChevronDown,
  ChevronRight,
  Eye,
  Search,
  FileText,
  Zap,
  Brain,
  Palette
} from 'lucide-react';
import { getWebSocketClient, WSResponse, ActiveRequest } from '@/lib/websocket';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'permission' | 'file_operation' | 'progress' | 'internal_action';
  content: string;
  timestamp: Date;
  requestId?: string;
  status?: 'running' | 'paused' | 'cancelled' | 'completed' | 'awaiting_permission';
  isTyping?: boolean;
  progress?: number;
  stage?: string;
  isError?: boolean;
  canRetry?: boolean;
  errorContext?: string;
  suggestions?: string[];
  stats?: {
    duration: number;
    tokensUsed: number;
    filesProcessed: number;
  };
  // Permission handling
  permissions?: any[];
  permissionIds?: string[];
  requiresApproval?: boolean;
  // Token info
  tokensUsed?: number;
  tokensLimit?: number;
  remainingTokens?: number;
  estimatedTokens?: number;
  queuePosition?: number;
  // File operations
  fileData?: any;
  originalType?: string;
  // Internal actions (Cursor-style)
  action?: string;
  actionDetails?: any;
  isCollapsed?: boolean;
}

interface WebSocketBuilderProps {
  project?: any;
  activeFile?: any;
  isCodingMode?: boolean;
}

export default function WebSocketBuilder({ 
  project, 
  activeFile, 
  isCodingMode = true 
}: WebSocketBuilderProps) {
  // WebSocket client
  const wsClient = getWebSocketClient();
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'system',
      content: 'Hi! I\'m Forma with advanced WebSocket capabilities. I can handle multiple requests, modifications, and real-time interactions.',
      timestamp: new Date()
    }
  ]);
  
  const [currentMessage, setCurrentMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [activeRequests, setActiveRequests] = useState<ActiveRequest[]>([]);
  
  // UI state
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [modificationText, setModificationText] = useState('');
  const [showModificationInput, setShowModificationInput] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentRequestId = useRef<string | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        await wsClient.connect();
        setIsConnected(wsClient.isConnected());
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        toast.error('Failed to connect to AI agent');
      }
    };

    initializeWebSocket();

    // Set up event handlers
    wsClient.onConnection(() => {
      setIsConnected(true);
      toast.success('Connected to AI agent');
    });

    wsClient.onError((error) => {
      setIsConnected(false);
      toast.error('WebSocket connection error');
    });

    // Handle all WebSocket responses
    const handleResponse = (response: WSResponse) => {
      console.log('📨 WebSocket response:', response);
      
      switch (response.type) {
        case 'request_started':
          updateMessageStatus(response.requestId, 'running', 'Generating response...');
          updateMessageTokenInfo(response.requestId, response.data);
          break;
          
        case 'typing_start':
          setMessageTyping(response.requestId, true);
          break;
          
        case 'typing_stop':
          setMessageTyping(response.requestId, false);
          break;
          
        case 'progress':
          // Handle different progress types
          if (response.data?.originalType) {
            handleSpecialEvent(response.requestId, response.data.originalType, response);
          } else {
            updateMessageProgress(response.requestId, response.message || '', response.data?.progress, response.data?.stage);
          }
          break;
          
        case 'code':
          appendMessageContent(response.requestId, response.content || '');
          break;
          
        case 'complete':
          completeMessage(response.requestId, response.message, response.stats);
          break;
          
        case 'error':
          errorMessage(response.requestId, response.message, response.errorContext, response.canRetry, response.suggestions);
          break;
          
        case 'question':
          if (response.requiresApproval) {
            // Permission request - show permission dialog
            showPermissionRequest(response.requestId, response.message || '', response.data?.permissions || []);
          } else {
            // Regular AI question - show interactive prompt
            showAIQuestion(response.requestId, response.message || '');
          }
          break;
          
        case 'request_cancelled':
          updateMessageStatus(response.requestId, 'cancelled', 'Request cancelled');
          break;
          
        case 'internal_action':
          // Handle Cursor-style internal AI actions
          showInternalAction(response.requestId, response.action || '', response.data?.details || {}, response.message || '');
          break;
      }
      
      // Update active requests
      setActiveRequests(wsClient.getActiveRequests());
    };

    wsClient.on('*', handleResponse);

    // Cleanup on unmount
    return () => {
      wsClient.off('*', handleResponse);
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Message management functions
  const updateMessageStatus = (requestId: string, status: ChatMessage['status'], content?: string) => {
    setMessages(prev => prev.map(msg => 
      msg.requestId === requestId 
        ? { ...msg, status, content: content || msg.content }
        : msg
    ));
  };

  const setMessageTyping = (requestId: string, isTyping: boolean) => {
    setMessages(prev => prev.map(msg => 
      msg.requestId === requestId 
        ? { ...msg, isTyping }
        : msg
    ));
  };

  const updateMessageContent = (requestId: string, content: string) => {
    setMessages(prev => prev.map(msg => 
      msg.requestId === requestId 
        ? { ...msg, content }
        : msg
    ));
  };

  const appendMessageContent = (requestId: string, content: string) => {
    setMessages(prev => prev.map(msg => 
      msg.requestId === requestId 
        ? { ...msg, content: msg.content + content }
        : msg
    ));
  };

  const completeMessage = (requestId: string, finalContent?: string, stats?: any) => {
    setMessages(prev => prev.map(msg => 
      msg.requestId === requestId 
        ? { 
            ...msg, 
            content: finalContent || msg.content,
            status: 'completed',
            isTyping: false,
            stats
          }
        : msg
    ));
    
    if (stats) {
      toast.success(`Request completed in ${(stats.duration / 1000).toFixed(1)}s`);
    }
  };

  const errorMessage = (requestId: string, errorMsg?: string, errorContext?: string, canRetry?: boolean, suggestions?: string[]) => {
    setMessages(prev => prev.map(msg => 
      msg.requestId === requestId 
        ? { 
            ...msg, 
            content: errorMsg || 'An error occurred',
            status: 'cancelled',
            isError: true,
            canRetry,
            errorContext,
            suggestions,
            isTyping: false
          }
        : msg
    ));
  };

  const updateMessageTokenInfo = (requestId: string, data: any) => {
    if (!data) return;
    
    setMessages(prev => prev.map(msg => 
      msg.requestId === requestId 
        ? { 
            ...msg, 
            queuePosition: data.queuePosition,
            estimatedTokens: data.estimatedTokens,
            remainingTokens: data.remainingTokens
          }
        : msg
    ));
  };

  const updateMessageProgress = (requestId: string, message: string, progress?: number, stage?: string) => {
    setMessages(prev => prev.map(msg => 
      msg.requestId === requestId 
        ? { 
            ...msg, 
            content: message || msg.content,
            progress,
            stage
          }
        : msg
    ));
  };

  const handleSpecialEvent = (requestId: string, eventType: string, response: WSResponse) => {
    switch (eventType) {
      case 'file_created':
      case 'file_deleted':
      case 'file_diff':
        // Add file operation message
        const fileMessage: ChatMessage = {
          id: `file-${Date.now()}`,
          type: 'file_operation',
          content: response.message || `File operation: ${eventType}`,
          timestamp: new Date(),
          requestId,
          fileData: response.data,
          originalType: eventType
        };
        setMessages(prev => [...prev, fileMessage]);
        break;
        
      case 'git_result':
        // Add git result message
        const gitMessage: ChatMessage = {
          id: `git-${Date.now()}`,
          type: 'system',
          content: `Git: ${response.content || response.message}`,
          timestamp: new Date(),
          requestId
        };
        setMessages(prev => [...prev, gitMessage]);
        break;
        
      case 'project_updated':
        // Handle project update
        console.log('📁 Project updated:', response.data);
        // TODO: Update project state if needed
        break;
    }
  };

  const showPermissionRequest = (requestId: string, message: string, permissions: any[]) => {
    // Add permission request message
    const permissionMessage: ChatMessage = {
      id: `permission-${Date.now()}`,
      type: 'permission',
      content: message,
      timestamp: new Date(),
      requestId,
      permissions,
      permissionIds: permissions.map(p => p.id),
      requiresApproval: true,
      status: 'awaiting_permission'
    };
    
    setMessages(prev => [...prev, permissionMessage]);
  };

  const showInternalAction = (requestId: string, action: string, details: any, message: string) => {
    // Add internal action message (Cursor-style)
    const actionMessage: ChatMessage = {
      id: `action-${Date.now()}`,
      type: 'internal_action',
      content: message,
      timestamp: new Date(),
      requestId,
      action,
      actionDetails: details,
      isCollapsed: true // Start collapsed like Cursor
    };
    
    setMessages(prev => [...prev, actionMessage]);
  };

  const showAIQuestion = (requestId: string, question: string) => {
    // Add AI question message
    const questionMessage: ChatMessage = {
      id: `question-${Date.now()}`,
      type: 'assistant',
      content: `❓ ${question}`,
      timestamp: new Date(),
      requestId
    };
    
    setMessages(prev => [...prev, questionMessage]);
    
    // Show interactive prompt (simplified for demo)
    const answer = prompt(question);
    if (answer) {
      wsClient.answerQuestion(requestId, answer);
    }
  };

  const toggleActionCollapse = (messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, isCollapsed: !msg.isCollapsed }
        : msg
    ));
  };

  // Main actions
  const handleSendMessage = useCallback(() => {
    const messageContent = currentMessage.trim();
    if (!messageContent || !isConnected) return;

    const requestId = `req-${Date.now()}`;
    currentRequestId.current = requestId;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: messageContent,
      timestamp: new Date()
    };

    // Add loading assistant message
    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: 'Connecting to AI...',
      timestamp: new Date(),
      requestId,
      status: 'running'
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setCurrentMessage('');

    // Send via WebSocket
    wsClient.generateCode(requestId, messageContent, {
      projectId: project?.id,
      activeFile: activeFile?.path,
      mode: isCodingMode ? 'coding' : 'conversation'
    });

  }, [currentMessage, isConnected, project, activeFile, isCodingMode]);

  const handleCancelRequest = (requestId: string) => {
    wsClient.cancelRequest(requestId);
    toast.info('Request cancelled');
  };

  const handlePauseRequest = (requestId: string) => {
    wsClient.pauseRequest(requestId);
    toast.info('Request paused');
  };

  const handleResumeRequest = (requestId: string) => {
    wsClient.resumeRequest(requestId);
    toast.info('Request resumed');
  };

  const handleModifyRequest = (requestId: string, modification: string) => {
    wsClient.modifyRequest(requestId, modification);
    setShowModificationInput(false);
    setModificationText('');
    toast.info('Modification sent');
  };

  const handleRetry = (requestId: string, originalContent: string) => {
    const newRequestId = `retry-${Date.now()}`;
    wsClient.generateCode(newRequestId, originalContent, {
      projectId: project?.id,
      activeFile: activeFile?.path,
      mode: isCodingMode ? 'coding' : 'conversation'
    });
  };

  const handleApprovePermissions = (requestId: string, permissions: string[]) => {
    wsClient.approvePermissions(requestId, permissions);
    
    // Update message to show approval
    setMessages(prev => prev.map(msg => 
      msg.requestId === requestId && msg.type === 'permission'
        ? { ...msg, content: `${msg.content}\n\n✅ Permissions approved`, requiresApproval: false }
        : msg
    ));
    
    toast.success('Permissions approved');
  };

  const handleRejectPermissions = (requestId: string, permissions: string[]) => {
    wsClient.rejectPermissions(requestId, permissions);
    
    // Update message to show rejection
    setMessages(prev => prev.map(msg => 
      msg.requestId === requestId && msg.type === 'permission'
        ? { ...msg, content: `${msg.content}\n\n❌ Permissions rejected`, requiresApproval: false }
        : msg
    ));
    
    toast.info('Permissions rejected');
  };

  // Render request status badge
  const renderStatusBadge = (status?: ChatMessage['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-orange-500" />;
      case 'awaiting_permission':
        return <AlertCircle className="w-4 h-4 text-purple-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  // Render message controls
  const renderMessageControls = (message: ChatMessage) => {
    if (message.type !== 'assistant' || !message.requestId) return null;

    const request = wsClient.getRequest(message.requestId);
    if (!request) return null;

    return (
      <div className="flex items-center gap-2 mt-2">
        {request.status === 'running' && (
          <>
            <button
              onClick={() => handleCancelRequest(message.requestId!)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              <Square className="w-3 h-3" />
              Stop
            </button>
            <button
              onClick={() => handlePauseRequest(message.requestId!)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors"
            >
              <Pause className="w-3 h-3" />
              Pause
            </button>
            <button
              onClick={() => {
                setSelectedRequestId(message.requestId!);
                setShowModificationInput(true);
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              <Edit3 className="w-3 h-3" />
              Modify
            </button>
          </>
        )}
        
        {request.status === 'paused' && (
          <button
            onClick={() => handleResumeRequest(message.requestId!)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
          >
            <Play className="w-3 h-3" />
            Resume
          </button>
        )}
        
        {message.canRetry && (
          <button
            onClick={() => handleRetry(message.requestId!, request.message)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Retry
          </button>
        )}


      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Connection Status */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-muted-foreground">
            {isConnected ? 'Connected to AI Agent' : 'Disconnected'}
          </span>
        </div>
        
        {/* Enhanced Active Requests Display */}
        {activeRequests.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {activeRequests.length} active request{activeRequests.length !== 1 ? 's' : ''}
            </div>
            
            {/* Status Breakdown */}
            <div className="flex items-center gap-3 text-xs">
              {activeRequests.filter(r => r.status === 'running').length > 0 && (
                <div className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                  {activeRequests.filter(r => r.status === 'running').length} running
                </div>
              )}
              {activeRequests.filter(r => r.status === 'awaiting_permission').length > 0 && (
                <div className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-purple-500" />
                  {activeRequests.filter(r => r.status === 'awaiting_permission').length} awaiting approval
                </div>
              )}
              {activeRequests.filter(r => r.status === 'paused').length > 0 && (
                <div className="flex items-center gap-1">
                  <Pause className="w-3 h-3 text-orange-500" />
                  {activeRequests.filter(r => r.status === 'paused').length} paused
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.type === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : message.type === 'system'
                  ? 'bg-muted text-muted-foreground'
                  : message.type === 'permission'
                  ? 'bg-purple-50 text-purple-900 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-100 dark:border-purple-800'
                  : message.type === 'file_operation'
                  ? 'bg-blue-50 text-blue-900 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-100 dark:border-blue-800'
                  : message.type === 'progress'
                  ? 'bg-yellow-50 text-yellow-900 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-100 dark:border-yellow-800'
                  : message.type === 'internal_action'
                  ? 'bg-gray-50 text-gray-700 border border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-700'
                  : message.isError
                  ? 'bg-destructive/10 text-destructive border border-destructive/20'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {/* Message Header */}
              {(message.type === 'assistant' || message.type === 'permission' || message.type === 'file_operation' || message.type === 'progress') && message.requestId && (
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                  {renderStatusBadge(message.status)}
                  <span>Request {message.requestId}</span>
                  
                  {/* Queue Position */}
                  {message.queuePosition && (
                    <span>• Queue: #{message.queuePosition}</span>
                  )}
                  
                  {/* Progress */}
                  {message.progress !== undefined && (
                    <span>• {message.progress}%</span>
                  )}
                  
                  {/* Stage */}
                  {message.stage && (
                    <span>• {message.stage}</span>
                  )}
                  
                  {/* Token Info */}
                  {message.remainingTokens !== undefined && (
                    <span>• {message.remainingTokens} tokens left</span>
                  )}
                  
                  {/* Duration */}
                  {message.stats && (
                    <span>• {(message.stats.duration / 1000).toFixed(1)}s</span>
                  )}
                </div>
              )}

              {/* Progress Bar */}
              {message.progress !== undefined && message.status === 'running' && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{message.stage || 'Processing...'}</span>
                    <span>{message.progress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${message.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Internal Action Content (Cursor-style) */}
              {message.type === 'internal_action' && (
                <div className="cursor-pointer" onClick={() => toggleActionCollapse(message.id)}>
                  <div className="flex items-center gap-2">
                    {/* Action Icon */}
                    {message.action === 'reading_codebase' && <Eye className="w-4 h-4 text-blue-500" />}
                    {message.action === 'searching_patterns' && <Search className="w-4 h-4 text-purple-500" />}
                    {message.action === 'found_symbols' && <FileText className="w-4 h-4 text-green-500" />}
                    {message.action === 'analyzing_style' && <Palette className="w-4 h-4 text-orange-500" />}
                    {message.action === 'style_detected' && <Palette className="w-4 h-4 text-orange-500" />}
                    {message.action === 'analyzing_relationships' && <Brain className="w-4 h-4 text-indigo-500" />}
                    {message.action === 'reading_files' && <FileText className="w-4 h-4 text-blue-500" />}
                    {message.action === 'found_relationships' && <Brain className="w-4 h-4 text-indigo-500" />}
                    {message.action === 'ready_to_generate' && <Zap className="w-4 h-4 text-green-500" />}
                    
                    {/* Message Text */}
                    <span className="text-sm font-medium">{message.content}</span>
                    
                    {/* Collapse/Expand Icon */}
                    {message.isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  
                  {/* Expanded Details */}
                  {!message.isCollapsed && message.actionDetails && (
                    <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded border text-xs">
                      {message.action === 'reading_codebase' && (
                        <div>Files analyzed: {message.actionDetails.fileCount}</div>
                      )}
                      {message.action === 'searching_patterns' && (
                        <div>Query: "{message.actionDetails.query}..."</div>
                      )}
                      {message.action === 'found_symbols' && (
                        <div className="space-y-1">
                          <div>Found {message.actionDetails.symbolCount} symbols:</div>
                          {message.actionDetails.symbols?.slice(0, 5).map((symbol: any, i: number) => (
                            <div key={i} className="ml-2">• {symbol.type} "{symbol.name}" in {symbol.file}</div>
                          ))}
                        </div>
                      )}
                      {message.action === 'style_detected' && (
                        <div>
                          Indentation: {message.actionDetails.indentation}, 
                          Quotes: {message.actionDetails.quotes}, 
                          Semicolons: {message.actionDetails.semicolons ? 'Yes' : 'No'}
                        </div>
                      )}
                      {message.action === 'reading_files' && (
                        <div className="space-y-1">
                          <div>Key files:</div>
                          {message.actionDetails.files?.map((file: string, i: number) => (
                            <div key={i} className="ml-2">• {file}</div>
                          ))}
                        </div>
                      )}
                      {message.action === 'found_relationships' && (
                        <div className="space-y-1">
                          <div>Related files: {message.actionDetails.relatedFiles?.join(', ')}</div>
                          {message.actionDetails.sharedTypes?.length > 0 && (
                            <div>Shared types: {message.actionDetails.sharedTypes.join(', ')}</div>
                          )}
                        </div>
                      )}
                      {message.action === 'ready_to_generate' && (
                        <div>
                          Context: {message.actionDetails.contextSize}/{message.actionDetails.totalFiles} files
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Regular Message Content */}
              {message.type !== 'internal_action' && (
                <div className="whitespace-pre-wrap">
                  {message.content}
                  {message.isTyping && (
                    <span className="inline-flex items-center gap-1 ml-2">
                      <div className="flex space-x-1">
                        <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </span>
                  )}
                </div>
              )}

              {/* Error Context */}
              {message.errorContext && (
                <div className="mt-2 p-2 bg-destructive/5 border border-destructive/20 rounded text-xs">
                  <strong>Error Details:</strong> {message.errorContext}
                </div>
              )}

              {/* Permission Details */}
              {message.type === 'permission' && message.permissions && message.permissions.length > 0 && (
                <div className="mt-2 p-3 bg-purple-100 dark:bg-purple-900/30 rounded border border-purple-200 dark:border-purple-800">
                  <div className="text-xs font-medium mb-2">Required Permissions:</div>
                  <div className="space-y-2">
                    {message.permissions.map((permission, index) => (
                      <div key={index} className="flex items-start gap-2 text-xs">
                        <AlertCircle className={`w-3 h-3 mt-0.5 flex-shrink-0 ${
                          permission.isSensitive ? 'text-red-500' : 'text-yellow-500'
                        }`} />
                        <div>
                          <div className="font-medium">{permission.type}: {permission.path}</div>
                          <div className="text-muted-foreground">{permission.message}</div>
                          {permission.isSensitive && (
                            <div className="text-red-600 dark:text-red-400 font-medium">⚠️ High Risk Operation</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* File Operation Details */}
              {message.type === 'file_operation' && message.fileData && (
                <div className="mt-2 p-3 bg-blue-100 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
                  <div className="text-xs font-medium mb-1">File Operation: {message.originalType}</div>
                  {message.fileData.file && (
                    <div className="text-xs text-muted-foreground">
                      Path: {message.fileData.file.path} ({message.fileData.file.size} bytes)
                    </div>
                  )}
                </div>
              )}

              {/* Suggestions */}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs font-medium mb-1">Suggestions:</div>
                  <ul className="text-xs space-y-1">
                    {message.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Message Controls */}
              {renderMessageControls(message)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Modification Input */}
      {showModificationInput && selectedRequestId && (
        <div className="p-4 border-t border-border bg-muted/50">
          <div className="flex items-center gap-2 mb-2">
            <Edit3 className="w-4 h-4" />
            <span className="text-sm font-medium">Modify Request {selectedRequestId}</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={modificationText}
              onChange={(e) => setModificationText(e.target.value)}
              placeholder="Describe the modification..."
              className="flex-1 px-3 py-2 border border-border rounded-md bg-background"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && modificationText.trim()) {
                  handleModifyRequest(selectedRequestId, modificationText);
                }
              }}
            />
            <button
              onClick={() => handleModifyRequest(selectedRequestId, modificationText)}
              disabled={!modificationText.trim()}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowModificationInput(false);
                setModificationText('');
                setSelectedRequestId(null);
              }}
              className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            placeholder={isConnected ? "Describe what you want to build..." : "Connecting to AI agent..."}
            disabled={!isConnected}
            className="flex-1 px-4 py-2 border border-border rounded-lg bg-background disabled:opacity-50"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!currentMessage.trim() || !isConnected}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>
            {isConnected ? 'Press Enter to send, Shift+Enter for new line' : 'Connecting...'}
          </span>
          {activeRequests.length > 0 && (
            <span>{activeRequests.length} request{activeRequests.length !== 1 ? 's' : ''} in progress</span>
          )}
        </div>
      </div>
    </div>
  );
} 