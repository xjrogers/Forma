'use client';

import { useState } from 'react';

import { toast } from 'sonner';

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  projectName: string;
}

export default function DeleteProjectModal({ isOpen, onClose, onConfirm, projectName }: DeleteProjectModalProps) {
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (confirmText !== projectName) {
      toast.error('Project name does not match');
      return;
    }

    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error deleting project:', error);
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
          <h2 className="text-lg font-semibold text-foreground">Delete {projectName}?</h2>
        </div>

        {/* Content */}
        <div className="p-6">

          <p className="text-muted-foreground mb-4">
            This action cannot be undone. This will permanently delete the project and all of its data.
          </p>
          
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={`Type "${projectName}" to confirm`}
            className="w-full px-4 py-3 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm mb-6"
            disabled={loading}
          />

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-foreground hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || confirmText !== projectName}
              className="relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 overflow-hidden flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                transform: 'translateY(0)'
              }}
              onMouseEnter={(e) => {
                if (!loading && confirmText === projectName) {
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
                if (!loading && confirmText === projectName) {
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
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-t-transparent border-red-400 rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Project'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 