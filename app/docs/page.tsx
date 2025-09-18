'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { 
  Search, 
  Copy, 
  ExternalLink, 
  BookOpen, 
  Code, 
  Zap, 
  Shield, 
  Download, 
  Settings, 
  Users, 
  BarChart3, 
  Globe, 
  Smartphone, 
  Layers, 
  Check,
  HelpCircle,
  MessageCircle,
  ChevronDown
} from 'lucide-react'

export default function DocsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [showSupportDropdown, setShowSupportDropdown] = useState(false)
  const supportDropdownRef = useRef<HTMLDivElement>(null)

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  // Close support dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (supportDropdownRef.current && !supportDropdownRef.current.contains(event.target as Node)) {
        setShowSupportDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const sidebarSections = [
    {
      title: 'Getting Started',
      icon: Layers,
      items: [
        { title: 'Quick Start', href: '#quick-start', active: true },
        { title: 'Installation', href: '#installation' },
        { title: 'Your First Project', href: '#first-project' },
        { title: 'Basic Concepts', href: '#concepts' },
        { title: 'Project Structure', href: '#project-structure' },
        { title: 'Configuration', href: '#configuration' }
      ]
    },
    {
      title: 'Building Apps',
      icon: Code,
      items: [
        { title: 'AI Builder', href: '#ai-builder' },
        { title: 'Components', href: '#components' },
        { title: 'Styling', href: '#styling' },
        { title: 'State Management', href: '#state' },
        { title: 'Data Fetching', href: '#data-fetching' },
        { title: 'Forms & Validation', href: '#forms' },
        { title: 'Routing', href: '#routing' },
        { title: 'Authentication', href: '#auth' }
      ]
    },
    {
      title: 'Deployment',
      icon: Globe,
      items: [
        { title: 'Deploy to Production', href: '#deploy' },
        { title: 'Custom Domains', href: '#domains' },
        { title: 'Environment Variables', href: '#env-vars' },
        { title: 'CI/CD Integration', href: '#cicd' },
        { title: 'SSL Certificates', href: '#ssl' },
        { title: 'Database Setup', href: '#database' },
        { title: 'Monitoring', href: '#monitoring' },
        { title: 'Scaling', href: '#scaling' }
      ]
    },
    {
      title: 'API Reference',
      icon: BarChart3,
      items: [
        { title: 'REST API', href: '#rest-api' },
        { title: 'Webhooks', href: '#webhooks' },
        { title: 'SDKs', href: '#sdks' },
        { title: 'Rate Limits', href: '#rate-limits' },
        { title: 'Authentication', href: '#api-auth' },
        { title: 'Error Codes', href: '#error-codes' },
        { title: 'Pagination', href: '#pagination' },
        { title: 'Filtering', href: '#filtering' }
      ]
    },
    {
      title: 'Account & Billing',
      icon: Settings,
      items: [
        { title: 'Subscription Plans', href: '#plans' },
        { title: 'Usage & Limits', href: '#usage' },
        { title: 'Team Management', href: '#teams' },
        { title: 'Security', href: '#security' },
        { title: 'Payment Methods', href: '#payment-methods' },
        { title: 'Billing History', href: '#billing-history' },
        { title: 'Invoices', href: '#invoices' },
        { title: 'Refunds', href: '#refunds' }
      ]
    },
    {
      title: 'Integrations',
      icon: Zap,
      items: [
        { title: 'GitHub Integration', href: '#github' },
        { title: 'Stripe Integration', href: '#stripe' },
        { title: 'Third-party APIs', href: '#third-party' },
        { title: 'Custom Integrations', href: '#custom-integrations' },
        { title: 'Webhooks Setup', href: '#webhooks-setup' }
      ]
    },
    {
      title: 'Advanced',
      icon: Shield,
      items: [
        { title: 'Custom Components', href: '#custom-components' },
        { title: 'Plugin Development', href: '#plugins' },
        { title: 'Performance Optimization', href: '#performance' },
        { title: 'Security Best Practices', href: '#security-best' },
        { title: 'Troubleshooting', href: '#troubleshooting' },
        { title: 'Migration Guide', href: '#migration' }
      ]
    },
    {
      title: 'Support',
      icon: HelpCircle,
      items: [
        { title: 'FAQ', href: '#faq' },
        { title: 'Contact Support', href: '#contact' },
        { title: 'Community', href: '#community' },
        { title: 'Bug Reports', href: '#bug-reports' },
        { title: 'Feature Requests', href: '#feature-requests' },
        { title: 'Status Page', href: '#status' }
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/20 bg-background/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Navigation */}
            <div className="flex items-center space-x-8">
              <Link href="/" className="flex items-center text-xl font-semibold text-foreground hover:text-primary transition-colors">
                <img src="/logo-main.png" alt="DevAssistant.io" className="h-32 w-auto" />
              </Link>
              <Link 
                href="/"
                className="flex items-center gap-2 app-link text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Back to Home
              </Link>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-lg mx-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-secondary/30 border border-border/20 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all"
                />
              </div>
            </div>

            {/* CTA */}
            <div className="flex items-center space-x-4">
              <Link href="/pricing" className="app-link text-sm font-medium">
                Pricing
              </Link>
              <Link
                href="/login"
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12 flex gap-12 min-h-[calc(100vh-200px)]">
        {/* Sidebar */}
        <aside className="w-72 flex-shrink-0">
          <div className="sticky top-28 bg-card/30 border border-border/10 rounded-xl p-6 backdrop-blur-sm max-h-[calc(100vh-140px)] overflow-y-auto scrollbar-thin">
            <div className="pb-6">
              {sidebarSections.map((section) => (
                              <div key={section.title} className="mb-8">
                  <div className="flex items-center gap-3 mb-4 pb-2 border-b border-border/10">
                    <section.icon className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{section.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {section.items.map((item) => (
                      <li key={item.title}>
                        <a
                          href={item.href}
                          className={`block py-2 px-3 rounded-lg text-sm transition-all duration-200 ${
                            item.active 
                              ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary' 
                              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                          }`}
                        >
                          {item.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 max-w-none overflow-y-auto">
          <div className="prose prose-invert max-w-none pb-12">
            {/* Hero Section */}
            <div className="mb-16 text-center">
              <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 tracking-tight">
                Documentation
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
                Everything you need to build, deploy, and scale applications with Forma's AI-powered platform.
              </p>
            </div>

            {/* Quick Start Cards */}
            <div className="grid md:grid-cols-3 gap-8 mb-16 not-prose">
              <div className="bg-card/20 border border-border/10 rounded-2xl p-8 hover:border-primary/30 hover:bg-card/30 transition-all duration-300 group">
                <Zap className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Quick Start</h3>
                <p className="text-muted-foreground text-sm mb-4">Get up and running in minutes with our guided setup.</p>
                <a href="#quick-start" className="app-link text-sm font-medium">
                  Start Building →
                </a>
              </div>

              <div className="bg-card/20 border border-border/10 rounded-2xl p-8 hover:border-primary/30 hover:bg-card/30 transition-all duration-300 group">
                <Code className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-lg font-semibold text-foreground mb-2">API Reference</h3>
                <p className="text-muted-foreground text-sm mb-4">Comprehensive API documentation and examples.</p>
                <a href="#rest-api" className="app-link text-sm font-medium">
                  View API Docs →
                </a>
              </div>

              <div className="bg-card/20 border border-border/10 rounded-2xl p-8 hover:border-primary/30 hover:bg-card/30 transition-all duration-300 group">
                <Globe className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Deploy</h3>
                <p className="text-muted-foreground text-sm mb-4">Learn how to deploy your apps to production.</p>
                <a href="#deploy" className="app-link text-sm font-medium">
                  Deploy Now →
                </a>
              </div>
            </div>

            {/* Content Sections */}
            <section id="quick-start" className="mb-20">
              <div className="flex items-center gap-4 mb-8 pb-4 border-b border-border/20">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Layers className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-3xl font-bold text-foreground">Quick Start Guide</h2>
              </div>
              
              <div className="bg-card/10 border border-border/10 rounded-xl p-8 mb-8">
                <h3 className="text-xl font-semibold text-foreground mb-4">1. Create Your Account</h3>
                <p className="text-muted-foreground mb-4">
                  Sign up for a free Forma account to get started. You'll get access to our AI builder and can create your first project immediately.
                </p>
                <div className="bg-secondary/30 border border-border/20 rounded-lg p-6 mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-foreground flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                      <span className="ml-2">Terminal</span>
                    </span>
                    <button
                      onClick={() => handleCopyCode('npx create-forma-app my-app')}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      {copiedCode === 'npx create-forma-app my-app' ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  <code className="text-primary font-mono text-base">npx create-forma-app my-app</code>
                </div>
              </div>

              <div className="luxury-card p-6 mb-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">2. Use the AI Builder</h3>
                <p className="text-muted-foreground mb-4">
                  Describe your app idea in natural language and watch as our AI generates a complete, functional application for you.
                </p>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <p className="text-blue-300 text-sm">
                    💡 <strong>Pro Tip:</strong> Be specific about your requirements. The more detail you provide, the better your generated app will be.
                  </p>
                </div>
              </div>

              <div className="luxury-card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">3. Deploy to Production</h3>
                <p className="text-muted-foreground mb-4">
                  With one click, deploy your application to our global infrastructure. Get a live URL instantly and share your creation with the world.
                </p>
                <a href="#deploy" className="app-link-highlight">
                  Learn about deployment →
                </a>
              </div>
            </section>

            <section id="ai-builder" className="mb-12">
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                <Zap className="w-6 h-6 text-primary" />
                AI Builder
              </h2>
              
              <p className="text-muted-foreground mb-6">
                Our AI Builder is the heart of the Forma platform. It understands natural language descriptions and generates complete, production-ready applications.
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-6 not-prose">
                <div className="luxury-card p-6">
                  <h4 className="text-lg font-semibold text-foreground mb-3">Natural Language Processing</h4>
                  <p className="text-muted-foreground text-sm">
                    Describe your app in plain English. Our AI understands context, requirements, and user intent to generate exactly what you need.
                  </p>
                </div>
                <div className="luxury-card p-6">
                  <h4 className="text-lg font-semibold text-foreground mb-3">Smart Code Generation</h4>
                  <p className="text-muted-foreground text-sm">
                    Generate clean, maintainable code following best practices. Includes proper error handling, responsive design, and accessibility features.
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-foreground mb-3">Example Prompts</h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• "Create a task management app with user authentication and real-time updates"</li>
                  <li>• "Build an e-commerce store with product catalog, shopping cart, and payment processing"</li>
                  <li>• "Make a social media dashboard with analytics and content scheduling"</li>
                </ul>
              </div>
            </section>

            <section id="deploy" className="mb-12">
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                <Globe className="w-6 h-6 text-primary" />
                Deployment
              </h2>
              
              <p className="text-muted-foreground mb-6">
                Deploy your applications to production with enterprise-grade infrastructure, automatic scaling, and global CDN distribution.
              </p>

              <div className="space-y-6">
                <div className="luxury-card p-6">
                  <h4 className="text-lg font-semibold text-foreground mb-3">One-Click Deployment</h4>
                  <p className="text-muted-foreground mb-4">
                    Deploy directly from the builder with a single click. No complex configuration or DevOps knowledge required.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    Average deployment time: 30 seconds
                  </div>
                </div>

                <div className="luxury-card p-6">
                  <h4 className="text-lg font-semibold text-foreground mb-3">Custom Domains</h4>
                  <p className="text-muted-foreground mb-4">
                    Connect your own domain name with automatic SSL certificates and global CDN distribution.
                  </p>
                  <a href="#domains" className="app-link text-sm">
                    Learn about custom domains →
                  </a>
                </div>

                <div className="luxury-card p-6">
                  <h4 className="text-lg font-semibold text-foreground mb-3">Environment Variables</h4>
                  <p className="text-muted-foreground mb-4">
                    Securely manage API keys, database connections, and other sensitive configuration through our dashboard.
                  </p>
                  <a href="#env-vars" className="app-link text-sm">
                    Environment configuration →
                  </a>
                </div>
              </div>
            </section>

            {/* API Reference Preview */}
            <section id="rest-api" className="mb-12">
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-primary" />
                API Reference
              </h2>
              
              <p className="text-muted-foreground mb-6">
                Integrate with Forma programmatically using our REST API. Perfect for automation, custom integrations, and building on top of our platform.
              </p>

              <div className="luxury-card p-6 mb-6">
                <h4 className="text-lg font-semibold text-foreground mb-4">Authentication</h4>
                <p className="text-muted-foreground mb-4">
                  All API requests require authentication using API keys. Include your API key in the Authorization header.
                </p>
                <div className="bg-secondary/50 rounded-lg p-4 border border-border/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">cURL</span>
                    <button
                      onClick={() => handleCopyCode('curl -H "Authorization: Bearer YOUR_API_KEY" https://api.forma.dev/v1/projects')}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                      {copiedCode === 'curl -H "Authorization: Bearer YOUR_API_KEY" https://api.forma.dev/v1/projects' ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  <code className="text-primary font-mono text-sm block">
                    curl -H "Authorization: Bearer YOUR_API_KEY" \<br />
                    &nbsp;&nbsp;https://api.forma.dev/v1/projects
                  </code>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 not-prose">
                <div className="luxury-card p-6">
                  <h4 className="text-lg font-semibold text-foreground mb-3">Projects API</h4>
                  <p className="text-muted-foreground text-sm mb-4">
                    Create, update, and manage your projects programmatically.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-mono">GET</span>
                      <code className="text-muted-foreground">/v1/projects</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-mono">POST</span>
                      <code className="text-muted-foreground">/v1/projects</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-mono">PUT</span>
                      <code className="text-muted-foreground">/v1/projects/:id</code>
                    </div>
                  </div>
                </div>

                <div className="luxury-card p-6">
                  <h4 className="text-lg font-semibold text-foreground mb-3">Deployments API</h4>
                  <p className="text-muted-foreground text-sm mb-4">
                    Trigger deployments and monitor deployment status.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-mono">GET</span>
                      <code className="text-muted-foreground">/v1/deployments</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-mono">POST</span>
                      <code className="text-muted-foreground">/v1/deploy</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-mono">DELETE</span>
                      <code className="text-muted-foreground">/v1/deployments/:id</code>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Support Section */}
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                <Users className="w-6 h-6 text-primary" />
                Need Help?
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6 not-prose">
                <div className="luxury-card p-6">
                  <h4 className="text-lg font-semibold text-foreground mb-3">Community Support</h4>
                  <p className="text-muted-foreground text-sm mb-4">
                    Get help from our documentation, tutorials, and support team.
                  </p>
                </div>

                <div className="luxury-card p-6">
                  <h4 className="text-lg font-semibold text-foreground mb-3">Premium Support</h4>
                  <p className="text-muted-foreground text-sm mb-4">
                    Get priority support, dedicated assistance, and direct access to our engineering team.
                  </p>
                  <a href="/pricing" className="app-link text-sm font-medium">
                    Upgrade to Business →
                  </a>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/20 bg-card/5 mt-24">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row items-center justify-between">
            {/* Logo & Copyright */}
            <div className="flex flex-col items-center md:items-start mb-8 md:mb-0">
              <div className="mb-3">
                <img src="/logo-main.png" alt="DevAssistant.io" className="h-32 w-auto" />
              </div>
              <div className="text-muted-foreground">
                © 2025 DevAssistant.io. All rights reserved.
              </div>
            </div>

            {/* Links */}
            <div className="flex items-center space-x-8">
              <Link href="/pricing" className="app-link text-sm">Pricing</Link>
              <Link href="/privacy" className="app-link text-sm">Privacy</Link>
              <Link href="/terms" className="app-link text-sm">Terms</Link>
              <Link href="/" className="app-link text-sm">Home</Link>
              
              {/* Support Dropdown */}
              <div className="relative" ref={supportDropdownRef}>
                <button
                  onClick={() => setShowSupportDropdown(!showSupportDropdown)}
                  className="flex items-center gap-1 app-link text-sm"
                >
                  Support
                  <ChevronDown className={`w-3 h-3 transition-transform ${showSupportDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showSupportDropdown && (
                  <div className="absolute bottom-full left-0 mb-2 w-48 bg-card/95 backdrop-blur-xl border border-border/20 rounded-xl shadow-xl z-50">
                    <div className="p-2">
                      <Link
                        href="/contact"
                        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-foreground hover:bg-primary/10 rounded-lg transition-colors"
                        onClick={() => setShowSupportDropdown(false)}
                      >
                        <MessageCircle className="w-4 h-4" />
                        Contact Us
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
} 