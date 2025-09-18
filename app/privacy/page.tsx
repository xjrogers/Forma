'use client'

import PublicNavigation from '@/components/PublicNavigation'
import PublicFooter from '@/components/PublicFooter'

export default function PrivacyPolicy() {
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
                Privacy <span className="gradient-text">Policy</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg text-muted-foreground mb-4 max-w-2xl mx-auto">
                Your privacy is important to us. Learn how we collect, use, and protect your information.
              </p>
              <p className="text-sm text-muted-foreground/70">
                Last updated: January 15, 2025
              </p>
            </div>

            {/* Content Card - Using luxury-card class like home page */}
            <div className="luxury-card p-8 md:p-12">
              <div className="prose prose-invert max-w-none">
                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">1. Information We Collect</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    We collect information you provide directly to us, such as when you create an account, use our services, or contact us for support.
                  </p>
                  
                  <h3 className="text-xl font-semibold text-foreground mb-4 mt-8">Personal Information</h3>
                  <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                    <li>Name and email address</li>
                    <li>Account credentials</li>
                    <li>Payment information (processed securely through Stripe)</li>
                    <li>Profile information and preferences</li>
                  </ul>

                  <h3 className="text-xl font-semibold text-foreground mb-4 mt-8">Usage Information</h3>
                  <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                    <li>Projects and code you create</li>
                    <li>Service usage patterns and preferences</li>
                    <li>Device information and IP addresses</li>
                    <li>Log data and analytics</li>
                  </ul>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">2. How We Use Your Information</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    We use the information we collect to provide, maintain, and improve our services. Specifically, we use your information to:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                    <li>Provide and deliver the services you request</li>
                    <li>Process transactions and send related information</li>
                    <li>Send technical notices and support messages</li>
                    <li>Respond to your comments and questions</li>
                    <li>Improve our services and develop new features</li>
                    <li>Protect against fraud and abuse</li>
                  </ul>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">3. Information Sharing</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy.
                  </p>
                  
                  <h3 className="text-xl font-semibold text-foreground mb-4 mt-8">Service Providers</h3>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    We may share your information with trusted third-party service providers who assist us in operating our service, such as:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                    <li>Payment processing (Stripe)</li>
                    <li>Cloud hosting and infrastructure</li>
                    <li>Email delivery services</li>
                    <li>Analytics and monitoring tools</li>
                  </ul>

                  <h3 className="text-xl font-semibold text-foreground mb-4 mt-8">Legal Requirements</h3>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    We may disclose your information if required by law or in response to valid requests by public authorities.
                  </p>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">4. Data Security</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                    <li>Encryption of data in transit and at rest</li>
                    <li>Regular security assessments and updates</li>
                    <li>Access controls and authentication</li>
                    <li>Secure payment processing through Stripe</li>
                  </ul>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">5. Data Retention</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this policy. We may also retain certain information as required by law or for legitimate business purposes.
                  </p>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">6. Your Rights</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    Depending on your location, you may have certain rights regarding your personal information, including:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
                    <li>Access to your personal information</li>
                    <li>Correction of inaccurate information</li>
                    <li>Deletion of your personal information</li>
                    <li>Portability of your data</li>
                    <li>Objection to processing</li>
                  </ul>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    To exercise these rights, please contact us at{' '}
                    <a href="mailto:info@devassistant.io" className="text-primary hover:text-primary/80 transition-colors">
                  info@devassistant.io
                    </a>
                  </p>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">7. Cookies and Tracking</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    We use cookies and similar tracking technologies to enhance your experience on our service. You can control cookie settings through your browser preferences.
                  </p>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">8. International Data Transfers</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your information during such transfers.
                  </p>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">9. Children's Privacy</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
                  </p>
                </section>

                <section className="mb-12">
                  <h2 className="text-2xl font-bold text-foreground mb-6">10. Changes to This Policy</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date.
                  </p>
                </section>

                <section className="mb-0">
                  <h2 className="text-2xl font-bold text-foreground mb-6">11. Contact Us</h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    If you have any questions about this Privacy Policy, please contact us at{' '}
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