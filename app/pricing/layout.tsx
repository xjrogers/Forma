import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing Plans - AI App Builder',
  description: 'Choose the perfect plan for your AI app development needs. Free plan with 200K daily tokens, Starter at $20/month, Business at $50/month. Build unlimited apps with AI.',
  keywords: [
    'AI app builder pricing',
    'no-code pricing',
    'AI development cost',
    'app builder plans',
    'SaaS builder pricing',
    'AI coding subscription',
    'development platform pricing',
    'monthly tokens',
    'AI assistant pricing',
    'forma pricing',
    'AI development subscription'
  ],
  openGraph: {
    title: 'DevAssistant.io Pricing - AI App Builder Plans',
    description: 'Choose the perfect plan for your AI app development needs. Free plan available, paid plans starting at $20/month.',
    url: 'https://devassistant.io/pricing',
    images: [
      {
        url: '/og-pricing.png',
        width: 1200,
        height: 630,
        alt: 'DevAssistant.io Pricing Plans',
      },
    ],
  },
  twitter: {
    title: 'DevAssistant.io Pricing - AI App Builder Plans',
    description: 'Choose the perfect plan for your AI app development needs. Free plan available, paid plans starting at $20/month.',
    images: ['/twitter-pricing.png'],
  },
  alternates: {
    canonical: 'https://devassistant.io/pricing',
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Structured Data for Pricing */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "DevAssistant.io AI App Builder",
            "description": "AI-powered platform for building web applications and SaaS products",
                          "brand": {
                "@type": "Brand",
                "name": "DevAssistant.io"
              },
            "offers": [
              {
                "@type": "Offer",
                "name": "Free Plan",
                "price": "0",
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock",
                "description": "200K daily tokens, basic AI assistance, public projects only",
                "priceSpecification": {
                  "@type": "PriceSpecification",
                  "price": "0",
                  "priceCurrency": "USD"
                }
              },
              {
                "@type": "Offer",
                "name": "Starter Plan",
                "price": "20",
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock",
                "description": "12M monthly tokens, advanced AI assistance, private projects, 1 deployment",
                "priceSpecification": {
                  "@type": "PriceSpecification",
                  "price": "20",
                  "priceCurrency": "USD",
                  "billingIncrement": "Month"
                }
              },
              {
                "@type": "Offer",
                "name": "Business Plan",
                "price": "50",
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock",
                "description": "35M monthly tokens, enterprise features, team collaboration, 3 deployments",
                "priceSpecification": {
                  "@type": "PriceSpecification",
                  "price": "50",
                  "priceCurrency": "USD",
                  "billingIncrement": "Month"
                }
              }
            ]
          })
        }}
      />
      {children}
    </>
  )
} 