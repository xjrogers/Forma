/**
 * Environment detection utilities
 * Helps separate WebContainer preview from production environment
 */

export const Environment = {
  /**
   * Check if we're running in a WebContainer environment
   * This should ONLY return true for actual WebContainer previews, not the main Forma app
   */
  isWebContainer(): boolean {
    if (typeof window === 'undefined') return false;
    
    // Only consider it WebContainer if we have specific WebContainer indicators
    return (
      // Check for WebContainer-specific hostnames
      window.location.hostname.includes('webcontainer') ||
      window.location.hostname.includes('stackblitz') ||
      window.location.hostname.includes('codesandbox') ||
      // Check for WebContainer-specific URL patterns
      window.location.hostname.includes('.webcontainer.') ||
      // Check if we're in the builder page's preview iframe specifically
      (window.location.pathname === '/dashboard/builder' && 
       window !== window.top) ||
      // Check for WebContainer-specific globals that are set by the preview system
      (typeof window !== 'undefined' && (
        // @ts-ignore - WebContainer specific globals
        window.__webcontainer__ || 
        // @ts-ignore - Check for preview-specific elements
        document.querySelector('[data-webcontainer-preview]')
      ))
    );
  },

  /**
   * Check if we're in production environment
   */
  isProduction(): boolean {
    if (typeof window === 'undefined') return process.env.NODE_ENV === 'production';
    
    return (
      process.env.NODE_ENV === 'production' &&
      !this.isWebContainer() &&
      (window.location.hostname.includes('forma.') || 
       window.location.hostname.includes('your-domain.'))
    );
  },

  /**
   * Check if we're in development (but not WebContainer)
   */
  isDevelopment(): boolean {
    return !this.isProduction() && !this.isWebContainer();
  },

  /**
   * Check if Stripe should be loaded
   */
  shouldLoadStripe(): boolean {
    return !this.isWebContainer() && !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  },

  /**
   * Check if WebContainer features should be enabled
   */
  shouldEnableWebContainer(): boolean {
    return this.isWebContainer() || this.isDevelopment();
  },

  /**
   * Get environment name for debugging
   */
  getEnvironmentName(): string {
    if (this.isProduction()) return 'production';
    if (this.isWebContainer()) return 'webcontainer';
    if (this.isDevelopment()) return 'development';
    return 'unknown';
  }
};

/**
 * Environment-specific configuration
 */
export const EnvironmentConfig = {
  // Stripe configuration
  stripe: {
    enabled: Environment.shouldLoadStripe(),
    publishableKey: Environment.shouldLoadStripe() ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY : null
  },

  // WebContainer configuration  
  webContainer: {
    enabled: Environment.shouldEnableWebContainer(),
    // Disable COEP headers in WebContainer
    headers: Environment.isWebContainer() ? {
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
    } : {}
  },

  // Feature flags based on environment
  features: {
    payments: Environment.shouldLoadStripe(),
    preview: Environment.shouldEnableWebContainer(),
    analytics: Environment.isProduction(),
    debugging: Environment.isDevelopment()
  }
}; 