import type { Metadata } from 'next'
import './globals.css'
import { Inter } from 'next/font/google'
import { Providers } from './components/Providers'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true,
})

export const metadata: Metadata = {
  metadataBase: new URL('https://devassistant.io'),
  title: {
    default: 'DevAssistant.io - AI App & Website Builder | Create Apps & SEO Sites with AI',
    template: '%s | DevAssistant.io - AI App & Website Builder'
  },
  description: 'Build production-ready web applications, SEO-optimized websites, and SaaS platforms by chatting with AI. Export-first, PR-only workflow. Own your code, deploy anywhere.',
  keywords: [
    'AI app builder',
    'AI website builder',
    'SEO website builder',
    'no-code development',
    'low-code platform',
    'AI code generation',
    'web app builder',
    'SaaS builder',
    'React app generator',
    'Next.js builder',
    'AI development tool',
    'code export',
    'production deployment',
    'AI assistant',
    'automated coding',
    'visual development',
    'rapid prototyping',
    'SEO optimization'
  ],
  authors: [{ name: 'DevAssistant.io Team', url: 'https://devassistant.io' }],
  creator: 'DevAssistant.io',
  publisher: 'DevAssistant.io',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  category: 'Technology',
  classification: 'AI Development Platform',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/safari-pinned-tab.svg', color: '#8b5cf6' },
    ],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://devassistant.io',
    siteName: 'DevAssistant.io',
    title: 'DevAssistant.io - AI App & Website Builder | Create Apps & SEO Sites with AI',
    description: 'Build production-ready web applications, SEO-optimized websites, and SaaS platforms by chatting with AI. Export-first, PR-only workflow.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevAssistant.io - AI App & Website Builder',
        type: 'image/png',
      },
      {
        url: '/og-image-square.png',
        width: 1200,
        height: 1200,
        alt: 'DevAssistant.io - AI App & Website Builder',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@devassistant_io',
    creator: '@devassistant_io',
    title: 'DevAssistant.io - AI App & Website Builder | Create Apps & SEO Sites with AI',
    description: 'Build production-ready web applications, SEO-optimized websites, and SaaS platforms by chatting with AI. Export-first, PR-only workflow.',
    images: ['/twitter-image.png'],
  },
  alternates: {
    canonical: 'https://devassistant.io',
    languages: {
      'en-US': 'https://devassistant.io',
    },
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
    yahoo: 'your-yahoo-verification-code',
    other: {
      'msvalidate.01': 'your-bing-verification-code',
    },
  },
  other: {
    'theme-color': '#8b5cf6',
    'color-scheme': 'dark light',
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'DevAssistant.io',
    'application-name': 'DevAssistant.io',
    'msapplication-TileColor': '#8b5cf6',
    'msapplication-config': '/browserconfig.xml',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* DNS prefetch for performance */}
        <link rel="dns-prefetch" href="//api.devassistant.io" />
        <link rel="dns-prefetch" href="//cdn.devassistant.io" />
        
        {/* Structured Data - Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "DevAssistant.io",
              "url": "https://devassistant.io",
              "logo": "https://devassistant.io/logo.png",
              "description": "AI-powered app and website builder for creating production-ready web applications and SEO-optimized websites",
              "foundingDate": "2024",
              "sameAs": [
                "https://twitter.com/devassistant_io",
                "https://github.com/devassistant-io"
              ],
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer service",
                "url": "https://devassistant.io/contact"
              }
            })
          }}
        />
        
        {/* Structured Data - SoftwareApplication */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "DevAssistant.io AI App & Website Builder",
              "applicationCategory": "DeveloperApplication",
              "operatingSystem": "Web Browser",
              "description": "AI-powered no-code/low-code platform for building web applications, SEO-optimized websites, and SaaS platforms",
              "url": "https://devassistant.io",
              "screenshot": "https://devassistant.io/screenshot.png",
              "softwareVersion": "1.0",
              "datePublished": "2024-01-01",
              "author": {
                "@type": "Organization",
                "name": "DevAssistant.io"
              },
              "offers": [
                {
                  "@type": "Offer",
                  "name": "Free Plan",
                  "price": "0",
                  "priceCurrency": "USD",
                  "description": "200K daily tokens, basic AI assistance"
                },
                {
                  "@type": "Offer",
                  "name": "Starter Plan",
                  "price": "20",
                  "priceCurrency": "USD",
                  "billingIncrement": "Month",
                  "description": "12M monthly tokens, advanced AI assistance, private projects"
                },
                {
                  "@type": "Offer",
                  "name": "Business Plan",
                  "price": "50",
                  "priceCurrency": "USD",
                  "billingIncrement": "Month",
                  "description": "35M monthly tokens, enterprise features, team collaboration"
                }
              ],
              "featureList": [
                "AI-powered code generation",
                "Export-first development",
                "Live app previews",
                "GitHub integration",
                "Production deployments",
                "Real-time collaboration",
                "Multi-framework support"
              ]
            })
          }}
        />
        
        {/* Structured Data - WebSite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "DevAssistant.io",
              "url": "https://devassistant.io",
              "description": "AI App Builder - Create production-ready applications with AI",
              "potentialAction": {
                "@type": "SearchAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": "https://devassistant.io/search?q={search_term_string}"
                },
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
        
        {/* Performance and Security */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
        <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
        
        {/* Suppress WebContainer warnings */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Suppress WebContainer preload warnings
              const originalWarn = console.warn;
              console.warn = function(...args) {
                const message = args.join(' ');
                if (message.includes('preloaded using link preload but not used') && 
                    (message.includes('w-corp-staticblitz.com') || message.includes('worker'))) {
                  return; // Suppress WebContainer worker preload warnings
                }
                originalWarn.apply(console, args);
              };
            `
          }}
        />
      </head>
      <body className={`h-full antialiased ${inter.className}`}>
        {children}
        <Providers />
      </body>
    </html>
  )
} 