'use client'

import { useState, useEffect } from 'react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { toast } from 'sonner'
import { X, Lock, Crown, Rocket, CreditCard } from 'lucide-react'
import { Environment, EnvironmentConfig } from '@/lib/environment'

// Conditionally load Stripe based on environment
const stripePromise = EnvironmentConfig.stripe.enabled 
  ? loadStripe(EnvironmentConfig.stripe.publishableKey!) 
  : null;

interface SubscriptionDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onError?: () => void
  planId: string
  planName: string
  planPrice: number
  hasPaymentMethod: boolean
  isLoadingPaymentMethods?: boolean
  isYearly?: boolean
}

function CheckoutForm({ 
  onClose, 
  onSuccess, 
  onError,
  planId, 
  planName, 
  planPrice, 
  hasPaymentMethod,
  isLoadingPaymentMethods = false,
  isYearly = false
}: Omit<SubscriptionDialogProps, 'isOpen'>) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [billingDetails, setBillingDetails] = useState({
    name: '',
    email: ''
  })

  const handleBillingChange = (field: string, value: string) => {
    setBillingDetails(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)

    try {
      if (hasPaymentMethod) {
        // User has payment method, just create subscription
        await createSubscription()
      } else {
        // User needs to add payment method first, then create subscription
        await addPaymentMethodAndSubscribe()
      }
    } catch (error) {
      console.error('Subscription error:', error)
      
      // Provide user-friendly error messages
      let errorMessage = 'Subscription failed'
      if (error instanceof Error) {
        const message = error.message.toLowerCase()
        
        if (message.includes('payment method') && message.includes('attached')) {
          errorMessage = 'Payment method error. Please refresh the page and try again.'
        } else if (message.includes('card was declined')) {
          errorMessage = 'Your card was declined. Please check your card details or try a different card.'
        } else if (message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds. Please check your account balance or try a different card.'
        } else if (message.includes('expired')) {
          errorMessage = 'Your card has expired. Please use a different card.'
        } else if (message.includes('cvc') || message.includes('security code')) {
          errorMessage = 'Invalid security code. Please check your card\'s CVC.'
        } else if (message.includes('zip') || message.includes('postal')) {
          errorMessage = 'Invalid postal code. Please check your billing address.'
        } else if (message.includes('name is required')) {
          errorMessage = 'Please enter your full name.'
        } else if (message.includes('email is required')) {
          errorMessage = 'Please enter a valid email address.'
        } else if (message.includes('payment system not ready')) {
          errorMessage = 'Payment system is loading. Please wait a moment and try again.'
        } else {
          // For other errors, show the original message but make it more user-friendly
          errorMessage = error.message.charAt(0).toUpperCase() + error.message.slice(1)
        }
      }
      
      toast.error(errorMessage)
      
      // Call onError callback to refresh payment method state
      if (onError) {
        onError()
      }
    } finally {
      setLoading(false)
    }
  }

  const createSubscription = async () => {
    const response = await fetch('/api/billing/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ planId, isYearly })
    })

    const data = await response.json()

    if (!response.ok) {
      // Extract detailed error message from server response
      const errorMessage = data.error || data.message || 'Failed to create subscription'
      throw new Error(errorMessage)
    }

    // Success will be handled by webhook - no immediate toast
    onSuccess()
    onClose()
  }

  const addPaymentMethodAndSubscribe = async () => {
    if (!stripe || !elements) {
      throw new Error('Payment system not ready')
    }

    // Validate required fields
    if (!billingDetails.name.trim()) {
      throw new Error('Name is required')
    }

    if (!billingDetails.email.trim()) {
      throw new Error('Email is required')
    }

    const card = elements.getElement(CardElement)
    if (!card) {
      throw new Error('Card element not found')
    }

    // Create payment method
    const result = await stripe.createPaymentMethod({
      type: 'card',
      card: card,
      billing_details: {
        name: billingDetails.name,
        email: billingDetails.email
      }
    })

    if (result.error) {
      throw new Error(result.error.message)
    }

    // Add payment method and create subscription in a transaction
    const response = await fetch('/api/billing/subscribe-with-payment-method', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        paymentMethodId: result.paymentMethod.id,
        planId,
        isYearly
      })
    })

    const data = await response.json()

    if (!response.ok) {
      // Extract detailed error message from server response
      const errorMessage = data.error || data.message || 'Failed to create subscription'
      throw new Error(errorMessage)
    }

    // Success will be handled by webhook - no immediate toast
    onSuccess()
    onClose()
  }



  return (
    <div className="p-5">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Compact Plan Header */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-white/5 to-white/10 border border-white/10">
                      <div>
              <h3 className="font-semibold text-white">{planName} Plan</h3>
              <p className="text-sm text-gray-400">
                ${planPrice}/month{isYearly ? ` billed yearly ($${(planPrice * 12).toFixed(0)} total)` : ''}
                {isYearly && <span className="ml-2 text-xs text-green-400">Save 15%</span>}
              </p>
            </div>
        </div>

        {isLoadingPaymentMethods && (
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-t-transparent border-gray-400 rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Checking payment methods...</p>
            </div>
          </div>
        )}

        {!isLoadingPaymentMethods && !hasPaymentMethod && (
          <div className="space-y-4">
            {/* Compact Billing Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={billingDetails.name}
                  onChange={(e) => handleBillingChange('name', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:border-blue-400/50 focus:outline-none transition-colors"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={billingDetails.email}
                  onChange={(e) => handleBillingChange('email', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:border-blue-400/50 focus:outline-none transition-colors"
                  placeholder="john@example.com"
                  required
                />
              </div>
            </div>

            {/* Card Information */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-300">
                Card Information
              </label>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 transition-colors focus-within:border-blue-400/50">
                <CardElement
                  options={{
                    style: {
                      base: {
                        fontSize: '14px',
                        color: '#ffffff',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontSmoothing: 'antialiased',
                        '::placeholder': {
                          color: '#9ca3af',
                        },
                        ':-webkit-autofill': {
                          color: '#ffffff',
                        },
                      },
                      invalid: {
                        color: '#ef4444',
                      },
                      complete: {
                        color: '#10b981',
                      },
                    },
                    hidePostalCode: false,
                  }}
                />
              </div>
              
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <Lock className="w-3 h-3 text-gray-400" />
                <p className="text-xs text-gray-400">
                  Secured by Stripe encryption
                </p>
              </div>
            </div>
          </div>
        )}

        {!isLoadingPaymentMethods && hasPaymentMethod && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-400 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Payment method attached
            </p>
          </div>
        )}

        {/* Compact Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading || isLoadingPaymentMethods}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!stripe || loading || isLoadingPaymentMethods}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 relative overflow-hidden flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(147, 51, 234, 0.8) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              transform: 'translateY(0)'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                
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
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }
            }}
          >
            {/* Shimmer effect */}
            <div 
              className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                transform: 'translateX(-100%)'
              }}
            ></div>
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : isLoadingPaymentMethods ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>Subscribe</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function SubscriptionDialog({ 
  isOpen, 
  onClose, 
  onSuccess, 
  onError,
  planId, 
  planName, 
  planPrice, 
  hasPaymentMethod,
  isLoadingPaymentMethods = false,
  isYearly = false
}: SubscriptionDialogProps) {
  // Handle escape key to close dialog
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen || !EnvironmentConfig.stripe.enabled) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div
        className="w-full max-w-sm overflow-hidden rounded-xl border shadow-2xl"
        style={{
          backgroundColor: 'rgba(20, 20, 20, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        }}
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">Subscribe</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Content - Only render if Stripe is enabled */}
        {EnvironmentConfig.stripe.enabled && (
          <Elements stripe={stripePromise}>
            <CheckoutForm 
              onClose={onClose} 
              onSuccess={onSuccess} 
              onError={onError}
              planId={planId}
              planName={planName}
              planPrice={planPrice}
              hasPaymentMethod={hasPaymentMethod}
              isLoadingPaymentMethods={isLoadingPaymentMethods}
              isYearly={isYearly}
            />
          </Elements>
        )}
      </div>
    </div>
  )
} 