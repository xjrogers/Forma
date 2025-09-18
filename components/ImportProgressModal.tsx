'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, Github, Zap, FileText, Brain, Shield, Database } from 'lucide-react';

interface ImportProgressStep {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message: string;
  details?: string;
  progress?: number;
  icon: React.ComponentType<{ className?: string }>;
}

interface ImportProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  jobId?: string;
}

export default function ImportProgressModal({ isOpen, onClose, projectName, jobId }: ImportProgressModalProps) {
  const [steps, setSteps] = useState<ImportProgressStep[]>([
    {
      id: 'queue',
      name: 'Queuing Import',
      status: 'completed',
      message: 'Project added to import queue',
      icon: Github
    },
    {
      id: 'fetch',
      name: 'Repository Fetch',
      status: 'processing',
      message: 'Downloading repository contents...',
      progress: 45,
      icon: FileText
    },
    {
      id: 'security',
      name: 'Security Scan',
      status: 'pending',
      message: 'Scanning for security issues',
      icon: Shield
    },
    {
      id: 'analysis',
      name: 'AI Analysis',
      status: 'pending',
      message: 'Analyzing project structure and business logic',
      icon: Brain
    },
    {
      id: 'optimization',
      name: 'AI Optimization',
      status: 'pending',
      message: 'Creating embeddings and knowledge graph',
      icon: Zap
    },
    {
      id: 'finalization',
      name: 'Finalization',
      status: 'pending',
      message: 'Saving project and updating metadata',
      icon: Database
    }
  ]);

  const [overallProgress, setOverallProgress] = useState(15);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState('2-3 minutes');

  // Simulate progress updates (in real implementation, this would come from the backend)
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setSteps(prevSteps => {
        const newSteps = [...prevSteps];
        const processingIndex = newSteps.findIndex(step => step.status === 'processing');
        
        if (processingIndex !== -1) {
          const currentStep = newSteps[processingIndex];
          if (currentStep.progress !== undefined && currentStep.progress < 100) {
            currentStep.progress = Math.min(currentStep.progress + Math.random() * 10, 100);
            
            if (currentStep.progress >= 100) {
              currentStep.status = 'completed';
              currentStep.message = `${currentStep.name} completed successfully`;
              
              // Start next step
              if (processingIndex + 1 < newSteps.length) {
                newSteps[processingIndex + 1].status = 'processing';
                newSteps[processingIndex + 1].progress = 0;
              }
            }
          }
        }
        
        return newSteps;
      });

      setOverallProgress(prev => Math.min(prev + Math.random() * 5, 95));
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const totalSteps = steps.length;
  const progressPercentage = (completedSteps / totalSteps) * 100;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-popover border border-border rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <Github className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold text-foreground">Importing Project</h2>
              <p className="text-sm text-muted-foreground">{projectName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Monitor Display */}
          <div className="flex flex-col items-center mb-8">
            {/* Monitor Container */}
            <div className="relative">
              {/* Monitor Screen */}
              <div className="w-96 h-64 bg-gradient-to-b from-secondary to-secondary/80 rounded-lg shadow-lg relative border-2 border-border/50">
                {/* Screen bezel */}
                <div className="absolute inset-2 bg-background rounded-lg overflow-hidden border border-border/30">
                  {/* Import progress interface */}
                  <div className="h-full bg-gradient-to-b from-background to-secondary/20 p-4 flex flex-col justify-center">
                    <div className="text-center space-y-4">
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Importing project...</span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-full h-2 bg-secondary/50 rounded-full overflow-hidden border border-border/20">
                        <div 
                          className="h-full rounded-full relative overflow-hidden transition-all duration-1000" 
                          style={{ 
                            width: `${progressPercentage}%`, 
                            background: 'linear-gradient(135deg, #2E2A5D 0%, #5A3F9E 25%, #2D8EFF 75%, #00D2C6 100%)' 
                          }}
                        >
                          {progressPercentage > 0 && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                          )}
                        </div>
                      </div>
                      
                      {/* Progress text */}
                      <div className="text-xs text-muted-foreground">
                        <div>{completedSteps} of {totalSteps} steps completed</div>
                        <div>Estimated time remaining: {estimatedTimeRemaining}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Screen reflection */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-lg pointer-events-none"></div>
              </div>
            </div>
          </div>

          {/* Detailed Progress Steps */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-foreground mb-4">Import Progress</h3>
            
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.id} className="flex items-start space-x-3 p-4 bg-secondary/20 rounded-lg border border-border/30">
                  <div className="mt-0.5">
                    {step.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                    {step.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                    {step.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                    {step.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />}
                  </div>
                  
                  <Icon className="w-5 h-5 text-muted-foreground mt-0.5" />
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-foreground">{step.name}</p>
                      {step.status === 'processing' && step.progress !== undefined && (
                        <span className="text-xs text-muted-foreground">{Math.round(step.progress)}%</span>
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground">{step.message}</p>
                    
                    {step.details && (
                      <p className="text-xs text-muted-foreground/70 mt-1">{step.details}</p>
                    )}
                    
                    {/* Individual step progress bar */}
                    {step.status === 'processing' && step.progress !== undefined && (
                      <div className="mt-2 w-full h-1 bg-secondary/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${step.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Token Usage Info */}
          <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Token Usage</span>
            </div>
            <div className="text-xs text-muted-foreground">
              <div>Estimated tokens: 25,000 - 45,000</div>
              <div>Tokens will be deducted as each step completes</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <div className="text-xs text-muted-foreground">
              You can safely close this window. Import will continue in the background.
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-secondary hover:bg-secondary/80 text-foreground rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 