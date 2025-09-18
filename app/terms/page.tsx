'use client'

import PublicNavigation from '@/components/PublicNavigation'
import PublicFooter from '@/components/PublicFooter'

export default function TermsOfService() {
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
                Terms of <span className="gradient-text">Service</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg text-muted-foreground mb-4 max-w-2xl mx-auto">
                Please read these terms carefully before using DevAssistant.io
              </p>
              <p className="text-sm text-muted-foreground/70">
                Last updated: January 15, 2025
              </p>
            </div>

            {/* Content Card - Using luxury-card class like home page */}
            <div className="luxury-card p-8 md:p-12">
              <div className="prose prose-invert max-w-none">
                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">1. Acceptance of Terms</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    By accessing and using DevAssistant.io ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
                  </p>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">2. Description of Service</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    DevAssistant.io is an AI-powered application builder that helps users create web applications, mobile apps, and other software projects through natural language descriptions.
                  </p>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    The Service includes but is not limited to:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                    <li>AI-powered code generation</li>
                    <li>Project templates and frameworks</li>
                    <li>Deployment and hosting services</li>
                    <li>Collaboration tools</li>
                    <li>Documentation and support resources</li>
                  </ul>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">3. User Accounts</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    To access certain features of the Service, you may be required to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
                  </p>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.
                  </p>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">4. Acceptable Use</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    You agree not to use the Service for any unlawful purpose or in any way that could damage, disable, overburden, or impair the Service. Prohibited activities include but are not limited to:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                    <li>Violating any applicable laws or regulations</li>
                    <li>Infringing on intellectual property rights</li>
                    <li>Distributing malware or harmful code</li>
                    <li>Attempting to gain unauthorized access to systems</li>
                    <li>Harassing or threatening other users</li>
                  </ul>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">5. Intellectual Property</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    The Service and its original content, features, and functionality are owned by DevAssistant.io and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
                  </p>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    You retain ownership of any code, content, or projects you create using the Service. However, you grant us a limited license to host, store, and display your content as necessary to provide the Service.
                  </p>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">6. Privacy</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the Service, to understand our practices.
                  </p>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">7. Limitation of Liability</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    In no event shall DevAssistant.io, its directors, employees, partners, agents, suppliers, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your use of the Service.
                  </p>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">8. Termination</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    We may terminate or suspend your account and bar access to the Service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever, including without limitation if you breach the Terms.
                  </p>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">9. Changes to Terms</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect.
                  </p>
                </section>

                <section className="mb-0">
                  <h2 className="text-2xl font-bold text-foreground mb-6">10. Contact Information</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    If you have any questions about these Terms of Service, please contact us at{' '}
                    <a href="mailto:info@devassistant.io" className="text-primary hover:text-primary/80 transition-colors">
                    info@devassistant.io
                    </a>
                  </p>
                </section>
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