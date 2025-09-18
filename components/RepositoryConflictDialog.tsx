'use client';

import { useState } from 'react';
import { Github, AlertCircle, Plus, Link } from 'lucide-react';
import { toast } from 'sonner';

interface RepositoryConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  suggestedName: string;
  onCreateWithName: (name: string) => Promise<void>;
  onConnectExisting: () => void;
}

export default function RepositoryConflictDialog({
  isOpen,
  onClose,
  projectName,
  suggestedName,
  onCreateWithName,
  onConnectExisting
}: RepositoryConflictDialogProps) {
  const [customName, setCustomName] = useState(suggestedName);
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleCreateWithSuggested = async () => {
    setIsCreating(true);
    try {
      await onCreateWithName(suggestedName);
      onClose();
    } catch (error) {
      toast.error('Failed to create repository');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateWithCustom = async () => {
    if (!customName.trim()) {
      toast.error('Repository name is required');
      return;
    }
    
    setIsCreating(true);
    try {
      await onCreateWithName(customName.trim());
      onClose();
    } catch (error) {
      toast.error('Failed to create repository');
    } finally {
      setIsCreating(false);
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.2)'
            }}>
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Repository Name Conflict</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-muted-foreground mb-6">
            A repository named <span className="font-medium text-foreground">"{projectName}"</span> already exists in your GitHub account. 
            Choose how you'd like to proceed:
          </p>
          
          <div className="space-y-4">
            {/* Option 1: Create with suggested name */}
            <div className="p-4 rounded-lg border border-white/10 bg-white/5">
              <div className="flex items-start gap-3">
                <Plus className="w-5 h-5 text-green-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-foreground mb-1">Create as "{suggestedName}"</h3>
                  <p className="text-sm text-muted-foreground mb-3">Recommended - Creates a new repository with an adjusted name</p>
                  <button
                    onClick={handleCreateWithSuggested}
                    disabled={isCreating}
                    className="relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 overflow-hidden flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(34, 197, 94, 0.2)',
                      color: '#22c55e',
                      transform: 'translateY(0)'
                    }}
                    onMouseEnter={(e) => {
                      if (!isCreating) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isCreating) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.2)';
                      }
                    }}
                  >
                    {isCreating ? 'Creating...' : 'Create Repository'}
                  </button>
                </div>
              </div>
            </div>

            {/* Option 2: Connect to existing */}
            <div className="p-4 rounded-lg border border-white/10 bg-white/5">
              <div className="flex items-start gap-3">
                <Link className="w-5 h-5 text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-foreground mb-1">Connect to existing "{projectName}"</h3>
                  <p className="text-sm text-muted-foreground mb-3">Use the existing repository if it's the right one</p>
                  <button
                    onClick={onConnectExisting}
                    disabled={isCreating}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-blue-400 hover:bg-blue-600/10 border border-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Browse Repositories
                  </button>
                </div>
              </div>
            </div>

            {/* Option 3: Custom name */}
            <div className="p-4 rounded-lg border border-white/10 bg-white/5">
              <div className="flex items-start gap-3">
                <Github className="w-5 h-5 text-purple-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-foreground mb-1">Choose different name</h3>
                  <p className="text-sm text-muted-foreground mb-3">Create with a custom repository name</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm"
                      placeholder="my-awesome-project"
                    />
                    <button
                      onClick={handleCreateWithCustom}
                      disabled={isCreating || !customName.trim()}
                      className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-purple-400 hover:bg-purple-600/10 border border-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <button
              onClick={onClose}
              disabled={isCreating}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-foreground hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 