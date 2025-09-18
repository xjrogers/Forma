'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [isLoading, setIsLoading] = useState(false)

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send reset code')
      }

      toast.success('Reset code sent to your email')
      setStep('verify')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send reset code')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, resetCode, newPassword })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reset password')
      }

      toast.success('Password reset successfully')
      router.push('/login')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reset password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
        style={{ backgroundImage: 'url(/background.png)' }}
      ></div>
      
      <div className="relative z-10">
        {/* Main Content */}
        <main className="relative">
          <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full">
              {/* Forgot Password Form */}
              <div className="border border-border/40 rounded-2xl overflow-hidden backdrop-blur-md" style={{ 
                backgroundColor: 'rgba(30, 30, 30, 0.5)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                transform: 'translateY(-4px)'
              }}>
                {/* Header */}
                <div className="p-8 pb-6 text-center">
                  <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">
                    {step === 'request' ? 'Forgot password?' : 'Reset your password'}
                  </h1>
                  <p className="text-muted-foreground">
                    {step === 'request' 
                      ? 'Enter your email address and we\'ll send you a verification code'
                      : 'Enter the verification code sent to your email and your new password'
                    }
                  </p>
                </div>

                {/* Form */}
                <div className="px-8 pb-8">
                  {step === 'request' ? (
                    <form onSubmit={handleRequestReset} className="space-y-6">
                      <div className="space-y-2">
                        <label htmlFor="email" className="block text-sm font-semibold text-foreground/90">
                          Email Address
                        </label>
                        <input
                          type="email"
                          id="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-6 py-4 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm"
                          placeholder="you@company.com"
                          required
                          disabled={isLoading}
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full button-luxury mt-8 py-4 text-base font-semibold"
                        disabled={isLoading}
                      >
                        {isLoading ? 'Sending...' : 'Send verification code'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleResetPassword} className="space-y-6">
                      <div className="space-y-2">
                        <label htmlFor="resetCode" className="block text-sm font-semibold text-foreground/90">
                          Verification Code
                        </label>
                        <input
                          type="text"
                          id="resetCode"
                          value={resetCode}
                          onChange={(e) => setResetCode(e.target.value)}
                          className="w-full px-6 py-4 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm font-mono tracking-wider"
                          placeholder="000000"
                          required
                          maxLength={6}
                          pattern="[0-9]{6}"
                          disabled={isLoading}
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="newPassword" className="block text-sm font-semibold text-foreground/90">
                          New Password
                        </label>
                        <input
                          type="password"
                          id="newPassword"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-6 py-4 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm"
                          placeholder="Enter your new password"
                          required
                          minLength={8}
                          disabled={isLoading}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Must be at least 8 characters long
                        </p>
                      </div>

                      <div className="space-y-4">
                        <button
                          type="submit"
                          className="w-full button-luxury py-4 text-base font-semibold"
                          disabled={isLoading}
                        >
                          {isLoading ? 'Resetting...' : 'Reset password'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setStep('request')
                            setResetCode('')
                            setNewPassword('')
                          }}
                          className="w-full py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                          disabled={isLoading}
                        >
                          Request new code
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Footer Links */}
                  <div className="mt-4 text-center">
                    <div className="flex items-center justify-center space-x-2 text-sm">
                      <Link href="/login" className="app-link font-medium">
                        Back to login
                      </Link>
                      <span className="text-muted-foreground/50">|</span>
                      <Link href="/signup" className="app-link font-medium">
                        Sign up
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
} 