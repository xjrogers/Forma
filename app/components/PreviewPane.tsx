'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  Play, 
  Square, 
  RotateCcw, 
  ExternalLink,
  Terminal,
  Smartphone, 
  Tablet, 
  Monitor,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Edit3,
  Wand2
} from 'lucide-react';
import VisualEditor from './VisualEditor';
import { Environment, EnvironmentConfig } from '@/lib/environment';

// WebContainer imports - these will be loaded dynamically
let WebContainer: any = null;
let globalWebContainerInstance: any = null; // Single global instance (WebContainer limitation)
let isWebContainerBooting = false; // Prevent multiple boot attempts
let isSDKLoading = false; // Prevent multiple SDK loads

interface PreviewPaneProps {
  projectId: string;
  isVisible: boolean;
  hasFiles?: boolean;
  preventRestart?: boolean;
  userPlan?: string;
}

interface PreviewStatus {
  id: string;
  projectId: string;
  status: 'initializing' | 'ready' | 'error' | 'stopped';
  previewUrl: string;
  framework: string;
  lastUpdated: string;
  files: Array<{ path: string; content: string }>;
}

type ViewportSize = 'mobile' | 'tablet' | 'desktop';

const VIEWPORT_SIZES = {
  mobile: { width: 375, height: 667, label: 'Mobile' },
  tablet: { width: 768, height: 1024, label: 'Tablet' },
  desktop: { width: 1200, height: 800, label: 'Desktop' }
};

// Common dependency cache for faster installs
const FRAMEWORK_DEPENDENCIES: Record<string, {
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
}> = {
  'react-vite': {
    dependencies: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0'
    },
    devDependencies: {
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      '@vitejs/plugin-react': '^4.0.0',
      'vite': '^4.4.0',
      'typescript': '^5.0.0'
    }
  },
  'nextjs': {
    dependencies: {
      'next': '^13.4.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0'
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      'typescript': '^5.0.0'
    }
  }
};

interface ProgressStep {
  step: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  message?: string;
}

