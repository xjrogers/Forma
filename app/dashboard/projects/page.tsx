'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../../components/DashboardLayout';
import { Plus, Github, Database, Zap, Settings, Trash2, GitBranch, File, FileText } from 'lucide-react';
import { toast } from 'sonner';
import CreateProjectModal from '../../../components/CreateProjectModal';
import DeleteProjectModal from '../../../components/DeleteProjectModal';
import ProjectSettingsDialog from '../../../components/ProjectSettingsDialog';
import ImportProjectModal from '../../../components/ImportProjectModal';
import ImportProgressModal from '../../../components/ImportProgressModal';
import { authService } from '@/lib/auth';

interface ProjectFile {
  id: string;
  path: string;
  contentType: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  branch: string;
  tokensUsed: number;
  githubRepoId: string | null;
  githubRepoName: string | null;
  githubPrivate: boolean;
  repoUrl: string | null;
  githubUrl: string | null;
  dbHost: string | null;
  dbName: string | null;
  dbUser: string | null;
  hasGithub: boolean;
  hasDatabase: boolean;
  files: ProjectFile[];
  fileCount: number;
  totalSize: number;
}

interface ProjectsResponse {
  projects: Project[];
  total: number;
  tokensUsed: number;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [userPlan, setUserPlan] = useState<string>('free');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressProject, setProgressProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  useEffect(() => {
    // Fetch fresh user plan from backend
    fetchUserPlan();
    fetchProjects();
  }, []);

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

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      
      const data: ProjectsResponse = await response.json();
      setProjects(data.projects);
      setTotalTokens(data.tokensUsed);
    } catch (error) {
      toast.error('Failed to load projects');
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    setProjectToDelete(project);
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;

    try {
      const response = await fetch(`/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      toast.success('Project deleted successfully');
      fetchProjects(); // Refresh the list
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
      throw error; // Re-throw to be handled by the modal
    }
  };

  function formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  return (
    <DashboardLayout activeTab="projects">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-foreground">Projects</h1>
            <div className="flex items-center space-x-3">
              {/* Import Button - Styled like Deploy Button */}
              <div className="relative group">
                <button
                  onClick={() => {
                    if (userPlan === 'free') {
                      toast.error('Project import requires a paid plan', {
                        duration: 6000,
                        action: {
                          label: 'Upgrade',
                          onClick: () => window.open('/pricing', '_blank')
                        }
                      });
                      return;
                    }
                    setShowImportModal(true);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 relative overflow-hidden ${
                    userPlan === 'free' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    transform: 'translateY(0)',
                    ...(userPlan === 'free' ? { filter: 'grayscale(0.3)' } : {})
                  }}
                  onMouseEnter={(e) => {
                    // Only apply hover effects if not restricted
                    if (userPlan !== 'free') {
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
                    // Only apply hover effects if not restricted
                    if (userPlan !== 'free') {
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
                  <Github className="w-4 h-4" />
                  Import
                  {userPlan === 'free' && (
                    <div className="absolute inset-0 bg-gray-900/20 rounded-xl pointer-events-none" />
                  )}
                </button>
                
                {/* Instant tooltip */}
                {userPlan === 'free' && (
                  <div className="absolute left-4 top-full mt-2 px-3 py-2 text-sm text-white bg-gray-900 border border-gray-600 rounded-lg shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[99999]">
                    Upgrade to paid plan for this feature
                    <div className="absolute bottom-full left-4 border-4 border-transparent border-b-gray-900"></div>
                  </div>
                )}
              </div>
              
              {/* New Project Button */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="button-luxury flex items-center space-x-2 px-4 py-2"
              >
                <Plus className="w-4 h-4" />
                <span>New Project</span>
              </button>
            </div>
          </div>
          <p className="text-lg text-muted-foreground">
            {projects.length} project{projects.length !== 1 ? 's' : ''} · {totalTokens.toLocaleString()} tokens used
          </p>
        </div>

        {/* Project List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="luxury-card p-12 text-center">
            <Plus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-6">Create your first project to get started building.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="button-luxury px-6 py-2"
            >
              Create Project
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="luxury-card p-6 hover:bg-secondary/20 transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/builder?projectId=${project.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-foreground">{project.name}</h3>
                      {/* Import Status Badge */}
                      {(project.description === 'Import queued...' || project.description === 'Import in progress...') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setProgressProject(project);
                            setShowProgressModal(true);
                          }}
                          className="px-2 py-1 rounded-full text-xs font-medium border bg-orange-500/20 text-orange-400 border-orange-500/30 flex items-center space-x-1 hover:bg-orange-500/30 transition-colors cursor-pointer"
                          title="Click to view import progress"
                        >
                          <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                          <span>{project.description === 'Import queued...' ? 'Queued' : 'Importing'}</span>
                        </button>
                      )}
                      {project.hasGithub && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium border bg-blue-500/20 text-blue-400 border-blue-500/30">
                          GitHub Connected
                        </span>
                      )}
                      {project.hasDatabase && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium border bg-green-500/20 text-green-400 border-green-500/30">
                          Database Connected
                        </span>
                      )}
                    </div>
                    {project.description && (
                      <p className="text-muted-foreground text-sm mb-3">{project.description}</p>
                    )}
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      {project.branch && (
                        <div className="flex items-center space-x-1">
                          <GitBranch className="w-3 h-3" />
                          <span>{project.branch}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-1">
                        <Zap className="w-3 h-3" />
                        <span>{project.tokensUsed.toLocaleString()} tokens</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <FileText className="w-3 h-3" />
                        <span>{project.fileCount} files</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <File className="w-3 h-3" />
                        <span>{formatFileSize(project.totalSize)}</span>
                      </div>
                      <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {project.hasGithub && (
                      <a
                        href={project.githubUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/30 rounded-lg transition-colors"
                        title="View on GitHub"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Github className="w-4 h-4" />
                      </a>
                    )}
                    <button 
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/30 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProject(project);
                        setShowSettingsDialog(true);
                      }}
                      title="Project Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button 
                      className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project);
                      }}
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchProjects}
      />

      {/* Import Project Modal */}
      <ImportProjectModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={fetchProjects}
      />

      {/* Import Progress Modal */}
      <ImportProgressModal
        isOpen={showProgressModal}
        onClose={() => {
          setShowProgressModal(false);
          setProgressProject(null);
        }}
        projectName={progressProject?.name || ''}
        jobId={progressProject?.id}
      />

      {/* Delete Project Modal */}
      <DeleteProjectModal
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={confirmDelete}
        projectName={projectToDelete?.name || ''}
      />

      {/* Project Settings Dialog */}
      <ProjectSettingsDialog
        isOpen={showSettingsDialog}
        onClose={() => {
          setShowSettingsDialog(false);
          setSelectedProject(null);
        }}
        projectId={selectedProject?.id || ''}
        projectData={selectedProject ? {
          id: selectedProject.id,
          name: selectedProject.name,
          description: selectedProject.description || undefined,
          dbName: selectedProject.dbName || undefined,
          dbHost: selectedProject.dbHost || undefined,
          dbUser: selectedProject.dbUser || undefined,
          dbPassword: undefined, // Not included in Project interface
          repoUrl: selectedProject.repoUrl || undefined,
          branch: selectedProject.branch,
          tokensUsed: selectedProject.tokensUsed,
          githubRepoId: selectedProject.githubRepoId || undefined,
          githubRepoName: selectedProject.githubRepoName || undefined,
          githubInstallationId: undefined, // Not included in Project interface
          githubPrivate: selectedProject.githubPrivate
        } : undefined}
      />
    </DashboardLayout>
  );
} 