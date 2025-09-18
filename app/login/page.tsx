'use client'

import { useState } from 'react'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { authService } from '@/lib/auth'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'login' | 'verify'>('login')
  const [userId, setUserId] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await authService.login(email, password)
      
      if (response.requiresVerification) {
        setUserId(response.userId || '')
        setStep('verify')
        return
      }

      // Redirect to home page on success
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      await authService.verifyEmail(userId, verificationCode)
      toast.success('Email verified successfully')
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    setIsResending(true)
    setError('')

    try {
      await authService.resendVerification(userId)
      toast.success('New verification code sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code')
    } finally {
      setIsResending(false)
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
              {/* Login Form */}
              <div className="border border-border/40 rounded-2xl overflow-hidden backdrop-blur-md" style={{ 
                backgroundColor: 'rgba(30, 30, 30, 0.5)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                transform: 'translateY(-4px)'
              }}>
                {/* Header */}
                <div className="p-8 pb-6 text-center">
                  <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">
                    {step === 'login' ? 'Welcome back' : 'Verify your email'}
                  </h1>
                  <p className="text-muted-foreground">
                    {step === 'login' 
                      ? 'Sign in to continue building with DevAssistant.io'
                      : `We've sent a verification code to ${email}`
                    }
                  </p>
                </div>

                {/* Form */}
                <div className="px-8 pb-8">
                  {error && (
                    <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-sm">
                      <p className="text-red-400">{error}</p>
                    </div>
                  )}

                  {step === 'login' ? (
                    <form onSubmit={handleLogin} className="space-y-6">
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

                      <div className="space-y-2">
                        <label htmlFor="password" className="block text-sm font-semibold text-foreground/90">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-6 py-4 pr-12 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm"
                            placeholder="Enter your password"
                            required
                            disabled={isLoading}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full button-luxury mt-8 py-4 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerify} className="space-y-6">
                      <div className="space-y-2">
                        <label htmlFor="verificationCode" className="block text-sm font-semibold text-foreground/90">
                          Verification Code
                        </label>
                        <input
                          type="text"
                          id="verificationCode"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          className="w-full px-4 py-3 text-sm transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm font-mono tracking-wider"
                          placeholder="000000"
                          required
                          maxLength={6}
                          pattern="[0-9]{6}"
                          disabled={isLoading}
                        />
                      </div>

                      <div className="space-y-4">
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full button-luxury py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading ? 'Verifying...' : 'Verify email'}
                        </button>

                        <div className="flex items-center justify-center space-x-2 text-sm">
                          <button
                            type="button"
                            onClick={() => setStep('login')}
                            className="app-link font-medium"
                          >
                            Back to login
                          </button>
                          <span className="text-muted-foreground/50">|</span>
                          <button
                            type="button"
                            onClick={handleResendCode}
                            disabled={isResending}
                            className="app-link font-medium disabled:opacity-50"
                          >
                            {isResending ? 'Sending...' : 'Resend code'}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  {/* Footer Links */}
                  {step === 'login' && (
                    <div className="mt-4 text-center">
                      <div className="flex items-center justify-center space-x-2 text-sm">
                        <Link href="/signup" className="app-link font-medium">
                          Sign up
                        </Link>
                        <span className="text-muted-foreground/50">|</span>
                        <Link href="/forgot-password" className="app-link font-medium">
                          Forgot password
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
} 