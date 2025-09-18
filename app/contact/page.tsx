'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, User, MessageSquare, Send, Check, AlertCircle } from 'lucide-react'
import PublicNavigation from '@/components/PublicNavigation'
import PublicFooter from '@/components/PublicFooter'

interface FormData {
  name: string
  email: string
  reason: string
  message: string
}

interface ValidationErrors {
  name?: string
  email?: string
  reason?: string
  message?: string
}

export default function ContactPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    reason: '',
    message: ''
  })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const steps = [
    {
      id: 'name',
      title: 'What\'s your name?',
      subtitle: 'Let us know how to address you',
      icon: User,
      type: 'text',
      placeholder: 'Enter your full name',
      field: 'name' as keyof FormData
    },
    {
      id: 'email',
      title: 'Your email address?',
      subtitle: 'We\'ll use this to get back to you',
      icon: Mail,
      type: 'email',
      placeholder: 'Enter your email address',
      field: 'email' as keyof FormData
    },
    {
      id: 'reason',
      title: 'How can we help?',
      subtitle: 'Select the reason for contacting us',
      icon: MessageSquare,
      type: 'select',
      field: 'reason' as keyof FormData,
      options: [
        'General Inquiry',
        'Technical Support',
        'Billing Question',
        'Feature Request',
        'Bug Report',
        'Partnership',
        'Other'
      ]
    },
    {
      id: 'message',
      title: 'Tell us more',
      subtitle: 'Provide details about your inquiry',
      icon: MessageSquare,
      type: 'textarea',
      placeholder: 'Describe your question or issue in detail...',
      field: 'message' as keyof FormData
    }
  ]

  const currentStepData = steps[currentStep]

  // Validation functions
  const validateName = (name: string): string | undefined => {
    if (!name.trim()) {
      return 'Name is required'
    }
    if (name.trim().length < 2) {
      return 'Name must be at least 2 characters long'
    }
    if (name.trim().length > 50) {
      return 'Name must be less than 50 characters'
    }
    if (!/^[a-zA-Z\s\-'\.]+$/.test(name.trim())) {
      return 'Name can only contain letters, spaces, hyphens, apostrophes, and periods'
    }
    return undefined
  }

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) {
      return 'Email is required'
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return 'Please enter a valid email address'
    }
    if (email.length > 254) {
      return 'Email address is too long'
    }
    return undefined
  }

  const validateReason = (reason: string): string | undefined => {
    if (!reason.trim()) {
      return 'Please select a reason for contacting us'
    }
    const validReasons = [
      'General Inquiry',
      'Technical Support', 
      'Billing Question',
      'Feature Request',
      'Bug Report',
      'Partnership',
      'Other'
    ]
    if (!validReasons.includes(reason)) {
      return 'Please select a valid reason'
    }
    return undefined
  }

  const validateMessage = (message: string): string | undefined => {
    if (!message.trim()) {
      return 'Message is required'
    }
    if (message.trim().length < 10) {
      return 'Message must be at least 10 characters long'
    }
    if (message.trim().length > 5000) {
      return 'Message must be less than 5000 characters'
    }
    return undefined
  }

  const validateCurrentStep = (): boolean => {
    const field = currentStepData.field
    const value = formData[field]
    let error: string | undefined

    switch (field) {
      case 'name':
        error = validateName(value)
        break
      case 'email':
        error = validateEmail(value)
        break
      case 'reason':
        error = validateReason(value)
        break
      case 'message':
        error = validateMessage(value)
        break
    }

    setErrors(prev => ({
      ...prev,
      [field]: error
    }))

    return !error
  }

  const validateAllFields = (): boolean => {
    const newErrors: ValidationErrors = {
      name: validateName(formData.name),
      email: validateEmail(formData.email),
      reason: validateReason(formData.reason),
      message: validateMessage(formData.message)
    }

    setErrors(newErrors)

    return !Object.values(newErrors).some(error => error !== undefined)
  }

  const handleInputChange = (value: string) => {
    const field = currentStepData.field
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }))
    }
  }

  const handleNext = () => {
    if (!validateCurrentStep()) {
      return
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleSubmit()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    // Final validation of all fields
    if (!validateAllFields()) {
      // Go back to first invalid field
      const errorFields = Object.entries(errors).filter(([_, error]) => error)
      if (errorFields.length > 0) {
        const firstErrorField = errorFields[0][0] as keyof FormData
        const stepIndex = steps.findIndex(step => step.field === firstErrorField)
        if (stepIndex !== -1) {
          setCurrentStep(stepIndex)
        }
      }
      return
    }

    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          reason: formData.reason,
          message: formData.message.trim()
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit form')
      }

      const result = await response.json()
      console.log('Form submitted successfully:', result)
      
      setIsSubmitted(true)
    } catch (error) {
      console.error('Error submitting form:', error)
      
      // Set a general error message
      setErrors(prev => ({
        ...prev,
        message: error instanceof Error ? error.message : 'Failed to send message. Please try again.'
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  const isCurrentStepValid = () => {
    const value = formData[currentStepData.field]
    return value && value.trim().length > 0 && !errors[currentStepData.field]
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && isCurrentStepValid()) {
      e.preventDefault()
      handleNext()
    }
  }

  const getCharacterCount = () => {
    if (currentStepData.field === 'message') {
      return formData.message.length
    }
    if (currentStepData.field === 'name') {
      return formData.name.length
    }
    return 0
  }

  const getMaxLength = () => {
    if (currentStepData.field === 'message') return 5000
    if (currentStepData.field === 'name') return 50
    return 0
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Background Image - Same as home page */}
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/background.png)' }}
        ></div>
        
        <div className="relative z-10">
          <PublicNavigation showHome={true} showChangelog={true} showContact={true} />
          
          <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
            <div className="max-w-md w-full text-center">
              <div className="luxury-card p-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-4">
                  Message Received!
                </h1>
                <p className="text-muted-foreground mb-8">
                  Thank you for reaching out. We've received your message and will follow up with you within 24 hours.
                </p>
                <Link
                  href="/"
                  className="button-enter inline-flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
          
          <PublicFooter 
            showTopBorder={false}
            topMargin="small"
            verticalPadding="none"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Image - Same as home page */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/background.png)' }}
      ></div>

      <div className="relative z-10">
        <PublicNavigation showHome={true} showChangelog={true} showContact={true} />

        {/* Main Content */}
        <main className="relative pt-16">
          <div className="mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-24 max-w-4xl">
            <div className="text-center mb-12">
              {/* Main Headline */}
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
                Get in <span className="gradient-text">Touch</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Have a question or need support? We're here to help you build amazing applications.
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">
                    Step {currentStep + 1} of {steps.length}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(((currentStep + 1) / steps.length) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-secondary/30 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-primary to-primary/80 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Form Card - Using luxury-card class like home page */}
              <div className="luxury-card p-8">
                {/* Step Header */}
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <currentStepData.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    {currentStepData.title}
                  </h2>
                  <p className="text-muted-foreground">
                    {currentStepData.subtitle}
                  </p>
                </div>

                {/* Form Input */}
                <div className="mb-6">
                  {currentStepData.type === 'select' ? (
                    <div className="space-y-3">
                      {currentStepData.options?.map((option) => (
                        <button
                          key={option}
                          onClick={() => handleInputChange(option)}
                          className={`w-full p-4 text-left rounded-xl border transition-all duration-200 ${
                            formData[currentStepData.field] === option
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border/20 bg-secondary/20 text-foreground hover:border-primary/30 hover:bg-primary/5'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : currentStepData.type === 'textarea' ? (
                    <div className="relative">
                      <textarea
                        value={formData[currentStepData.field]}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={currentStepData.placeholder}
                        rows={6}
                        maxLength={5000}
                        className={`w-full p-6 text-base luxury-card focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 resize-none transition-all duration-300 placeholder:text-muted-foreground/60 text-foreground ${
                          errors[currentStepData.field] ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20' : ''
                        }`}
                        autoFocus
                      />
                      <div className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                        {getCharacterCount()}/{getMaxLength()}
                      </div>
                    </div>
                  ) : (
                    <input
                      type={currentStepData.type}
                      value={formData[currentStepData.field]}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={currentStepData.placeholder}
                      maxLength={currentStepData.field === 'name' ? 50 : undefined}
                      className={`w-full p-6 text-base luxury-card focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 transition-all duration-300 placeholder:text-muted-foreground/60 text-foreground ${
                        errors[currentStepData.field] ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20' : ''
                      }`}
                      autoFocus
                    />
                  )}
                  
                  {/* Character count for name field */}
                  {currentStepData.field === 'name' && (
                    <div className="text-right mt-1">
                      <span className="text-xs text-muted-foreground">
                        {getCharacterCount()}/{getMaxLength()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {errors[currentStepData.field] && (
                  <div className="mb-6 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errors[currentStepData.field]}</span>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex gap-4">
                  {currentStep > 0 && (
                    <button
                      onClick={handleBack}
                      className="flex-1 button-secondary"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    disabled={!isCurrentStepValid() || isSubmitting}
                    className="flex-1 button-enter disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : currentStep === steps.length - 1 ? (
                      <>
                        <Send className="w-4 h-4" />
                        Send Message
                      </>
                    ) : (
                      'Next'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        <PublicFooter 
          showTopBorder={false}
          topMargin="small"
          verticalPadding="none"
        />
      </div>
    </div>
  )
} 