function PreviewPane({ projectId, isVisible, hasFiles = true, preventRestart = false, userPlan = 'free' }: PreviewPaneProps) {
  
  const [isLoading, setIsLoading] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [currentStep, setCurrentStep] = useState<string>('');
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [webcontainerReady, setWebcontainerReady] = useState(false);
  const [webcontainerError, setWebcontainerError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false); // Track if preview is currently starting
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [preview, setPreview] = useState<any>(null);
  const [shouldAutoStart, setShouldAutoStart] = useState(true); // Track if auto-start should happen - start as true
  const [isVisualEditorActive, setIsVisualEditorActive] = useState(false);
  
  // Track if we've ever started the preview process for this project
  const [hasStartedPreview, setHasStartedPreview] = useState(false);
  
  // Determine if we should show loading state immediately
  const shouldShowLoadingState = !previewUrl && (isLoading || isStarting || shouldAutoStart || hasStartedPreview) && projectId && hasFiles;
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const webcontainerRef = useRef<any>(null);
  const startTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Debounce timer
  const previewStatusCheckedRef = useRef<string | null>(null); // Track which project we've checked
  const isCreatingPreviewRef = useRef<boolean>(false); // Track if preview creation is in progress

  // Helper function to manage sequential progress steps
  const updateProgressStep = (stepName: string, status: 'active' | 'complete' | 'error', message: string) => {
    setProgressSteps(prev => {
      // Find if step already exists
      const existingIndex = prev.findIndex(step => step.step === stepName);
      
      if (existingIndex >= 0) {
        // Update existing step
        const updated = [...prev];
        updated[existingIndex] = { step: stepName, status, message };
        return updated;
      } else {
        // Add new step
        return [...prev, { step: stepName, status, message }];
      }
    });
  };

  // Helper to complete a step and move to next
  const completeStep = (stepName: string, message: string) => {
    updateProgressStep(stepName, 'complete', message);
  };

  // Helper to start a new step
  const startStep = (stepName: string, message: string) => {
    updateProgressStep(stepName, 'active', message);
  };

  // Helper to mark step as error
  const errorStep = (stepName: string, message: string) => {
    updateProgressStep(stepName, 'error', message);
  };

  // Component mount/unmount logging
  useEffect(() => {
    console.log('🔄 PreviewPane MOUNTED for project:', projectId);
    return () => {
      console.log('💀 PreviewPane UNMOUNTING for project:', projectId);
      // Reset creation flag on unmount
      isCreatingPreviewRef.current = false;
    };
  }, [projectId]);

  // Cleanup WebContainer when component unmounts completely (page navigation)
  useEffect(() => {
    // Add beforeunload listener to cleanup WebContainer on page navigation/close
    const handleBeforeUnload = () => {
      if (globalWebContainerInstance) {
        try {
          console.log('🧹 Cleaning up WebContainer on page unload...');
          // Synchronous cleanup for beforeunload
          globalWebContainerInstance = null;
          isWebContainerBooting = false;
        } catch (error) {
          console.error('❌ Error during beforeunload cleanup:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Only cleanup if we're actually navigating away (not just a re-render)
      const cleanup = async () => {
        if (globalWebContainerInstance) {
          try {
            console.log('🧹 Cleaning up WebContainer on component unmount...');
            await globalWebContainerInstance.teardown();
            globalWebContainerInstance = null;
            isWebContainerBooting = false;
            setWebcontainerReady(false);
            console.log('✅ WebContainer cleaned up successfully');
          } catch (error) {
            console.error('❌ Error cleaning up WebContainer:', error);
            // Force reset even if teardown fails
            globalWebContainerInstance = null;
            isWebContainerBooting = false;
            setWebcontainerReady(false);
          }
        }
      };
      
      // Use setTimeout to ensure this runs after React's cleanup
      setTimeout(cleanup, 0);
    };
  }, []); // Empty dependency array means this only runs on final unmount

  // Load WebContainer SDK and pre-boot containers (Bolt.new style)
  useEffect(() => {
    const initializeWebContainerPool = async () => {
      try {
        if (typeof window !== 'undefined' && !WebContainer && !isSDKLoading) {
          isSDKLoading = true;
          
          // Check if crossOriginIsolated is available
          console.log('🔒 crossOriginIsolated:', window.crossOriginIsolated);
          console.log('🔒 SharedArrayBuffer available:', typeof SharedArrayBuffer !== 'undefined');
          console.log('🔒 Current URL:', window.location.href);
          console.log('🔒 User Agent:', navigator.userAgent);
          
          // Check crossOriginIsolated with retry logic (sometimes takes time to initialize)
          let coiAttempts = 0;
          const maxCoiAttempts = 10; // 1 second max wait
          
          while (!window.crossOriginIsolated && coiAttempts < maxCoiAttempts) {
            console.log(`🔄 Waiting for crossOriginIsolated... attempt ${coiAttempts + 1}`);
            await new Promise(resolve => setTimeout(resolve, 100));
            coiAttempts++;
          }
          
          if (!window.crossOriginIsolated) {
            errorStep('WebContainer', '❌ WebContainer requires crossOriginIsolated to be true');
            errorStep('WebContainer', '💡 This usually means CORS headers are not properly configured');
            errorStep('WebContainer', '🔧 Try refreshing the page or restarting the dev server');
            errorStep('WebContainer', '🔄 Falling back to simple preview mode...');
            
            // Set error state instead of just false
            setWebcontainerError('CrossOriginIsolated not available');
            setWebcontainerReady(false);
            isSDKLoading = false;
            return;
          }

          // Load WebContainer SDK
          startStep('WebContainer', '📦 Loading WebContainer SDK...');
          const { WebContainer: WC } = await import('@webcontainer/api');
          WebContainer = WC;
          completeStep('WebContainer', '✅ WebContainer SDK loaded successfully');
          
          // Initialize global WebContainer (Bolt.new style - single instance reuse)
          try {
          await initializeGlobalWebContainer();
          console.log('✅ WebContainer instance ready');
            completeStep('WebContainer', '✅ WebContainer initialization complete');
          } catch (initError) {
            console.error('❌ Failed to initialize WebContainer:', initError);
            errorStep('WebContainer', `❌ WebContainer initialization failed: ${initError instanceof Error ? initError.message : 'Unknown error'}`);
          }
          
          isSDKLoading = false;
        }
      } catch (error) {
        console.error('❌ Failed to load WebContainer SDK:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errorStep('WebContainer', `ERROR: Failed to load WebContainer SDK: ${errorMessage}`);
        
        // Provide helpful error messages
        if (errorMessage.includes('SharedArrayBuffer')) {
          errorStep('WebContainer', '💡 SharedArrayBuffer is not available - this requires HTTPS and proper CORS headers');
        }
        
        isSDKLoading = false;
      }
    };

    initializeWebContainerPool();
  }, []);

  // Initialize single WebContainer instance (WebContainer limitation: only 1 per tab)
  const initializeGlobalWebContainer = async () => {
    if (globalWebContainerInstance) {
      startStep('WebContainer', '⚡ Using existing WebContainer instance');
      console.log('🎯 Setting webcontainerReady to true (existing instance)');
      setWebcontainerReady(true);
      return globalWebContainerInstance;
    }
    
    if (isWebContainerBooting) {
      startStep('WebContainer', '⏳ WebContainer is already booting, waiting...');
      // Wait for the boot to complete with timeout
      let attempts = 0;
      const maxAttempts = 100; // 10 seconds max wait
      while (isWebContainerBooting && !globalWebContainerInstance && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      if (globalWebContainerInstance) {
        setWebcontainerReady(true);
        return globalWebContainerInstance;
      }
      if (attempts >= maxAttempts) {
        throw new Error('WebContainer boot timeout - took longer than 10 seconds');
      }
    }

    // Check if WebContainer SDK is loaded
    if (!WebContainer) {
      throw new Error('WebContainer SDK not loaded yet. Please wait for initialization to complete.');
    }

    try {
      isWebContainerBooting = true;
      startStep('WebContainer', '🚀 Booting WebContainer (one per browser tab)...');
      
      globalWebContainerInstance = await WebContainer.boot();
      completeStep('WebContainer', '✅ WebContainer ready for reuse');
      console.log('🎯 Setting webcontainerReady to true');
      
      // Ensure WebContainer is actually ready before setting state
      if (globalWebContainerInstance && globalWebContainerInstance.fs) {
        setWebcontainerReady(true);
      } else {
        throw new Error('WebContainer booted but filesystem not available');
      }
      
      return globalWebContainerInstance;
    } catch (error) {
      console.error('Failed to boot WebContainer:', error);
      
      // If we get "Only a single WebContainer instance can be booted", try to recover
      if (error instanceof Error && error.message.includes('Only a single WebContainer instance can be booted')) {
        console.log('🔄 Attempting to recover from existing WebContainer instance...');
        
        // Reset our tracking variables
        globalWebContainerInstance = null;
        isWebContainerBooting = false;
        
        // Try to find the existing instance (this is a workaround)
        try {
          // Force a small delay and try again
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // If there's truly an existing instance, we need to work with it
          // For now, we'll throw a more helpful error
          throw new Error('WebContainer instance already exists. Please refresh the page to reset the environment.');
        } catch (recoveryError) {
          errorStep('WebContainer', '❌ Failed to recover WebContainer. Please refresh the page.');
          throw new Error('WebContainer instance conflict. Please refresh the page to reset the environment.');
        }
      }
      
      errorStep('WebContainer', `❌ Failed to boot WebContainer: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    } finally {
      isWebContainerBooting = false;
    }
  };

  // Get the global WebContainer instance (instant reuse!)
  const getWebContainer = async () => {
    if (globalWebContainerInstance) {
      startStep('WebContainer', '⚡ Reusing global WebContainer instance (instant!)');
      return globalWebContainerInstance;
    } else {
      return await initializeGlobalWebContainer();
    }
  };

  // Start preview with Bolt.new optimizations
  const startPreview = useCallback(
    async () => {
      if (!projectId) return;
      
      // Prevent multiple simultaneous starts
      if (isStarting || isLoading || isCreatingPreviewRef.current) {
        console.log('🔄 Preview already starting, ignoring duplicate request');
        return;
      }
      
      isCreatingPreviewRef.current = true;
      setShouldAutoStart(false); // Reset auto-start flag when actually starting
      setHasStartedPreview(true); // Mark that we've started the preview process

      // Clear any pending start timeout
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }

      setIsStarting(true);
    setIsLoading(true);
      setProgressSteps([]);
    
    try {
      // Get project files from backend
      startStep('Project Files', '📁 Fetching project files...');
      console.log('🔍 Making API call to:', `/api/preview/create/${projectId}`);
      
      const response = await fetch(`/api/preview/create/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('📡 API Response status:', response.status);
      completeStep('Project Files', `📡 API Response: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { message: errorText || `HTTP ${response.status}` };
        }
        errorStep('Project Files', `❌ API Error: ${error.message || errorText}`);
        throw new Error(error.message || `Failed to start preview (HTTP ${response.status})`);
      }

      const data = await response.json();
      console.log('📦 Received data:', data);
      completeStep('Project Files', `📦 Received ${data.preview?.files?.length || 0} files`);
      
      if (!data.preview) {
        throw new Error('No preview data received from backend');
      }
      
      setPreview(data.preview);

      // Check if WebContainer is available and ready with retry logic
      console.log('🔍 WebContainer check:', {
        WebContainer: !!WebContainer,
        webcontainerReady,
        webcontainerError,
        globalWebContainerInstance: !!globalWebContainerInstance
      });
      
      // Wait for WebContainer SDK to load with timeout
      if (!WebContainer) {
        startStep('WebContainer', '⏳ Waiting for WebContainer SDK to load...');
        
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait
        
        while (!WebContainer && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!WebContainer) {
          throw new Error('WebContainer SDK failed to load after 5 seconds. Please refresh the page.');
        }
        
        completeStep('WebContainer', '✅ WebContainer SDK loaded');
      }
      
      if (webcontainerError) {
        throw new Error(`WebContainer error: ${webcontainerError}`);
      }
      
      // Wait for WebContainer to be ready with retry logic
      if (!webcontainerReady || !globalWebContainerInstance) {
        startStep('WebContainer', '⏳ Waiting for WebContainer to initialize...');
        
        // Initialize WebContainer if not already done
        try {
          await initializeGlobalWebContainer();
        } catch (error) {
          // If initialization fails, wait a bit and retry once
          console.log('🔄 WebContainer initialization failed, retrying in 1 second...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          try {
            await initializeGlobalWebContainer();
          } catch (retryError) {
            throw new Error(`Failed to initialize WebContainer after retry: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`);
          }
        }
        
        // Wait for webcontainerReady state to be true
        let readyAttempts = 0;
        const maxReadyAttempts = 30; // 3 seconds max wait
        
        while (!webcontainerReady && readyAttempts < maxReadyAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          readyAttempts++;
        }
        
        if (!webcontainerReady) {
          throw new Error('WebContainer failed to become ready after initialization');
        }
      }
      
      startStep('WebContainer', '🚀 Starting WebContainer preview...');
      
      // Get WebContainer instance
      startStep('WebContainer', '🔄 Getting WebContainer instance...');
      
      // Reuse existing WebContainer instance (safer than teardown)
      const webcontainerInstance = await getWebContainer();
      console.log('🔍 WebContainer instance received:', !!webcontainerInstance);
      webcontainerRef.current = webcontainerInstance;
      console.log('🔗 WebContainer ref set:', !!webcontainerRef.current);
      console.log('🔍 WebContainer ref value:', webcontainerRef.current);
      completeStep('WebContainer', '✅ WebContainer instance acquired');

      // Ensure WebContainer ref is properly set before proceeding
      if (!webcontainerRef.current) {
        throw new Error('Failed to set WebContainer reference');
      }

      // Parallel operations for speed (Bolt.new style)
      await Promise.all([
        mountProjectFilesOptimized(data.preview.files, data.preview.framework),
        setupServerListener()
      ]);

      // Start the development server
      await startOptimizedDevServer(data.preview.framework);

      // Don't show success toast here - wait for preview URL to be ready

    } catch (error) {
      console.error('Failed to start preview:', error);
      errorStep('Preview', `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast.error('Failed to start preview');
      setHasStartedPreview(false); // Reset on error so user can try again
    } finally {
      setIsLoading(false);
      setIsStarting(false);
      isCreatingPreviewRef.current = false;
      // Don't reset hasStartedPreview here - only reset on success or when preview URL is set
    }
  }, [projectId, webcontainerReady, webcontainerError, isLoading, isStarting]);

  // Optimized file mounting with streaming (Bolt.new style)
  const mountProjectFilesOptimized = async (
    files: Array<{ path: string; content: string }>,
    framework: string
  ) => {
    // Wait for WebContainer to be ready with timeout
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    while (!webcontainerRef.current && attempts < maxAttempts) {
      console.log(`⏳ Waiting for WebContainer ref... (attempt ${attempts + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!webcontainerRef.current) {
      throw new Error('WebContainer not initialized after waiting');
    }

    console.log('📁 Files to mount:', files.map(f => ({ path: f.path, size: f.content.length })));
    console.log('🔍 WebContainer ref check:', !!webcontainerRef.current);
    startStep('Mount Files', `📁 Mounting ${files.length} files...`);

    if (!files.length) {
      completeStep('Mount Files', '⚠️ No files to mount, creating basic structure...');
      // Create a basic file structure if no files exist
      const basicStructure = {
        'package.json': {
          file: {
            contents: JSON.stringify({
              name: 'preview-project',
              version: '1.0.0',
              scripts: {
                dev: framework === 'nextjs' ? 'next dev' : 'vite',
                build: framework === 'nextjs' ? 'next build' : 'vite build'
              },
              dependencies: FRAMEWORK_DEPENDENCIES[framework] || {}
            }, null, 2)
          }
        },
        'index.html': {
          file: {
            contents: '<html><body><h1>Preview Loading...</h1></body></html>'
          }
        }
      };
      await webcontainerRef.current.mount(basicStructure);
      completeStep('Mount Files', '✅ Mounted basic project structure');
      return;
    }

    // Build file tree efficiently (files already have correct paths from backend)
    const fileTree: any = {};
    
    for (const file of files) {
      // Skip empty paths or invalid paths
      if (!file.path || file.path === '/' || file.path === '') {
        console.warn('⚠️ Skipping invalid file path:', file.path);
        continue;
      }

      // Remove leading slash if present
      const cleanPath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
      const pathParts = cleanPath.split('/').filter(part => part.length > 0);
      
      if (pathParts.length === 0) {
        console.warn('⚠️ Skipping empty path after cleaning:', file.path);
        continue;
      }

      let current = fileTree;
      
      // Create directory structure
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        current = current[part].directory;
      }
      
      // Add the file
      const fileName = pathParts[pathParts.length - 1];
      current[fileName] = {
        file: {
          contents: file.content
        }
      };
    }

    console.log('🗂️ File tree structure:', fileTree);
    
    try {
    await webcontainerRef.current.mount(fileTree);
      completeStep('Mount Files', `✅ Mounted ${files.length} files successfully`);
    } catch (error) {
      console.error('❌ Mount error:', error);
      errorStep('Mount Files', `❌ Mount failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // If mount fails, fall back to individual file writing
      startStep('Mount Files', '🔄 Falling back to individual file writing...');
      for (const file of files) {
        const cleanPath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
        if (!cleanPath || cleanPath === '') continue;
        
        try {
          await webcontainerRef.current.fs.writeFile(cleanPath, file.content);
          console.log(`✅ Wrote file: ${cleanPath}`);
        } catch (fileError) {
          console.error(`❌ Failed to write file ${cleanPath}:`, fileError);
        }
      }
      completeStep('Mount Files', '✅ Files written individually');
    }
  };

  // Setup server listener before starting (Bolt.new optimization)
  const setupServerListener = async () => {
    if (!webcontainerRef.current) return;
    
    webcontainerRef.current.on('server-ready', (port: number, url: string) => {
      console.log(`🚀 Server ready on port ${port}: ${url}`);
      setPreviewUrl(url);
      setShouldAutoStart(false); // Reset auto-start flag when preview is ready
      setHasStartedPreview(false); // Reset started flag when preview is ready
      completeStep('Server', `✅ Server ready at ${url} (${Date.now() - startTime}ms)`);
      
      // Show success toast when preview is actually ready
      if (preview?.framework) {
        toast.success(`Preview ready for ${preview.framework} project! 🎉`);
      }
    });
  };

  let startTime = Date.now();

  // Optimized dev server startup with dependency caching
  const startOptimizedDevServer = async (framework: string) => {
    if (!webcontainerRef.current) throw new Error('WebContainer not initialized');

    startTime = Date.now();

    try {
      // Use cached node_modules if available (Bolt.new optimization)
      startStep('Dependencies', '📦 Installing dependencies...');
      
      // Parallel install with optimizations
      const installProcess = await webcontainerRef.current.spawn('npm', ['install'], {
        cwd: '/'
      });
      
      let installOutput = '';
      installProcess.output.pipeTo(new WritableStream({
        write(data) {
          installOutput += data;
          // Only show meaningful messages, filter out npm warnings and spinner noise
          if (shouldShowStep(data)) {
            const cleaned = cleanMessage(data);
            if (cleaned) {
              startStep('Dependencies', cleaned);
            }
          }
        }
      }));

      const installExitCode = await installProcess.exit;
      if (installExitCode !== 0) {
        // Send install error to AI for automatic fixing
        await sendErrorToAI(installOutput, 'dependency_install');
        throw new Error(`Dependency installation failed with exit code ${installExitCode}`);
      }

      completeStep('Dependencies', '✅ Dependencies installed (optimized)');

      // Start development server
      startStep('Dev Server', '🚀 Starting development server...');
      const devCommand = getDevCommand(framework);
      
      const devProcess = await webcontainerRef.current.spawn('npm', ['run', devCommand]);

      let buildOutput = '';
      let hasError = false;
      
      devProcess.output.pipeTo(new WritableStream({
        write(data) {
          buildOutput += data;
          console.log('📋 Dev server output:', data);
          
          // Only show meaningful dev server messages
          if (shouldShowStep(data)) {
            const cleaned = cleanMessage(data);
            if (cleaned) {
              // Determine step status based on content
              if (cleaned.includes('Ready in') || cleaned.includes('ready')) {
                completeStep('Dev Server', '✅ Development server ready!');
              } else if (cleaned.includes('Starting') || cleaned.includes('Compiling')) {
                startStep('Dev Server', cleaned);
              } else if (cleaned.toLowerCase().includes('error') || cleaned.toLowerCase().includes('failed')) {
                errorStep('Dev Server', cleaned);
              } else {
                startStep('Dev Server', cleaned);
              }
            }
          }
          
          // Enhanced error detection with specific categorization
          if (data.includes('Module not found') || data.includes("Cannot resolve module")) {
            hasError = true;
            console.log('🔍 Detected missing_module error:', data);
            setTimeout(() => sendErrorToAI(data, 'missing_module'), 1000);
          } else if (data.includes('Failed to compile') || data.includes('Compilation error') || data.includes('Failed to parse') || data.includes('SyntaxError')) {
            hasError = true;
            console.log('🔍 Detected compilation_error:', data);
            setTimeout(() => sendErrorToAI(data, 'compilation_error'), 1000);
          } else if (data.includes('TypeError') || data.includes('ReferenceError')) {
            hasError = true;
            console.log('🔍 Detected runtime_error:', data);
            setTimeout(() => sendErrorToAI(data, 'runtime_error'), 1000);
          } else if (data.includes('ENOENT') || data.includes('file not found')) {
            hasError = true;
            console.log('🔍 Detected missing_file error:', data);
            setTimeout(() => sendErrorToAI(data, 'missing_file'), 1000);
          } else if (data.includes('npm ERR!') || data.includes('yarn error')) {
            hasError = true;
            console.log('🔍 Detected package_error:', data);
            setTimeout(() => sendErrorToAI(data, 'package_error'), 1000);
          }
          
          // Log server status
          if (data.includes('ready') || data.includes('started') || data.includes('listening')) {
            console.log('✅ Dev server status:', data);
          }
          
          // Log any error-like output
          if (data.toLowerCase().includes('error') || data.toLowerCase().includes('failed') || data.toLowerCase().includes('warn')) {
            console.log('⚠️ Potential issue detected:', data);
          }
        }
      }));

      // Monitor for build errors and send to AI
      setTimeout(async () => {
        if (hasError && buildOutput) {
          console.log('🤖 Sending build error to AI:', buildOutput);
          await sendErrorToAI(buildOutput, 'compilation_error');
        }
      }, 5000);

      // Wait for server to be ready and get the URL
      startStep('Dev Server', '⏳ Waiting for development server to start...');
      console.log('⏳ Waiting for development server to start...');
      
      // Check if the process exits unexpectedly
      devProcess.exit.then((exitCode: number) => {
        if (exitCode !== 0) {
          console.error(`Dev server exited with code: ${exitCode}`);
          errorStep('Dev Server', `❌ Dev server failed with exit code: ${exitCode}`);
          errorStep('Dev Server', `📋 Full output: ${buildOutput}`);
          
          // Send error to AI for fixing
          sendErrorToAI(buildOutput, 'runtime_error');
        }
      }).catch((error: unknown) => {
        errorStep('Dev Server', `❌ Dev server process error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        sendErrorToAI(error instanceof Error ? error.message : 'Unknown error', 'runtime_error');
      });

      // Wait for the server to be ready (poll the URL)
      const maxRetries = 30;
      let retries = 0;
      let serverReady = false;

      while (retries < maxRetries && !serverReady) {
        try {
          console.log(`🔍 Checking server readiness (attempt ${retries + 1}/${maxRetries})...`);
          const testResponse = await fetch(previewUrl, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });
          
          console.log('📡 Server response status:', testResponse.status);
          console.log('📡 Server response headers:', Object.fromEntries(testResponse.headers.entries()));
          
          if (testResponse.ok) {
            serverReady = true;
            console.log('✅ Development server is ready!');
            completeStep('Dev Server', '✅ Development server is ready!');
          } else {
            console.log(`⚠️ Server responded with ${testResponse.status}, retrying...`);
            startStep('Dev Server', `⚠️ Server responded with ${testResponse.status}, retrying...`);
          }
    } catch (error) {
          console.log(`⚠️ Server not ready yet (${error instanceof Error ? error.message : 'Unknown error'}), retrying...`);
          startStep('Dev Server', `⚠️ Server not ready yet, retrying... (${retries + 1}/${maxRetries})`);
        }
        
        if (!serverReady) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          retries++;
        }
      }

      if (!serverReady) {
        console.error('❌ Development server failed to start after maximum retries');
        errorStep('Dev Server', '❌ Development server failed to start after maximum retries');
        console.error('📋 Final build output:', buildOutput);
        errorStep('Dev Server', `📋 Final build output: ${buildOutput}`);
        throw new Error('Development server failed to start');
      }

    } catch (error) {
      errorStep('Dev Server', `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  // Send errors to AI for automatic fixing
  const sendErrorToAI = async (errorOutput: string, errorType: 'compilation_error' | 'runtime_error' | 'dependency_install' | 'missing_module' | 'missing_file' | 'package_error') => {
    if (!projectId || !hasFiles) {
      console.log('🛑 Skipping AI error send - no project ID or no files');
      return;
    }

    try {
      startStep('AI Fix', `🤖 Sending ${errorType} to AI for automatic fix...`);
      
      // Send to backend PreviewService which will handle AI integration directly
      const response = await fetch(`/api/preview/error/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorType,
          errorOutput
        })
      });

      if (response.ok) {
        completeStep('AI Fix', '✅ Error sent to AI for fixing');
      } else {
        throw new Error('Failed to send error to backend');
      }
    } catch (error) {
      console.error('Failed to send error to AI:', error);
      errorStep('AI Fix', `❌ Failed to send error to AI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Get development command based on framework
  const getDevCommand = (framework: string): string => {
    switch (framework) {
      case 'react-vite':
      case 'vue':
      case 'svelte':
        return 'dev';
      case 'react-cra':
        return 'start';
      case 'nextjs':
        return 'dev';
      default:
        return 'dev';
    }
  };

  // Stop preview with smart cleanup (Bolt.new style - keep instance alive)
  const stopPreview = useCallback(async () => {
    if (!preview) return;

    try {
      // Clean up current project but keep WebContainer alive for reuse
      if (webcontainerRef.current) {
        startStep('Stop Preview', '🛑 Stopping development server...');
        
        // Kill running processes but keep WebContainer alive
        try {
          await webcontainerRef.current.spawn('pkill', ['-f', 'node']);
          completeStep('Stop Preview', '♻️ Cleaned up processes, WebContainer ready for reuse');
        } catch (e) {
          // Ignore errors when killing processes
        }
        
        // Clear local reference but keep global instance
        webcontainerRef.current = null;
      }

      // Call backend to cleanup
      await fetch(`/api/preview/${preview.projectId}`, {
        method: 'DELETE'
      });

      setPreview(null);
      setPreviewUrl('');
      setProgressSteps([]);
      toast.success('Preview stopped');

    } catch (error) {
      console.error('Failed to stop preview:', error);
      errorStep('Stop Preview', `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast.error('Failed to stop preview');
    }
  }, [preview]);

  // Get preview status on mount and auto-start if needed
  useEffect(() => {
    if (!projectId || previewStatusCheckedRef.current === projectId) return;

    const getPreviewStatus = async () => {
      try {
        console.log('🔍 Checking preview status for project:', projectId);
        previewStatusCheckedRef.current = projectId; // Mark as checked
        
        const response = await fetch(`/api/preview/${projectId}`);
        if (response.ok) {
          const data = await response.json();
          console.log('📊 Preview status data:', data);
          
          // If preview exists and is ready, set the URL
          if (data.preview?.previewUrl) {
            console.log('🔍 Checking preview URL:', data.preview.previewUrl);
            // Only use real WebContainer URLs (localhost), ignore fake backend URLs
            if (data.preview.previewUrl.includes('localhost') || data.preview.previewUrl.includes('127.0.0.1')) {
              console.log('✅ Found valid WebContainer URL:', data.preview.previewUrl);
          setPreview(data.preview);
              setPreviewUrl(data.preview.previewUrl);
            } else {
              console.log('🚫 Ignoring fake preview URL:', data.preview.previewUrl);
              // Clear both the fake URL and preview object to allow fresh WebContainer start
              setPreviewUrl('');
              setPreview(null);
            }
          } else {
            console.log('📭 No preview URL found in response');
            setPreview(data.preview);
          }
        } else {
          console.log('📭 No existing preview found, will need to create one');
        }
      } catch (error) {
        console.log('📭 Preview status check failed (normal if no preview exists):', error);
      }
    };

    getPreviewStatus();
  }, [projectId]);

  // Auto-start preview when component mounts with a projectId
  useEffect(() => {
    console.log('🔍 Auto-start effect triggered:', {
      projectId: !!projectId,
      preview: !!preview,
      isLoading,
      isStarting,
      isVisible,
      hasFiles,
      previewUrl: !!previewUrl,
      webcontainerRef: !!webcontainerRef.current
    });
    
    if (!projectId || preview || isLoading || isStarting || !isVisible || !hasFiles || preventRestart || isCreatingPreviewRef.current) {
      console.log('🛑 Auto-start blocked:', {
        noProjectId: !projectId,
        hasPreview: !!preview,
        isLoading,
        isStarting,
        notVisible: !isVisible,
        noFiles: !hasFiles,
        preventRestart,
        isCreatingPreview: isCreatingPreviewRef.current
      });
      setShouldAutoStart(false);
      return;
    }
    
    // Check if there's already a running preview for this project
    if (previewUrl && webcontainerRef.current) {
      console.log('🎯 Preview already running, skipping auto-start');
      setShouldAutoStart(false);
      return;
    }
    
    // Set auto-start flag immediately to show loading state
    setShouldAutoStart(true);
    
    // Debounce the start to prevent rapid successive calls
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
    }
    
    startTimeoutRef.current = setTimeout(() => {
      // Double-check conditions before starting (including WebContainer readiness)
      if (!isLoading && !isStarting && !preview && isVisible && hasFiles && !preventRestart && 
          WebContainer && (webcontainerReady || globalWebContainerInstance)) {
        console.log('🚀 Auto-starting preview for project:', projectId);
        startPreview();
      } else {
        console.log('🛑 Auto-start cancelled in timeout:', {
          isLoading,
          isStarting,
          hasPreview: !!preview,
          isVisible,
          hasFiles,
          WebContainer: !!WebContainer,
          webcontainerReady,
          globalWebContainerInstance: !!globalWebContainerInstance
        });
      }
    }, 1000); // Increased debounce to 1000ms to allow WebContainer to fully initialize
    
    // Cleanup timeout on unmount
    return () => {
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }
    };
  }, [projectId, preview, isLoading, isStarting, previewUrl, isVisible, hasFiles, preventRestart, startPreview]);

  // Listen for real-time updates via Server-Sent Events
  useEffect(() => {
    if (!projectId) return;

    const eventSource = new EventSource(`/api/preview/stream/${projectId}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'preview-updated':
          // Update files in WebContainer
          if (webcontainerRef.current && data.changedFiles) {
            updateWebContainerFiles(data.changedFiles);
          }
          break;
        case 'preview-ready':
          setPreview(data.preview);
          break;
        case 'preview-error':
          errorStep('Preview', `ERROR: ${data.error}`);
          break;
        case 'preview-stopped':
          setPreview(null);
          setPreviewUrl('');
          break;
      }
    };

    return () => {
      eventSource.close();
    };
  }, [projectId]); // Removed 'preview' dependency to prevent infinite loop

  // Update files in WebContainer when AI makes changes
  const updateWebContainerFiles = async (changedFiles: Array<{ path: string; content: string }>) => {
    if (!webcontainerRef.current) return;

    try {
      for (const file of changedFiles) {
        await webcontainerRef.current.fs.writeFile(file.path, file.content);
      }
      completeStep('Update Files', `🔄 Updated ${changedFiles.length} files`);
    } catch (error) {
      errorStep('Update Files', `ERROR updating files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle file updates from visual editor
  const handleVisualEditorFileUpdate = async (filePath: string, content: string) => {
    try {
      // Update file in WebContainer - this triggers hot reload automatically
      if (webcontainerRef.current) {
        // Ensure the file path is correct (remove leading slash if present)
        const normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
        
        await webcontainerRef.current.fs.writeFile(normalizedPath, content);
        console.log(`✅ Updated ${normalizedPath} in WebContainer - hot reload should trigger automatically`);
        
        // For React/Vite projects, the dev server should pick up changes within 1-2 seconds
        // For Next.js, hot reloading is even faster (usually under 1 second)
        
        // Optional: We could add a small delay and check if the preview updated
        setTimeout(() => {
          console.log(`🔄 Hot reload should have completed for ${normalizedPath}`);
        }, 2000);
      }

      toast.success(`Updated ${filePath.split('/').pop()} - preview updating...`);
    } catch (error) {
      console.error('Failed to update file from visual editor:', error);
      toast.error('Failed to update file');
    }
  };

  // Refresh preview
  const refreshPreview = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  // Open in new tab
  const openInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  const getViewportClasses = (size: ViewportSize) => {
    switch (size) {
      case 'mobile':
        return 'w-full h-full max-w-sm mx-auto';
      case 'tablet':
        return 'w-full h-full max-w-2xl mx-auto';
      case 'desktop':
        return 'w-full h-full';
      default:
        return 'w-full h-full';
    }
  };

  const cleanMessage = (message: string) => {
    // Remove ANSI escape codes and clean up the message
    return message
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // Remove ANSI escape sequences (ESC[...letter)
      .replace(/\[[\d;]*[a-zA-Z]/g, '') // Remove bracket codes without ESC prefix ([1G, [0K, etc.)
      .replace(/\x1b\([AB]/g, '') // Remove charset sequences
      .replace(/\x1b[=>]/g, '') // Remove keypad sequences
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove all control characters
      .replace(/^\s*[\|\\/\-\\~]\s*$/gm, '') // Remove spinner/loading characters
      .replace(/^\s*[📦✅❌⚠️🔍🚀🔄💡🎯]\s*/gm, '') // Remove emoji prefixes for cleaner look
      .replace(/^\s+|\s+$/g, '') // Trim whitespace
      .replace(/\s+/g, ' '); // Normalize multiple spaces
  };

  const shouldShowStep = (message: string) => {
    const cleaned = cleanMessage(message);
    
    // Filter out noise like npm warnings, spinner output, etc.
    if (!cleaned) return false;
    if (cleaned.length < 3) return false;
    
    // Filter out common noise patterns
    if (cleaned.includes('npm warn config')) return false;
    if (cleaned.includes('npm WARN')) return false;
    if (cleaned.match(/^[\|\\/\-\\~\s]*$/)) return false; // Only spinner chars
    if (cleaned.match(/^[0-9]+$/)) return false; // Only numbers
    if (cleaned.match(/^[K\s]*$/)) return false; // Only K characters (from ANSI codes)
    if (cleaned.match(/^[\[\]0-9;]*$/)) return false; // Only bracket sequences
    
    return true;
  };

  // Cleanup on unmount or projectId change
  useEffect(() => {
    return () => {
      // Clear any pending timeouts
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }
      
      // Close event source
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      // Stop the preview on the backend when component unmounts
      if (projectId && preview) {
        fetch(`/api/preview/${projectId}`, {
          method: 'DELETE'
        }).catch((error: unknown) => {
          console.error('Failed to stop preview on cleanup:', error);
        });
      }
      
      // Reset preview status check when projectId changes
      previewStatusCheckedRef.current = null;
    };
  }, [projectId, preview]); // Added preview dependency to ensure we only stop active previews

  // Additional cleanup for page navigation/visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && projectId && preview) {
        // Page is hidden (user navigated away or minimized)
        fetch(`/api/preview/${projectId}`, {
          method: 'DELETE'
        }).catch((error: unknown) => {
          console.error('Failed to stop preview on visibility change:', error);
        });
      }
    };

    const handleBeforeUnload = () => {
      if (projectId && preview) {
        // User is leaving the page - use fetch with DELETE method instead of sendBeacon
        // sendBeacon only supports POST and sends data as string, causing JSON parsing issues
        try {
          fetch(`/api/preview/${projectId}`, {
            method: 'DELETE',
            keepalive: true // This ensures the request completes even if page unloads
          }).catch(() => {
            // Ignore errors during page unload
          });
        } catch (error) {
          // Fallback: if fetch fails, ignore silently during page unload
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [projectId, preview]);

  return (
    <div className={`h-full flex flex-col luxury-card ${!isVisible ? 'hidden' : ''}`}
      style={{
        borderRadius: '0'
      }}
    >
      {/* Content - Full height without header */}
      <div className="flex-1 flex flex-col relative">
                {/* Floating Viewport Controls - Only visible when preview is loaded */}
        {previewUrl && (
          <div className="absolute bottom-4 right-4 transition-all duration-300 z-50">
            <div className="flex items-center gap-1 p-1">
              {(['desktop', 'tablet', 'mobile'] as ViewportSize[]).map((size) => (
                <button 
                  key={size}
                  onClick={() => setViewport(size)}
                  className="p-2 rounded-lg font-medium relative group/item overflow-hidden"
                  style={{
                    background: viewport === size 
                      ? 'linear-gradient(135deg, #2E2A5D 0%, #5A3F9E 25%, #2D8EFF 75%, #00D2C6 100%)'
                      : 'rgba(0, 0, 0, 0.6)',
                    border: 'none',
                    boxShadow: viewport === size 
                      ? '0 4px 20px rgba(45, 142, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      : '0 2px 10px rgba(0, 0, 0, 0.3)',
                    color: '#ffffff',
                    transform: 'translateY(0)',
                    backdropFilter: 'blur(10px)',
                    filter: viewport === size ? 'brightness(1)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (viewport === size) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 35px rgba(45, 142, 255, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                      e.currentTarget.style.filter = 'brightness(1.1)';
                      
                      // Trigger shimmer effect for active buttons
                      const shimmer = e.currentTarget.querySelector('.shimmer-effect') as HTMLElement;
                      if (shimmer) {
                        shimmer.style.transition = 'transform 0.5s ease-out';
                        shimmer.style.transform = 'translateX(100%)';
                        setTimeout(() => {
                          shimmer.style.transition = 'none';
                          shimmer.style.transform = 'translateX(-100%)';
                        }, 500);
                      }
                    } else {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewport === size) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(45, 142, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                      e.currentTarget.style.filter = 'brightness(1)';
                    } else {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  title={`${size.charAt(0).toUpperCase() + size.slice(1)} view`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-300"></div>
                  
                  {/* Shimmer effect for active buttons */}
                  {viewport === size && (
                    <div 
                      className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                        transform: 'translateX(-100%)'
                      }}
                    ></div>
                  )}
                  
                  <div className={`w-4 h-4 flex-shrink-0 relative z-10 transition-all duration-300 ${
                    viewport === size ? 'text-white' : 'text-muted-foreground group-hover/item:text-foreground'
                  }`}>
                  {size === 'desktop' && <Monitor className="h-4 w-4" />}
                    {size === 'tablet' && <Tablet className="h-4 w-4" />}
                    {size === 'mobile' && <Smartphone className="h-4 w-4" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

                        {isLoading ? (
          /* Loading State with Computer UI */
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            {/* Monitor Container */}
            <div className="relative">
              {/* Monitor Screen */}
              <div className="w-96 h-64 bg-gradient-to-b from-secondary to-secondary/80 rounded-lg shadow-lg relative border-2 border-border/50">
                {/* Screen bezel */}
                <div className="absolute inset-2 bg-background rounded-lg overflow-hidden border border-border/30">
                  {/* Terminal-like interface */}
                  <div className="h-full bg-gradient-to-b from-background to-secondary/20 p-4 font-mono text-sm">
                    {/* Terminal header */}
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/30">
                      <div className="flex gap-1">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>
                      <div className="text-muted-foreground text-xs ml-2">Development Environment</div>
                    </div>
                    
                    {/* Progress Steps */}
                    <div className="space-y-3">
                      {(() => {
                        // Filter and process steps for sequential display
                        const filteredSteps = progressSteps.filter(step => shouldShowStep(step.message || ''));
                        const completedSteps = filteredSteps.filter(step => step.status === 'complete');
                        const currentStep = filteredSteps.find(step => step.status === 'active');
                        const isCompleted = previewUrl && !isLoading;
                        const progressPercentage = isCompleted ? 100 : Math.round((completedSteps.length / Math.max(filteredSteps.length, 1)) * 100);

                        return (
                          <>
                            {/* Progress Bar */}
                            <div className="mb-4">
                                                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-primary">
                                  {isCompleted ? '✓ Preview Ready!' : currentStep?.step || '⚡ Initializing...'}
                                </span>
                                <span className="text-xs text-muted-foreground">{progressPercentage}%</span>
                              </div>
                              <div className="w-full h-1 bg-secondary/50 rounded-full overflow-hidden border border-border/20">
                                 <div 
                                   className="h-full transition-all duration-500 ease-out rounded-full relative overflow-hidden"
                                   style={{ 
                                     width: `${progressPercentage}%`,
                                     background: isCompleted 
                                       ? 'linear-gradient(135deg, #2E2A5D 0%, #5A3F9E 25%, #2D8EFF 75%, #00D2C6 100%)'
                                       : 'linear-gradient(135deg, #2E2A5D 0%, #5A3F9E 25%, #2D8EFF 75%, #00D2C6 100%)'
                                   }}
                                 >
                                   {!isCompleted && progressPercentage > 0 && (
                                     <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                                   )}
                                 </div>
                               </div>
                            </div>

                                                         {/* Terminal Output */}
                             <div className="space-y-2 text-xs">
                               {filteredSteps.slice(-4).map((step, index) => (
                                 <div key={index} className="flex items-start gap-2">
                                   <span className="text-muted-foreground/60 mt-0.5">$</span>
                                   <div className="flex-1">
                                     <div className={`${
                                       step.status === 'complete' ? 'text-primary' :
                                       step.status === 'active' ? 'text-primary' :
                                       step.status === 'error' ? 'text-destructive' : 'text-muted-foreground'
                                     }`}>
                                       {step.status === 'active' && <span className="animate-pulse">▶ </span>}
                                       {step.status === 'complete' && '✓ '}
                                       {step.status === 'error' && '✗ '}
                                       {step.step}
                                     </div>
                                     {step.message && (
                                       <div className="text-muted-foreground/70 text-xs ml-3 mt-1">
                                         {cleanMessage(step.message)}
                                       </div>
                                     )}
                                   </div>
                                 </div>
                               ))}
                               
                               {/* Current step with blinking cursor */}
                               {currentStep && (
                                 <div className="flex items-center gap-2 mt-3">
                                   <span className="text-muted-foreground/60">$</span>
                                   <span className="text-primary">
                                     {currentStep.step}
                                     <span className="animate-pulse ml-1">_</span>
                                   </span>
                                 </div>
                               )}
                             </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                
                {/* Screen reflection */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-lg pointer-events-none"></div>
              </div>
            </div>
            

          </div>
        ) : previewUrl ? (
          /* Preview iframe with loading overlay */
          <div className="flex-1 relative">
            {/* Loading overlay - same as other loading states */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8" id="preview-loading-overlay">
                                                       {/* Monitor Container */}
             <div className="relative">
               {/* Monitor Screen */}
                 <div className="w-96 h-64 bg-gradient-to-b from-secondary to-secondary/80 rounded-lg shadow-lg relative border-2 border-border/50">
                   {/* Screen bezel */}
                   <div className="absolute inset-2 bg-background rounded-lg overflow-hidden border border-border/30">
                                        {/* Clean interface */}
                   <div className="h-full bg-gradient-to-b from-background to-secondary/20 p-4 flex flex-col justify-center">
                     {/* Launching preview display */}
                     <div className="text-center space-y-4">
                       <div className="flex items-center justify-center gap-2 text-primary">
                         <span className="text-sm">Launching preview...</span>
                       </div>
                       
                       {/* Progress animation */}
                       <div className="w-full h-1 bg-secondary/50 rounded-full overflow-hidden border border-border/20">
                         <div className="h-full rounded-full relative overflow-hidden" style={{ width: '80%', background: 'linear-gradient(135deg, #2E2A5D 0%, #5A3F9E 25%, #2D8EFF 75%, #00D2C6 100%)' }}>
                           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                         </div>
                       </div>
                     </div>
                    </div>
                  </div>
                  
                  {/* Screen reflection */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-lg pointer-events-none"></div>
                </div>
              </div>
              
              
            </div>

            <iframe
              ref={iframeRef}
              src={previewUrl}
              className={`w-full h-full border-0 transition-all duration-300 ${getViewportClasses(viewport)}`}
              title="Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
              loading="lazy"
              style={{ 
                backgroundColor: 'transparent',
                opacity: 0,
                transition: 'opacity 0.5s ease-in-out'
              }}
              onLoad={(e) => {
                const iframe = e.target as HTMLIFrameElement;
                
                // Wait for the content to actually be ready
                const checkContent = () => {
                  try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (iframeDoc) {
                      // Check if Next.js has finished loading
                      const body = iframeDoc.body;
                      const hasContent = body && (
                        body.children.length > 0 || 
                        body.textContent?.trim() !== '' ||
                        iframeDoc.querySelector('#__next')
                      );
                      
                      // Also check if we're not on an error page
                      const isErrorPage = iframeDoc.title?.includes('Error') || 
                                         body?.textContent?.includes('Application error');
                      
                      if (hasContent && !isErrorPage) {
                        // Wait a bit longer to ensure content is fully rendered
                        setTimeout(() => {
                          // Show iframe and hide overlay simultaneously for seamless transition
                          iframe.style.opacity = '1';
                          const overlay = document.getElementById('preview-loading-overlay');
                          if (overlay) {
                            overlay.style.opacity = '0';
                            overlay.style.transition = 'opacity 0.5s ease-out';
                            setTimeout(() => {
                              overlay.style.display = 'none';
                            }, 500);
                          }
                        }, 1000); // Keep "Launching preview..." for 1 extra second
                        return;
                      }
                    }
                  } catch (e) {
                    // Cross-origin restrictions, fallback to timeout
                  }
                  
                  // Retry after a short delay
                  setTimeout(checkContent, 200);
                };
                
                // Start checking after a brief delay
                setTimeout(checkContent, 300);
                
                // Fallback: show after 5 seconds regardless
                setTimeout(() => {
                  if (iframe.style.opacity === '0') {
                    // Fallback: show iframe and hide overlay after extended timeout
                    iframe.style.opacity = '1';
                    const overlay = document.getElementById('preview-loading-overlay');
                    if (overlay) {
                      overlay.style.opacity = '0';
                      overlay.style.transition = 'opacity 0.5s ease-out';
                      setTimeout(() => {
                        overlay.style.display = 'none';
                      }, 500);
                    }
                  }
                }, 8000); // Extended fallback timeout to 8 seconds
              }}
            />
          </div>
            ) : shouldShowLoadingState ? (
          /* Loading state - unified with main loading UI */
          <div className="flex-1 flex flex-col items-center justify-center p-8">
                         {/* Monitor Container */}
             <div className="relative">
               {/* Monitor Screen */}
               <div className="w-96 h-64 bg-gradient-to-b from-secondary to-secondary/80 rounded-lg shadow-lg relative border-2 border-border/50">
                 {/* Screen bezel */}
                 <div className="absolute inset-2 bg-background rounded-lg overflow-hidden border border-border/30">
                   {/* Clean interface */}
                   <div className="h-full bg-gradient-to-b from-background to-secondary/20 p-4 flex flex-col justify-center">
                     {/* Simple loading display */}
                     <div className="text-center space-y-4">
                       <div className="flex items-center justify-center gap-2 text-primary">
                         <span className="text-sm">Initializing preview...</span>
                       </div>
                       
                       {/* Simple progress animation */}
                       <div className="w-full h-1 bg-secondary/50 rounded-full overflow-hidden border border-border/20">
                         <div className="h-full rounded-full relative overflow-hidden" style={{ width: '30%', background: 'linear-gradient(135deg, #2E2A5D 0%, #5A3F9E 25%, #2D8EFF 75%, #00D2C6 100%)' }}>
                           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                         </div>
                       </div>
                     </div>
                  </div>
                </div>
                
                {/* Screen reflection */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-lg pointer-events-none"></div>
              </div>
            </div>
            
            
          </div>
        ) : (
          /* Empty state - only show when not loading */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <h3 className="text-xl font-semibold mb-3 text-white">No Preview Available</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {!hasFiles ? 'Start by describing your project in the chat to generate files' : 
               projectId ? 'Your preview will appear here once the project is ready' : 
               'Select a project to see its live preview'}
            </p>
            {projectId && hasFiles && (
              <button 
                onClick={startPreview} 
                disabled={isLoading}
                className="button-enter px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
              >
                <Play className="h-5 w-5" />
                Start Preview
              </button>
            )}
          </div>
        )}

        {/* Visual Editor Button */}
        {previewUrl && (
          <div className="absolute top-4 right-4 z-40">
            <div className="relative group">
              <button
                onClick={() => {
                  if (userPlan === 'free') {
                    toast.error('Visual editor requires a paid plan', {
                      duration: 6000,
                      action: {
                        label: 'Upgrade',
                        onClick: () => window.open('/pricing', '_blank')
                      }
                    });
                    return;
                  }
                  setIsVisualEditorActive(!isVisualEditorActive);
                }}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  userPlan === 'free' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                style={{
                  background: isVisualEditorActive
                    ? 'rgba(59, 130, 246, 0.2)'
                    : 'rgba(0, 0, 0, 0.8)',
                  color: isVisualEditorActive ? '#60a5fa' : 'white',
                  border: isVisualEditorActive 
                    ? '1px solid rgba(59, 130, 246, 0.4)' 
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(20px)',
                  ...(userPlan === 'free' ? { filter: 'grayscale(0.3)' } : {})
                }}
              >
                {isVisualEditorActive ? <Edit3 className="w-5 h-5" /> : <Wand2 className="w-5 h-5" />}
                {userPlan === 'free' && (
                  <div className="absolute inset-0 bg-gray-900/20 rounded-lg pointer-events-none" />
                )}
              </button>
              
              {/* Instant tooltip */}
              {userPlan === 'free' && (
                <div className="absolute right-0 top-full mt-2 px-3 py-2 text-sm text-white bg-gray-900 border border-gray-600 rounded-lg shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[99999]">
                  Upgrade to paid plan for this feature
                  <div className="absolute bottom-full right-4 border-4 border-transparent border-b-gray-900"></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Visual Editor Component */}
        <VisualEditor
          projectId={projectId}
          iframeRef={iframeRef}
          isActive={isVisualEditorActive}
          onToggle={() => setIsVisualEditorActive(!isVisualEditorActive)}
          onFileUpdate={handleVisualEditorFileUpdate}
        />
      </div>
    </div>
  );
}

// Memoize PreviewPane to prevent unnecessary remounts
export default React.memo(PreviewPane, (prevProps, nextProps) => {
  // Only re-render if projectId changes or if preventRestart changes from true to false
  if (prevProps.projectId !== nextProps.projectId) {
    return false; // Re-render
  }
  
  // If preventRestart is going from true to false, don't re-render to avoid restart
  if (prevProps.preventRestart && !nextProps.preventRestart) {
    console.log('🚫 PreviewPane: Preventing re-render when preventRestart goes from true to false');
    return true; // Don't re-render
  }
  
  // For other prop changes, use shallow comparison
  return (
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.hasFiles === nextProps.hasFiles &&
    prevProps.preventRestart === nextProps.preventRestart
  );
}); 