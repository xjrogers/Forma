/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Builder page with any query params - Cross-Origin Isolation enabled
        source: '/dashboard/builder(\\?.*)?',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin'
          }
        ]
      }
    ]
  },
  webpack: (config) => {
    // Remove the Stripe external since we're using @stripe/stripe-js properly
    return config
  }
}

module.exports = nextConfig 