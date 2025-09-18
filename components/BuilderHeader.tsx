'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Download, 
  Github, 
  ChevronDown,
  Monitor,
  Tablet,
  Smartphone,
  Settings,
  Loader2
} from 'lucide-react';
import ProjectSettingsDialog from './ProjectSettingsDialog';
import { toast } from 'sonner';

interface BuilderHeaderProps {
  projectName?: string;
  fileCount?: number;
  layout: 'code' | 'split' | 'preview';
  onLayoutChange: (layout: 'code' | 'split' | 'preview') => void;
  onPublish: () => void;
  onGithub: () => void;
  onExport: () => void;
  projectId?: string;
  isGitHubProcessing?: boolean;
  userPlan?: string;
  projectData?: {
    id: string;
    name: string;
    description?: string;
    dbName?: string;
    dbHost?: string;
    dbUser?: string;
    dbPassword?: string;
    repoUrl?: string;
    branch: string;
    tokensUsed: number;
    githubRepoId?: string;
    githubRepoName?: string;
    githubInstallationId?: string;
    githubPrivate: boolean;
  };
}

export default function BuilderHeader({
  projectName = 'hi',
  fileCount = 20,
  layout,
  onLayoutChange,
  onPublish,
  onGithub,
  onExport,
  projectId,
  isGitHubProcessing = false,
  userPlan = 'free',
  projectData
}: BuilderHeaderProps) {
  const [showDeployDropdown, setShowDeployDropdown] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const deployDropdownRef = useRef<HTMLDivElement>(null);
  const shimmerTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Clean up shimmer timeouts when layout changes
  useEffect(() => {
    // Clear all existing shimmer timeouts when layout changes
    shimmerTimeoutsRef.current.forEach((timeout) => {
      clearTimeout(timeout);
    });
    shimmerTimeoutsRef.current.clear();

    // Reset all shimmer effects immediately
    const allShimmers = document.querySelectorAll('.shimmer-effect');
    allShimmers.forEach((shimmer) => {
      (shimmer as HTMLElement).style.transform = 'translateX(-100%)';
      (shimmer as HTMLElement).style.transition = 'none';
    });
  }, [layout]);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      shimmerTimeoutsRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      shimmerTimeoutsRef.current.clear();
    };
  }, []);

  // Handle mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Listen for sidebar hover state changes
  useEffect(() => {
    const handleSidebarHover = () => {
      const sidebar = document.querySelector('[data-sidebar]') as HTMLElement;
      if (sidebar) {
        const isExpanded = sidebar.classList.contains('w-48');
        setSidebarExpanded(isExpanded);
      }
    };

    // Check initial state
    handleSidebarHover();

    // Set up observer for sidebar class changes
    const sidebar = document.querySelector('[data-sidebar]');
    if (sidebar) {
      const observer = new MutationObserver(handleSidebarHover);
      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
      
      return () => observer.disconnect();
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (deployDropdownRef.current && !deployDropdownRef.current.contains(e.target as Node)) {
        setShowDeployDropdown(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDeployDropdown(false);
      }
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <>
    <div 
      className="fixed top-0 right-0 h-16 flex items-center justify-between px-6 z-50 transition-all duration-500 ease-out border-b"
      style={{
        left: isMobile ? '0px' : (sidebarExpanded ? '192px' : '44px'), // Updated for w-48 (192px)
        backgroundColor: 'rgba(30, 30, 30, 0.5)',
        backdropFilter: 'blur(20px)',
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
      }}
    >
      {/* Left Side - Project Info */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3">
          <button
            className="p-2 rounded-lg transition-all duration-300 text-gray-300 hover:text-white"
            title="Project Settings"
            onClick={() => setShowSettingsDialog(true)}
          >
            <Settings className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">{projectName}</h1>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground/70">
            <span>•</span>
            <span>{fileCount} files</span>
          </div>
        </div>
      </div>

      {/* Right Side - Controls */}
      <div className="flex items-center space-x-4">
        {/* Layout Controls */}
        <div 
          className="inline-flex p-1 rounded-xl border backdrop-blur-sm"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderColor: 'rgba(255, 255, 255, 0.15)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }}
        >
          {(['code', 'split', 'preview'] as const).map((mode) => (
            <button
              key={mode}
              data-layout-button={mode}
              onClick={() => onLayoutChange(mode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium relative overflow-hidden ${
                layout === mode
                  ? 'text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              style={{
                background: layout === mode 
                  ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)'
                  : 'transparent',
                border: layout === mode 
                  ? '1px solid rgba(255, 255, 255, 0.2)'
                  : '1px solid transparent',
                boxShadow: layout === mode 
                  ? '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                  : 'none',
                transform: 'translateY(0)',
                backdropFilter: layout === mode ? 'blur(20px)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (layout === mode) {
                  // Remove lift effect - no transform changes
                  // e.currentTarget.style.transform = 'translateY(-2px)';
                  // e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                  // e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  
                  // Only trigger shimmer effect for selected button
                  const shimmer = e.currentTarget.querySelector('.shimmer-effect') as HTMLElement;
                  if (shimmer) {
                    // Clear any existing timeout for this button
                    const existingTimeout = shimmerTimeoutsRef.current.get(mode);
                    if (existingTimeout) {
                      clearTimeout(existingTimeout);
                    }
                    
                    // Animate shimmer with JavaScript
                    shimmer.style.transition = 'transform 0.5s ease-out';
                    shimmer.style.transform = 'translateX(100%)';
                    const timeout = setTimeout(() => {
                      shimmer.style.transition = 'none';
                      shimmer.style.transform = 'translateX(-100%)';
                      shimmerTimeoutsRef.current.delete(mode);
                    }, 500);
                    shimmerTimeoutsRef.current.set(mode, timeout);
                  }
                }
              }}
              onMouseLeave={(e) => {
                // Remove lift effect reset
                // if (layout === mode) {
                //   e.currentTarget.style.transform = 'translateY(0)';
                //   e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                //   e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                // }
              }}
            >
              {/* Shimmer effect for selected button only */}
              {layout === mode && (
                <div 
                  className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                    transform: 'translateX(-100%)'
                  }}
                ></div>
              )}
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div 
          className="w-px h-6"
          style={{ background: 'rgba(255, 255, 255, 0.15)' }}
        ></div>

        {/* Deploy Dropdown */}
        <div className="relative" ref={deployDropdownRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeployDropdown(!showDeployDropdown);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 relative overflow-hidden"
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
                // Clear any existing timeout for deploy button
                const existingTimeout = shimmerTimeoutsRef.current.get('deploy');
                if (existingTimeout) {
                  clearTimeout(existingTimeout);
                }
                
                // Animate shimmer with JavaScript
                shimmer.style.transition = 'transform 0.5s ease-out';
                shimmer.style.transform = 'translateX(100%)';
                const timeout = setTimeout(() => {
                  shimmer.style.transition = 'none';
                  shimmer.style.transform = 'translateX(-100%)';
                  shimmerTimeoutsRef.current.delete('deploy');
                }, 500);
                shimmerTimeoutsRef.current.set('deploy', timeout);
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
              className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                transform: 'translateX(-100%)'
              }}
            ></div>
            {isGitHubProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isGitHubProcessing ? 'Pushing...' : 'Deploy'}
            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showDeployDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {showDeployDropdown && (
            <div 
              className="absolute top-full right-0 mt-2 w-52 rounded-xl overflow-hidden z-50 border"
              style={{
                backgroundColor: 'rgb(30, 30, 30)', // Solid background instead of rgba
                borderColor: 'rgba(255, 255, 255, 0.2)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                transform: 'translateY(-4px)'
              }}
            >
              <div className="py-1">
                <div className="relative group">
                  <button
                    onClick={() => {
                      if (userPlan === 'free') {
                        toast.error('Deployments require a paid plan', {
                          duration: 6000,
                          action: {
                            label: 'Upgrade',
                            onClick: () => window.open('/pricing', '_blank')
                          }
                        });
                        return;
                      }
                      setShowDeployDropdown(false);
                      onPublish();
                    }}
                    onMouseEnter={(e) => {
                      if (userPlan === 'free') {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const tooltip = document.createElement('div');
                        tooltip.id = 'deploy-tooltip';
                        tooltip.className = 'fixed px-3 py-2 text-sm text-white bg-gray-900 border border-gray-600 rounded-lg shadow-xl whitespace-nowrap pointer-events-none z-[999999]';
                        tooltip.textContent = 'Upgrade to paid plan for this feature';
                        tooltip.style.left = `${rect.left - 220}px`;
                        tooltip.style.top = `${rect.top}px`;
                        document.body.appendChild(tooltip);
                      }
                    }}
                    onMouseLeave={() => {
                      const tooltip = document.getElementById('deploy-tooltip');
                      if (tooltip) tooltip.remove();
                    }}
                    className={`w-full px-4 py-3 text-left text-sm transition-all duration-300 relative group/item overflow-hidden hover:bg-white/5 flex items-center gap-3 ${
                      userPlan === 'free' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    style={userPlan === 'free' ? { filter: 'grayscale(0.3)' } : {}}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-300"></div>
                    <Play className="w-4 h-4 text-green-400 relative z-10" />
                    <div className="relative z-10">
                      <div className="font-medium text-white">Publish</div>
                      <div className="text-xs text-muted-foreground">Deploy to production</div>
                    </div>
                    {userPlan === 'free' && (
                      <div className="absolute inset-0 bg-gray-900/20 rounded-lg pointer-events-none" />
                    )}
                  </button>
                  

                </div>
                
                <div 
                  className="h-px mx-2"
                  style={{ background: 'rgba(255, 255, 255, 0.1)' }}
                ></div>
                
                <div className="relative group">
                  <button
                    onClick={() => {
                      if (userPlan === 'free') {
                        toast.error('GitHub integration requires a paid plan', {
                          duration: 6000,
                          action: {
                            label: 'Upgrade',
                            onClick: () => window.open('/pricing', '_blank')
                          }
                        });
                        return;
                      }
                      if (isGitHubProcessing) return; // Prevent clicks while processing
                      setShowDeployDropdown(false);
                      onGithub();
                    }}

                    onMouseEnter={(e) => {
                      if (userPlan === 'free') {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const tooltip = document.createElement('div');
                                                 tooltip.id = 'github-tooltip';
                         tooltip.className = 'fixed px-3 py-2 text-sm text-white bg-gray-900 border border-gray-600 rounded-lg shadow-xl whitespace-nowrap pointer-events-none z-[999999]';
                         tooltip.textContent = 'Upgrade to paid plan for this feature';
                         tooltip.style.left = `${rect.left - 220}px`;
                        tooltip.style.top = `${rect.top}px`;
                        document.body.appendChild(tooltip);
                      }
                    }}
                    onMouseLeave={() => {
                      const tooltip = document.getElementById('github-tooltip');
                      if (tooltip) tooltip.remove();
                    }}
                    className={`w-full px-4 py-3 text-left text-sm transition-all duration-300 relative group/item overflow-hidden flex items-center gap-3 ${
                      isGitHubProcessing 
                        ? 'opacity-75 cursor-not-allowed' 
                        : userPlan === 'free'
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-white/5'
                    }`}
                    style={userPlan === 'free' ? { filter: 'grayscale(0.3)' } : {}}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-300"></div>
                    <Github className="w-4 h-4 text-gray-400 relative z-10" />
                    <div className="relative z-10">
                      <div className="font-medium text-white">GitHub</div>
                      <div className="text-xs text-muted-foreground">
                        {projectData?.githubRepoName 
                          ? `Push to ${projectData.githubRepoName}` 
                          : 'Push to repository'
                        }
                      </div>
                    </div>
                    {userPlan === 'free' && (
                      <div className="absolute inset-0 bg-gray-900/20 rounded-lg pointer-events-none" />
                    )}
                  </button>
                </div>
                
                <div className="relative group">
                  <button
                    onClick={() => {
                      if (userPlan === 'free') {
                        toast.error('Project export requires a paid plan', {
                          duration: 6000,
                          action: {
                            label: 'Upgrade',
                            onClick: () => window.open('/pricing', '_blank')
                          }
                        });
                        return;
                      }
                      setShowDeployDropdown(false);
                      onExport();
                    }}
                    onMouseEnter={(e) => {
                      if (userPlan === 'free') {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const tooltip = document.createElement('div');
                                                 tooltip.id = 'export-tooltip';
                         tooltip.className = 'fixed px-3 py-2 text-sm text-white bg-gray-900 border border-gray-600 rounded-lg shadow-xl whitespace-nowrap pointer-events-none z-[999999]';
                         tooltip.textContent = 'Upgrade to paid plan for this feature';
                         tooltip.style.left = `${rect.left - 220}px`;
                        tooltip.style.top = `${rect.top}px`;
                        document.body.appendChild(tooltip);
                      }
                    }}
                    onMouseLeave={() => {
                      const tooltip = document.getElementById('export-tooltip');
                      if (tooltip) tooltip.remove();
                    }}
                    className={`w-full px-4 py-3 text-left text-sm transition-all duration-300 relative group/item overflow-hidden hover:bg-white/5 flex items-center gap-3 ${
                      userPlan === 'free' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    style={userPlan === 'free' ? { filter: 'grayscale(0.3)' } : {}}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-300"></div>
                    <Download className="w-4 h-4 text-blue-400 relative z-10" />
                    <div className="relative z-10">
                      <div className="font-medium text-white">Export Project</div>
                      <div className="text-xs text-muted-foreground">Download as ZIP</div>
                    </div>
                    {userPlan === 'free' && (
                      <div className="absolute inset-0 bg-gray-900/20 rounded-lg pointer-events-none" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Project Settings Dialog */}
    {projectId && (
      <ProjectSettingsDialog
        isOpen={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        projectId={projectId}
        projectData={projectData}
      />
    )}
  </>
  );
}