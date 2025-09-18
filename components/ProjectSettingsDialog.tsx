'use client';

import { useState, useEffect } from 'react';
import { X, Settings, Save, Pencil, Check, Github, Unlink, Link } from 'lucide-react';
import { toast } from 'sonner';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';
import GitHubRepoDialog from './GitHubRepoDialog';

interface ProjectSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
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

export default function ProjectSettingsDialog({
  isOpen,
  onClose,
  projectId,
  projectData
}: ProjectSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  
  // Edit state for individual fields
  const [editState, setEditState] = useState<Record<string, boolean>>({});
  
  // Visibility state (separate from githubPrivate boolean)
  const [visibility, setVisibility] = useState<'public' | 'private' | 'secret'>('public');
  const [tempVisibility, setTempVisibility] = useState<'public' | 'private' | 'secret'>('public');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dbName: '',
    dbHost: '',
    dbUser: '',
    dbPassword: '',
    repoUrl: '',
    branch: 'main',
    githubPrivate: false
  });

  // Temporary values for editing
  const [tempValues, setTempValues] = useState({
    name: '',
    description: '',
    dbName: '',
    dbHost: '',
    dbUser: '',
    dbPassword: '',
    repoUrl: '',
    branch: 'main',
    githubPrivate: false
  });

  // Load project data when dialog opens
  useEffect(() => {
    if (isOpen && projectData) {
      const data = {
        name: projectData.name || '',
        description: projectData.description || '',
        dbName: projectData.dbName || '',
        dbHost: projectData.dbHost || '',
        dbUser: projectData.dbUser || '',
        dbPassword: projectData.dbPassword || '',
        repoUrl: projectData.repoUrl || '',
        branch: projectData.branch || 'main',
        githubPrivate: projectData.githubPrivate || false
      };
      setFormData(data);
      setTempValues(data);
      setEditState({});
      setIsSaving({});
      
      // Set visibility based on githubPrivate boolean
      const visibilityValue = projectData.githubPrivate ? 'private' : 'public';
      setVisibility(visibilityValue);
      setTempVisibility(visibilityValue);
    }
  }, [isOpen, projectData]);

  const handleEdit = (field: string) => {
    setEditState(prev => ({ ...prev, [field]: true }));
    if (field === 'githubPrivate') {
      setTempVisibility(visibility);
    } else {
      setTempValues(prev => ({ ...prev, [field]: formData[field as keyof typeof formData] }));
    }
  };

  const handleCancel = (field: string) => {
    setEditState(prev => ({ ...prev, [field]: false }));
    if (field === 'githubPrivate') {
      setTempVisibility(visibility);
    } else {
      setTempValues(prev => ({ ...prev, [field]: formData[field as keyof typeof formData] }));
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setTempValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (field: string) => {
    // Special handling for branch updates with GitHub validation
    if (field === 'branch') {
      return handleBranchSave();
    }

    setIsSaving(prev => ({ ...prev, [field]: true }));
    try {
      let valueToSave;
      if (field === 'githubPrivate') {
        // Convert visibility to boolean for backend
        valueToSave = tempVisibility === 'private';
      } else {
        valueToSave = tempValues[field as keyof typeof tempValues];
      }

      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: valueToSave }),
      });

      if (!response.ok) throw new Error('Failed to update project');

      // Update form data with saved value
      if (field === 'githubPrivate') {
        setFormData(prev => ({ ...prev, [field]: valueToSave as boolean }));
        setVisibility(tempVisibility);
      } else {
        setFormData(prev => ({ ...prev, [field]: tempValues[field as keyof typeof tempValues] }));
      }
      setEditState(prev => ({ ...prev, [field]: false }));
      
      toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully`);
    } catch (error) {
      console.error('Failed to update project:', error);
      toast.error(`Failed to update ${field}`);
    } finally {
      setIsSaving(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleBranchSave = async () => {
    setIsSaving(prev => ({ ...prev, branch: true }));
    try {
      const branchName = tempValues.branch;
      
      if (!branchName || branchName.trim() === '') {
        toast.error('Branch name cannot be empty');
        return;
      }

      // Check if project has GitHub repository connected
      if (!projectData?.githubRepoName) {
        // If no GitHub repo, just update the database
        const response = await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ branch: branchName }),
        });

        if (!response.ok) throw new Error('Failed to update project');

        setFormData(prev => ({ ...prev, branch: branchName }));
        setEditState(prev => ({ ...prev, branch: false }));
        toast.success('Branch updated successfully');
        return;
      }

      // Use GitHub validation endpoint for projects with connected repositories
      const response = await fetch('/api/github/update-branch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          projectId, 
          branch: branchName,
          createIfMissing: true // Allow creating branches if they don't exist
        }),
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (data.error === 'Branch does not exist' && data.suggestion) {
          toast.error(data.message, {
            description: data.suggestion,
            duration: 5000
          });
        } else if (data.error === 'Insufficient permissions') {
          toast.error('Permission denied', {
            description: data.message,
            duration: 5000
          });
        } else {
          toast.error(data.message || 'Failed to update branch');
        }
        return;
      }

      // Update form data with saved value
      setFormData(prev => ({ ...prev, branch: branchName }));
      setEditState(prev => ({ ...prev, branch: false }));
      
      // Show success message with additional info
      if (data.branch?.created) {
        toast.success('Branch created and updated! 🌿', {
          description: `Created new branch "${branchName}" from the default branch`,
          duration: 4000
        });
      } else {
        toast.success('Branch updated successfully! ✅', {
          description: data.message,
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Failed to update branch:', error);
      toast.error('Failed to update branch');
    } finally {
      setIsSaving(prev => ({ ...prev, branch: false }));
    }
  };

  const handleDeleteMessages = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteMessages = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/messages`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to delete messages');

      toast.success('All messages deleted successfully');
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete messages:', error);
      toast.error('Failed to delete messages');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConnectGitHub = () => {
    setShowGitHubDialog(true);
  };

  const handleGitHubRepoSelect = async (repo: any) => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/users/projects/connect-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          githubRepoId: repo.id.toString(),
          githubRepoName: repo.full_name,
          repoUrl: repo.html_url,
          githubPrivate: repo.private
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to connect repository');
      }

      toast.success(`Connected to ${repo.full_name}! 🎉`);
      
      // Update form data to reflect the connection
      setFormData(prev => ({
        ...prev,
        repoUrl: repo.html_url,
        githubPrivate: repo.private
      }));
      
      // Update visibility state
      setVisibility(repo.private ? 'private' : 'public');
      
      // Refresh the page data or trigger a re-fetch
      window.location.reload();
    } catch (error) {
      console.error('Error connecting repository:', error);
      toast.error('Failed to connect repository');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    setIsDisconnecting(true);
    try {
      const response = await fetch('/api/users/projects/disconnect-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect repository');
      }

      toast.success('Repository disconnected successfully');
      
      // Update form data to reflect the disconnection
      setFormData(prev => ({
        ...prev,
        repoUrl: '',
        githubPrivate: false
      }));
      
      // Reset visibility state
      setVisibility('public');
      
      // Close confirmation dialog
      setShowDisconnectConfirm(false);
      
      // Refresh the page data or trigger a re-fetch
      window.location.reload();
    } catch (error) {
      console.error('Error disconnecting repository:', error);
      toast.error('Failed to disconnect repository');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleUpdateVisibility = async (newVisibility: 'public' | 'private') => {
    if (!projectData?.githubRepoName) {
      toast.error('No GitHub repository connected');
      return;
    }

    setIsUpdatingVisibility(true);
    try {
      const response = await fetch('/api/github/update-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          visibility: newVisibility
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update repository visibility');
      }

      toast.success(`Repository visibility updated to ${newVisibility}`);
      
      // Update local state
      setVisibility(newVisibility);
      setFormData(prev => ({
        ...prev,
        githubPrivate: newVisibility === 'private'
      }));
      
      setEditState(prev => ({ ...prev, githubPrivate: false }));
    } catch (error) {
      console.error('Error updating visibility:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update repository visibility');
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="w-full max-w-2xl h-[85vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col"
        style={{
          backgroundColor: 'rgba(30, 30, 30, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
        }}
      >
                      {/* Professional Navigation */}
              <div className="px-6 py-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('basic')}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 overflow-hidden ${
                activeTab === 'basic'
                  ? 'bg-white/10 text-foreground border border-white/20 backdrop-blur-sm shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
              style={activeTab === 'basic' ? {
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                transform: 'translateY(0)'
              } : {}}
              onMouseEnter={activeTab === 'basic' ? (e) => {
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
              } : undefined}
              onMouseLeave={activeTab === 'basic' ? (e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              } : undefined}
            >
              <Settings className="w-4 h-4" />
              Basic Settings
              {activeTab === 'basic' && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent rounded-lg opacity-50"></div>
                  <div 
                    className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                      transform: 'translateX(-100%)'
                    }}
                  ></div>
                </>
              )}
            </button>
            
            {/* Integrations Tab */}
            <button
              onClick={() => setActiveTab('integrations')}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 overflow-hidden ${
                activeTab === 'integrations'
                  ? 'bg-white/10 text-foreground border border-white/20 backdrop-blur-sm shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
              style={activeTab === 'integrations' ? {
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                transform: 'translateY(0)'
              } : {}}
              onMouseEnter={activeTab === 'integrations' ? (e) => {
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
              } : undefined}
              onMouseLeave={activeTab === 'integrations' ? (e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              } : undefined}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Integrations
              {activeTab === 'integrations' && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent rounded-lg opacity-50"></div>
                  <div 
                    className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                      transform: 'translateX(-100%)'
                    }}
                  ></div>
                </>
              )}
            </button>
            
            <button
              onClick={() => setActiveTab('security')}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 opacity-50 cursor-not-allowed ${
                activeTab === 'security'
                  ? 'bg-white/10 text-foreground border border-white/20 backdrop-blur-sm shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
              disabled
              title="Coming Soon"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Security
            </button>
            
            <button
              onClick={() => setActiveTab('advanced')}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 opacity-50 cursor-not-allowed ${
                activeTab === 'advanced'
                  ? 'bg-white/10 text-foreground border border-white/20 backdrop-blur-sm shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
              disabled
              title="Coming Soon"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
                                  Advanced
                  </button>
                  </div>
                  
                  {/* Close Button */}
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg transition-all duration-300 text-gray-300 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'basic' && (
            <div className="space-y-6">
              {/* Project Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Project Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={editState.name ? tempValues.name : formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={!editState.name}
                    className={`w-full px-4 py-3 pr-20 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm ${!editState.name ? 'opacity-70' : ''}`}
                    placeholder="Enter project name"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex space-x-2">
                    {editState.name ? (
                      <>
                        <button
                          onClick={() => handleCancel('name')}
                          className="p-1 hover:text-red-400 transition-colors"
                          disabled={isSaving.name}
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSave('name')}
                          className="p-1 hover:text-green-400 transition-colors"
                          disabled={isSaving.name}
                        >
                          {isSaving.name ? (
                            <div className="w-4 h-4 border-2 border-t-transparent border-green-400 rounded-full animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleEdit('name')}
                        className="p-1 hover:text-primary transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Project Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Description
                </label>
                <div className="relative">
                  <textarea
                    value={editState.description ? tempValues.description : formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    disabled={!editState.description}
                    rows={3}
                    className={`w-full px-4 py-3 pr-20 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm resize-none ${!editState.description ? 'opacity-70' : ''}`}
                    placeholder="Enter project description"
                  />
                  <div className="absolute right-3 top-3 flex space-x-2">
                    {editState.description ? (
                      <>
                        <button
                          onClick={() => handleCancel('description')}
                          className="p-1 hover:text-red-400 transition-colors"
                          disabled={isSaving.description}
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSave('description')}
                          className="p-1 hover:text-green-400 transition-colors"
                          disabled={isSaving.description}
                        >
                          {isSaving.description ? (
                            <div className="w-4 h-4 border-2 border-t-transparent border-green-400 rounded-full animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleEdit('description')}
                        className="p-1 hover:text-primary transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>





                                  {/* Token Usage Display */}
                    {projectData && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Tokens Used
                        </label>
                        <div className="px-4 py-3 text-base rounded-lg border text-muted-foreground bg-white/10 border-white/20 backdrop-blur-sm">
                          {projectData.tokensUsed.toLocaleString()} tokens
                        </div>
                      </div>
                    )}

                    {/* Delete Messages */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Delete All Messages
                      </label>
                      <p className="text-sm text-muted-foreground">
                        This will permanently delete all chat messages for this project. This action cannot be undone.
                      </p>
                      <button
                        onClick={handleDeleteMessages}
                        disabled={isDeleting}
                        className="relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 overflow-hidden flex items-center gap-2"
                        style={{
                          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)',
                          backdropFilter: 'blur(20px)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: '#ef4444',
                          transform: 'translateY(0)'
                        }}
                        onMouseEnter={(e) => {
                          if (!isDeleting) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                            
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
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isDeleting) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                          }
                        }}
                      >
                        {/* Shimmer effect */}
                        <div 
                          className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
                          style={{
                            background: 'linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.2), transparent)',
                            transform: 'translateX(-100%)'
                          }}
                        ></div>
                        {isDeleting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-t-transparent border-red-400 rounded-full animate-spin" />
                            Deleting Messages...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete All Messages
                          </>
                        )}
                      </button>
                    </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-6">
              {/* GitHub Integration */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-foreground">GitHub Integration</h3>
                
                {projectData?.githubRepoName ? (
                  // Connected State
                  <div className="space-y-4">
                    {/* Repository Name */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Connected Repository
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={projectData.githubRepoName}
                          disabled
                          className="w-full px-4 py-3 pr-20 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm opacity-70"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex space-x-2">
                          <a 
                            href={projectData.repoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1 hover:text-primary transition-colors"
                            title="View Repository"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                          <button 
                            onClick={() => setShowDisconnectConfirm(true)}
                            disabled={isDisconnecting}
                            className="p-1 hover:text-red-400 transition-colors"
                            title="Disconnect Repository"
                          >
                            {isDisconnecting ? (
                              <div className="w-4 h-4 border-2 border-t-transparent border-red-400 rounded-full animate-spin" />
                            ) : (
                              <Unlink className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Branch Configuration */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Default Branch
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={editState.branch ? tempValues.branch : formData.branch}
                          onChange={(e) => handleInputChange('branch', e.target.value)}
                          disabled={!editState.branch}
                          className={`w-full px-4 py-3 pr-20 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm ${!editState.branch ? 'opacity-70' : ''}`}
                          placeholder="main"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex space-x-2">
                          {editState.branch ? (
                            <>
                              <button onClick={() => handleCancel('branch')} className="p-1 hover:text-red-400 transition-colors" disabled={isSaving.branch}>
                                <X className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleSave('branch')} className="p-1 hover:text-green-400 transition-colors" disabled={isSaving.branch}>
                                {isSaving.branch ? <div className="w-4 h-4 border-2 border-t-transparent border-green-400 rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                              </button>
                            </>
                          ) : (
                            <button onClick={() => handleEdit('branch')} className="p-1 hover:text-primary transition-colors">
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Repository Visibility */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Repository Visibility
                      </label>
                      <div className="relative">
                        <select
                          value={visibility}
                          onChange={(e) => handleUpdateVisibility(e.target.value as 'public' | 'private')}
                          disabled={isUpdatingVisibility}
                          className={`w-full px-4 py-3 pr-12 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm appearance-none ${isUpdatingVisibility ? 'opacity-70' : ''}`}
                        >
                          <option value="public">Public</option>
                          <option value="private">Private</option>
                        </select>
                        {/* Custom dropdown arrow */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          {isUpdatingVisibility ? (
                            <div className="w-4 h-4 border-2 border-t-transparent border-primary rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Disconnected State
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      GitHub Repository
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value="No repository connected"
                        disabled
                        className="w-full px-4 py-3 pr-20 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm opacity-70"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex space-x-2">
                        <button 
                          onClick={handleConnectGitHub}
                          disabled={isConnecting}
                          className="p-1 hover:text-primary transition-colors"
                          title="Connect Repository"
                        >
                          {isConnecting ? (
                            <div className="w-4 h-4 border-2 border-t-transparent border-primary rounded-full animate-spin" />
                          ) : (
                            <Link className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Database Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-foreground">Database Configuration</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Database Name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={editState.dbName ? tempValues.dbName : formData.dbName}
                        onChange={(e) => handleInputChange('dbName', e.target.value)}
                        disabled={!editState.dbName}
                        className={`w-full px-4 py-3 pr-20 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm ${!editState.dbName ? 'opacity-70' : ''}`}
                        placeholder="Database name"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex space-x-2">
                        {editState.dbName ? (
                          <>
                            <button
                              onClick={() => handleCancel('dbName')}
                              className="p-1 hover:text-red-400 transition-colors"
                              disabled={isSaving.dbName}
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSave('dbName')}
                              className="p-1 hover:text-green-400 transition-colors"
                              disabled={isSaving.dbName}
                            >
                              {isSaving.dbName ? (
                                <div className="w-4 h-4 border-2 border-t-transparent border-green-400 rounded-full animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleEdit('dbName')}
                            className="p-1 hover:text-primary transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Database Host
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={editState.dbHost ? tempValues.dbHost : formData.dbHost}
                        onChange={(e) => handleInputChange('dbHost', e.target.value)}
                        disabled={!editState.dbHost}
                        className={`w-full px-4 py-3 pr-20 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm ${!editState.dbHost ? 'opacity-70' : ''}`}
                        placeholder="localhost"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex space-x-2">
                        {editState.dbHost ? (
                          <>
                            <button onClick={() => handleCancel('dbHost')} className="p-1 hover:text-red-400 transition-colors" disabled={isSaving.dbHost}>
                              <X className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleSave('dbHost')} className="p-1 hover:text-green-400 transition-colors" disabled={isSaving.dbHost}>
                              {isSaving.dbHost ? <div className="w-4 h-4 border-2 border-t-transparent border-green-400 rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                          </>
                        ) : (
                          <button onClick={() => handleEdit('dbHost')} className="p-1 hover:text-primary transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Database User
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={editState.dbUser ? tempValues.dbUser : formData.dbUser}
                        onChange={(e) => handleInputChange('dbUser', e.target.value)}
                        disabled={!editState.dbUser}
                        className={`w-full px-4 py-3 pr-20 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm ${!editState.dbUser ? 'opacity-70' : ''}`}
                        placeholder="Username"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex space-x-2">
                        {editState.dbUser ? (
                          <>
                            <button onClick={() => handleCancel('dbUser')} className="p-1 hover:text-red-400 transition-colors" disabled={isSaving.dbUser}>
                              <X className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleSave('dbUser')} className="p-1 hover:text-green-400 transition-colors" disabled={isSaving.dbUser}>
                              {isSaving.dbUser ? <div className="w-4 h-4 border-2 border-t-transparent border-green-400 rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                          </>
                        ) : (
                          <button onClick={() => handleEdit('dbUser')} className="p-1 hover:text-primary transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Database Password
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={editState.dbPassword ? tempValues.dbPassword : formData.dbPassword}
                        onChange={(e) => handleInputChange('dbPassword', e.target.value)}
                        disabled={!editState.dbPassword}
                        className={`w-full px-4 py-3 pr-20 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm ${!editState.dbPassword ? 'opacity-70' : ''}`}
                        placeholder="Password"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex space-x-2">
                        {editState.dbPassword ? (
                          <>
                            <button onClick={() => handleCancel('dbPassword')} className="p-1 hover:text-red-400 transition-colors" disabled={isSaving.dbPassword}>
                              <X className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleSave('dbPassword')} className="p-1 hover:text-green-400 transition-colors" disabled={isSaving.dbPassword}>
                              {isSaving.dbPassword ? <div className="w-4 h-4 border-2 border-t-transparent border-green-400 rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                          </>
                        ) : (
                          <button onClick={() => handleEdit('dbPassword')} className="p-1 hover:text-primary transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

                      </div>
          )}
                  </div>


      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDeleteMessages}
        title="Delete All Messages"
        message="Are you sure you want to delete all chat messages for this project? This action cannot be undone and will permanently remove all conversation history."
        confirmText="Delete All Messages"
        isLoading={isDeleting}
      />

      {/* GitHub Disconnect Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={showDisconnectConfirm}
        onClose={() => setShowDisconnectConfirm(false)}
        onConfirm={handleDisconnectGitHub}
        title="Disconnect GitHub Repository"
        message={`Are you sure you want to disconnect "${projectData?.githubRepoName}" from this project? You will lose the ability to push changes directly to GitHub until you reconnect a repository.`}
        confirmText="Disconnect Repository"
        isLoading={isDisconnecting}
      />

      {/* GitHub Repository Selection Dialog */}
      <GitHubRepoDialog
        isOpen={showGitHubDialog}
        onClose={() => setShowGitHubDialog(false)}
        onSuccess={handleGitHubRepoSelect}
        projectId={projectId}
        projectName={projectData?.name || ''}
        mode="connect"
        title="Connect GitHub Repository"
      />
    </div>
  );
} 