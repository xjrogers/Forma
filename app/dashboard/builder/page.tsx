'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Send, 
  Play, 
  Download, 
  Github, 
  FileText, 
  Eye, 
  Code, 
  Zap, 
  Sparkles,
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen, 
  Plus, 
  Search,
  Save, 
  Copy, 
  RotateCcw,
  RefreshCw, 
  ExternalLink, 
  Smartphone, 
  Tablet, 
  Monitor, 
  AlertCircle,
  X, 
  MessageCircle,
  Paperclip,
  ChevronLeft,
  Loader2
} from 'lucide-react';
import DashboardLayout from '../../../components/DashboardLayout';
import PreviewPane from '../../components/PreviewPane';
import BuilderHeader from '../../../components/BuilderHeader';
import { toast } from 'sonner';
import SideNavigation from '../../../components/SideNavigation';

import GitHubRepoDialog from '../../../components/GitHubRepoDialog';
import { getSmartAIClient, ConnectionType, AIResponse } from '@/lib/smartAIClient';
import { authService } from '@/lib/auth';

// Global request handlers map (persists across hot reloads)
declare global {
  interface Window {
    __forgeRequestHandlers?: Map<string, (response: AIResponse) => void>;
    __forgeMapId?: string;
    __forgeActiveHandlers?: { [key: string]: (response: AIResponse) => void };
  }
}

// Ensure the Map is always available and persistent
function getGlobalHandlers(): Map<string, (response: AIResponse) => void> {
  if (typeof window === 'undefined') {
    return new Map<string, (response: AIResponse) => void>();
  }
  
  if (!window.__forgeRequestHandlers) {
    window.__forgeRequestHandlers = new Map<string, (response: AIResponse) => void>();
    window.__forgeMapId = Math.random().toString(36).substring(7);
    console.log(`🗺️ Global request handlers Map created on window with ID: ${window.__forgeMapId}`);
  }
  
  return window.__forgeRequestHandlers;
}

const globalRequestHandlers = getGlobalHandlers();

// Type declaration for Monaco Editor
declare global {
  interface Window {
    monaco: any;
    require: any;
  }
}

// Animated dots component for generating indicator
const AnimatedDots = () => {
  const [dots, setDots] = useState('.');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        switch (prev) {
          case '.': return '..';
          case '..': return '...';
          case '...': return '.';
          default: return '.';
        }
      });
    }, 500); // Change every 500ms
    
    return () => clearInterval(interval);
  }, []);
  
  return <span>Generating{dots}</span>;
};

interface ProjectFile {
  id: string;
  path: string;
  content: string;
  contentType: string;
  size: number;
}

interface BuilderProject {
  id: string;
  name: string;
  description: string;
  files: ProjectFile[];
  isGenerating: boolean;
  previewUrl?: string;
  // GitHub integration fields
  githubRepoId?: string;
  githubRepoName?: string;
  githubPrivate?: boolean;
  repoUrl?: string;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  file?: ProjectFile;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isGenerating?: boolean;
  isTyping?: boolean;
  progress?: number;
  isError?: boolean;
  canRetry?: boolean;
  errorContext?: string;
  suggestions?: string[];
  permissionData?: Array<{
    id: string;
    type: string;
    path: string;
    message: string;
    isSensitive: boolean;
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  fileData?: {
    path: string;
    fileId: string;
  };
  metadata?: any; // For database-loaded messages with file metadata
}

type ViewportSize = 'mobile' | 'tablet' | 'desktop';

export default function BuilderPage() {
  const searchParams = useSearchParams();
  
  // User State
  const [userPlan, setUserPlan] = useState<string>('free');
  
  // Project State
  const [project, setProject] = useState<BuilderProject | null>(null);
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMessageCount, setTotalMessageCount] = useState(0);
  
  // UI State
  const [layout, setLayout] = useState<'code' | 'split' | 'preview'>('preview');
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [sidebarOpen, setSidebarOpen] = useState(false);
 
