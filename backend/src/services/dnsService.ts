/**
 * DNS Management Service for Forma Deployments
 * Handles domain configuration and DNS records
 */

export interface DNSRecord {
  type: 'CNAME' | 'A' | 'AAAA' | 'TXT';
  name: string;
  value: string;
  ttl?: number;
}

export interface DomainConfig {
  domain: string;
  subdomain: string;
  fullDomain: string;
  target: string;
  type: 'A' | 'CNAME' | 'AAAA';
  records: DNSRecord[];
  status: 'pending' | 'active' | 'failed';
}

export class DNSService {
  private baseDomain: string;
  private dnsProvider: string;

  constructor() {
    this.baseDomain = process.env.FORMA_BASE_DOMAIN || 'forma.dev';
    this.dnsProvider = process.env.DNS_PROVIDER || 'cloudflare'; // cloudflare, route53, etc.
  }

  /**
   * Generate DNS configuration for a deployment
   */
  generateDNSConfig(subdomain: string, railwayUrl: string): DomainConfig {
    const fullDomain = `${subdomain}.${this.baseDomain}`;
    
    // Extract Railway's target from their URL
    const railwayTarget = railwayUrl.replace('https://', '').replace('http://', '');
    
    const records: DNSRecord[] = [
      {
        type: 'CNAME',
        name: subdomain,
        value: railwayTarget,
        ttl: 300 // 5 minutes for fast updates
      }
    ];

    return {
      domain: this.baseDomain,
      subdomain,
      fullDomain,
      target: railwayTarget,
      type: 'CNAME',
      records,
      status: 'pending'
    };
  }

  /**
   * Get DNS instructions for manual setup
   */
  getDNSInstructions(config: DomainConfig): string {
    const instructions = `
🌐 DNS Configuration for ${config.fullDomain}

To set up your domain, add these DNS records to your domain provider:

${config.records.map(record => `
📝 Record Type: ${record.type}
   Name: ${record.name}
   Value: ${record.value}
   TTL: ${record.ttl || 300} seconds
`).join('\n')}

🔧 Common DNS Providers:
• Cloudflare: Dashboard → DNS → Records
• Namecheap: Domain List → Manage → Advanced DNS
• GoDaddy: DNS Management → Records
• Route53: Hosted Zones → Create Record

⏱️ Propagation: Changes may take 5-60 minutes to take effect.
✅ Verification: Use 'dig ${config.fullDomain}' or online DNS checkers.
`;

    return instructions.trim();
  }

  /**
   * Verify DNS configuration is working
   */
  async verifyDNS(domain: string): Promise<boolean> {
    try {
      // Simple DNS resolution check
      const dns = require('dns').promises;
      await dns.lookup(domain);
      return true;
    } catch (error) {
      console.log(`DNS verification failed for ${domain}:`, error);
      return false;
    }
  }

  /**
   * Auto-configure DNS (if using supported provider)
   */
  async autoConfigureDNS(config: DomainConfig): Promise<boolean> {
    console.log(`🔧 Auto-configuring DNS for ${config.fullDomain}...`);
    
    try {
      switch (this.dnsProvider.toLowerCase()) {
        case 'cloudflare':
          return await this.configureCloudflare(config);
        case 'route53':
          return await this.configureRoute53(config);
        default:
          console.log(`⚠️ Auto-configuration not supported for ${this.dnsProvider}`);
          return false;
      }
    } catch (error) {
      console.error('DNS auto-configuration failed:', error);
      return false;
    }
  }

  /**
   * Configure DNS via Cloudflare API
   */
  private async configureCloudflare(config: DomainConfig): Promise<boolean> {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;

    if (!apiToken || !zoneId) {
      console.log('⚠️ Cloudflare credentials not configured');
      return false;
    }

    try {
      for (const record of config.records) {
        const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: record.type,
            name: record.name,
            content: record.value,
            ttl: record.ttl || 300
          })
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Cloudflare DNS creation failed:', error);
          return false;
        }
      }

      console.log(`✅ Cloudflare DNS configured for ${config.fullDomain}`);
      return true;
    } catch (error) {
      console.error('Cloudflare configuration error:', error);
      return false;
    }
  }

  /**
   * Configure DNS via AWS Route53
   */
  private async configureRoute53(config: DomainConfig): Promise<boolean> {
    // Implementation for Route53 would go here
    console.log(`⚠️ Route53 auto-configuration not yet implemented for domain: ${config.domain}`);
    console.log(`Target: ${config.target}, Type: ${config.type}`);
    return false;
  }

  /**
   * Get wildcard SSL certificate info
   */
  getSSLInfo(): string {
    return `
🔒 SSL Certificate Information

For ${this.baseDomain} deployments:
• SSL certificates are automatically provided by Railway
• Certificates are issued for each subdomain (*.${this.baseDomain})
• HTTPS is enforced by default
• Certificates auto-renew every 90 days

🛡️ Security Features:
• TLS 1.2+ only
• HSTS headers enabled
• Secure cipher suites
• Perfect Forward Secrecy
`;
  }
}

export default DNSService; 