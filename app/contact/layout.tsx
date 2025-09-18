import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Us - AI App Builder Support',
  description: 'Get in touch with the DevAssistant.io team. Contact us for support, questions, or feedback about our AI app builder platform. We\'re here to help you build amazing applications.',
  keywords: [
    'contact devassistant.io',
    'AI app builder support',
    'devassistant.io support',
    'customer service',
    'technical support',
    'app builder help',
    'AI development support',
    'devassistant.io contact'
  ],
  openGraph: {
    title: 'Contact DevAssistant.io - AI App Builder Support',
    description: 'Get in touch with the DevAssistant.io team for support, questions, or feedback about our AI app builder platform.',
    url: 'https://devassistant.io/contact',
    images: [
      {
        url: '/og-contact.png',
        width: 1200,
        height: 630,
        alt: 'Contact DevAssistant.io',
      },
    ],
  },
  twitter: {
    title: 'Contact DevAssistant.io - AI App Builder Support',
    description: 'Get in touch with the DevAssistant.io team for support, questions, or feedback about our AI app builder platform.',
    images: ['/twitter-contact.png'],
  },
  alternates: {
    canonical: 'https://devassistant.io/contact',
  },
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Structured Data for Contact */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ContactPage",
            "name": "Contact DevAssistant.io",
            "description": "Get in touch with the DevAssistant.io team for support and inquiries",
            "url": "https://devassistant.io/contact",
                          "mainEntity": {
                "@type": "Organization",
                "name": "DevAssistant.io",
                "url": "https://devassistant.io",
                              "contactPoint": {
                  "@type": "ContactPoint",
                  "contactType": "customer service",
                  "availableLanguage": "English",
                  "url": "https://devassistant.io/contact"
                }
            }
          })
        }}
      />
      {children}
    </>
  )
} 