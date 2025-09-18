'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Shield, Download, Code2, Zap, MessageCircle, ChevronDown, Globe, Smartphone, Layers, Building2, ShoppingCart, Briefcase } from 'lucide-react'
import Link from 'next/link'
import { authService, User } from '@/lib/auth'
import SideNavigation from '@/components/SideNavigation'
import PublicNavigation from '@/components/PublicNavigation'
import PublicFooter from '@/components/PublicFooter'

import { toast } from 'sonner'

export default function HomePage() {
  const router = useRouter()
  const [intent, setIntent] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastClickTime = useRef<number>(0)

  // Check authentication state and auto-focus textarea
  useEffect(() => {
    setIsClient(true)
    const currentUser = authService.getCurrentUser()
    setUser(currentUser)
    setIsLoggedIn(!!currentUser)
    
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  const generateProjectNameAndDescription = (userInput: string) => {
    // Extract key concepts and create a concise project name
    const words = userInput.toLowerCase().split(/\s+/).filter(word => word.length > 2)
    const keyWords = words.slice(0, 3) // Take first 3 meaningful words
    
    // Create a project name (capitalize first letter of each word)
    const projectName = keyWords
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .substring(0, 50) || 'New Project'
    
    // Use the full input as description, truncated if too long
    const description = userInput.length > 200 
      ? userInput.substring(0, 197) + '...' 
      : userInput
    
    return { projectName, description }
  }

  const handleGeneratePlan = async () => {
    if (!isLoggedIn) {
      window.location.href = '/login'
      return
    }

    const userInput = intent.trim()
    if (!userInput) {
      toast.error('Please describe what you want to build')
      return
    }

    setIsCreatingProject(true)
    
    try {
      // Generate project name and description from user input
      const { projectName, description } = generateProjectNameAndDescription(userInput)
      
      // Create the project
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          description: description,
          isPrivate: true // Default to private
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.code === 'GITHUB_NOT_CONNECTED') {
          toast.error('Please connect your GitHub account first', {
            action: {
              label: 'Connect GitHub',
              onClick: () => window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/github`
            }
          })
          return
        }
        if (data.code === 'GITHUB_AUTH_FAILED') {
          toast.error('GitHub authentication expired', {
            action: {
              label: 'Reconnect',
              onClick: () => window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/github`
            }
          })
          return
        }
        throw new Error(data.error || 'Failed to create project')
      }

      // Navigate to builder with the project and the initial prompt
      const projectId = data.project.id
      const encodedPrompt = encodeURIComponent(userInput)
      router.push(`/dashboard/builder?projectId=${projectId}&prompt=${encodedPrompt}`)
      
    } catch (error) {
      console.error('Error creating project:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create project')
    } finally {
      setIsCreatingProject(false)
    }
  }

  const typeText = (text: string) => {
    const now = Date.now()
    const timeSinceLastClick = now - lastClickTime.current
    const minDelay = 300 // Minimum 300ms between clicks
    
    // Rate limiting - prevent rapid clicking
    if (isTyping && timeSinceLastClick < minDelay) {
      return // Ignore click if too soon
    }
    
    lastClickTime.current = now
    setIsTyping(true)
    
    // Clear any existing typing interval
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current)
    }
    
    setIntent('') // Clear current text
    let index = 0
    const typeSpeed = 8 // milliseconds per character
    
    typingIntervalRef.current = setInterval(() => {
      if (index < text.length) {
        setIntent(text.slice(0, index + 1))
        index++
      } else {
        clearInterval(typingIntervalRef.current!)
        typingIntervalRef.current = null
        setIsTyping(false)
      }
    }, typeSpeed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleGeneratePlan()
    }
  }

  if (!isClient) {
    return null // Prevent hydration mismatch
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/background.png)' }}
      ></div>
      
      {/* Mobile sidebar backdrop */}
      {isLoggedIn && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - only show when logged in */}
      {isLoggedIn && (
        <SideNavigation 
          activeTab="home"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
      )}
      
      <div className="relative z-10">
        {/* Navigation - only show when not logged in */}
        {!isLoggedIn && <PublicNavigation showChangelog={true} showContact={true} />}

        {/* Hero Section */}
        <main className={`relative ${!isLoggedIn ? 'pt-16' : 'pt-6'}`}>
          <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${!isLoggedIn ? 'pt-24' : 'pt-16'} pb-24 ${isLoggedIn ? 'max-w-5xl' : 'max-w-6xl'}`}>
          <div className="text-center">
            {/* Welcome message for logged in users */}
            {isLoggedIn && user && (
              <div className="mb-6">
                <p className="text-lg text-muted-foreground">
                  Welcome back, <span className="text-foreground font-medium">{user.firstName || user.email}</span>
                </p>
              </div>
            )}



            {/* Main Headline */}
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
              {isLoggedIn ? 'Ready to build?' : 'Your ideas.'}{' '}
              <span className="gradient-text">{isLoggedIn ? 'Let\'s create.' : 'Your code.'}</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              {isLoggedIn 
                ? 'Describe your project and I\'ll generate a complete application for you.'
                : 'DevAssistant.io builds apps you fully own ; exportable at any time.'
              }
            </p>

            {/* Intent Input */}
            <div className="max-w-3xl mx-auto mb-3">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Build a modern dashboard with user authentication, subscription billing, and a content management system..."
                  className="w-full h-32 px-6 py-4 pb-16 text-base luxury-card focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 resize-none overflow-hidden transition-all duration-300 placeholder:text-muted-foreground/60 text-foreground"
                  style={{ fontFamily: 'inherit' }}
                />
                
                {/* Quick Start Buttons */}
                <div className="absolute bottom-4 left-4 flex items-center space-x-2">
                  <button
                    onClick={() => typeText("Build a modern business website with hero section, services page, testimonials, blog, contact forms, SEO optimization, responsive design, and professional animations. Include a content management system for easy updates.")}
                    disabled={isTyping}
                    className={`px-2.5 py-1 text-xs font-medium transition-all duration-200 border border-border/20 rounded-md ${
                      isTyping 
                        ? 'text-muted-foreground/50 bg-secondary/20 cursor-not-allowed' 
                        : 'text-muted-foreground hover:text-foreground bg-secondary/30 hover:bg-secondary/50'
                    }`}
                  >
                    Website
                  </button>
                  <button
                    onClick={() => typeText("Create a comprehensive SaaS application with user authentication, subscription billing with Stripe, admin dashboard, user management, API endpoints, email notifications, analytics tracking, and multi-tenant architecture with role-based permissions.")}
                    disabled={isTyping}
                    className={`px-2.5 py-1 text-xs font-medium transition-all duration-200 border border-border/20 rounded-md ${
                      isTyping 
                        ? 'text-muted-foreground/50 bg-secondary/20 cursor-not-allowed' 
                        : 'text-muted-foreground hover:text-foreground bg-secondary/30 hover:bg-secondary/50'
                    }`}
                  >
                    SaaS
                  </button>
                  <button
                    onClick={() => typeText("Build a powerful analytics dashboard with interactive charts, data visualization, real-time metrics, user management, reporting features, data export capabilities, filtering and search functionality, and customizable widgets for business intelligence.")}
                    disabled={isTyping}
                    className={`px-2.5 py-1 text-xs font-medium transition-all duration-200 border border-border/20 rounded-md ${
                      isTyping 
                        ? 'text-muted-foreground/50 bg-secondary/20 cursor-not-allowed' 
                        : 'text-muted-foreground hover:text-foreground bg-secondary/30 hover:bg-secondary/50'
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => typeText("Create a native iOS mobile application with tab navigation, user profiles, authentication, data synchronization, push notifications, offline support, camera integration, location services, and seamless user experience with modern iOS design patterns.")}
                    disabled={isTyping}
                    className={`px-2.5 py-1 text-xs font-medium transition-all duration-200 border border-border/20 rounded-md ${
                      isTyping 
                        ? 'text-muted-foreground/50 bg-secondary/20 cursor-not-allowed' 
                        : 'text-muted-foreground hover:text-foreground bg-secondary/30 hover:bg-secondary/50'
                    }`}
                  >
                    iOS App
                  </button>
                </div>

                <div className="absolute bottom-4 right-4">
                  <button
                    onClick={handleGeneratePlan}
                    disabled={isCreatingProject || !intent.trim()}
                    className="button-enter text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCreatingProject ? (
                      <>
                        <div className="w-3 h-3 border border-t-transparent border-white rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Enter'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="text-center mb-6">
              <p className="text-xs silver-accent">
                Start building in seconds • No credit card required • Export your code anytime
              </p>
            </div>


          </div>
        </div>

        </main>

        {/* Use Cases Section - Only show when not logged in for SEO */}
        {!isLoggedIn && (
          <section className="py-16 mt-20">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  Why Choose DevAssistant.io?
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  Build anything you can imagine with AI. From SEO-optimized websites to complex enterprise applications.
                </p>
              </div>
              
              {/* Use Cases - Clean List Style */}
              <div className="text-center mb-12">
                <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-lg">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-5 w-5 text-primary" />
                    Websites
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Smartphone className="h-5 w-5 text-primary" />
                    Mobile Apps
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Layers className="h-5 w-5 text-primary" />
                    Web Apps
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-5 w-5 text-primary" />
                    SaaS Platforms
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    E-commerce
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Enterprise Apps
                  </span>
                </div>
              </div>

              {/* Key Benefits - Simple Clean Style */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
                <div>
                  <Sparkles className="h-8 w-8 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-3">AI-Powered Generation</h3>
                  <p className="text-muted-foreground">
                    Chat with advanced AI to generate complete applications, components, and features. 
                    No coding experience required.
                  </p>
                </div>
                
                <div>
                  <Download className="h-8 w-8 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-3">Export-First</h3>
                  <p className="text-muted-foreground">
                    Own your code completely. Export your projects at any time and deploy anywhere. 
                    No vendor lock-in.
                  </p>
                </div>
                
                <div>
                  <Zap className="h-8 w-8 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-3">Production Ready</h3>
                  <p className="text-muted-foreground">
                    Generate production-ready applications with modern frameworks like React, 
                    Next.js, and TypeScript.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <PublicFooter 
          showTopBorder={false}
          topMargin="small"
          verticalPadding="none"
        />
        </div>
      </div>
    )
  } 