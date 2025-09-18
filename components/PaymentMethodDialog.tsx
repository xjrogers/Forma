'use client'

import { useState, useEffect } from 'react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { toast } from 'sonner'
import { X, Lock } from 'lucide-react'
import { Environment, EnvironmentConfig } from '@/lib/environment'

// Conditionally load Stripe based on environment
const stripePromise = EnvironmentConfig.stripe.enabled 
  ? loadStripe(EnvironmentConfig.stripe.publishableKey!).catch((error) => {
      console.error('Failed to load Stripe:', error);
      toast.error('Payment system unavailable', {
        description: 'Unable to load payment processing. Please refresh the page and try again.'
      });
      return null;
    })
  : Promise.resolve(null);

interface PaymentMethodDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function CheckoutForm({ onClose, onSuccess }: Omit<PaymentMethodDialogProps, 'isOpen'>) {
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

    if (!stripe || !elements) {
      toast.error('Payment system not ready')
      return
    }

    const card = elements.getElement(CardElement)
    
    if (!card) {
      toast.error('Card element not found')
      return
    }

    // Validate required fields
    if (!billingDetails.name.trim()) {
      toast.error('Name is required')
      return
    }

    if (!billingDetails.email.trim()) {
      toast.error('Email is required')
      return
    }

    setLoading(true)

    try {
      const result = await stripe.createPaymentMethod({
        type: 'card',
        card: card,
        billing_details: {
          name: billingDetails.name,
          email: billingDetails.email
        }
      })

      if (result.error) {
        toast.error(result.error.message)
      } else {
        const response = await fetch('/api/billing/payment-methods', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            paymentMethodId: result.paymentMethod.id
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to save payment method')
        }

        toast.success('Payment method added successfully!')
        onSuccess()
        onClose()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unexpected error occurred')
    }

    setLoading(false)
  }

  return (
    <div className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          {/* Billing Information */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={billingDetails.name}
                  onChange={(e) => handleBillingChange('name', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder-muted-foreground focus:border-white/20 focus:outline-none transition-colors"
                  placeholder="Full name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={billingDetails.email}
                  onChange={(e) => handleBillingChange('email', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder-muted-foreground focus:border-white/20 focus:outline-none transition-colors"
                  placeholder="email@example.com"
                  required
                />
              </div>
            </div>
          </div>

          {/* Card Information */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Card Information *
            </label>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10 transition-colors">
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
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
                  hidePostalCode: false, // Let Stripe handle postal code
                }}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 mt-3">
            <Lock className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Your card and billing information are encrypted and secure
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-foreground hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!stripe || loading}
            className="relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 overflow-hidden flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
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
            ) : (
              <span>Add Card</span>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function PaymentMethodDialog({ isOpen, onClose, onSuccess }: PaymentMethodDialogProps) {
  if (!isOpen || !EnvironmentConfig.stripe.enabled) return null

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
          <h2 className="text-lg font-semibold text-foreground">Add Payment Method</h2>
        </div>

        {/* Content - Only render if Stripe is enabled */}
        {EnvironmentConfig.stripe.enabled && (
          <Elements stripe={stripePromise}>
            <CheckoutForm onClose={onClose} onSuccess={onSuccess} />
          </Elements>
        )}
      </div>
    </div>
  )
} 