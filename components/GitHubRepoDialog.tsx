'use client';

import { useState, useEffect } from 'react';
import { Github, Loader2, Plus, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  clone_url?: string;
  default_branch?: string;
  language?: string | null;
  stargazers_count?: number;
  size?: number;
  updated_at?: string;
  topics?: string[];
  description?: string;
}

interface GitHubRepoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (repo: GitHubRepo) => void;
  projectId?: string;
  projectName?: string;
  mode?: 'connect' | 'import';
  title?: string;
}

export default function GitHubRepoDialog({ 
  isOpen, 
  onClose, 
  onSuccess,
  projectId,
  projectName = '',
  mode = 'connect',
  title
}: GitHubRepoDialogProps) {
  const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectingRepoId, setConnectingRepoId] = useState<number | null>(null);
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newRepoName, setNewRepoName] = useState(projectName.replace(/[^a-zA-Z0-9-]/g, '-'));
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);

  // Fetch user's repositories
  useEffect(() => {
    if (isOpen) {
      console.log('GitHubRepoDialog opened, fetching repositories...');
      fetchRepositories();
    }
  }, [isOpen]);

  const fetchRepositories = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching repositories from /api/github/repositories');
      const response = await fetch('/api/github/repositories', {
        credentials: 'include'
      });
      
      console.log('Repository fetch response:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Repository fetch failed:', errorText);
        throw new Error('Failed to fetch repositories');
      }
      
      const repos = await response.json();
      console.log('Fetched repositories:', repos);
      setRepositories(repos);
    } catch (error) {
      console.error('Error fetching repositories:', error);
      toast.error('Failed to fetch repositories');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRepository = async (repo: GitHubRepo) => {
    if (mode === 'import') {
      // For import mode, just return the selected repo
      onSuccess?.(repo);
      onClose();
      return;
    }

    // For connect mode, connect the repository to the project
    setConnectingRepoId(repo.id);
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
      onSuccess?.(repo);
      onClose();
    } catch (error) {
      console.error('Error connecting repository:', error);
      toast.error('Failed to connect repository');
    } finally {
      setConnectingRepoId(null);
    }
  };

  const handleCreateNew = async () => {
    if (!newRepoName.trim()) {
      toast.error('Repository name is required');
      return;
    }

    setIsCreatingRepo(true);
    try {
      const response = await fetch('/api/github/create-repository', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          name: newRepoName,
          private: newRepoPrivate,
          description: `Project created with Forge: ${projectName}`
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create repository');
      }

      const repo = await response.json();
      toast.success(`Created ${repo.full_name}! 🎉`);
      onSuccess?.(repo);
      onClose();
    } catch (error) {
      console.error('Error creating repository:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create repository');
    } finally {
      setIsCreatingRepo(false);
    }
  };

  if (!isOpen) {
    console.log('GitHubRepoDialog is closed');
    return null;
  }
  
  console.log('GitHubRepoDialog is rendering...');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div 
        className="w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl max-h-[80vh] flex flex-col"
        style={{
          backgroundColor: 'rgba(30, 30, 30, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-center p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-foreground">
            {title || (mode === 'import' ? 'Select Repository to Import' : 'Connect to Repository')}
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Tabs - Only show for connect mode */}
          {mode === 'connect' && (
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setShowCreateNew(false)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  !showCreateNew 
                    ? 'text-foreground border-b-2 border-blue-500' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Existing Repositories
              </button>
              <button
                onClick={() => setShowCreateNew(true)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  showCreateNew 
                    ? 'text-foreground border-b-2 border-blue-500' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Create New
              </button>
            </div>
          )}

          <div className="flex-1 overflow-auto p-6">
            {(mode === 'import' || !showCreateNew) ? (
              /* Existing Repositories */
              <div className="space-y-3">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading repositories...</span>
                  </div>
                ) : repositories.length === 0 ? (
                  <div className="text-center py-8">
                    <Github className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No repositories found</p>
                    <p className="text-sm text-muted-foreground mt-1">Create a new repository to get started</p>
                  </div>
                ) : (
                  repositories.map((repo) => (
                    <div
                      key={repo.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{repo.name}</span>
                          {repo.private ? (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <Unlock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        {repo.description && (
                          <p className="text-sm text-muted-foreground mt-1">{repo.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{repo.full_name}</p>
                      </div>
                      <button
                        onClick={() => handleSelectRepository(repo)}
                        disabled={connectingRepoId === repo.id}
                        className="relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 overflow-hidden flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                          backdropFilter: 'blur(20px)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                          color: '#ffffff',
                          transform: 'translateY(0)'
                        }}
                        onMouseEnter={(e) => {
                          if (connectingRepoId !== repo.id) {
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
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (connectingRepoId !== repo.id) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                          }
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
                        {connectingRepoId === repo.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {mode === 'import' ? 'Selecting...' : 'Connecting...'}
                          </>
                        ) : (
                          mode === 'import' ? 'Select' : 'Connect'
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* Create New Repository */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Repository Name
                  </label>
                  <input
                    type="text"
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    className="w-full px-4 py-3 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm"
                    placeholder="my-awesome-project"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="private"
                    checked={newRepoPrivate}
                    onChange={(e) => setNewRepoPrivate(e.target.checked)}
                    className="rounded border-white/20"
                  />
                  <label htmlFor="private" className="text-sm text-foreground flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Private repository
                  </label>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>This will create a new repository in your GitHub account and connect it to this project.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end p-6 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={isCreatingRepo || connectingRepoId !== null}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-foreground hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          {mode === 'connect' && showCreateNew && (
            <button
              onClick={handleCreateNew}
              disabled={isCreatingRepo || !newRepoName.trim()}
              className="relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 overflow-hidden flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                transform: 'translateY(0)'
              }}
              onMouseEnter={(e) => {
                if (!isCreatingRepo && newRepoName.trim()) {
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
                }
              }}
              onMouseLeave={(e) => {
                if (!isCreatingRepo && newRepoName.trim()) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }
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
              {isCreatingRepo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Repository
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 