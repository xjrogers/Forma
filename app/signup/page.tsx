'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { authService } from '@/lib/auth'
import { toast } from 'sonner'

export default function SignupPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [verificationCode, setVerificationCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'signup' | 'verify'>('signup')
  const [userId, setUserId] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    try {
      const response = await authService.register(
        formData.email, 
        formData.password, 
        formData.firstName, 
        formData.lastName
      )

      if (response.requiresVerification) {
        setUserId(response.user.id)
        setStep('verify')
        toast.success('Please check your email for verification code')
      } else {
        // Redirect to dashboard if no verification needed
        window.location.href = '/dashboard'
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
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
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    setIsLoading(true)
    setError('')

    try {
      await authService.resendVerification(userId)
      toast.success('New verification code sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code')
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
          <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
            <div className="max-w-md w-full">
              {/* Form Container */}
              <div className="border border-border/40 rounded-2xl overflow-hidden backdrop-blur-md" style={{ 
                backgroundColor: 'rgba(30, 30, 30, 0.5)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                transform: 'translateY(-4px)'
              }}>
                {/* Header */}
                <div className="p-6 pb-4 text-center">
                  <h1 className="text-2xl font-bold text-foreground tracking-tight mb-2">
                    {step === 'signup' ? 'Create your account' : 'Verify your email'}
                  </h1>
                  {step === 'verify' && (
                    <p className="text-muted-foreground text-sm">
                      We've sent a verification code to {formData.email}
                    </p>
                  )}
                </div>

                {/* Form */}
                <div className="px-6 pb-6">
                  {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  {step === 'signup' ? (
                    <form onSubmit={handleSignup} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="firstName" className="block text-sm font-semibold text-foreground/90">
                            First Name
                          </label>
                          <input
                            type="text"
                            id="firstName"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            className="w-full px-3 py-3 text-sm transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm"
                            placeholder="John"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="lastName" className="block text-sm font-semibold text-foreground/90">
                            Last Name
                          </label>
                          <input
                            type="text"
                            id="lastName"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            className="w-full px-3 py-3 text-sm transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm"
                            placeholder="Doe"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="email" className="block text-sm font-semibold text-foreground/90">
                          Email Address
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full px-4 py-3 text-sm transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm"
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
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full px-4 py-3 pr-10 text-sm transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm"
                            placeholder="Create a password"
                            required
                            disabled={isLoading}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="confirmPassword" className="block text-sm font-semibold text-foreground/90">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className="w-full px-4 py-3 pr-10 text-sm transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm"
                            placeholder="Confirm your password"
                            required
                            disabled={isLoading}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full button-luxury mt-6 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? 'Creating account...' : 'Create account'}
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

                        <button
                          type="button"
                          onClick={handleResendCode}
                          disabled={isLoading}
                          className="w-full py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Resend verification code
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Footer Links */}
                  <div className="mt-3 text-center">
                    <div className="flex items-center justify-center space-x-2 text-sm">
                      <span className="text-muted-foreground/70">Already have an account?</span>
                      <Link href="/login" className="app-link font-medium">
                        Sign in
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