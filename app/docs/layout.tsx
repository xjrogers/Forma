import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Documentation - AI App Builder Guide',
  description: 'Complete guide to building applications with DevAssistant.io AI App Builder. Learn how to create web apps, SaaS platforms, and websites using AI-powered development.',
  keywords: [
    'AI app builder documentation',
    'no-code tutorial',
    'AI development guide',
    'devassistant.io docs',
    'app builder tutorial',
    'AI coding guide',
    'web development AI',
    'SaaS builder guide',
    'React AI generator',
    'Next.js AI builder'
  ],
  openGraph: {
    title: 'DevAssistant.io Documentation - AI App Builder Guide',
    description: 'Complete guide to building applications with DevAssistant.io AI App Builder. Learn AI-powered development.',
    url: 'https://devassistant.io/docs',
    images: [
      {
        url: '/og-docs.png',
        width: 1200,
        height: 630,
        alt: 'DevAssistant.io Documentation',
      },
    ],
  },
  twitter: {
    title: 'DevAssistant.io Documentation - AI App Builder Guide',
    description: 'Complete guide to building applications with DevAssistant.io AI App Builder. Learn AI-powered development.',
    images: ['/twitter-docs.png'],
  },
  alternates: {
    canonical: 'https://devassistant.io/docs',
  },
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Structured Data for Documentation */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "TechArticle",
            "headline": "DevAssistant.io AI App Builder Documentation",
            "description": "Complete guide to building applications with AI-powered development platform",
                          "author": {
                "@type": "Organization",
                "name": "DevAssistant.io"
              },
                          "publisher": {
                "@type": "Organization",
                "name": "DevAssistant.io",
                              "logo": {
                  "@type": "ImageObject",
                  "url": "https://devassistant.io/logo.png"
                }
            },
            "datePublished": "2024-01-01",
            "dateModified": new Date().toISOString(),
                          "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": "https://devassistant.io/docs"
              },
            "articleSection": "Documentation",
            "keywords": [
              "AI app builder",
              "no-code development",
              "documentation",
              "tutorial",
              "guide"
            ]
          })
        }}
      />
      {children}
    </>
  )
} 