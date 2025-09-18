'use client';



interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  isLoading?: boolean;
}

export default function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Delete",
  isLoading = false
}: DeleteConfirmationDialogProps) {
  if (!isOpen) return null;

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
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-muted-foreground mb-6">{message}</p>
          
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-foreground hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 overflow-hidden flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                transform: 'translateY(0)'
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
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
                if (!isLoading) {
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
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-t-transparent border-red-400 rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 