  // Pane/Layout State
  const [leftPaneTab, setLeftPaneTab] = useState<'chat' | 'files'>('chat');
  const [leftPaneWidth] = useState<number>(360); // Fixed width, no resizing
  const [splitRatio] = useState<number>(0.5); // Fixed split ratio, no resizing
  
  
  // File Explorer State
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']));
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [newlyCreatedFiles, setNewlyCreatedFiles] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: ProjectFile } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<ProjectFile | null>(null);
  const [permissionRequests, setPermissionRequests] = useState<Array<{
    id: string;
    type: string;
    path: string;
    message: string;
    isSensitive: boolean;
    riskLevel: 'low' | 'medium' | 'high';
  }>>([]);
  const [approvedActions, setApprovedActions] = useState<string[]>([]);
  const [rejectedActions, setRejectedActions] = useState<string[]>([]);
  
  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'system',
              content: 'Hi! I\'m DevAssistant.io, your AI coding assistant. Describe what you want to build and I\'ll generate a complete project for you.',
      timestamp: new Date()
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCodingMode, setIsCodingMode] = useState(true);
  const [isChatHidden, setIsChatHidden] = useState(false);
  
  // Smart AI Client State
  const [connectionType, setConnectionType] = useState<ConnectionType>('disconnected');
  const [aiCapabilities, setAiCapabilities] = useState({
    cancel: false,
    modify: false,
    pause: false,
    resume: false,
    multiRequest: false,
    permissions: false,
    internalActions: false
  });
  const smartAIClient = getSmartAIClient();

  // Global handler registration flag
  const globalHandlerRegistered = useRef(false);
  
  // Debug: Log when the component renders
  const currentMapId = typeof window !== 'undefined' ? window.__forgeMapId : 'server';
  console.log(`🔄 Builder component render, Global Map size: ${globalRequestHandlers.size}, Map ID: ${currentMapId}`);

  
  // Monaco Editor State
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoRef = useRef<any>(null);
  const editorInstanceRef = useRef<any>(null);
  const [isEditorLoading, setIsEditorLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalContent, setOriginalContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);
  const [isProgrammaticUpdate, setIsProgrammaticUpdate] = useState(false); // Track programmatic content updates
  const [aiEditingFile, setAiEditingFile] = useState<string | null>(null); // Track which file AI is editing
  const [streamingFileContent, setStreamingFileContent] = useState<{ [path: string]: string }>({}); // Track streaming content

  const [showGitHubRepo, setShowGitHubRepo] = useState(false);
  const [isGitHubPushing, setIsGitHubPushing] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedConversationRef = useRef<string | null>(null);

  // Helper function to render message content with clickable links
  const renderMessageContent = (content: string) => {
    // Check for FILE_ACTION tags and render Cursor-style file cards
    const fileActionRegex = /<FILE_ACTION>\s*\{[\s\S]*?"type":\s*"create_file"[\s\S]*?"path":\s*"([^"]+)"[\s\S]*?\}\s*<\/FILE_ACTION>/g;
    const fileActions: string[] = [];
    let fileMatch;
    
    while ((fileMatch = fileActionRegex.exec(content)) !== null) {
      fileActions.push(fileMatch[1]); // Extract file path
    }
    
    // Also check for simple "Created file:" messages (for individual messages)
    const createdFileRegex = /Created file:\s*([^\n\r]+)/g;
    let createdFileMatch;
    
    while ((createdFileMatch = createdFileRegex.exec(content)) !== null) {
      const filePath = createdFileMatch[1].trim();
      if (!fileActions.includes(filePath)) {
        fileActions.push(filePath);
      }
    }
    
    // If we found file actions, render them as Cursor-style cards
    if (fileActions.length > 0) {
      // Remove FILE_ACTION tags and "Created file:" messages from content for cleaner display
      let cleanContent = content
        .replace(/<FILE_ACTION>[\s\S]*?<\/FILE_ACTION>/g, '')
        .replace(/Created file:\s*[^\n\r]+/g, '')
        .replace(/✅ Generated \d+ files? successfully!/g, '') // Remove success message
        .replace(/\n\s*\n+/g, '\n') // Remove extra blank lines
        .replace(/^\s*\n+|\n+\s*$/g, '') // Remove leading/trailing newlines
        .trim();
      
      // Find the project files to get file objects
      const createdFiles = fileActions.map(filePath => {
        const file = project?.files?.find((f: ProjectFile) => f.path === filePath);
        return { path: filePath, file };
      });
      
      return (
        <div className="space-y-4">
          {/* Main message content */}
          {cleanContent && (
            <div className="whitespace-pre-wrap break-words">
              {renderBasicContent(cleanContent)}
            </div>
          )}
          
          {/* Cursor-style file cards */}
          {createdFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                <FileText className="w-4 h-4" />
                <span>Created {createdFiles.length} file{createdFiles.length > 1 ? 's' : ''}</span>
              </div>
              
              <div className="grid gap-2">
                {createdFiles.map((item, index) => {
                  const fileName = item.path.split('/').pop() || item.path;
                  const fileDir = item.path.includes('/') ? item.path.substring(0, item.path.lastIndexOf('/')) : '';
                  
                  return (
                    <div
                      key={index}
                      onClick={() => {
                        if (item.file) {
                          setActiveFile(item.file);
                          toast.success(`Opened ${fileName}`);
                        } else {
                          toast.error(`File ${fileName} not found in project`);
                        }
                      }}
                      className="group flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    >
                      {/* File icon */}
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center">
                        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      
                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {fileName}
                        </div>
                        {fileDir && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {fileDir}/
                          </div>
                        )}
                      </div>
                      
                      {/* Click indicator */}
                      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                          <Eye className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // If no file actions, render normally with link parsing
    return renderBasicContent(content);
  };

  // Helper function for basic content rendering (links, etc.)
  const renderBasicContent = (content: string) => {
    // Convert markdown-style links [text](url) to clickable links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      
      // Add the clickable link
      const linkText = match[1];
      const linkUrl = match[2];
      parts.push(
        <a
          key={match.index}
          href={linkUrl}
          className="app-link font-medium"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = linkUrl;
          }}
        >
          {linkText}
        </a>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }
    
    return parts.length > 1 ? parts : content;
  };

  // Helper function to check if a message is a file operation
  const isFileOperationMessage = (message: ChatMessage): boolean => {
    // Check for new format with fileData
    if (message.fileData) return true;
    
    // Check for old format with metadata
    const messageMetadata = message.metadata as any;
    if (messageMetadata?.action === 'create_file' && messageMetadata?.filePath) return true;
    if (messageMetadata?.action === 'modify_file' && messageMetadata?.filePath) return true;
    
    // Check for content-based detection (for messages without metadata)
    const content = message.content.trim();
    if (content.startsWith('Created ') || content.startsWith('Modified file:')) return true;
    
    return false;
  };

  // Enhanced message rendering with file click handling (Cursor-style)
  const renderMessageWithFileHandling = (message: ChatMessage) => {
    // Check if this is a file operation message (new format with fileData)
    if (message.fileData) {
      const fileName = message.fileData.path.split('/').pop() || message.fileData.path;
      const fileDir = message.fileData.path.includes('/') ? message.fileData.path.substring(0, message.fileData.path.lastIndexOf('/')) : '';
      
      return (
        <div
          onClick={async () => {
            // Find the file in the project and open it
            const file = project?.files?.find((f: ProjectFile) => f.id === message.fileData?.fileId);
            if (file && project) {
              setActiveFile(file);
              setLayout('code'); // Switch to code editor tab
              
              // Load file content if not already loaded
              if (!file.content) {
                const updatedFile = await loadFileContent(file.id, project.id);
                if (updatedFile) {
                  setActiveFile(updatedFile);
                }
              }
              
              toast.success(`Opened ${fileName}`);
            } else {
              toast.error(`File ${fileName} not found`);
            }
          }}
          className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer transition-colors"
        >
          {/* File icon */}
          <FileText className="w-3 h-3 flex-shrink-0" />
          
          {/* File name only */}
          <span className="text-xs underline decoration-dotted underline-offset-2">
            Created {fileName}
          </span>
        </div>
      );
    }
    
    // Check if this is a file operation message from database (old format with metadata)
    const messageMetadata = message.metadata as any;
    
    // Handle both create_file and modify_file actions with metadata
    if ((messageMetadata?.action === 'create_file' || messageMetadata?.action === 'modify_file') && messageMetadata?.filePath) {
      const filePath = messageMetadata.filePath;
      const fileName = filePath.split('/').pop() || filePath;
      const actionText = messageMetadata.action === 'create_file' ? 'Created' : 'Modified';
      
      return (
        <div
          onClick={async () => {
            // Find the file in the project by path
            const file = project?.files?.find((f: ProjectFile) => f.path === filePath);
            if (file && project) {
              setActiveFile(file);
              setLayout('code'); // Switch to code editor tab
              
              // Load file content if not already loaded
              if (!file.content) {
                const updatedFile = await loadFileContent(file.id, project.id);
                if (updatedFile) {
                  setActiveFile(updatedFile);
                }
              }
              
              toast.success(`Opened ${fileName}`);
            } else {
              toast.error(`File ${fileName} not found`);
            }
          }}
          className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer transition-colors"
        >
          {/* File icon */}
          <FileText className="w-3 h-3 flex-shrink-0" />
          
          {/* File name only */}
          <span className="text-xs underline decoration-dotted underline-offset-2">
            {actionText} {fileName}
          </span>
        </div>
      );
    }
    

    
    // For regular messages, use the existing renderMessageContent function
    return renderMessageContent(message.content);
  };

  const lastLoadTimeRef = useRef<number>(0);
  const loadedProjectIdRef = useRef<string | null>(null);

  // Auto-scroll chat to bottom only for new messages (not when loading more)
  const prevMessagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    const prevMessages = prevMessagesRef.current;
    
    // Only scroll if:
    // 1. We're not loading more messages (prepending older messages)
    // 2. New messages were added to the end (last message is different)
    if (!isLoadingMoreMessages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const prevLastMessage = prevMessages[prevMessages.length - 1];
      
      // Scroll if this is a new message at the end
      if (!prevLastMessage || lastMessage.id !== prevLastMessage.id) {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    
    prevMessagesRef.current = messages;
  }, [messages, isLoadingMoreMessages]);



  // Initialize Smart AI Client
  useEffect(() => {
    const initializeAI = async () => {
      try {
        console.log('🤖 Initializing Smart AI Client...');
        
        // Set up connection handler
        smartAIClient.onConnection((type: ConnectionType) => {
          setConnectionType(type);
          setAiCapabilities(smartAIClient.getCapabilities());
        });

        // Set up error handler
        smartAIClient.onError((error) => {
          console.error('AI Client error:', error);
          toast.error('AI connection failed');
        });

        // Connect first
        const connType = await smartAIClient.connect();
        console.log(`✅ AI Client connected via ${connType}`);

        // Set up global event handler for all requests (only once, AFTER connection)
        if (!globalHandlerRegistered.current) {
          console.log('🎯 Registering global event handler (one-time setup)');
          smartAIClient.on('*', (response: AIResponse) => {
            console.log(`🌐 Global handler received:`, response.type, response.requestId);
            
            // BULLETPROOF: Check window object first
            if (typeof window !== 'undefined' && window.__forgeActiveHandlers && window.__forgeActiveHandlers[response.requestId]) {
              console.log(`🎯 BULLETPROOF HANDLER FOUND for:`, response.requestId);
              window.__forgeActiveHandlers[response.requestId](response);
              return;
            }
            
            // Fallback to Map (shouldn't be needed)
            const handler = globalRequestHandlers.get(response.requestId);
            if (handler) {
              console.log(`📞 Fallback handler called for:`, response.requestId);
              handler(response);
            } else {
              console.log(`⚠️ NO HANDLER FOUND for request:`, response.requestId);
              console.log(`🔍 Window handlers:`, typeof window !== 'undefined' && window.__forgeActiveHandlers ? Object.keys(window.__forgeActiveHandlers) : 'none');
              console.log(`🔍 Map size:`, globalRequestHandlers.size);
            }
          });
          globalHandlerRegistered.current = true;
        }
        
      } catch (error) {
        console.error('Failed to initialize AI client:', error);
        toast.error('Failed to connect to AI');
      }
    };

    initializeAI();

    // Cleanup on unmount
    return () => {
      console.log('🧹 Component cleanup - preserving global handlers');
      // Do NOT disconnect in development (React Strict Mode)
      // This prevents clearing our global event handlers
      if (process.env.NODE_ENV === 'production') {
        smartAIClient.disconnect();
      }
    };
  }, []);

  // Initialize Monaco Editor
  useEffect(() => {
    if (!activeFile) return;
    
    const initMonaco = async () => {
      if (typeof window === 'undefined') return;

      try {
        if (!window.monaco) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/editor/editor.main.css';
          document.head.appendChild(link);

          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js';
          
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });

          window.require.config({
            paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }
          });

          await new Promise((resolve) => {
            window.require(['vs/editor/editor.main'], resolve);
          });
        }

        monacoRef.current = window.monaco;
        
        // Configure TypeScript for multi-file projects
        const monaco = window.monaco;
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          target: monaco.languages.typescript.ScriptTarget.ES2020,
          allowNonTsExtensions: true,
          moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          module: monaco.languages.typescript.ModuleKind.ESNext,
          noEmit: true,
          esModuleInterop: true,
          jsx: monaco.languages.typescript.JsxEmit.React,
          allowJs: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
          strict: false, // Less strict for better UX
          typeRoots: ["node_modules/@types"],
          baseUrl: ".",
          paths: {
            "*": ["*", "node_modules/*"]
          }
        });

        // Also configure JavaScript defaults
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
          target: monaco.languages.typescript.ScriptTarget.ES2020,
          allowNonTsExtensions: true,
          moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          module: monaco.languages.typescript.ModuleKind.ESNext,
          noEmit: true,
          esModuleInterop: true,
          jsx: monaco.languages.typescript.JsxEmit.React,
          allowJs: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
          checkJs: false, // Don't type-check JS files as strictly
          baseUrl: ".",
          paths: {
            "*": ["*", "node_modules/*"]
          }
        });

        // Configure better error messages and diagnostics
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          noSuggestionDiagnostics: false,
          diagnosticCodesToIgnore: [
            1108, // Return statement in constructor
            1375, // 'await' expressions are only allowed at the top level
            2307, // Cannot find module (we'll handle this with AI)
          ]
        });

        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          noSuggestionDiagnostics: false,
          diagnosticCodesToIgnore: [
            2307, // Cannot find module (we'll handle this with AI)
          ]
        });

        console.log('✅ TypeScript configuration applied for multi-file projects');
        setIsEditorLoading(false);
      } catch (error) {
        console.error('Failed to load Monaco Editor:', error);
        setIsEditorLoading(false);
      }
    };

    initMonaco();
  }, [activeFile]);

  // Load project context into Monaco's virtual file system
  useEffect(() => {
    if (!monacoRef.current || !project?.files) return;

    const monaco = monacoRef.current;
    
    // Add all project files to Monaco's virtual file system
    project.files.forEach(file => {
      try {
        const uri = monaco.Uri.parse(`file:///${file.path}`);
        
        // Check if model already exists
        const existingModel = monaco.editor.getModel(uri);
        if (existingModel) {
          // Update existing model content
          existingModel.setValue(file.content || '');
        } else {
          // Create new model
          monaco.editor.createModel(
            file.content || '',
            getLanguage(file.path),
            uri
          );
        }
      } catch (error) {
        console.warn(`Failed to add file ${file.path} to Monaco context:`, error);
      }
    });

    console.log(`✅ Added ${project.files.length} files to Monaco project context`);
  }, [project?.files, monacoRef.current]);

  // AI Quick Fix functionality
  const handleAIQuickFix = useCallback(async (errorMessage: string, errorLine?: number, errorColumn?: number) => {
    if (!activeFile || !project) {
      toast.error('No active file or project');
      return;
    }

    try {
      setIsSaving(true);
      toast.info('Generating AI fix...');

      const response = await fetch('/api/builder/quick-fix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errorMessage,
          filePath: activeFile.path,
          fileContent: activeFile.content || '',
          projectId: project.id,
          errorLine,
          errorColumn
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate quick fix');
      }

      if (data.success && data.fix) {
        // Apply the fix to the editor
        if (editorInstanceRef.current) {
          setIsProgrammaticUpdate(true); // Prevent auto-save
          editorInstanceRef.current.setValue(data.fix);
          
          // Update the active file content
          setActiveFile(prev => prev ? { ...prev, content: data.fix } : null);
          
          toast.success(`AI Fix Applied: ${data.explanation}`);
          console.log(`💰 Quick fix used ${data.tokensUsed} tokens ($${data.cost?.toFixed(4)})`);
        }
      } else {
        toast.error('AI could not generate a fix for this error');
      }

    } catch (error) {
      console.error('❌ Error generating AI quick fix:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate AI quick fix');
    } finally {
      setIsSaving(false);
    }
  }, [activeFile, project, setIsProgrammaticUpdate]);

  // Register AI quick fix action with Monaco
  useEffect(() => {
    if (!monacoRef.current || !editorInstanceRef.current) return;

    const monaco = monacoRef.current;
    const editor = editorInstanceRef.current;

    // Register AI quick fix code action provider
    const disposable = monaco.languages.registerCodeActionProvider(['typescript', 'javascript', 'typescriptreact', 'javascriptreact'], {
      provideCodeActions: (model: any, range: any, context: any) => {
        const actions: any[] = [];

        // Add AI quick fix for each diagnostic (error)
        context.markers.forEach((marker: any) => {
          if (marker.severity === monaco.MarkerSeverity.Error) {
            actions.push({
              title: `🤖 Fix with AI: ${marker.message}`,
              id: 'ai-quick-fix',
              kind: 'quickfix',
              run: () => {
                handleAIQuickFix(marker.message, marker.startLineNumber, marker.startColumn);
              }
            });
          }
        });

        return {
          actions,
          dispose: () => {}
        };
      }
    });

    return () => {
      disposable.dispose();
    };
  }, [monacoRef.current, editorInstanceRef.current, handleAIQuickFix]);

  // Create Monaco editor instance
  useEffect(() => {
    if (!monacoRef.current || !editorRef.current || isEditorLoading || !activeFile) return;

    const monaco = monacoRef.current;

    const editor = monaco.editor.create(editorRef.current, {
      value: activeFile.content || '',
      language: getLanguage(activeFile.path),
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 14,
      lineNumbers: 'on',
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      tabSize: 2,
      insertSpaces: true,
      folding: true,
      bracketPairColorization: { enabled: true },
    });

    editorInstanceRef.current = editor;
    setOriginalContent(activeFile.content);

    const disposable = editor.onDidChangeModelContent(() => {
      // Skip auto-save if this is a programmatic update
      if (isProgrammaticUpdate) {
        console.log('Skipping auto-save for programmatic update');
        setIsProgrammaticUpdate(false); // Reset flag
        return;
      }
      
      const currentContent = editor.getValue();
      setHasUnsavedChanges(currentContent !== originalContent);
      handleFileUpdate(activeFile.id, currentContent);
      
      // Auto-save after 3 seconds of inactivity
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        if (currentContent !== originalContent && activeFile && project && !isSaving) {
          console.log('Auto-save triggered for:', activeFile.path);
          debouncedSave(currentContent, activeFile.id, project.id);
        }
      }, 3000);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveFile();
    });

    return () => {
      disposable.dispose();
      editor.dispose();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [activeFile?.id, isEditorLoading]);

  // Update Monaco editor content when activeFile content changes
  useEffect(() => {
    if (editorInstanceRef.current && activeFile) {
      const currentValue = editorInstanceRef.current.getValue();
      const newValue = activeFile.content || '';
      
      if (currentValue !== newValue) {
        setIsProgrammaticUpdate(true); // Flag this as programmatic update
        editorInstanceRef.current.setValue(newValue);
        setOriginalContent(activeFile.content);
        setHasUnsavedChanges(false);
      }
    }
  }, [activeFile?.content]);

  // Keyboard shortcuts (Cursor-style)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete key to delete active file
      if (e.key === 'Delete' && activeFile && leftPaneTab === 'files') {
        e.preventDefault();
        setShowDeleteDialog(activeFile);
      }
      
      // Escape to close context menu
      if (e.key === 'Escape') {
        setContextMenu(null);
        setShowDeleteDialog(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      setContextMenu(null);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClick);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClick);
    };
  }, [activeFile, leftPaneTab]);

  const loadConversationHistory = useCallback(async (projectId: string, page: number = 1, append: boolean = false) => {
    // Prevent duplicate loading
    if (loadedConversationRef.current === projectId && !append && isLoadingConversation) return;
    if (append && isLoadingMoreMessages) return;
    
    if (append) {
      setIsLoadingMoreMessages(true);
    } else {
      setIsLoadingConversation(true);
      loadedConversationRef.current = projectId; // Set immediately to prevent race conditions
    }
    
    try {
      const apiUrl = `/api/conversations/${projectId}/paginated`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          page: page,
          limit: 20
        })
      });
      if (response.ok) {
        const data = await response.json();
        
        setHasMoreMessages(data.hasMore || false);
        setTotalMessageCount(data.totalCount || 0);
        setCurrentPage(page);
        
        if (data.messages && data.messages.length > 0) {
          console.log('📥 Loaded messages from API:', data.messages.length, 'messages');
          console.log('📥 Sample messages:', data.messages.map((m: any) => ({ 
            id: m.id, 
            content: m.content.substring(0, 50) + '...', 
            metadata: m.metadata 
          })));
          
          const conversationMessages: ChatMessage[] = data.messages.map((msg: any) => ({
            id: msg.id,
            type: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
            timestamp: new Date(msg.createdAt),
            metadata: msg.metadata // Include metadata for file operations
          }));
          
          if (append) {
            // Prepend older messages to the beginning with deduplication
            setMessages(prev => {
              const existingIds = new Set(prev.map(msg => msg.id));
              const newMessages = conversationMessages.filter(msg => !existingIds.has(msg.id));
              return [...newMessages, ...prev];
            });
          } else {
            // Replace all messages (initial load) with deduplication
            const uniqueMessages = conversationMessages.filter((msg, index, arr) => 
              arr.findIndex(m => m.id === msg.id) === index
            );
            setMessages(uniqueMessages);
          }
          return;
        }
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error);
      if (!append) {
        loadedConversationRef.current = null; // Reset on error
      }
    } finally {
      if (append) {
        setIsLoadingMoreMessages(false);
      } else {
        setIsLoadingConversation(false);
      }
    }
    
    // Fallback: Set empty messages for existing project (no system message)
    if (!append) {
      setMessages([]);
      setHasMoreMessages(false);
      setTotalMessageCount(0);
      setCurrentPage(1);
    }
  }, [isLoadingConversation, isLoadingMoreMessages]);

  const loadMoreMessages = useCallback(async () => {
    if (!project?.id || !hasMoreMessages || isLoadingMoreMessages) return;
    
    const nextPage = currentPage + 1;
    await loadConversationHistory(project.id, nextPage, true);
  }, [project?.id, hasMoreMessages, isLoadingMoreMessages, currentPage, loadConversationHistory]);

  const loadExistingProject = useCallback(async (projectId: string, forceRefresh: boolean = false, updateState: boolean = true) => {
    // Prevent duplicate calls if already loading, but allow force refresh
    if (isLoadingProject) {
      console.log('⏳ Already loading project, skipping...');
      return;
    }
    
    // Skip if project is already loaded, unless force refresh is requested
    if (!forceRefresh && project && project.id === projectId && loadedProjectIdRef.current === projectId) {
      console.log('✅ Project already loaded, returning existing data');
      return project;
    }
    
    // Simple debounce - prevent calls within 1 second, unless force refresh
    const now = Date.now();
    if (!forceRefresh && now - lastLoadTimeRef.current < 1000) {
      console.log('⏳ Debouncing project load, skipping...');
      return;
    }
    lastLoadTimeRef.current = now;
    
    setIsLoadingProject(true);
    
    try {
      // Load project metadata and file list (without content) - Bolt.new style
      console.log('🔄 Loading project:', projectId, 'updateState:', updateState, 'forceRefresh:', forceRefresh);
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) throw new Error('Failed to load project');

      const data = await response.json();
      
      const builderProject: BuilderProject = {
        id: data.project.id,
        name: data.project.name,
        description: data.project.description || '',
        files: data.project.files?.map((file: any) => ({
          id: file.id,
          path: file.path,
          content: '', // Content loaded on-demand
          contentType: file.contentType,
          size: file.size
        })) || [],
        isGenerating: false,
        previewUrl: data.project.previewUrl,
        // Include GitHub integration fields
        githubRepoId: data.project.githubRepoId,
        githubRepoName: data.project.githubRepoName,
        githubPrivate: data.project.githubPrivate,
        repoUrl: data.project.repoUrl
      };

      // Only update state if requested (avoid re-renders during GitHub operations)
      if (updateState) {
        // Only call setProject if we don't have a project yet OR if it's actually a different project
        const shouldSetProject = !project || project.id !== builderProject.id;
          
        if (shouldSetProject) {
        console.log('🚨 CALLING setProject() - THIS WILL CAUSE FULL RE-RENDER AND PREVIEW REMOUNT');
          console.trace('setProject called from:', { 
            hasProject: !!project, 
            currentProjectId: project?.id, 
            newProjectId: builderProject.id,
            reason: !project ? 'no project loaded' : 'different project'
          });
      setProject(builderProject);
          loadedProjectIdRef.current = builderProject.id;
        } else {
          console.log('✅ Same project already loaded, skipping setProject() to prevent re-render');
          // Update the ref to track that we've loaded this project
          loadedProjectIdRef.current = builderProject.id;
        }
      
        // Load first file content if exists (only if project changed or no active file)
        if ((shouldSetProject || !activeFile) && builderProject.files.length > 0) {
        const firstFile = builderProject.files[0];
        const updatedFirstFile = await loadFileContent(firstFile.id, projectId);
        if (updatedFirstFile) {
          setActiveFile(updatedFirstFile);
          }
        }
      }

      // Reset conversation ref when switching projects
      loadedConversationRef.current = null;
      
      // Reset pagination state when switching projects
      setHasMoreMessages(false);
      setTotalMessageCount(0);
      setCurrentPage(1);

      // Load conversation history for this project
      await loadConversationHistory(projectId);

      // Only show success toast for initial loads, not refreshes
      if (!forceRefresh) {
      toast.success(`Loaded project: ${builderProject.name}`);
      }
      
      // Return the fresh project data
      return builderProject;
    } catch (error) {
      console.error('Failed to load project:', error);
      toast.error('Failed to load project');
      return null;
    } finally {
      setIsLoadingProject(false);
    }
      }, []);

  // Fetch fresh user plan from backend
  const fetchUserPlan = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const userData = await response.json();
        if (userData.success && userData.user?.plan) {
          setUserPlan(userData.user.plan);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user plan:', error);
      // Fallback to cached data
      const user = authService.getCurrentUser();
      if (user?.plan) {
        setUserPlan(user.plan);
      }
    }
  };

  // Handle URL parameters on page load
  useEffect(() => {
    // Fetch fresh user plan from backend instead of localStorage
    fetchUserPlan();

    const promptParam = searchParams.get('prompt');
    const projectIdParam = searchParams.get('projectId');

    if (projectIdParam && (!project || project.id !== projectIdParam) && !isLoadingProject) {
      // Load the project first
      const now = Date.now();
      if (now - lastLoadTimeRef.current < 500) return; // Prevent calls within 500ms
      
      loadExistingProject(projectIdParam);
    }
  }, [searchParams, project?.id, isLoadingProject]);





  const handleGenerateWithApprovals = async (prompt: string, approvals: string[]) => {
    return handleGenerate(prompt, approvals);
  };

  // Helper functions for Smart AI Client
  const showInternalAction = (requestId: string, action: string, details: any, message: string) => {
    console.log(`🔍 Internal Action: ${action} - ${message}`, details);
    // For now, just log. Could add to messages if needed.
  };

  const appendMessageContent = (messageId: string, content: string) => {
    console.log(`📝 Appending content to message ${messageId}:`, content);
    
    // Check if this content contains FILE_ACTION tags - if so, don't append it to the main message
    if (content.includes('<FILE_ACTION>')) {
      console.log(`🚫 Intercepting FILE_ACTION content, not appending to main message`);
      
      // Set AI editing indicator if we have an active file
      if (activeFile) {
        console.log(`🤖 AI started working on files, showing indicator for: ${activeFile.path}`);
        setAiEditingFile(activeFile.path);
      }
      
      return; // Don't append FILE_ACTION content to the main message
    }
    
    // Check if this content contains success messages - also don't append
    if (content.includes('Generated') && content.includes('files successfully')) {
      console.log(`🚫 Intercepting success message, not appending to main message`);
      return;
    }
    
    setMessages(prev => {
      const updated = prev.map(msg => {
        if (msg.id === messageId) {
          const newContent = msg.content + content;
          return { ...msg, content: newContent };
        }
        return msg;
      });
      console.log(`📝 Messages after append:`, updated.map(m => ({ id: m.id, content: m.content?.substring(0, 50) + '...' })));
      return updated;
    });
  };

  const updateMessageProgress = (messageId: string, message: string, progress?: number, stage?: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content: message || msg.content, progress, stage }
        : msg
    ));
  };

  const setMessageTyping = (messageId: string, isTyping: boolean) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, isTyping }
        : msg
    ));
  };

  const showPermissionRequest = (requestId: string, message: string, permissions: any[]) => {
    console.log(`🔐 Permission Request: ${message}`, permissions);
    // For now, just log. Could show permission dialog if needed.
  };

  const completeMessage = (messageId: string, finalMessage?: string, stats?: any) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { 
            ...msg, 
            content: finalMessage || msg.content,
            isGenerating: false,
            stats
          }
        : msg
    ));
  };

  const errorMessage = (messageId: string, errorMsg?: string, errorContext?: string, canRetry?: boolean, suggestions?: string[]) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { 
            ...msg, 
            content: errorMsg || 'An error occurred',
            isGenerating: false,
            isError: true,
            canRetry,
            errorContext,
            suggestions
          }
        : msg
    ));
  };

  const handleFileOperation = (response: AIResponse) => {
    console.log(`📁 File Operation: ${response.type}`, response.data);
    
    // Handle project_updated events (contains full project data)
    if (response.type === 'project_updated' && response.data?.project) {
      const updatedProject = response.data.project;
      console.log(`🔄 Project updated with ${updatedProject.files?.length || 0} files`);
      
      setProject(prev => {
        if (!prev) return updatedProject;
        
        // Merge the updated project data
        const newProject = {
          ...prev,
          ...updatedProject,
          files: updatedProject.files || prev.files
        };
        
        // Find newly added files for highlighting
        const prevFileIds = new Set(prev.files.map((f: ProjectFile) => f.id));
        const newFiles = updatedProject.files?.filter((f: ProjectFile) => !prevFileIds.has(f.id)) || [];
        
        if (newFiles.length > 0) {
          console.log(`➕ Found ${newFiles.length} new files:`, newFiles.map((f: ProjectFile) => f.path));
          
          // Add new files to highlighting
          const newFileIds: string[] = newFiles.map((f: ProjectFile) => f.id);
          setNewlyCreatedFiles(prevSet => {
            const newSet = new Set(prevSet);
            newFileIds.forEach((id: string) => newSet.add(id));
            return newSet;
          });
          
          // Remove highlighting after 3 seconds
          setTimeout(() => {
            setNewlyCreatedFiles(prevSet => {
              const newSet = new Set(prevSet);
              newFileIds.forEach((id: string) => newSet.delete(id));
              return newSet;
            });
          }, 3000);
          
          // Show toast for multiple files
          toast.success(`📁 Added ${newFiles.length} file${newFiles.length > 1 ? 's' : ''} to project`, {
            duration: 2000
          });
          
          // Add a summary message for multiple files (Cursor-style)
          const summaryMessage: ChatMessage = {
            id: `summary-${Date.now()}-${Math.random()}`,
            type: 'assistant',
            content: `✅ Generated ${newFiles.length} file${newFiles.length > 1 ? 's' : ''} successfully!`,
            timestamp: new Date(),
            isGenerating: false
          };
          
          setMessages(prev => [...prev, summaryMessage]);
        }
        
        return newProject;
      });
      
      return; // Exit early for project_updated
    }
    
    // Handle individual file_created events
    if (response.type === 'file_created' && response.file) {
      const updatedFile = response.file;
      
      // Update project files
      setProject(prev => {
        if (!prev) return prev;
        
        const existingFileIndex = prev.files.findIndex((f: ProjectFile) => f.path === updatedFile.path);
        
        if (existingFileIndex >= 0) {
          // Update existing file
          const newFiles = [...prev.files];
          newFiles[existingFileIndex] = {
            ...newFiles[existingFileIndex],
            content: updatedFile.content,
            size: updatedFile.size
          };
          
          return { ...prev, files: newFiles };
        } else {
          // Add new file
          console.log(`➕ Adding new file to project: ${updatedFile.path}`);
          
          // Add to newly created files for highlighting
          setNewlyCreatedFiles(prev => {
            const newSet = new Set(prev);
            newSet.add(updatedFile.id);
            return newSet;
          });
          
          // Remove from newly created files after 3 seconds
          setTimeout(() => {
            setNewlyCreatedFiles(prev => {
              const newSet = new Set(prev);
              newSet.delete(updatedFile.id);
              return newSet;
            });
          }, 3000);
          
          return {
            ...prev,
            files: [...prev.files, updatedFile]
          };
        }
      });
      
      // If this file is currently active, update the editor content in real-time
      if (activeFile && activeFile.path === updatedFile.path) {
        console.log(`🔄 Live updating active file: ${updatedFile.path}`);
        
        // Set AI editing indicator
        setAiEditingFile(updatedFile.path);
        
        // Update activeFile state
        setActiveFile(prev => prev ? {
          ...prev,
          content: updatedFile.content,
          size: updatedFile.size
        } : null);
        
        // Show live editing indicator
        toast.success(`✨ AI updated ${updatedFile.path.split('/').pop()}`, {
          duration: 2000,
          icon: '🤖'
        });
        
        // Clear AI editing indicator after a delay
        setTimeout(() => {
          setAiEditingFile(null);
        }, 3000);
      } else {
        // File updated but not currently active
        console.log(`📝 File created but not active: ${updatedFile.path}`);
        toast.success(`📝 Created ${updatedFile.path.split('/').pop()}`, {
          duration: 1500
        });
      }
      
      // Add a separate chat message for this file operation (Cursor-style)
      const fileOperationMessage: ChatMessage = {
        id: `file-op-${Date.now()}-${Math.random()}`,
        type: 'assistant',
        content: `📝 Created ${updatedFile.path}`,
        timestamp: new Date(),
        isGenerating: false,
        fileData: {
          path: updatedFile.path,
          fileId: updatedFile.id
        }
      };
      
      setMessages(prev => [...prev, fileOperationMessage]);
    }
  };

  const handleGenerate = async (prompt?: string, overrideApprovals?: string[]) => {
    const messageContent = prompt || currentMessage.trim();
    if (!messageContent || isGenerating) return; // Prevent multiple simultaneous requests

    // Generate consistent IDs
    const timestamp = Date.now();
    const requestId = `req-${timestamp}`;

    const userMessage: ChatMessage = {
      id: timestamp.toString(),
      type: 'user',
      content: messageContent,
      timestamp: new Date()
    };

    const loadingMessage: ChatMessage = {
      id: requestId, // Use the same ID as the request
      type: 'assistant',
      content: '', // Remove the "Generating..." text from message content
      timestamp: new Date(),
      isGenerating: true
    };

    console.log(`🎯 Creating loading message with ID: ${loadingMessage.id}`);

    if (!prompt) {
      setMessages(prev => [...prev, userMessage, loadingMessage]);
      console.log(`📝 Added user message + loading message (new conversation)`);
      // Clear approved and rejected actions for new conversations
      setApprovedActions([]);
      setRejectedActions([]);
    } else {
      setMessages(prev => [...prev, loadingMessage]);
      console.log(`📝 Added loading message only (continuation)`);
      // Keep approved actions for continuations
    }
    
    setCurrentMessage('');
    setIsGenerating(true);

    try {
      // Use Smart AI Client (automatically chooses WebSocket or SSE)
      console.log(`🚀 Using Smart AI Client (${connectionType}) for: "${messageContent.slice(0, 50)}..."`);
      const finalApprovals = overrideApprovals || approvedActions;
      console.log('🔐 Sending approved actions:', finalApprovals);
      console.log('🔄 Override approvals:', overrideApprovals);
      console.log('📋 State approvals:', approvedActions);

      // Set up event handlers for this request
      const handleAIResponse = (response: AIResponse) => {
        console.log(`🎧 handleAIResponse called with:`, response.type, response.requestId);
        console.log(`🔍 Frontend expecting: ${requestId}, received: ${response.requestId}, match: ${response.requestId === requestId}`);
        if (response.requestId !== requestId) {
          console.log(`⏭️ Skipping response - ID mismatch: expected ${requestId}, got ${response.requestId}`);
          return; // Only handle our request
        }
        
        // Handle different response types (unified for both WebSocket and SSE)
        console.log(`🎯 About to switch on response type:`, response.type);
        switch (response.type) {
          case 'internal_action':
            // Show Cursor-style internal actions
            showInternalAction(response.requestId, response.action || '', response.details || {}, response.message || '');
            break;
            
          case 'content_stream':
          case 'code':
            // Stream content
            console.log(`🔍 Code case triggered:`, response.type, response.content);
            if (response.content && response.content.trim().length > 0) {
              console.log(`📝 About to append content:`, response.content);
              appendMessageContent(loadingMessage.id, response.content);
                  } else {
              console.log(`⚠️ No content to append:`, response.content);
            }
            break;
            
          case 'progress':
          case 'progress_update':
            // Update progress
            updateMessageProgress(loadingMessage.id, response.message || '', response.data?.progress, response.data?.stage);
            break;
            
          case 'typing_start':
            setMessageTyping(loadingMessage.id, true);
            break;
            
          case 'typing_stop':
            setMessageTyping(loadingMessage.id, false);
            break;
            
          case 'permission_request':
          case 'question':
            if (response.data?.requiresApproval) {
              showPermissionRequest(response.requestId, response.message || '', response.data?.permissions || []);
            }
            break;
            
          case 'complete':
            completeMessage(loadingMessage.id, response.message, response.stats);
            // Clean up request handler when request completes
            console.log('🧹 Cleaning up request handler for:', requestId);
            globalRequestHandlers.delete(requestId);
            if (typeof window !== 'undefined' && window.__forgeActiveHandlers) {
              delete window.__forgeActiveHandlers[requestId];
              console.log('🧹 BULLETPROOF cleanup for:', requestId);
                }
            break;
            
          case 'error':
            errorMessage(loadingMessage.id, response.message, response.errorContext, response.canRetry, response.suggestions);
            // Clean up request handler on error
            console.log('🧹 Cleaning up request handler for (error):', requestId);
            globalRequestHandlers.delete(requestId);
            if (typeof window !== 'undefined' && window.__forgeActiveHandlers) {
              delete window.__forgeActiveHandlers[requestId];
              console.log('🧹 BULLETPROOF cleanup for (error):', requestId);
            }
            break;
            
          case 'file_created':
          case 'file_deleted':
          case 'project_updated':
            // Handle file operations
            handleFileOperation(response);
            break;
        }
      };

      // BULLETPROOF SOLUTION - Store handler on window object directly
      console.log('🎧 BULLETPROOF - Storing handler on window for:', requestId);
      
      if (typeof window !== 'undefined') {
        if (!window.__forgeActiveHandlers) {
          window.__forgeActiveHandlers = {};
        }
        window.__forgeActiveHandlers[requestId] = handleAIResponse;
        console.log('✅ BULLETPROOF HANDLER stored for:', requestId);
        console.log('🗂️ Active handlers:', Object.keys(window.__forgeActiveHandlers));
      }

      // Generate code using Smart AI Client
      await smartAIClient.generateCode(requestId, messageContent, {
        projectId: project?.id || undefined,
        activeFile: activeFile?.path || undefined,
        selectedCode: undefined, // TODO: Add selected code support
        model: 'claude-4-sonnet-20250514',
        mode: isCodingMode ? 'coding' : 'conversation',
        approvedActions: finalApprovals,
        rejectedActions: rejectedActions
      });

      // Note: Cleanup will happen in the 'complete' event handler or finally block

    } catch (error: any) {
      console.error('Chat error:', error);
      
      // Handle token-related errors
      if (error.status === 429 || error.isTokenError) {
        const errorData = await error.json?.() || {};
        
        // Remove the loading message entirely for token errors
        setMessages(prev => prev.filter(msg => msg.id !== loadingMessage.id));
        
        // Create a special token error message with link
        const tokenErrorMessage: ChatMessage = {
          id: (Date.now() + Math.random()).toString(),
          type: 'system',
          content: 'Insufficient tokens. Please [top up here](/dashboard/billing) to continue using DevAssistant.io.',
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, tokenErrorMessage]);
        toast.error('Insufficient tokens. Please upgrade your plan.');
      } else {
        setMessages(prev => prev.map(msg => 
          msg.id === loadingMessage.id 
            ? { ...msg, content: 'Sorry, I encountered an error. Please try again.', isGenerating: false }
            : msg
        ));
        toast.error('Failed to process message');
      }
    } finally {
      setIsGenerating(false);
      // DON'T clean up handlers here - they will be cleaned up in the 'complete' event handler
      // This finally block runs immediately after generate() call, not after streaming completes
      console.log('🔄 Generate function completed, but handlers preserved for streaming');
    }
  };

  const handleSendMessage = () => {
    if (currentMessage.trim() && !isGenerating) {
      handleGenerate();
    }
  };

  // Handle prompt parameter after project is loaded
  useEffect(() => {
    const promptParam = searchParams.get('prompt');
    
    if (promptParam && project && messages.length === 0 && !isGenerating) {
      // Clear the prompt from URL to prevent re-triggering
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('prompt');
      window.history.replaceState({}, '', newUrl.toString());
      
      // Add user message and start generation
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: decodeURIComponent(promptParam),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      handleGenerate(decodeURIComponent(promptParam));
    }
  }, [project, messages.length, isGenerating, searchParams]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // For now, just show the file names in the chat input
    // Later we'll integrate this with the AI API
    const fileNames = Array.from(files).map(file => file.name).join(', ');
    const fileMessage = `📎 Uploaded files: ${fileNames}\n\n`;
    setCurrentMessage(prev => fileMessage + prev);
    
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Load individual file content on-demand (Bolt.new style)
  const loadFileContent = useCallback(async (fileId: string, projectId: string): Promise<ProjectFile | null> => {
    // Check if file is already loaded with content
    const existingFile = project?.files.find(f => f.id === fileId);
    if (existingFile?.content) {
      console.log('📋 File already loaded from cache:', fileId);
      return existingFile;
    }

    try {
      setLoadingFileId(fileId);
      
      const response = await fetch(`/api/projects/${projectId}/files/${fileId}`);
      if (!response.ok) throw new Error('Failed to load file content');

      const data = await response.json();
      
      let updatedFile: ProjectFile | null = null;
      
      // Update the file in the project state

      setProject(prev => {
        if (!prev) return prev;
        
        const newProject = {
          ...prev,
          files: prev.files.map(file => {
            if (file.id === fileId) {
              updatedFile = { ...file, content: data.file.content };
              return updatedFile;
            }
            return file;
          })
        };
        
        return newProject;
      });
      
      return updatedFile;
    } catch (error) {
      console.error('Error loading file content:', error);
      toast.error('Failed to load file content');
      return null;
    } finally {
      setLoadingFileId(null);
    }
  }, [project]);

  // Delete file function (Cursor-style)
  const deleteFile = useCallback(async (file: ProjectFile) => {
    if (!project) return;
    
    try {
      const response = await fetch(`/api/files/${project.id}/${encodeURIComponent(file.path)}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete file');
      
      // Remove file from project state
      console.log('🚨 setProject called from handleDeleteFile');
      setProject(prev => {
        if (!prev) return prev;
        
        return {
          ...prev,
          files: prev.files.filter(f => f.id !== file.id)
        };
      });
      
      // Clear active file if it was deleted
      if (activeFile?.id === file.id) {
        const remainingFiles = project.files.filter(f => f.id !== file.id);
        setActiveFile(remainingFiles.length > 0 ? remainingFiles[0] : null);
      }
      
      toast.success(`Deleted ${file.path}`);
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
    }
  }, [project, activeFile]);

  // File Explorer Functions
  const buildFileTree = (files: ProjectFile[]): FileNode[] => {
    const tree: FileNode[] = [];
    const folderMap = new Map<string, FileNode>();

    const filteredFiles = files.filter(file =>
      file.path.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filteredFiles.forEach(file => {
      const parts = file.path.split('/');
      let currentPath = '';

      parts.forEach((part, index) => {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (index === parts.length - 1) {
          const fileNode: FileNode = {
            name: part,
            path: currentPath,
            type: 'file',
            file
          };

          if (parentPath) {
            const parent = folderMap.get(parentPath);
            if (parent) {
              parent.children = parent.children || [];
              parent.children.push(fileNode);
            }
          } else {
            tree.push(fileNode);
          }
        } else {
          if (!folderMap.has(currentPath)) {
            const folderNode: FileNode = {
              name: part,
              path: currentPath,
              type: 'folder',
              children: []
            };

            folderMap.set(currentPath, folderNode);

            if (parentPath) {
              const parent = folderMap.get(parentPath);
              if (parent) {
                parent.children = parent.children || [];
                parent.children.push(folderNode);
              }
            } else {
              tree.push(folderNode);
            }
          }
        }
      });
    });

    const sortNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      }).map(node => ({
        ...node,
        children: node.children ? sortNodes(node.children) : undefined
      }));
    };

    return sortNodes(tree);
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const iconClass = "w-4 h-4";
    
    switch (ext) {
      case 'tsx':
      case 'jsx':
        return <File className={`${iconClass} text-blue-400`} />;
      case 'ts':
      case 'js':
        return <File className={`${iconClass} text-yellow-400`} />;
      case 'css':
      case 'scss':
        return <File className={`${iconClass} text-pink-400`} />;
      case 'html':
        return <File className={`${iconClass} text-orange-400`} />;
      case 'json':
        return <File className={`${iconClass} text-green-400`} />;
      case 'md':
        return <File className={`${iconClass} text-gray-400`} />;
      default:
        return <File className={`${iconClass} text-muted-foreground`} />;
    }
  };

  const renderFileNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isActive = activeFile?.path === node.path;
    const isLoading = node.file && loadingFileId === node.file.id;
    const isNewlyCreated = newlyCreatedFiles.has(node.path);

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 px-2 py-1 cursor-pointer transition-all duration-300 rounded-lg mx-1 relative overflow-hidden group/item ${
            isActive 
              ? 'text-white shadow-sm' 
              : isNewlyCreated
                ? 'bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse'
                : 'text-muted-foreground hover:text-foreground'
          }`}
          style={{ 
            paddingLeft: `${depth * 12 + 8}px`,
            background: isActive 
              ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.15) 100%)'
              : 'transparent',
            border: isActive 
              ? '1px solid rgba(59, 130, 246, 0.3)'
              : '1px solid transparent',
            boxShadow: isActive 
              ? '0 2px 10px rgba(59, 130, 246, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              : 'none',
            backdropFilter: isActive ? 'blur(10px)' : 'none'
          }}
          onClick={async () => {
            if (node.type === 'folder') {
              toggleFolder(node.path);
            } else if (node.file && project) {
              // Load file content on-demand (Bolt.new style)
              if (!node.file.content) {
                const updatedFile = await loadFileContent(node.file.id, project.id);
                if (updatedFile) {
                  setActiveFile(updatedFile);
                }
              } else {
                setActiveFile(node.file);
              }
            }
          }}
          onContextMenu={(e) => {
            if (node.file) {
              e.preventDefault();
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                file: node.file
              });
            }
          }}
        >
          {/* Hover gradient effect - matches SideNavigation */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-300"></div>
          
          {/* Subtle shimmer effect for active file */}
          {isActive && (
            <div 
              className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
                animation: 'shimmer 2s infinite'
              }}
            />
          )}
          
          {node.type === 'folder' ? (
            <>
              {isExpanded ? (
                <ChevronDown className={`w-4 h-4 ${isActive ? 'text-blue-200' : 'text-muted-foreground'}`} />
              ) : (
                <ChevronRight className={`w-4 h-4 ${isActive ? 'text-blue-200' : 'text-muted-foreground'}`} />
              )}
              {isExpanded ? (
                <FolderOpen className={`w-4 h-4 ${isActive ? 'text-blue-300' : 'text-blue-400'}`} />
              ) : (
                <Folder className={`w-4 h-4 ${isActive ? 'text-blue-300' : 'text-blue-400'}`} />
              )}
            </>
          ) : (
            <>
              <div className="w-4" />
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
              ) : (
                <div className={`${isActive ? 'brightness-125' : ''}`}>
                  {getFileIcon(node.name)}
                </div>
              )}
            </>
          )}
          <span className={`text-sm truncate relative z-10 ${
            isLoading 
              ? 'text-blue-400' 
              : isActive 
                ? 'text-white font-medium' 
                : ''
          }`}>
            {node.name}
          </span>
        </div>

        {node.type === 'folder' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderFileNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Editor Functions
  const getLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'tsx':
      case 'jsx':
        return 'typescript';
      case 'ts':
        return 'typescript';
      case 'js':
        return 'javascript';
      case 'css':
        return 'css';
      case 'scss':
        return 'scss';
      case 'html':
        return 'html';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      default:
        return 'plaintext';
    }
  };

  const handleFileUpdate = (fileId: string, newContent: string) => {
    if (!project) return;

    const updatedFiles = project.files.map(file =>
      file.id === fileId ? { ...file, content: newContent } : file
    );

    console.log('🚨 setProject called from handleFileUpdate');
    setProject({ ...project, files: updatedFiles });

    if (activeFile?.id === fileId) {
      setActiveFile({ ...activeFile, content: newContent });
    }
  };

  // Debounced save function with rate limiting
  const debouncedSave = useCallback(async (content: string, fileId: string, projectId: string) => {
    const now = Date.now();
    const timeSinceLastSave = now - lastSaveTime;
    const minInterval = 1000; // Minimum 1 second between saves
    
    if (timeSinceLastSave < minInterval) {
      // If too soon, schedule for later
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        debouncedSave(content, fileId, projectId);
      }, minInterval - timeSinceLastSave);
      return;
    }
    
    try {
      setIsSaving(true);
      setLastSaveTime(now);
      
      const response = await fetch(`/api/projects/${projectId}/files/${fileId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });
      
      if (!response.ok) {
        throw new Error(`Save failed: ${response.status}`);
      }
      
      const updatedFile = await response.json();
      
      // Update local state
    setOriginalContent(content);
    setHasUnsavedChanges(false);
      
      // Update the active file content
      if (activeFile) {
        setActiveFile({ ...activeFile, content });
      }
      
      toast.success('File saved successfully');
      
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save file. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [lastSaveTime, activeFile]);

  const handleSaveFile = async () => {
    if (!editorInstanceRef.current || !activeFile || !project || isSaving) return;
    
    const content = editorInstanceRef.current.getValue();
    
    // Check if content actually changed
    if (content === originalContent) {
      toast.info('No changes to save');
      return;
    }
    
    await debouncedSave(content, activeFile.id, project.id);
  };

  const handleCopyContent = async () => {
    if (!editorInstanceRef.current) return;
    const content = editorInstanceRef.current.getValue();
    await navigator.clipboard.writeText(content);
    toast.success('Content copied to clipboard');
  };







  // Action Handlers
  const handleDeploy = async () => {
    if (!project) return;

    // Check if user is on free plan and show upgrade prompt
    const user = authService.getCurrentUser();
    if (user?.plan === 'free') {
      toast.error('Deployments require a paid plan', {
        duration: 8000,
        action: {
          label: 'Upgrade Plan',
          onClick: () => window.open('/pricing', '_blank')
        }
      });
      return;
    }

    try {
      setIsGenerating(true); // Show loading state
      
      const response = await fetch('/api/deployments/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'Deployment limit reached') {
          toast.error(`Deployment limit reached (${data.current}/${data.limit})`, {
            duration: 8000,
            action: {
              label: 'Upgrade Plan',
              onClick: () => window.open('/pricing', '_blank')
            }
          });
        } else if (data.code === 'PLAN_UPGRADE_REQUIRED') {
          toast.error(data.error, {
            duration: 8000,
            action: {
              label: 'Upgrade Plan',
              onClick: () => window.open('/pricing', '_blank')
            }
          });
        } else {
          throw new Error(data.error || 'Deploy failed');
        }
        return;
      }

      toast.success(`Deployment started! Your app will be available at ${data.subdomain}.railway.app in ${data.estimatedTime}`);
      
      // Start polling for deployment status
      pollDeploymentStatus(project.id);
      
    } catch (error) {
      console.error('Deploy error:', error);
      toast.error('Failed to start deployment');
    } finally {
      setIsGenerating(false);
    }
  };

  // Poll deployment status
  const pollDeploymentStatus = async (projectId: string) => {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/deployments/status/${projectId}`);
        const data = await response.json();

        if (data.status === 'deployed') {
          toast.success(`🚀 Deployment successful! Your app is live at: ${data.url}`, {
            duration: 10000,
            action: {
              label: 'Open App',
              onClick: () => window.open(data.url, '_blank')
            }
          });
          return;
        } else if (data.status === 'failed') {
          toast.error('Deployment failed. Check logs for details.');
          return;
        } else if (data.status === 'building' && attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else if (attempts >= maxAttempts) {
          toast.error('Deployment is taking longer than expected. Please check status manually.');
        }
      } catch (error) {
        console.error('Failed to poll deployment status:', error);
      }
    };

    poll();
  };

  const handleExport = async () => {
    if (!project) return;

    try {
      console.log(`🚀 Starting export for project: ${project.name}`);
      const response = await fetch(`/api/builder/export/${project.id}`);
      console.log(`📡 Response status: ${response.status} ${response.statusText}`);
      console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.code === 'PLAN_UPGRADE_REQUIRED') {
          toast.error(errorData.error, {
            duration: 8000,
            action: {
              label: 'Upgrade Plan',
              onClick: () => window.open('/pricing', '_blank')
            }
          });
          return;
        }
        throw new Error('Export failed');
      }

      // Ensure we get the blob as application/zip
      const blob = await response.blob();
      console.log(`📦 Received blob: ${blob.size} bytes, type: ${blob.type}`);
      
      // Check if blob is empty or too small
      if (blob.size === 0) {
        throw new Error('Received empty file');
      }
      if (blob.size < 22) { // Minimum ZIP file size
        throw new Error(`File too small to be valid ZIP: ${blob.size} bytes`);
      }

      // Read first few bytes to check ZIP signature
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const signature = Array.from(uint8Array.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('');
      console.log(`🔍 File signature (first 4 bytes): ${signature} (should be 504b0304 for ZIP)`);

      const zipBlob = new Blob([blob], { type: 'application/zip' });
      console.log(`✅ Created ZIP blob: ${zipBlob.size} bytes`);
      
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log(`🎉 Download triggered successfully`);
      toast.success('Project exported successfully!');
    } catch (error) {
      console.error('❌ Export error:', error);
      toast.error('Failed to export project');
    }
  };

  const handleDirectGitHubConnect = () => {
    
    // Calculate center position for popup
    const width = 600;
    const height = 700;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    // Open GitHub OAuth in popup directly
    const popup = window.open(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/github/popup`,
      'github-auth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      toast.error('Popup blocked', {
        description: 'Please allow popups for this site and try again'
      });
      return;
    }

    // Listen for success and auto-retry push
    let channel: BroadcastChannel | null = null;
    
    const cleanup = () => {
      window.removeEventListener('storage', handleStorageChange);
      channel?.close();
    };

    const handleStorageChange = async (event: StorageEvent) => {
      if (event.key === 'github-auth-trigger') {
        const data = localStorage.getItem('github-auth-success');
        if (data) {
          try {
            const message = JSON.parse(data);
            if (message.type === 'GITHUB_AUTH_SUCCESS') {
              cleanup();
              const toastId = toast.success('GitHub connected successfully!', {
                action: {
                  label: 'Push to GitHub',
                  onClick: () => {
                    handleGithub();
                    toast.dismiss(toastId);
                  }
                }
              });
            }
          } catch (e) {
            console.error('Failed to parse GitHub auth message:', e);
          }
        }
      }
    };

    try {
      channel = new BroadcastChannel('github-auth');
      channel.onmessage = async (event) => {
        if (event.data.type === 'GITHUB_AUTH_SUCCESS') {
          cleanup();
          const toastId = toast.success('GitHub connected successfully!', {
            action: {
              label: 'Push to GitHub',
              onClick: () => {
                handleGithub();
                toast.dismiss(toastId);
              }
            }
          });
        }
      };
    } catch (e) {
      console.log('BroadcastChannel not supported, using localStorage fallback');
    }

    window.addEventListener('storage', handleStorageChange);
    
    // Cleanup after 5 minutes
    setTimeout(cleanup, 5 * 60 * 1000);
  };

  const handleGithub = async (projectData?: BuilderProject) => {
    const currentProject = projectData || project;
    if (!currentProject) return;

    // Prevent multiple simultaneous pushes
    if (isGitHubPushing) return;
    setIsGitHubPushing(true);

    let loadingToast: string | number | undefined;

    try {
      const response = await fetch(`/api/builder/github/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            projectId: currentProject.id
          })
        });

        // Handle 401 Unauthorized (not authenticated with GitHub)
        if (response.status === 401) {
          setIsGitHubPushing(false);
          toast.error('GitHub authentication required', {
            action: {
              label: 'Connect GitHub',
              onClick: () => {
                handleDirectGitHubConnect();
              }
            }
          });
          return;
        }

        // Show loading toast only after we know user is authenticated
        loadingToast = toast.loading('Pushing to GitHub...', {
          description: 'Creating repository and uploading files'
        });

        const data = await response.json();

              if (!response.ok) {
        toast.dismiss(loadingToast);
        setIsGitHubPushing(false);
        
        // Handle specific error codes
        if (data.code === 'PLAN_UPGRADE_REQUIRED') {
          toast.error(data.error, {
            duration: 8000,
            action: {
              label: 'Upgrade Plan',
              onClick: () => window.open('/pricing', '_blank')
            }
          });
        } else if (data.code === 'GITHUB_AUTH_REQUIRED') {
          toast.error('GitHub authentication required', {
            action: {
              label: 'Connect GitHub',
              onClick: () => {
                handleDirectGitHubConnect();
              }
            }
          });
        } else if (data.code === 'GITHUB_REPO_CREATION_FAILED') {
          toast.error('Failed to create GitHub repository', {
            description: data.details || 'Repository name may already exist',
            action: {
              label: 'Try Again',
              onClick: () => {
                handleGithub(currentProject);
              }
            }
          });
        } else {
          toast.error('GitHub push failed', {
            description: data.error || 'An unexpected error occurred'
          });
        }
        return;
      }

              toast.dismiss(loadingToast);
      setIsGitHubPushing(false);
      console.log('✅ GitHub push successful:', data.result);

      // Handle no changes case
      if (data.result.noChanges) {
        toast.success('No new changes detected', {
          action: {
            label: 'View Repository',
            onClick: () => {
              window.open(data.result.repositoryUrl, '_blank');
            }
          }
        });
      } else {
      toast.success('Successfully pushed to GitHub! 🎉', {
          description: `${data.result.filesUpdated} files updated`,
        action: {
          label: 'View Repository',
          onClick: () => {
            window.open(data.result.repositoryUrl, '_blank');
          }
        }
      });
      }

      } catch (pushError) {
        if (loadingToast) {
          toast.dismiss(loadingToast);
        }
        setIsGitHubPushing(false);
        console.error('GitHub push error:', pushError);
        
        toast.error('GitHub push failed', {
          description: 'Please check your connection and try again'
        });
    }
  };

  const handlePublish = async () => {
    // Use the existing deploy functionality for "Publish"
    await handleDeploy();
  };

  const fileTree = project ? buildFileTree(project.files) : [];

  if (isLoadingProject || (searchParams.get('projectId') && !project)) {
    return (
      <DashboardLayout activeTab="projects">
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Loading Project</h2>
            <p className="text-muted-foreground">Fetching project files and configuration...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      {/* Top Navigation - Fixed to screen top */}
      <BuilderHeader
                  projectName={project?.name || 'DevAssistant.io'}
        fileCount={project?.files?.length || 0}
        layout={layout}
        onLayoutChange={setLayout}
        onPublish={handlePublish}
        onGithub={handleGithub}
        onExport={handleExport}
        projectId={project?.id}
        isGitHubProcessing={isGitHubPushing}
        userPlan={userPlan}

        projectData={project ? {
          id: project.id,
          name: project.name,
          description: project.description || '',
          dbName: (project as any).dbName || '',
          dbHost: (project as any).dbHost || '',
          dbUser: (project as any).dbUser || '',
          dbPassword: (project as any).dbPassword || '',
          repoUrl: (project as any).repoUrl || '',
          branch: (project as any).branch || 'main',
          tokensUsed: (project as any).tokensUsed || 0,
          githubRepoId: (project as any).githubRepoId || '',
          githubRepoName: (project as any).githubRepoName || '',
          githubInstallationId: (project as any).githubInstallationId || '',
          githubPrivate: (project as any).githubPrivate || false
        } : undefined}
      />
      
      {/* Custom Layout for Builder - Full Viewport */}
      <div className="min-h-screen bg-background relative">
        {/* Background Image */}
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-40"
          style={{ backgroundImage: 'url(/dashboard-background.png)' }}
        ></div>
        
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <SideNavigation 
          activeTab="projects"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* Main Content Area - Account for fixed header and sidebar */}
        <div className="fixed inset-0 pt-16 lg:pl-11 flex flex-col bg-transparent">
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar: Chat Only */}
            <div className="flex flex-col luxury-card transition-all duration-300" style={{ 
              width: isChatHidden ? '48px' : leftPaneWidth,
              borderLeft: 'none',
              borderRadius: '0'
            }}>
              {/* Chat Messages */}
              {!isChatHidden && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  
                  {/* Load More Messages Button */}
                  {hasMoreMessages && (
                    <div className="flex justify-center pb-4">
                      <button
                        onClick={loadMoreMessages}
                        disabled={isLoadingMoreMessages}
                      className="px-4 py-2 text-sm font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-muted-foreground hover:text-foreground"
                      >
                        {isLoadingMoreMessages ? (
                          <>
                          <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          Load More Messages
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  
                                {messages.map((message, index) => {
                  // Check if it's a file operation message (regardless of type)
                  const isFileOperation = message.content.includes('Deleted file:') ||
                                        message.content.includes('Installed package:') ||
                                        (message.content.includes('Created') && message.content.length < 100 && !message.content.startsWith('Created file:')) || 
                                        (message.content.includes('Modified') && message.content.length < 100 && !message.content.startsWith('Modified file:')) || 
                                        (message.content.includes('Deleted') && message.content.length < 100) ||
                                        message.content.includes('✅') ||
                                        message.content.includes('❌');
                  
                  // Render file operations as sleek status indicators
                  if (isFileOperation) {
                    return (
                      <div key={`${message.id}-${index}`} className="flex justify-start my-2">
                        <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground/70">
                          <div className="w-1 h-1 bg-muted-foreground/40 rounded-full"></div>
                          <span>{message.content}</span>
                        </div>
                      </div>
                    );
                  }
                  
                  // Render system messages as centered text
                  if (message.type === 'system') {
                    return (
                      <div key={`${message.id}-${index}`} className="flex justify-center my-4">
                        <div className="text-center text-muted-foreground text-sm max-w-md">
                          {message.content}
                        </div>
                      </div>
                    );
                  }
                  
                  // File operation messages (render inline without card)
                  if (message.type === 'assistant' && isFileOperationMessage(message)) {
                    return (
                      <div key={`${message.id}-${index}`} className="flex justify-start my-1">
                        <div className="text-foreground">
                          {renderMessageWithFileHandling(message)}
                        </div>
                      </div>
                    );
                  }
                  
                  // Regular user/assistant messages
                  return (
                    <div
                      key={`${message.id}-${index}`}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} group`}
                    >
                      <div
                        className={`max-w-[80%] relative overflow-hidden transition-all duration-300 ${
                          message.type === 'user'
                            ? 'text-white rounded-xl p-4'
                            : 'text-foreground rounded-xl p-0'
                        }`}
                        style={{
                          background: message.type === 'user'
                            ? 'linear-gradient(135deg, #2E2A5D 0%, #5A3F9E 25%, #2D8EFF 75%, #00D2C6 100%)'
                            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)',
                          backdropFilter: 'blur(20px)',
                          border: message.type === 'user' 
                            ? 'none'
                            : '1px solid rgba(255, 255, 255, 0.12)',
                          boxShadow: message.type === 'user'
                            ? '0 8px 32px rgba(45, 142, 255, 0.25), 0 2px 8px rgba(0, 0, 0, 0.1)'
                            : '0 4px 20px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                        }}
                      >
                                          {/* DevAssistant.io label for assistant messages (except file operations) */}
                    {message.type === 'assistant' && !isFileOperationMessage(message) && (
                      <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between">
                        <span className="text-xs font-medium text-white/70 tracking-wide">DEVASSISTANT.IO</span>
                        <button
                          onClick={() => {
                            // TODO: Implement report problem functionality
                            toast.info('Report problem feature coming soon');
                          }}
                          className="p-1 rounded transition-all duration-300 text-white/50 hover:text-white/80"
                          title="Report a problem with this response"
                        >
                          <AlertCircle className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                      
                      {/* Subtle shimmer effect for user messages */}
                      {message.type === 'user' && (
                        <div 
                          className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20"
                          style={{
                            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent)',
                            animation: 'shimmer 3s infinite'
                          }}
                        />
                      )}
                      
                      {message.isGenerating && !message.content.trim() ? (
                        // Show generating indicator immediately after FORMA header when no content
                        <div className="flex items-center gap-2 px-4 py-3 text-sm opacity-70">
                          <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
                          <AnimatedDots />
                        </div>
                      ) : (
                        // Show content with normal padding when there is content
                        <div className={`whitespace-pre-wrap break-words overflow-hidden relative z-10 leading-relaxed ${
                          message.type === 'assistant' ? 'p-4' : ''
                        } ${message.isError ? 'border-l-4 border-red-500 bg-red-50/10' : ''}`}>
                          {renderMessageWithFileHandling(message)}
                          
                          {/* Enhanced progress indicator with progress bar */}
                          {message.isGenerating && (
                            <div className="mt-3 space-y-2">
                              {/* Progress bar */}
                              {typeof message.progress === 'number' && (
                                <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                                  <div 
                                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${message.progress}%` }}
                                  />
                                </div>
                              )}
                              
                              {/* Typing or generating indicator */}
                              <div className="flex items-center gap-2 text-sm opacity-70">
                                {message.isTyping ? (
                                  <>
                                    <div className="flex gap-1">
                                      <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                      <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                      <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                    <span>Thinking...</span>
                                  </>
                                ) : (
                                  <>
                              <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
                              <AnimatedDots />
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Error Retry Button */}
                          {message.isError && (
                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={() => {
                                  // Find the user message that caused this error and retry immediately
                                  const messageIndex = messages.findIndex(m => m.id === message.id);
                                  if (messageIndex > 0) {
                                    const userMessage = messages[messageIndex - 1];
                                    if (userMessage.type === 'user') {
                                      // Remove the error message from the chat
                                      setMessages(prev => prev.filter(m => m.id !== message.id));
                                      // Immediately retry with the original user message
                                      handleGenerate(userMessage.content);
                                    }
                                  }
                                }}
                                className="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-500 hover:scale-105 overflow-hidden"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                                  backdropFilter: 'blur(20px)',
                                  border: '1px solid rgba(255, 255, 255, 0.2)',
                                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                  color: '#ffffff',
                                  transform: 'translateY(0)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                                  
                                  // Trigger shimmer effect
                                  const shimmer = e.currentTarget.querySelector('.shimmer-effect') as HTMLElement;
                                  if (shimmer) {
                                    shimmer.style.transition = 'transform 0.5s ease-out';
                                    shimmer.style.transform = 'translateX(100%)';
                                    setTimeout(() => {
                                      shimmer.style.transition = 'none';
                                      shimmer.style.transform = 'translateX(-100%)';
                                    }, 500);
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                }}
                              >
                                {/* Shimmer effect */}
                                <div 
                                  className="shimmer-effect absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                  style={{
                                    transform: 'translateX(-100%)',
                                    transition: 'none'
                                  }}
                                />
                                
                                <svg className="w-3 h-3 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span className="relative z-10">Retry</span>
                              </button>
                        </div>
                          )}
                        </div>
                      )}
                        
                        {/* Cursor-style Minimal Permission Request */}
                        {message.permissionData && (
                        <div className="mt-3 space-y-2 px-4 pb-4">
                            {message.permissionData.map((permission) => (
                              <div key={permission.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-md border">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">
                                    {permission.type === 'delete_file' ? 'Deleting file:' : 
                                     permission.type === 'modify_file' ? 'Modifying file:' : 
                                     'Action on file:'}
                                  </span>
                                  <code className="text-sm font-mono bg-secondary px-2 py-1 rounded">
                                    {permission.path}
                                  </code>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      // Track rejected actions
                                      const newRejectedActions = [...rejectedActions, ...message.permissionData!.map(p => p.id)];
                                      setRejectedActions(newRejectedActions);
                                      
                                      // Remove this permission message
                                      setMessages(prev => prev.filter(msg => msg.id !== message.id));
                                      
                                      console.log(`❌ Rejected actions:`, newRejectedActions);
                                    }}
                                    className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground border border-border rounded hover:bg-secondary/50 transition-colors"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={async () => {
                                      // Prevent multiple clicks
                                      if (isGenerating) return;
                                      
                                      // Approve all permissions and continue generation
                                      const newApprovedActions = [...approvedActions, ...message.permissionData!.map(p => p.id)];
                                      setApprovedActions(newApprovedActions);
                                      
                                      // Remove this permission message
                                      setMessages(prev => prev.filter(msg => msg.id !== message.id));
                                      
                                      // Find the original user message that triggered this
                                      const userMessages = messages.filter(m => m.type === 'user');
                                      const lastUserMessage = userMessages[userMessages.length - 1];
                                      
                                      if (lastUserMessage) {
                                        // Pass approved actions directly to avoid state timing issues
                                        handleGenerateWithApprovals(lastUserMessage.content, newApprovedActions);
                                      }
                                    }}
                                    className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                                  >
                                    Approve
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                          </div>
                      </div>
                  );
                })}
                  <div ref={messagesEndRef} />
                </div>
              )}
              <div className="p-4 border-t border-border/30">
                {/* Mode and Upload Buttons */}
                  <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-h-[40px]">
                    {!isChatHidden && (
                      <>
                      <button
                        onClick={() => setIsCodingMode(!isCodingMode)}
                          className="p-2 rounded-lg transition-all duration-300 text-gray-300 hover:text-white flex items-center justify-center min-h-[40px] min-w-[40px]"
                          title={isCodingMode ? "Switch to Chat Mode" : "Switch to Code Mode"}
                        >
                          {isCodingMode ? (
                            <Code className="w-4 h-4" />
                          ) : (
                            <MessageCircle className="w-4 h-4" />
                          )}
                        </button>
                        
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept="image/*,.pdf,.txt,.md,.json,.js,.ts,.jsx,.tsx,.py,.java,.cpp,.c,.html,.css,.xml,.csv"
                          className="hidden"
                          multiple
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 rounded-lg transition-all duration-300 text-gray-300 hover:text-white flex items-center justify-center min-h-[40px] min-w-[40px]"
                          title="Upload files"
                        >
                          <Paperclip className="w-4 h-4" />
                      </button>
                      </>
                    )}
                    </div>
                  
                  <button
                    onClick={() => setIsChatHidden(!isChatHidden)}
                    className="rounded-lg transition-all duration-300 text-gray-300 hover:text-white"
                    title={isChatHidden ? "Show Chat" : "Hide Chat"}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '40px',
                      width: '40px',
                      padding: '0',
                      margin: '0',
                      border: 'none',
                      background: 'transparent'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        fontSize: '24px',
                        lineHeight: '1',
                        transform: isChatHidden ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease'
                      }}
                    >
                      ‹
                    </div>
                  </button>
                  </div>
                
                {/* Chat Input */}
                {!isChatHidden && (
                  <div className="relative">
                    <textarea
                      ref={chatInputRef}
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={isCodingMode ? "Describe what you want to build..." : "Ask me anything..."}
                    className="w-full resize-none transition-all duration-300 placeholder:text-muted-foreground/60 text-foreground px-6 py-4 pr-24 text-base luxury-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                    style={{
                      fontFamily: 'inherit'
                    }}
                      rows={3}
                      disabled={isGenerating}
                    />
                    <button
                      onClick={handleSendMessage}
                    disabled={isGenerating}
                    className={`button-enter-no-lift text-sm px-4 py-2 absolute top-1/2 -translate-y-1/2 right-4 disabled:cursor-not-allowed z-10 transition-all duration-300 ${
                      currentMessage.trim() 
                        ? 'opacity-100 scale-100 pointer-events-auto' 
                        : 'opacity-0 scale-95 pointer-events-none'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    </button>
                  </div>
                )}
                </div>
            </div>

            {/* Center: Editor area with Files Sidebar */}
            {project ? (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 flex overflow-hidden">
                  {/* Code Editor with Files Sidebar */}
                  <div className={`${layout === 'split' ? 'flex-1 min-w-0' : layout === 'code' ? 'flex-1' : 'hidden'} flex luxury-card`}
                    style={{
                      borderRadius: '0'
                    }}
                  >
                    {/* Files Sidebar - Cursor-style */}
                    <div className="w-48 flex flex-col border-r border-border/30" style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      backdropFilter: 'blur(20px)'
                                          }}>
                        {/* Files Header */}
                        <div className="flex items-center justify-end gap-2 p-4">
                    <button
                            onClick={() => {
                              setShowSearchInput(!showSearchInput);
                              if (!showSearchInput) {
                                // Focus the search input when opening
                                setTimeout(() => {
                                  const searchInput = document.querySelector('#file-search-input') as HTMLInputElement;
                                  if (searchInput) searchInput.focus();
                                }, 100);
                              } else {
                                // Clear search when closing
                                setSearchQuery('');
                              }
                            }}
                            className={`p-2 rounded-lg transition-all duration-300 ${
                              showSearchInput 
                                ? 'text-blue-400' 
                                : 'text-gray-300 hover:text-white'
                            }`}
                            title="Search Files"
                          >
                            <Search className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 rounded-lg transition-all duration-300 text-gray-300 hover:text-white"
                      title="New File"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                        
                        {/* Search Input - Toggleable */}
                        {showSearchInput && (
                          <div className="px-4 pb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                    <input
                                id="file-search-input"
                      type="text"
                      placeholder="Search files..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') {
                                    setShowSearchInput(false);
                                    setSearchQuery('');
                                  }
                                }}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-secondary/30 border border-border/30 rounded-md focus:border-primary/50 focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all text-foreground placeholder:text-muted-foreground/60"
                    />
                  </div>
                </div>
                        )}
                        
                        {/* Files Tree */}
                <div className="flex-1 overflow-y-auto">
                  {fileTree.length > 0 ? (
                          <div>
                      {fileTree.map(node => renderFileNode(node))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      {searchQuery ? 'No files match your search' : 'No files yet'}
                    </div>
                  )}
                </div>
                      

              </div>

                    {/* Code Editor */}
                    <div className="flex-1 flex flex-col">
                    {activeFile ? (
                      <>
                          {/* Editor Header */}
                          <div className="flex items-center justify-between p-4 border-b border-border/30"
                            style={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.02)',
                              backdropFilter: 'blur(20px)'
                            }}
                          >
                          <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-medium text-white">{activeFile.path}</span>
                              </div>
                            {hasUnsavedChanges && (
                                <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" title="Unsaved changes" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleCopyContent}
                                className="p-2 rounded-lg transition-all duration-300 text-gray-300 hover:text-white"
                              title="Copy content"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleSaveFile}
                                disabled={isSaving || !hasUnsavedChanges}
                                className={`p-2 rounded-lg transition-all duration-300 ${
                                  isSaving 
                                    ? 'text-blue-400 cursor-not-allowed' 
                                    : hasUnsavedChanges 
                                      ? 'text-gray-300 hover:text-white' 
                                      : 'text-gray-500 cursor-not-allowed'
                                }`}
                                title={
                                  isSaving 
                                    ? 'Saving...' 
                                    : hasUnsavedChanges 
                                      ? 'Save (Ctrl+S)' 
                                      : 'No changes to save'
                                }
                              >
                                {isSaving ? (
                                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                              <Save className="w-4 h-4" />
                                )}
                            </button>
                          </div>
                        </div>
                          
                          {/* Editor Content */}
                        {isEditorLoading ? (
                          <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                              <p className="text-muted-foreground">Loading editor...</p>
                            </div>
                          </div>
                        ) : (
                            <div className="flex-1 relative overflow-hidden">
                              {/* AI Editing Indicator */}
                              {aiEditingFile === activeFile?.path && (
                                <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-b border-blue-400/30 backdrop-blur-sm">
                                  <div className="flex items-center gap-2 px-4 py-2 text-sm">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                                      <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
                                      <span className="text-blue-100 font-medium">AI is editing this file...</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              <div className="absolute inset-0" ref={editorRef} />
                            </div>
                        )}
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto bg-secondary/50 border border-border/30"
                              style={{
                                backdropFilter: 'blur(20px)',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                              }}
                            >
                              <Code className="w-8 h-8 text-blue-400" />
                        </div>
                            <h3 className="text-lg font-medium mb-2 text-white">No File Selected</h3>
                            <p className="text-muted-foreground">Choose a file from the explorer to start editing</p>
                      </div>
                  </div>
                )}
                    </div>
                  </div>

                {/* Preview Pane */}
                  {project?.id && !isLoadingProject && (
                  <>
                      <div className={layout === 'preview' ? 'flex-1' : layout === 'split' ? 'flex-1 min-w-0' : 'hidden'}>
                      <PreviewPane 
                          projectId={project.id}
                          isVisible={layout === 'split' || layout === 'preview'}
                          hasFiles={project.files.length > 0}
                          preventRestart={false}
                          userPlan={userPlan}
                      />
                    </div>
                  </>
                )}

                {/* Loading state for preview area when project is loading */}
                {isLoadingProject && (layout === 'split' || layout === 'preview') && (
                  <div className={layout === 'preview' ? 'flex-1' : layout === 'split' ? 'flex-1 min-w-0' : 'hidden'}>
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-900">
                      <div className="flex items-center gap-3 mb-4">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                        <h3 className="text-xl font-semibold text-white">Loading Project...</h3>
              </div>
                      <p className="text-muted-foreground max-w-sm">
                        Setting up your development environment
                      </p>
                    </div>
                  </div>
                )}

              </div>


            </div>
          ) : (
            /* No Project - Show Welcome */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md luxury-card p-12">
                <Sparkles className="w-16 h-16 text-primary mx-auto mb-6" />
                <h2 className="text-2xl font-semibold mb-3">Start Building</h2>
                <p className="text-muted-foreground mb-6">
                  Describe your project in the chat and DevAssistant.io will generate a complete application for you.
                </p>
                <div className="text-sm text-muted-foreground">
                  Try: "Build a todo app with React and TypeScript"
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Context Menu (Cursor-style) */}
      {contextMenu && (
        <div
          className="fixed bg-popover border border-border rounded-md shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              setShowDeleteDialog(contextMenu.file);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/50 text-destructive flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Delete {contextMenu.file.path}
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog (Cursor-style) */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-popover border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <h3 className="text-lg font-semibold">Delete File</h3>
            </div>
            
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete <span className="font-mono text-foreground">{showDeleteDialog.path}</span>? 
              This action cannot be undone.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteDialog(null)}
                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-secondary/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await deleteFile(showDeleteDialog);
                  setShowDeleteDialog(null);
                }}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
                     </div>
         </div>
       )}



      {/* GitHub Repository Selection Dialog - Only render when needed */}
      {showGitHubRepo && (
      <GitHubRepoDialog
        isOpen={showGitHubRepo}
        onClose={() => {
          console.log('Closing GitHubRepoDialog');
          setShowGitHubRepo(false);
        }}
        projectId={project?.id || ''}
        projectName={project?.name || ''}
        onSuccess={async (repo) => {
          console.log('Repository connected:', repo);
          setShowGitHubRepo(false);
          toast.success(`Connected to ${repo.full_name}! Pushing project...`);
          
          // Refresh project data to get the updated GitHub connection
          if (project?.id) {
            const freshProject = await loadExistingProject(project.id, true, false);
            
            if (freshProject) {
              handleGithub(freshProject);
            }
          }
        }}
      />
      )}


    </>
  );
} 