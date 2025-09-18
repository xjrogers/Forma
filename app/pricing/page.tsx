'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Zap, Crown, Rocket, Sparkles, ChevronDown, MessageCircle } from 'lucide-react'
import { authService, User } from '@/lib/auth'
import SideNavigation from '@/components/SideNavigation'
import PublicNavigation from '@/components/PublicNavigation'
import PublicFooter from '@/components/PublicFooter'
import SubscriptionDialog from '@/components/SubscriptionDialog'

import { toast } from 'sonner'
import { WebSocketClient, WSResponse } from '@/lib/websocket'

export default function PricingPage() {
  const router = useRouter()
  const [isYearly, setIsYearly] = useState(true)
  const shimmerTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const [activeTab, setActiveTab] = useState('general')
  const [user, setUser] = useState<User | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showReactivateDialog, setShowReactivateDialog] = useState(false)
  const [showPlanChangeDialog, setShowPlanChangeDialog] = useState(false)
  const [planChangeDetails, setPlanChangeDetails] = useState<{
    targetPlan: string
    planName: string
    isUpgrade: boolean
  } | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<{
    id: string
    name: string
    price: number
  } | null>(null)
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false)
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false)
  const [loading, setLoading] = useState(false)
  const [processingSubscription, setProcessingSubscription] = useState<string | null>(null) // Track which plan is processing
  const [justUpgraded, setJustUpgraded] = useState<string | null>(null)
  const [wsClient, setWsClient] = useState<WebSocketClient | null>(null)

  // Fetch fresh user data on mount - no cached data
  useEffect(() => {
    setIsClient(true)
    fetchFreshUserData()
  }, [])

  // Handle escape key for dialogs
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCancelDialog) {
          setShowCancelDialog(false)
        }
        if (showReactivateDialog) {
          setShowReactivateDialog(false)
        }
        if (showPlanChangeDialog) {
          setShowPlanChangeDialog(false)
          setPlanChangeDetails(null)
        }
      }
    }

    if (showCancelDialog || showReactivateDialog || showPlanChangeDialog) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [showCancelDialog, showReactivateDialog, showPlanChangeDialog])

  // Setup WebSocket connection for real-time subscription updates
  useEffect(() => {
    if (isLoggedIn && user) {
      console.log('🔌 Setting up WebSocket connection for subscription updates...')
      const client = new WebSocketClient()
      
      // Listen for subscription updates using the correct API
      client.on('subscription_updated', (response: WSResponse) => {
        console.log('📢 Processing subscription update:', response.data)
        
        // Update user state with new plan and subscription data
        if (response.data?.plan) {
          console.log('🔄 Updating user plan from', user.plan, 'to', response.data.plan)
          const updatedUser = { 
            ...user, 
            plan: response.data.plan,
            subscriptionStatus: response.data.subscriptionStatus,
            subscriptionEndDate: response.data.subscriptionEndDate
          }
          setUser(updatedUser)
          
          // Show upgrade/downgrade animation (temporary pulse effect)
          setJustUpgraded(response.data.plan)
          setTimeout(() => setJustUpgraded(null), 2000) // Clear animation after 2 seconds
          
          // Clear processing state
          setProcessingSubscription(null)
          
          console.log('✅ Plan updated via WebSocket:', response.data.plan)
          console.log('✅ Subscription status:', response.data.subscriptionStatus)
          console.log('✅ Processing state cleared, justUpgraded set to:', response.data.plan)
        } else {
          console.log('❌ No plan data in subscription update:', response.data)
        }
      })
      
      client.connect()
      setWsClient(client)
      
      // Cleanup on unmount
      return () => {
        console.log('🔌 Cleaning up WebSocket connection...')
        client.disconnect()
        setWsClient(null)
      }
    }
  }, [isLoggedIn, user?.id]) // Only reconnect if login status or user ID changes

  const fetchFreshUserData = async () => {
    setIsLoadingUser(true)
    
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const userData = await response.json()
        
        if (userData.user) {
          // Update local state with FRESH data from database
          setUser(userData.user)
          setIsLoggedIn(true)
          
          // Also check payment methods
      checkPaymentMethods()
        } else {
          // No user data - user is not logged in
          setUser(null)
          setIsLoggedIn(false)
        }
      } else {
        // API call failed - user not authenticated
        setUser(null)
        setIsLoggedIn(false)
        setHasPaymentMethod(false)
        setIsLoadingPaymentMethods(false)
      }
    } catch (error) {
      console.error('Failed to fetch user data from backend:', error)
      // On error - assume not logged in
      setUser(null)
      setIsLoggedIn(false)
      setHasPaymentMethod(false)
      setIsLoadingPaymentMethods(false)
    } finally {
      setIsLoadingUser(false)
    }
  }

  const checkPaymentMethods = async () => {
    try {
      setIsLoadingPaymentMethods(true)
      const response = await fetch('/api/usage', {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success && data.paymentMethods) {
        setHasPaymentMethod(data.paymentMethods.length > 0)
      }
    } catch (error) {
      console.error('Failed to check payment methods:', error)
    } finally {
      setIsLoadingPaymentMethods(false)
    }
  }

  const handleReactivateSubscription = async () => {
    setProcessingSubscription(user?.plan || null)
    setJustUpgraded(null) // Clear previous upgrade state
    
    try {
      const response = await fetch('/api/billing/reactivate-subscription', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Subscription reactivated successfully!')
        // WebSocket will handle the UI update
      } else {
        throw new Error(data.error || 'Failed to reactivate subscription')
      }
    } catch (error) {
      console.error('Failed to reactivate subscription:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to reactivate subscription')
      setProcessingSubscription(null) // Clear processing state on error
    }
  }

  const handlePlanChange = async (targetPlan: string, planName: string) => {
    setProcessingSubscription(targetPlan)
    setJustUpgraded(null) // Clear previous upgrade state
    
    try {
      console.log(`🔄 Changing plan from ${user?.plan} to ${targetPlan}`)
      console.log(`🔍 Current subscription status: ${user?.subscriptionStatus}`)

      const response = await fetch('/api/billing/update-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ planId: targetPlan })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Successfully changed to ${planName} plan!`)
        // WebSocket will handle the UI update
      } else {
        throw new Error(data.error || 'Failed to change plan')
      }
    } catch (error) {
      console.error('Failed to change plan:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to change plan')
      setProcessingSubscription(null) // Clear processing state on error
    }
  }

  const handleConfirmedPlanChange = async () => {
    if (!planChangeDetails) return
    
    setShowPlanChangeDialog(false)
    await handlePlanChange(planChangeDetails.targetPlan, planChangeDetails.planName)
    setPlanChangeDetails(null)
  }

  const handlePlanClick = async (plan: any) => {
    if (!isLoggedIn) {
      router.push('/signup')
      return
    }

    if (user?.plan === plan.name.toLowerCase() && user?.subscriptionStatus !== 'cancel_at_period_end') {
      toast.info('You are already on this plan')
      return
    }

    const targetPlan = plan.name.toLowerCase()
    const currentPlan = user?.plan

    // Handle free plan (cancellation)
    if (targetPlan === 'free') {
      // Check if already canceling
      if (user?.subscriptionStatus === 'cancel_at_period_end') {
        toast.info('Your subscription is already set to cancel at the end of the billing period')
      return
    }

      // Show confirmation dialog for cancellation
      setShowCancelDialog(true)
      return
    }

    // Handle reactivation of canceled plan (same plan)
    if (currentPlan === targetPlan && user?.subscriptionStatus === 'cancel_at_period_end') {
      setShowReactivateDialog(true)
      return
    }

    // Handle plan changes (starter ↔ business) - including from cancel_at_period_end status
    if (currentPlan && currentPlan !== 'free' && targetPlan !== 'free') {
      // Determine if this is an upgrade or downgrade
      const planHierarchy = { free: 0, starter: 1, business: 2 }
      const currentPlanLevel = planHierarchy[currentPlan as keyof typeof planHierarchy] || 0
      const targetPlanLevel = planHierarchy[targetPlan as keyof typeof planHierarchy] || 0
      const isUpgrade = targetPlanLevel > currentPlanLevel
      
      // Show confirmation dialog for plan changes
      setPlanChangeDetails({
        targetPlan,
        planName: plan.name,
        isUpgrade
      })
      setShowPlanChangeDialog(true)
      return
    }

    // Handle new subscription (free → paid)
    setSelectedPlan({
      id: targetPlan,
      name: plan.name,
      price: isYearly ? plan.yearlyPrice : plan.price
    })
    
    // Check payment methods when opening subscription dialog
    checkPaymentMethods()
    
    setShowSubscriptionDialog(true)
    setProcessingSubscription(null) // Reset processing state
  }

  const handleDowngradeToFree = async () => {
    // Set processing state for free plan only
    setProcessingSubscription('free')
    setShowCancelDialog(false)
    setJustUpgraded(null) // Clear previous upgrade state
    
    try {
      // First, fetch fresh user data to check for active subscription
      const userResponse = await fetch('/api/auth/me', {
        credentials: 'include'
      })
      
      if (!userResponse.ok) {
        throw new Error('Failed to fetch user data')
      }
      
      const userData = await userResponse.json()
      
      if (!userData.user?.stripeSubscriptionId) {
      toast.error('No active subscription found')
        setProcessingSubscription(null)
      return
    }

      console.log('🔍 Waiting for WebSocket subscription update for plan: free')

      // Cancel the subscription
      const response = await fetch('/api/billing/cancel-subscription', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Subscription canceled successfully')
        
        // Note: WebSocket will handle the UI update when the webhook processes
        // The processing state will be cleared by the WebSocket handler
      } else {
        throw new Error(data.error || 'Failed to cancel subscription')
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to cancel subscription')
      setProcessingSubscription(null) // Clear processing state on error
    }
  }

  const handleSubscriptionSuccess = async () => {
    setProcessingSubscription(selectedPlan?.id || null)
    
    // Close dialog first
    setShowSubscriptionDialog(false)
    
    // WebSocket will handle the real-time update - no polling needed!
    console.log(`🔍 Waiting for WebSocket subscription update for plan: ${selectedPlan?.id}`)
    
    // Reset states
    setSelectedPlan(null)
    setJustUpgraded(null) // Clear previous upgrade state
    // Keep processing state until WebSocket update arrives
    
    toast.success(`Subscription activated successfully! Welcome to ${selectedPlan?.name} plan!`)
  }

  const faqCategories = {
    general: {
      label: 'General',
      faqs: [
        {
          question: "What is DevAssistant.io?",
          answer: "DevAssistant.io is an AI-powered app and website builder designed for coders and non-coders alike. It helps you build applications, create SEO-optimized websites, write and debug code faster, while syncing with your projects in real time."
        },
        {
          question: "What are tokens?",
          answer: (
            <>
              Tokens are the unit of usage for AI operations. Every time you generate, refactor, or debug code with DevAssistant.io, tokens are consumed. Larger projects or longer code responses require more tokens. Tokens are a complex mathematical usage system implemented by the AI providers and cannot be changed unfortunately. To learn more about tokens,{' '}
              <a 
                href="https://docs.claude.com/en/docs/about-claude/glossary#tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="app-link"
              >
                click here.
              </a>
            </>
          )
        },
        {
          question: "How are tokens used in DevAssistant.io?",
          answer: "Most token usage comes from: Generating new code snippets, Debugging and refactoring existing code, Syncing your project files with the AI. The bigger the project, the more tokens per request."
        },
        {
          question: "Do unused tokens roll over?",
          answer: "Purchased tokens roll over, while tokens from a monthly subscription do not."
        },
        {
          question: "What are the free plan limits?",
          answer: "The free plan includes: 200,000 tokens per day, 1,000,000 tokens per month. Great for individual testing and smaller projects."
        }
      ]
    },
    billing: {
      label: 'Billing',
      faqs: [
        {
          question: "How do subscription plans work?",
          answer: "Subscriptions provide you with a monthly token allotment. Each plan comes with different token limits and features. You can upgrade or downgrade anytime through the billing portal."
        },
        {
          question: "Do teams share tokens?",
          answer: "No. Each paid team member receives their own monthly token allotment. Tokens are not pooled or shared across the team."
        },
        {
          question: "Can I change my plan later?",
          answer: "Yes. You can change your plan anytime through the pricing page you are currently on."
        },
        {
          question: "Can I cancel my subscription?",
          answer: "Yes. You can cancel at any time. Your access will remain active until the end of the billing cycle."
        }
      ]
    }
  }

  const plans = [
    {
      name: 'Free',
      icon: <Zap className="w-5 h-5 text-primary" />,
      price: 0,
      yearlyPrice: 0,
      tokens: '200K',
      tokensDetail: '200,000 tokens daily',
      features: [
        'Basic AI assistance',
        'Standard response time',
        'Community support',
        'Basic templates',
        'Public projects only'
      ],
      buttonText: 'Start Building',
      popular: false
    },
    {
      name: 'Starter',
      icon: <Crown className="w-5 h-5 text-primary" />,
      price: 20,
      yearlyPrice: 17, // 15% discount
      tokens: '12M',
      tokensDetail: '12 million tokens monthly',
      features: [
        'Advanced AI assistance',
        'Priority response time',
        'Email support',
        'Premium templates',
        'Private projects',
        'Custom integrations',
        'Advanced analytics'
      ],
      buttonText: 'Start Building',
      popular: true
    },
    {
      name: 'Business',
      icon: <Rocket className="w-5 h-5 text-primary" />,
      price: 50,
      yearlyPrice: 42.5, // 15% discount
      tokens: '35M',
      tokensDetail: '35 million tokens monthly',
      features: [
        'Enterprise AI assistance',
        'Instant response time',
        'Priority support',
        'All premium templates',
        'Unlimited private projects',
        'Advanced integrations',
        'Custom AI models',
        'Team collaboration',
        'Advanced security'
      ],
      buttonText: 'Start Building',
      popular: false
    }
  ]

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex">
      {isClient && isLoggedIn && (
        <SideNavigation sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      )}
      <div className={`flex-1 ${isLoggedIn && sidebarOpen ? 'lg:pl-64' : ''}`}>
        {/* Background Image */}
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/background.png)' }}
        />
        
        <div className="relative z-10">
          {/* Navigation - Only show when not logged in */}
          {!isLoggedIn && <PublicNavigation showHome={true} showChangelog={true} showContact={true} />}

          {/* Main Content */}
          <main className={`relative ${!isLoggedIn ? 'pt-16' : ''}`}>
            <div className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 ${!isLoggedIn ? 'pt-16' : 'pt-8'} pb-24`}>
              <div className="text-center">
              {/* Main Headline */}
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
                Simple, Transparent{' '}
                <span className="gradient-text">Pricing</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Choose the perfect plan for your needs. Start free and upgrade as you grow.
              </p>
              
              {/* Billing Toggle */}
              <div className="flex items-center justify-center gap-4 mb-12">
                <div 
                  className="inline-flex p-1 rounded-xl border backdrop-blur-sm"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <button
                    onClick={() => setIsYearly(false)}
                    className={`px-4 py-1.5 rounded-xl text-sm font-medium relative overflow-hidden ${
                      !isYearly
                        ? 'text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    style={{
                      background: !isYearly 
                        ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)'
                        : 'transparent',
                      border: !isYearly 
                        ? '1px solid rgba(255, 255, 255, 0.2)'
                        : '1px solid transparent',
                      boxShadow: !isYearly 
                        ? '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                        : 'none',
                      transform: 'translateY(0)',
                      backdropFilter: !isYearly ? 'blur(20px)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!isYearly) {
                        const shimmer = e.currentTarget.querySelector('.shimmer-effect') as HTMLElement;
                        if (shimmer) {
                          const existingTimeout = shimmerTimeoutsRef.current.get('monthly');
                          if (existingTimeout) {
                            clearTimeout(existingTimeout);
                          }
                          
                          shimmer.style.transition = 'transform 0.5s ease-out';
                          shimmer.style.transform = 'translateX(100%)';
                          const timeout = setTimeout(() => {
                            shimmer.style.transition = 'none';
                            shimmer.style.transform = 'translateX(-100%)';
                            shimmerTimeoutsRef.current.delete('monthly');
                          }, 500);
                          shimmerTimeoutsRef.current.set('monthly', timeout);
                        }
                      }
                    }}
                  >
                    {!isYearly && (
                      <div 
                        className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
                        style={{
                          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                          transform: 'translateX(-100%)'
                        }}
                      ></div>
                    )}
                    Monthly
                  </button>
                  <button
                    onClick={() => setIsYearly(true)}
                    className={`px-4 py-1.5 rounded-xl text-sm font-medium relative overflow-hidden ${
                      isYearly
                        ? 'text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    style={{
                      background: isYearly 
                        ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)'
                        : 'transparent',
                      border: isYearly 
                        ? '1px solid rgba(255, 255, 255, 0.2)'
                        : '1px solid transparent',
                      boxShadow: isYearly 
                        ? '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                        : 'none',
                      transform: 'translateY(0)',
                      backdropFilter: isYearly ? 'blur(20px)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (isYearly) {
                        const shimmer = e.currentTarget.querySelector('.shimmer-effect') as HTMLElement;
                        if (shimmer) {
                          const existingTimeout = shimmerTimeoutsRef.current.get('yearly');
                          if (existingTimeout) {
                            clearTimeout(existingTimeout);
                          }
                          
                          shimmer.style.transition = 'transform 0.5s ease-out';
                          shimmer.style.transform = 'translateX(100%)';
                          const timeout = setTimeout(() => {
                            shimmer.style.transition = 'none';
                            shimmer.style.transform = 'translateX(-100%)';
                            shimmerTimeoutsRef.current.delete('yearly');
                          }, 500);
                          shimmerTimeoutsRef.current.set('yearly', timeout);
                        }
                      }
                    }}
                  >
                    {isYearly && (
                      <div 
                        className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
                        style={{
                          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                          transform: 'translateX(-100%)'
                        }}
                      ></div>
                    )}
                    Yearly
                  </button>
                </div>
              </div>
              
              {/* Save Message for Monthly Users */}
              {!isYearly && (
                <div className="text-center mb-4 -mt-8">
                  <p className="text-sm text-muted-foreground">
                    Save 15% on Yearly
                  </p>
                </div>
              )}
            </div>

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16">
              {plans.map((plan, index) => (
                <div
                  key={plan.name}
                  className={`relative rounded-3xl p-6 transition-all duration-500 bg-background/50 flex flex-col ${
                    plan.popular 
                      ? 'gradient-border' 
                      : 'border border-border/20 hover:border-primary/40'
                  } ${
                    isLoggedIn && user?.plan === plan.name.toLowerCase() && user?.subscriptionStatus !== 'cancel_at_period_end'
                      ? 'ring-2 ring-green-400 ring-opacity-75'
                      : ''
                  } ${
                    justUpgraded === plan.name.toLowerCase()
                      ? 'animate-pulse'
                      : ''
                  }`}
                  style={{
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  {/* Plan Header */}
                  <div className="mb-6">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
                        {plan.popular && (
                          <span className="button-luxury text-xs px-3 py-1">
                            Most Popular
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{plan.tokensDetail}</div>
                    </div>
                    
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-3xl font-bold text-foreground">
                        ${isYearly ? plan.yearlyPrice : plan.price}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-muted-foreground text-sm">/month</span>
                      )}
                    </div>
                    

                    
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                      <Zap className="w-3 h-3" />
                      {plan.tokens} tokens
                    </div>
                  </div>

                  {/* Features */}
                  <div className="flex-1 mb-6">
                    <div className="text-sm font-medium text-foreground mb-3">What's included:</div>
                    <ul className="space-y-2">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground text-sm leading-relaxed">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA Button */}
                  <div className="mt-auto">
                    <button 
                      onClick={() => handlePlanClick(plan)}
                      className={`w-full button-luxury py-3 px-6 text-sm ${
                        isLoadingUser || 
                        (isLoggedIn && user?.plan === plan.name.toLowerCase() && user?.subscriptionStatus !== 'cancel_at_period_end') || 
                        (plan.name.toLowerCase() === 'free' && user?.subscriptionStatus === 'cancel_at_period_end') ||
                        loading || 
                        processingSubscription === plan.name.toLowerCase()
                          ? 'opacity-50 cursor-not-allowed' 
                          : ''
                      }`}
                      disabled={
                        isLoadingUser || 
                        (isLoggedIn && user?.plan === plan.name.toLowerCase() && user?.subscriptionStatus !== 'cancel_at_period_end') || 
                        (plan.name.toLowerCase() === 'free' && user?.subscriptionStatus === 'cancel_at_period_end') ||
                        loading || 
                        processingSubscription === plan.name.toLowerCase()
                      }
                    >
                      {isLoadingUser ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Loading...
                        </div>
                      ) : loading || processingSubscription === plan.name.toLowerCase() ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {processingSubscription === plan.name.toLowerCase() ? 
                            (plan.name.toLowerCase() === 'free' ? 'Canceling...' : 'Activating...') : 
                            'Processing...'
                          }
                        </div>
                      ) : isLoggedIn ? (
                        user?.plan === plan.name.toLowerCase() ? (
                          <div className="flex flex-col items-center justify-center gap-1">
                            {user?.subscriptionStatus === 'cancel_at_period_end' ? (
                              <>
                                <span className="text-orange-400 text-sm">Ending {user?.subscriptionEndDate ? new Date(user.subscriptionEndDate).toLocaleDateString() : 'soon'}</span>
                                <span className="text-xs text-muted-foreground">Click to reactivate</span>
                              </>
                            ) : (
                              <div className={`flex items-center gap-2 ${justUpgraded === plan.name.toLowerCase() ? 'animate-pulse' : ''}`}>
                                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                Active Plan
                              </div>
                            )}
                          </div>
                        ) : user?.plan === 'free' ? (
                          // Free plan users see "Upgrade" for paid plans, "Current Plan" for free plan
                          ['starter', 'business'].includes(plan.name.toLowerCase()) ? 'Upgrade' : 'Current Plan'
                        ) : user?.plan === 'starter' ? (
                          // Starter plan users
                          plan.name.toLowerCase() === 'free' ? 
                            (user?.subscriptionStatus === 'cancel_at_period_end' ? 'Already Canceling' : 'Downgrade') : 
                          plan.name.toLowerCase() === 'business' ? 'Upgrade' : plan.buttonText
                        ) : user?.plan === 'business' ? (
                          // Business plan users  
                          plan.name.toLowerCase() === 'free' ? 
                            (user?.subscriptionStatus === 'cancel_at_period_end' ? 'Already Canceling' : 'Downgrade') :
                          plan.name.toLowerCase() === 'starter' ? 'Downgrade' : plan.buttonText
                        ) : plan.buttonText
                      ) : plan.buttonText}
                    </button>
                  </div>
                </div>
              ))}
            </div>



            {/* FAQ Section */}
            <section className="max-w-4xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-foreground text-center mb-12">
                Frequently Asked Questions
              </h2>
              
              {/* Tab Navigation */}
              <div className="flex justify-center mb-8">
                <div 
                  className="inline-flex p-1 rounded-xl border backdrop-blur-sm"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  }}
                >
                  {Object.entries(faqCategories).map(([key, category]) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`px-4 py-1.5 rounded-xl text-sm font-medium relative overflow-hidden transition-all duration-500 ${
                        activeTab === key
                          ? 'text-white shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      style={{
                        background: activeTab === key 
                          ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)'
                          : 'transparent',
                        border: activeTab === key 
                          ? '1px solid rgba(255, 255, 255, 0.2)'
                          : '1px solid transparent',
                        boxShadow: activeTab === key 
                          ? '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                          : 'none',
                        transform: 'translateY(0)',
                        backdropFilter: activeTab === key ? 'blur(20px)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (activeTab === key) {
                          const shimmer = e.currentTarget.querySelector('.shimmer-effect') as HTMLElement;
                          if (shimmer) {
                            const existingTimeout = shimmerTimeoutsRef.current.get(key);
                            if (existingTimeout) {
                              clearTimeout(existingTimeout);
                            }
                            
                            shimmer.style.transition = 'transform 0.5s ease-out';
                            shimmer.style.transform = 'translateX(100%)';
                            const timeout = setTimeout(() => {
                              shimmer.style.transition = 'none';
                              shimmer.style.transform = 'translateX(-100%)';
                              shimmerTimeoutsRef.current.delete(key);
                            }, 500);
                            shimmerTimeoutsRef.current.set(key, timeout);
                          }
                        }
                      }}
                    >
                      {activeTab === key && (
                        <div 
                          className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
                          style={{
                            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                            transform: 'translateX(-100%)'
                          }}
                        />
                      )}
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* FAQ Content */}
              <div className="space-y-6">
                {faqCategories[activeTab as keyof typeof faqCategories].faqs.map((faq, index) => (
                  <div key={index} className="luxury-card p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-3">
                      {faq.question}
                    </h3>
                    <div className="text-muted-foreground leading-relaxed">
                      {typeof faq.answer === 'string' ? faq.answer : faq.answer}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>

        {/* Footer */}
        <PublicFooter 
          showTopBorder={true}
          topMargin="large"
          verticalPadding="none"
        />
      </div>
      </div>

      {/* Subscription Dialog */}
      {selectedPlan && (
        <SubscriptionDialog
          isOpen={showSubscriptionDialog}
          onClose={() => {
            setShowSubscriptionDialog(false)
            setSelectedPlan(null)
          }}
          onSuccess={handleSubscriptionSuccess}
          onError={checkPaymentMethods}
          planId={selectedPlan.id}
          planName={selectedPlan.name}
          planPrice={selectedPlan.price}
          hasPaymentMethod={hasPaymentMethod}
          isLoadingPaymentMethods={isLoadingPaymentMethods}
          isYearly={isYearly}
        />
      )}

      {/* Cancel Subscription Confirmation Dialog */}
      {showCancelDialog && (
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
              <h2 className="text-lg font-semibold text-foreground">Cancel Subscription?</h2>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-muted-foreground mb-6">
                Are you sure you want to cancel your subscription? You'll continue to have access to your current plan until the end of your billing period, then you'll be moved to the free plan.
              </p>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowCancelDialog(false)}
                  disabled={processingSubscription === 'free'}
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-foreground hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Keep Subscription
                </button>
                <button
                  onClick={handleDowngradeToFree}
                  disabled={processingSubscription === 'free'}
                  className="relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 overflow-hidden flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    transform: 'translateY(0)'
                  }}
                  onMouseEnter={(e) => {
                    if (processingSubscription !== 'free') {
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
                    if (processingSubscription !== 'free') {
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
                  {processingSubscription === 'free' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-t-transparent border-red-400 rounded-full animate-spin" />
                      Canceling...
                    </>
                  ) : (
                    'Cancel Subscription'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate Subscription Confirmation Dialog */}
      {showReactivateDialog && (
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
              <h2 className="text-lg font-semibold text-foreground">Reactivate Subscription?</h2>
            </div>
            {/* Content */}
            <div className="p-6">
              <p className="text-muted-foreground mb-6">
                Your {user?.plan} plan is currently set to cancel at the end of your billing period. Would you like to reactivate it and continue with your current plan?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowReactivateDialog(false)}
                  disabled={processingSubscription !== null}
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-foreground hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowReactivateDialog(false)
                    await handleReactivateSubscription()
                  }}
                  disabled={processingSubscription !== null}
                  className="relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 overflow-hidden flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    color: '#22c55e',
                    transform: 'translateY(0)'
                  }}
                  onMouseEnter={(e) => {
                    if (processingSubscription === null) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
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
                    if (processingSubscription === null) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.2)';
                    }
                  }}
                >
                  {/* Shimmer effect */}
                  <div 
                    className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.2), transparent)',
                      transform: 'translateX(-100%)'
                    }}
                  ></div>
                  {processingSubscription !== null ? (
                    <>
                      <div className="w-4 h-4 border-2 border-t-transparent border-green-400 rounded-full animate-spin" />
                      Reactivating...
                    </>
                  ) : (
                    'Reactivate Subscription'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Change Confirmation Dialog */}
      {showPlanChangeDialog && planChangeDetails && (
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
              <h2 className="text-lg font-semibold text-foreground">
                {planChangeDetails.isUpgrade ? 'Confirm Upgrade' : 'Confirm Downgrade'}
              </h2>
            </div>
            {/* Content */}
            <div className="p-6">
              <p className="text-muted-foreground mb-6">
                {planChangeDetails.isUpgrade ? (
                  <>
                    Are you sure you want to upgrade to the <strong>{planChangeDetails.planName}</strong> plan? 
                    You'll be charged the prorated difference immediately and get access to additional features.
                  </>
                ) : (
                  <>
                    Are you sure you want to downgrade to the <strong>{planChangeDetails.planName}</strong> plan? 
                    The change will take effect at your next billing cycle, and you'll lose access to some features.
                  </>
                )}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowPlanChangeDialog(false)
                    setPlanChangeDetails(null)
                  }}
                  disabled={processingSubscription !== null}
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-foreground hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmedPlanChange}
                  disabled={processingSubscription !== null}
                  className="relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 overflow-hidden flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: planChangeDetails.isUpgrade 
                      ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)'
                      : 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(249, 115, 22, 0.05) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: planChangeDetails.isUpgrade 
                      ? '1px solid rgba(34, 197, 94, 0.2)'
                      : '1px solid rgba(249, 115, 22, 0.2)',
                    color: planChangeDetails.isUpgrade ? '#22c55e' : '#f97316',
                    transform: 'translateY(0)'
                  }}
                  onMouseEnter={(e) => {
                    if (processingSubscription === null) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = planChangeDetails.isUpgrade 
                        ? 'rgba(34, 197, 94, 0.3)'
                        : 'rgba(249, 115, 22, 0.3)';
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
                    if (processingSubscription === null) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = planChangeDetails.isUpgrade 
                        ? 'rgba(34, 197, 94, 0.2)'
                        : 'rgba(249, 115, 22, 0.2)';
                    }
                  }}
                >
                  {/* Shimmer effect */}
                  <div 
                    className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
                    style={{
                      background: planChangeDetails.isUpgrade
                        ? 'linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.2), transparent)'
                        : 'linear-gradient(90deg, transparent, rgba(249, 115, 22, 0.2), transparent)',
                      transform: 'translateX(-100%)'
                    }}
                  ></div>
                  {processingSubscription !== null ? (
                    <>
                      <div className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin" />
                      {planChangeDetails.isUpgrade ? 'Upgrading...' : 'Downgrading...'}
                    </>
                  ) : (
                    <>
                      {planChangeDetails.isUpgrade ? 'Confirm Upgrade' : 'Confirm Downgrade'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 