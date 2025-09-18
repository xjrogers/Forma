'use client';

import { useState, useEffect } from 'react';
import { X, Github, Search, Loader2, CheckCircle, AlertCircle, Info, Brain, Zap, FileText, GitBranch, Star, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import GitHubRepoDialog from './GitHubRepoDialog';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  private: boolean;
  html_url: string;
  clone_url?: string;
  default_branch?: string;
  language?: string | null;
  stargazers_count?: number;
  size?: number;
  updated_at?: string;
  topics?: string[];
}

interface ImportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportProgress {
  step: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message: string;
  details?: string;
}

export default function ImportProjectModal({ isOpen, onClose, onSuccess }: ImportProjectModalProps) {
  const [step, setStep] = useState<'select' | 'configure' | 'importing'>('select');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress[]>([]);
  const [showRepoDialog, setShowRepoDialog] = useState(false);
  
  // Import configuration
  const [config, setConfig] = useState({
    projectName: '',
    description: '',
    enableAIAnalysis: true,
    analyzeArchitecture: true,
    extractBusinessLogic: true,
    buildKnowledgeGraph: true,
    generateDocumentation: false,
    scanSecurity: true,
    optimizeForAI: true
  });

  // Token estimation state
  const [tokenEstimate, setTokenEstimate] = useState<any>(null);
  const [estimating, setEstimating] = useState(false);

  useEffect(() => {
    if (isOpen && step === 'select') {
      setShowRepoDialog(true);
    }
  }, [isOpen, step]);

  // Re-estimate tokens when config changes
  useEffect(() => {
    if (selectedRepo && step === 'configure') {
      const timeoutId = setTimeout(() => {
        estimateTokens(selectedRepo, config);
      }, 500); // Debounce to avoid too many requests

      return () => clearTimeout(timeoutId);
    }
  }, [config, selectedRepo, step]);

  const handleRepoSelect = (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setConfig(prev => ({
      ...prev,
      projectName: repo.name,
      description: repo.description || `Imported from ${repo.full_name}`
    }));
    setShowRepoDialog(false);
    setStep('configure');
    // Estimate tokens for this repository
    estimateTokens(repo, config);
  };

  const estimateTokens = async (repository: GitHubRepo, importConfig: typeof config) => {
    if (!repository) return;

    setEstimating(true);
    try {
      const response = await fetch('/api/projects/import/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository,
          config: importConfig
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTokenEstimate(data);
      } else {
        console.error('Failed to estimate tokens');
        setTokenEstimate(null);
      }
    } catch (error) {
      console.error('Error estimating tokens:', error);
      setTokenEstimate(null);
    } finally {
      setEstimating(false);
    }
  };

  const handleImport = async () => {
    if (!selectedRepo) return;

    setImporting(true);
    setStep('importing');
    setProgress([
      { step: 'Queuing Import', status: 'processing', message: 'Adding project to import queue...' }
    ]);

    try {
      const response = await fetch('/api/projects/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository: selectedRepo,
          config: config
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to queue import');
      }

      const data = await response.json();

      if (data.success) {
        setProgress([
          { step: 'Queuing Import', status: 'completed', message: 'Project queued for import' },
          { step: 'Processing', status: 'processing', message: 'Import is being processed in the background...' }
        ]);

        // Show success message and close modal
        setTimeout(() => {
          toast.success('Project import queued! 🎉', {
            description: `${selectedRepo.name} is being imported. You'll be notified when it's complete.`,
          });
          onSuccess();
          onClose();
        }, 2000);
      } else {
        throw new Error('Import queue failed');
      }

    } catch (error) {
      console.error('Error importing project:', error);
      
      if (error instanceof Error && error.message.includes('Insufficient tokens')) {
        toast.error('Insufficient tokens for import', {
          description: error.message,
        });
      } else {
        toast.error('Failed to import project', {
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
      
      setProgress(prev => prev.map(p => ({ ...p, status: 'error' as const })));
    } finally {
      setImporting(false);
    }
  };

  const resetModal = () => {
    setStep('select');
    setSelectedRepo(null);
    setShowRepoDialog(false);
    setProgress([]);
    setImporting(false);
    setConfig({
      projectName: '',
      description: '',
      enableAIAnalysis: true,
      analyzeArchitecture: true,
      extractBusinessLogic: true,
      buildKnowledgeGraph: true,
      generateDocumentation: false,
      scanSecurity: true,
      optimizeForAI: true
    });
  };

  const handleClose = () => {
    if (!importing) {
      resetModal();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-popover border border-border rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <Github className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold text-foreground">Import from GitHub</h2>
              <p className="text-sm text-muted-foreground">
                {step === 'select' && 'Select a repository to import'}
                {step === 'configure' && 'Configure import settings'}
                {step === 'importing' && 'Importing and analyzing project'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={importing}
            className="p-2 hover:bg-secondary/50 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Step 1: Repository Selection - Now handled by GitHubRepoDialog */}

          {/* Step 2: Configuration */}
          {step === 'configure' && selectedRepo && (
            <div className="p-6 space-y-6">
              {/* Project Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-foreground flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Project Details</span>
                </h3>
                
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={config.projectName}
                      onChange={(e) => setConfig(prev => ({ ...prev, projectName: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Description
                    </label>
                    <textarea
                      value={config.description}
                      onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>
              </div>

              {/* AI Analysis Options */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-foreground flex items-center space-x-2">
                  <Brain className="w-5 h-5" />
                  <span>AI Analysis & Indexing</span>
                </h3>
                
                <div className="bg-secondary/20 border border-border rounded-lg p-4">
                  <div className="flex items-start space-x-3 mb-4">
                    <Info className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm text-foreground font-medium">Advanced AI Understanding</p>
                      <p className="text-xs text-muted-foreground">
                        Enable comprehensive analysis to give AI deep understanding of your codebase for better assistance.
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={config.enableAIAnalysis}
                        onChange={(e) => setConfig(prev => ({ ...prev, enableAIAnalysis: e.target.checked }))}
                        className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary/50"
                      />
                      <div>
                        <span className="text-sm font-medium text-foreground">Enable AI Analysis</span>
                        <p className="text-xs text-muted-foreground">Perform comprehensive code analysis for AI understanding</p>
                      </div>
                    </label>

                    {config.enableAIAnalysis && (
                      <div className="ml-7 space-y-3 border-l-2 border-border pl-4">
                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={config.analyzeArchitecture}
                            onChange={(e) => setConfig(prev => ({ ...prev, analyzeArchitecture: e.target.checked }))}
                            className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary/50"
                          />
                          <div>
                            <span className="text-sm text-foreground">Architecture Analysis</span>
                            <p className="text-xs text-muted-foreground">Understand project structure, patterns, and dependencies</p>
                          </div>
                        </label>

                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={config.extractBusinessLogic}
                            onChange={(e) => setConfig(prev => ({ ...prev, extractBusinessLogic: e.target.checked }))}
                            className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary/50"
                          />
                          <div>
                            <span className="text-sm text-foreground">Business Logic Extraction</span>
                            <p className="text-xs text-muted-foreground">Identify core functionality and business rules</p>
                          </div>
                        </label>

                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={config.buildKnowledgeGraph}
                            onChange={(e) => setConfig(prev => ({ ...prev, buildKnowledgeGraph: e.target.checked }))}
                            className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary/50"
                          />
                          <div>
                            <span className="text-sm text-foreground">Knowledge Graph</span>
                            <p className="text-xs text-muted-foreground">Build relationships between components and functions</p>
                          </div>
                        </label>

                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={config.scanSecurity}
                            onChange={(e) => setConfig(prev => ({ ...prev, scanSecurity: e.target.checked }))}
                            className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary/50"
                          />
                          <div>
                            <span className="text-sm text-foreground">Security Scanning</span>
                            <p className="text-xs text-muted-foreground">Scan for potential security issues and vulnerabilities</p>
                          </div>
                        </label>

                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={config.optimizeForAI}
                            onChange={(e) => setConfig(prev => ({ ...prev, optimizeForAI: e.target.checked }))}
                            className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary/50"
                          />
                          <div>
                            <span className="text-sm text-foreground">AI Optimization</span>
                            <p className="text-xs text-muted-foreground">Create embeddings and indexes for faster AI responses</p>
                          </div>
                        </label>

                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={config.generateDocumentation}
                            onChange={(e) => setConfig(prev => ({ ...prev, generateDocumentation: e.target.checked }))}
                            className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary/50"
                          />
                          <div>
                            <span className="text-sm text-foreground">Auto-Generate Documentation</span>
                            <p className="text-xs text-muted-foreground">Create comprehensive project documentation</p>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Token Estimation */}
              {tokenEstimate && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground flex items-center space-x-2">
                    <Zap className="w-5 h-5" />
                    <span>Token Estimation</span>
                  </h3>
                  
                  <div className="bg-secondary/20 border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-foreground">Total Tokens Required</span>
                      <span className={`text-lg font-bold ${
                        tokenEstimate.userBalance?.canAfford ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {tokenEstimate.estimate.totalTokens.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Base Processing:</span>
                        <span>{tokenEstimate.estimate.baseTokens.toLocaleString()}</span>
                      </div>
                      {tokenEstimate.estimate.breakdown.architectureAnalysis > 0 && (
                        <div className="flex justify-between">
                          <span>Architecture Analysis:</span>
                          <span>{tokenEstimate.estimate.breakdown.architectureAnalysis.toLocaleString()}</span>
                        </div>
                      )}
                      {tokenEstimate.estimate.breakdown.businessLogicExtraction > 0 && (
                        <div className="flex justify-between">
                          <span>Business Logic:</span>
                          <span>{tokenEstimate.estimate.breakdown.businessLogicExtraction.toLocaleString()}</span>
                        </div>
                      )}
                      {tokenEstimate.estimate.breakdown.knowledgeGraph > 0 && (
                        <div className="flex justify-between">
                          <span>Knowledge Graph:</span>
                          <span>{tokenEstimate.estimate.breakdown.knowledgeGraph.toLocaleString()}</span>
                        </div>
                      )}
                      {tokenEstimate.estimate.breakdown.aiOptimization > 0 && (
                        <div className="flex justify-between">
                          <span>AI Optimization:</span>
                          <span>{tokenEstimate.estimate.breakdown.aiOptimization.toLocaleString()}</span>
                        </div>
                      )}
                      {tokenEstimate.estimate.breakdown.documentation > 0 && (
                        <div className="flex justify-between">
                          <span>Documentation:</span>
                          <span>{tokenEstimate.estimate.breakdown.documentation.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <div className="flex justify-between text-sm">
                        <span>Your Balance:</span>
                        <span className={tokenEstimate.userBalance?.canAfford ? 'text-green-500' : 'text-red-500'}>
                          {tokenEstimate.userBalance?.remainingTokens.toLocaleString()} tokens
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Estimated Cost:</span>
                        <span>${tokenEstimate.estimate.estimatedCost.toFixed(4)}</span>
                      </div>
                    </div>

                    {!tokenEstimate.userBalance?.canAfford && (
                      <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-start space-x-2">
                          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-red-500">Insufficient Tokens</p>
                            <p className="text-xs text-red-400">
                              You need {(tokenEstimate.estimate.totalTokens - tokenEstimate.userBalance.remainingTokens).toLocaleString()} more tokens to import this project.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {estimating && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
                  <span className="text-sm text-muted-foreground">Estimating tokens...</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <button
                  onClick={() => {
                    setStep('select');
                    setShowRepoDialog(true);
                  }}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={!config.projectName.trim() || !tokenEstimate?.userBalance?.canAfford || estimating}
                  className="button-luxury px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!tokenEstimate?.userBalance?.canAfford ? 'Insufficient Tokens' : 'Import Project'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Import Progress */}
          {step === 'importing' && (
            <div className="p-6">
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                  <h3 className="text-lg font-medium text-foreground">Importing {selectedRepo?.name}</h3>
                  <p className="text-sm text-muted-foreground">This may take a few minutes...</p>
                </div>

                <div className="space-y-3">
                  {progress.map((item, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-secondary/20 rounded-lg">
                      <div className="mt-0.5">
                        {item.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                        {item.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                        {item.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                        {item.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{item.step}</p>
                        <p className="text-xs text-muted-foreground">{item.message}</p>
                        {item.details && (
                          <p className="text-xs text-muted-foreground/70 mt-1">{item.details}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* GitHub Repository Selection Dialog */}
      <GitHubRepoDialog
        isOpen={showRepoDialog}
        onClose={() => {
          setShowRepoDialog(false);
          if (step === 'select') {
            onClose(); // Close the import modal if user cancels repo selection
          }
        }}
        onSuccess={(repo) => handleRepoSelect(repo as any)}
        mode="import"
        title="Select Repository to Import"
      />
    </div>
  );
} 