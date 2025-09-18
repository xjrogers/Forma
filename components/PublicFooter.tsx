'use client'

import Link from 'next/link'

interface PublicFooterProps {
  showTopBorder?: boolean
  topMargin?: 'small' | 'large'
  verticalPadding?: 'none' | 'normal'
}

export default function PublicFooter({ 
  showTopBorder = false,
  topMargin = 'small',
  verticalPadding = 'none'
}: PublicFooterProps) {
  
  const footerClasses = [
    'border-border/10',
    showTopBorder ? 'border-t' : '',
    topMargin === 'large' ? 'mt-32' : 'mt-16'
  ].filter(Boolean).join(' ')

  const containerClasses = [
    'max-w-7xl mx-auto px-6 lg:px-8',
    verticalPadding === 'normal' ? 'py-12' : 'py-0'
  ].filter(Boolean).join(' ')

  return (
    <footer className={footerClasses}>
      <div className={containerClasses}>
        <div className="flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
          {/* Brand */}
          <div className="flex items-center">
            <img src="/logo-main.png" alt="DevAssistant.io" className="h-32 w-auto" />
          </div>

          {/* Links */}
          <div className="flex items-center space-x-8">
            <Link href="/pricing" className="app-link text-sm">Pricing</Link>
            <Link href="/privacy" className="app-link text-sm">Privacy</Link>
            <Link href="/terms" className="app-link text-sm">Terms</Link>
            <Link href="/contact" className="app-link text-sm">Contact</Link>
          </div>

          {/* Copyright */}
          <div className="text-muted-foreground text-sm">
            © 2025 DevAssistant.io
          </div>
        </div>
      </div>
    </footer>
  )
} 