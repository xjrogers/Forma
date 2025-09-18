'use client'

import Link from 'next/link'
import { useState } from 'react'

interface PublicNavigationProps {
  showHome?: boolean
  showChangelog?: boolean
  showContact?: boolean
}

export default function PublicNavigation({ 
  showHome = false,
  showChangelog = true, 
  showContact = false 
}: PublicNavigationProps) {
  const [showDocsTooltip, setShowDocsTooltip] = useState(false)
  const [showChangelogTooltip, setShowChangelogTooltip] = useState(false)

  const handleSignInClick = () => {
    window.location.href = '/login'
  }

  return (
    <nav className="fixed top-0 left-0 right-0 border-b border-border/5 bg-background/5 backdrop-blur-sm z-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <img src="/logo-main.png" alt="DevAssistant.io" className="h-40 w-auto" />
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            {showHome && (
              <Link href="/" className="app-link text-sm font-medium">
                Home
              </Link>
            )}
            <Link href="/pricing" className="app-link text-sm font-medium">
              Pricing
            </Link>
            
            {/* Docs with Coming Soon overlay */}
            <div 
              className="relative"
              onMouseEnter={() => setShowDocsTooltip(true)}
              onMouseLeave={() => setShowDocsTooltip(false)}
            >
              <button 
                className="app-link text-sm font-medium cursor-not-allowed opacity-60"
                disabled
              >
                Docs
              </button>
              {showDocsTooltip && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-card/95 backdrop-blur-xl border border-border/20 rounded-lg shadow-xl z-50 whitespace-nowrap">
                  <div className="text-xs text-foreground font-medium">Coming Soon</div>
                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-card/95 border-l border-t border-border/20 rotate-45"></div>
                </div>
              )}
            </div>

            {showChangelog && (
              <div 
                className="relative"
                onMouseEnter={() => setShowChangelogTooltip(true)}
                onMouseLeave={() => setShowChangelogTooltip(false)}
              >
                <button 
                  className="app-link text-sm font-medium cursor-not-allowed opacity-60"
                  disabled
                >
                  Changelog
                </button>
                {showChangelogTooltip && (
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-card/95 backdrop-blur-xl border border-border/20 rounded-lg shadow-xl z-50 whitespace-nowrap">
                    <div className="text-xs text-foreground font-medium">Coming Soon</div>
                    <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-card/95 border-l border-t border-border/20 rotate-45"></div>
                  </div>
                )}
              </div>
            )}

            {showContact && (
              <Link href="/contact" className="app-link text-sm font-medium">
                Contact
              </Link>
            )}
            
            <button 
              onClick={handleSignInClick}
              className="button-luxury"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
} 