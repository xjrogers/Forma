'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info } from 'lucide-react';
import { toast } from 'sonner';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'secret'>('private');
  const [showTooltip, setShowTooltip] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          isPrivate: visibility === 'private' || visibility === 'secret'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'GITHUB_NOT_CONNECTED') {
          toast.error('Please connect your GitHub account first', {
            action: {
              label: 'Connect GitHub',
              onClick: () => window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/github`
            }
          });
          return;
        }
        if (data.code === 'GITHUB_AUTH_FAILED') {
          toast.error('GitHub authentication expired', {
            action: {
              label: 'Reconnect',
              onClick: () => window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/github`
            }
          });
          return;
        }
        throw new Error(data.error || 'Failed to create project');
      }

      toast.success('Project created successfully');
      onSuccess();
      onClose();
      setName('');
      setDescription('');
      setVisibility('private');
      
      // Redirect to builder with the new project
      router.push(`/dashboard/builder?projectId=${data.project.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div 
        className="w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          backgroundColor: 'rgba(30, 30, 30, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-center p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-foreground">Create Project</h2>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Project Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
                className="w-full px-6 py-4 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter project description (optional)"
                className="w-full px-6 py-4 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm"
                disabled={loading}
              />
            </div>

            <div className="space-y-2 mb-6">
              <label className="text-sm font-medium text-foreground">
                Project Visibility
              </label>
              <div className="relative">
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as 'public' | 'private' | 'secret')}
                  disabled={loading}
                  className="w-full px-4 py-3 text-base transition-all duration-300 text-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm appearance-none cursor-pointer"
                  style={{
                    backgroundImage: 'none'
                  }}
                >
                  <option value="public" className="bg-gray-800 text-white">Public - Everyone can access</option>
                  <option value="private" className="bg-gray-800 text-white">Private - Only with URL can access</option>
                  <option value="secret" className="bg-gray-800 text-white">Secret - Only owner/staff can access</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <button
                    type="button"
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  {showTooltip && (
                    <div className="absolute bottom-full right-0 mb-2 w-64 p-2 text-xs text-foreground bg-background/95 border border-border/20 rounded-lg shadow-lg backdrop-blur-sm">
                      Choose who can access your project. Public projects are visible to everyone, private projects require the URL, and secret projects are only accessible to you and staff.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-foreground hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 overflow-hidden flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  transform: 'translateY(0)'
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
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
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(0)';
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
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 