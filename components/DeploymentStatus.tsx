'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, Loader2, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react'
import { toast } from 'sonner'

interface DeploymentStatusProps {
  projectId: string
  onStatusChange?: (status: string) => void
}

interface DeploymentData {
  projectId: string
  isDeployed: boolean
  status: string
  url?: string
  subdomain?: string
  lastDeployedAt?: string
  latestDeployment?: {
    id: string
    status: string
    buildTime?: number
    createdAt: string
    errorMessage?: string
  }
}

export default function DeploymentStatus({ projectId, onStatusChange }: DeploymentStatusProps) {
  const [deployment, setDeployment] = useState<DeploymentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [undeploying, setUndeploying] = useState(false)

  // Fetch deployment status
  const fetchDeploymentStatus = async () => {
    try {
      const response = await fetch(`/api/deployments/status/${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setDeployment(data)
        onStatusChange?.(data.status)
      }
    } catch (error) {
      console.error('Failed to fetch deployment status:', error)
    } finally {
      setLoading(false)
    }
  }

  // Undeploy project
  const handleUndeploy = async () => {
    if (!deployment?.isDeployed) return

    const confirmed = window.confirm(
      'Are you sure you want to undeploy this project? This will stop your live application and cannot be undone.'
    )

    if (!confirmed) return

    setUndeploying(true)
    try {
      const response = await fetch(`/api/deployments/${projectId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Project undeployed successfully')
        fetchDeploymentStatus() // Refresh status
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Failed to undeploy')
      }
    } catch (error) {
      console.error('Undeploy error:', error)
      toast.error('Failed to undeploy project')
    } finally {
      setUndeploying(false)
    }
  }

  // Get deployment logs
  const handleViewLogs = async () => {
    try {
      const response = await fetch(`/api/deployments/logs/${projectId}`)
      if (response.ok) {
        const data = await response.json()
        
        // Open logs in a new window or modal
        const logsWindow = window.open('', '_blank', 'width=800,height=600')
        if (logsWindow) {
          logsWindow.document.write(`
            <html>
              <head><title>Deployment Logs - ${projectId}</title></head>
              <body style="font-family: monospace; padding: 20px; background: #1a1a1a; color: #fff;">
                <h2>Deployment Logs</h2>
                <pre style="white-space: pre-wrap; background: #000; padding: 15px; border-radius: 5px;">
                  ${data.logs.join('\n')}
                </pre>
              </body>
            </html>
          `)
        }
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
      toast.error('Failed to fetch deployment logs')
    }
  }

  useEffect(() => {
    fetchDeploymentStatus()
    
    // Poll for status updates if building
    const interval = setInterval(() => {
      if (deployment?.status === 'building') {
        fetchDeploymentStatus()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [projectId, deployment?.status])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading deployment status...
      </div>
    )
  }

  if (!deployment) {
    return (
      <div className="text-sm text-muted-foreground">
        No deployment information available
      </div>
    )
  }

  const getStatusIcon = () => {
    switch (deployment.status) {
      case 'deployed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'building':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusText = () => {
    switch (deployment.status) {
      case 'deployed':
        return 'Live'
      case 'building':
        return 'Building...'
      case 'failed':
        return 'Failed'
      case 'not_deployed':
        return 'Not deployed'
      default:
        return deployment.status
    }
  }

  const getStatusColor = () => {
    switch (deployment.status) {
      case 'deployed':
        return 'text-green-500'
      case 'building':
        return 'text-blue-500'
      case 'failed':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <div className="space-y-3">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        
        {deployment.isDeployed && deployment.url && (
          <a
            href={deployment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Visit App
          </a>
        )}
      </div>

      {/* Deployment URL */}
      {deployment.url && (
        <div className="text-xs text-muted-foreground">
          <span className="font-mono bg-gray-800 px-2 py-1 rounded">
            {deployment.url}
          </span>
        </div>
      )}

      {/* Build Information */}
      {deployment.latestDeployment && (
        <div className="text-xs text-muted-foreground space-y-1">
          {deployment.latestDeployment.buildTime && (
            <div>Build time: {deployment.latestDeployment.buildTime}s</div>
          )}
          <div>
            Last deployed: {new Date(deployment.latestDeployment.createdAt).toLocaleString()}
          </div>
          {deployment.latestDeployment.errorMessage && (
            <div className="text-red-400">
              Error: {deployment.latestDeployment.errorMessage}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {deployment.isDeployed && (
          <>
            <button
              onClick={handleViewLogs}
              className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              View Logs
            </button>
            <button
              onClick={handleUndeploy}
              disabled={undeploying}
              className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded transition-colors flex items-center gap-1"
            >
              {undeploying ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Undeploying...
                </>
              ) : (
                'Undeploy'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
} 