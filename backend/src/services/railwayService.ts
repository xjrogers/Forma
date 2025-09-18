interface RailwayProject {
  id: string;
  name: string;
  description?: string;
  teamId?: string;
}

interface RailwayService {
  id: string;
  name: string;
  projectId: string;
  templateServiceId?: string;
}

interface RailwayDeployment {
  id: string;
  serviceId: string;
  status: 'BUILDING' | 'SUCCESS' | 'FAILED' | 'CRASHED' | 'REMOVED';
  url?: string;
  createdAt: string;
}

export class RailwayDeploymentService {
  private static instance: RailwayDeploymentService;
  private apiToken: string;
  private baseUrl = 'https://backboard.railway.com/graphql/v2';
  private teamId: string; // Your Railway team ID

  private constructor() {
    this.apiToken = process.env.RAILWAY_API_TOKEN!;
    this.teamId = process.env.RAILWAY_TEAM_ID || '';
    
    if (!this.apiToken) {
      throw new Error('RAILWAY_API_TOKEN environment variable is required');
    }
    // Team ID is optional for personal accounts
    if (!this.teamId) {
      console.log('⚠️ No RAILWAY_TEAM_ID provided - using personal account');
    }
  }

  public static getInstance(): RailwayDeploymentService {
    if (!RailwayDeploymentService.instance) {
      RailwayDeploymentService.instance = new RailwayDeploymentService();
    }
    return RailwayDeploymentService.instance;
  }

  /**
   * Make GraphQL request to Railway API
   */
  private async makeRequest(query: string, variables: any = {}): Promise<any> {
    try {
      console.log(`🔍 Railway API Request:`, {
        url: this.baseUrl,
        token: `${this.apiToken.substring(0, 8)}...`,
        query: query.substring(0, 100) + '...'
      });

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables
        })
      });

      console.log(`📡 Railway API Response:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ Railway API Error Body:`, errorText);
        throw new Error(`Railway API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as any;
      
      if (data.errors) {
        throw new Error(`Railway GraphQL error: ${JSON.stringify(data.errors)}`);
      }

      return data.data;
    } catch (error) {
      console.error('Railway API request failed:', error);
      throw error;
    }
  }

  /**
   * Create a new Railway project for user deployment
   */
  async createProject(name: string, description?: string): Promise<RailwayProject> {
    const query = `
      mutation ProjectCreate($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          id
          name
          description
        }
      }
    `;

    // Generate Railway-compliant project name - use simple format
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits for uniqueness
    let projectName = `forma-${timestamp}`;
    
    // Try to include part of original name if possible
    const cleanName = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')  // Only keep alphanumeric
      .substring(0, 10);          // Max 10 chars from original
    
    if (cleanName.length >= 3) {
      projectName = `forma-${cleanName}-${timestamp}`;
    }

    const variables = {
      input: {
        name: projectName,
        description: description || `Forma deployment: ${name}`,
        ...(this.teamId && { teamId: this.teamId }), // Only include teamId if it exists
        isPublic: false
      }
    };

    console.log(`🏷️ Generated project name: "${projectName}" (length: ${projectName.length})`);
    console.log(`📋 Full variables:`, JSON.stringify(variables, null, 2));

    const result = await this.makeRequest(query, variables);
    return result.projectCreate;
  }

  /**
   * Create a service within a Railway project
   */
  async createService(projectId: string, serviceName: string, sourceRepo?: string): Promise<RailwayService> {
    const query = `
      mutation ServiceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
        }
      }
    `;

    const variables = {
      input: {
        projectId,
        name: serviceName,
        source: sourceRepo ? {
          repo: sourceRepo
        } : undefined
      }
    };

    const result = await this.makeRequest(query, variables);
    return result.serviceCreate;
  }

  /**
   * Deploy project files to Railway service
   */
  async deployFromFiles(serviceId: string, _files: Array<{ path: string; content: string }>): Promise<RailwayDeployment> {
    // For file-based deployment, we need to create a temporary GitHub repo or use Railway's direct upload
    // For now, we'll use the simpler approach of creating deployment from source
    
    const query = `
      mutation ServiceInstanceDeploy($input: ServiceInstanceDeployInput!) {
        serviceInstanceDeploy(input: $input) {
          id
          status
          url
          createdAt
        }
      }
    `;

    // Create a deployment trigger
    const variables = {
      input: {
        serviceId,
        environmentId: await this.getProductionEnvironmentId(serviceId)
      }
    };

    const result = await this.makeRequest(query, variables);
    return result.serviceInstanceDeploy;
  }

  /**
   * Get production environment ID for a service
   */
  private async getProductionEnvironmentId(serviceId: string): Promise<string> {
    const query = `
      query Service($id: String!) {
        service(id: $id) {
          project {
            environments {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `;

    const result = await this.makeRequest(query, { id: serviceId });
    const environments = result.service.project.environments.edges;
    
    // Find production environment (usually named "production" or is the first one)
    const prodEnv = environments.find((edge: any) => 
      edge.node.name.toLowerCase() === 'production'
    ) || environments[0];

    return prodEnv.node.id;
  }

  /**
   * Get deployment status and URL
   */
  async getDeploymentStatus(serviceId: string): Promise<{ status: string; url?: string; deploymentId?: string }> {
    const query = `
      query Service($id: String!) {
        service(id: $id) {
          deployments(first: 1) {
            edges {
              node {
                id
                status
                url
                createdAt
              }
            }
          }
        }
      }
    `;

    const result = await this.makeRequest(query, { id: serviceId });
    const deployments = result.service.deployments.edges;
    
    if (deployments.length === 0) {
      return { status: 'NOT_DEPLOYED' };
    }

    const latestDeployment = deployments[0].node;
    return {
      status: latestDeployment.status,
      url: latestDeployment.url,
      deploymentId: latestDeployment.id
    };
  }

  /**
   * Set environment variables for a service
   */
  async setEnvironmentVariables(serviceId: string, variables: Record<string, string>, projectId?: string): Promise<void> {
    const environmentId = await this.getProductionEnvironmentId(serviceId);
    console.log(`🔧 Setting environment variables for service ${serviceId}, environment ${environmentId}`);
    console.log(`📝 Variables to set:`, variables);
    
    for (const [key, value] of Object.entries(variables)) {
      const query = `
        mutation VariableUpsert($input: VariableUpsertInput!) {
          variableUpsert(input: $input) {
            id
          }
        }
      `;

      const variableInput = {
        input: {
          projectId: projectId || serviceId, // Use projectId if provided, fallback to serviceId
          environmentId,
          name: key,
          value
        }
      };

      console.log(`🔑 Setting variable ${key}=${value}`);
      console.log(`📋 Variable input:`, JSON.stringify(variableInput, null, 2));

      await this.makeRequest(query, variableInput);
    }
  }

  /**
   * Delete a Railway service (when user stops deployment)
   */
  async deleteService(serviceId: string): Promise<void> {
    const query = `
      mutation ServiceDelete($id: String!) {
        serviceDelete(id: $id)
      }
    `;

    await this.makeRequest(query, { id: serviceId });
  }

  /**
   * Generate a unique subdomain for the project
   */
  generateSubdomain(projectName: string, userId: string): string {
    // Create a unique subdomain: projectname-userid-random
    const cleanName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const userHash = userId.slice(-6); // Last 6 chars of user ID
    const random = Math.random().toString(36).substring(2, 6);
    
    return `${cleanName}-${userHash}-${random}`;
  }

  /**
   * Set up custom domain for Railway service
   */
  async setupCustomDomain(serviceId: string, subdomain: string, baseDomain: string = 'forma.dev'): Promise<string> {
    const customDomain = `${subdomain}.${baseDomain}`;
    
    const environmentId = await this.getProductionEnvironmentId(serviceId);
    
    const query = `
      mutation CustomDomainCreate($input: CustomDomainCreateInput!) {
        customDomainCreate(input: $input) {
          id
          domain
          status
          dnsRecords {
            type
            name
            value
          }
        }
      }
    `;

    const variables = {
      input: {
        environmentId,
        serviceId,
        domain: customDomain
      }
    };

    try {
      await this.makeRequest(query, variables);
      console.log(`🌐 Custom domain configured: ${customDomain}`);
      
      // Return the custom domain
      return `https://${customDomain}`;
    } catch (error) {
      console.error('Failed to setup custom domain:', error);
      // Fallback to Railway domain if custom domain fails
      const status = await this.getDeploymentStatus(serviceId);
      return status.url || `https://${subdomain}.railway.app`;
    }
  }

  /**
   * Set custom domain for Railway service
   */
  async setCustomDomain(serviceId: string, domain: string): Promise<void> {
    const environmentId = await this.getProductionEnvironmentId(serviceId);
    
    const query = `
      mutation CustomDomainCreate($input: CustomDomainCreateInput!) {
        customDomainCreate(input: $input) {
          id
          domain
        }
      }
    `;

    const variables = {
      input: {
        environmentId,
        serviceId,
        domain
      }
    };

    await this.makeRequest(query, variables);
  }

  /**
   * Get service logs for debugging
   */
  async getServiceLogs(serviceId: string, lines: number = 100): Promise<string[]> {
    const query = `
      query ServiceLogs($serviceId: String!, $filter: LogFilter) {
        logs(serviceId: $serviceId, filter: $filter) {
          edges {
            node {
              message
              timestamp
            }
          }
        }
      }
    `;

    const variables = {
      serviceId,
      filter: {
        limit: lines
      }
    };

    const result = await this.makeRequest(query, variables);
    return result.logs.edges.map((edge: any) => edge.node.message);
  }

  /**
   * Connect Railway service to GitHub repository
   */
  async connectServiceToGitHub(serviceId: string, repoFullName: string): Promise<void> {
    const query = `
      mutation ServiceConnect($serviceId: String!, $repo: String!) {
        serviceConnect(serviceId: $serviceId, repo: $repo) {
          id
        }
      }
    `;

    const variables = {
      serviceId,
      repo: repoFullName // Format: "owner/repo-name"
    };

    try {
      await this.makeRequest(query, variables);
      console.log(`🔗 Connected service ${serviceId} to GitHub repo: ${repoFullName}`);
    } catch (error) {
      console.error('Failed to connect service to GitHub:', error);
      throw new Error(`Failed to connect Railway service to GitHub repository: ${repoFullName}`);
    }
  }

  /**
   * Trigger deployment for a connected service
   */
  async triggerDeployment(serviceId: string): Promise<RailwayDeployment> {
    const environmentId = await this.getProductionEnvironmentId(serviceId);
    
    const query = `
      mutation DeploymentCreate($input: DeploymentCreateInput!) {
        deploymentCreate(input: $input) {
          id
          status
          url
          createdAt
        }
      }
    `;

    const variables = {
      input: {
        serviceId,
        environmentId
      }
    };

    const result = await this.makeRequest(query, variables);
    return result.deploymentCreate;
  }

  /**
   * Estimate monthly cost for deployment
   */
  calculateMonthlyCost(plan: string = 'starter'): number {
    // Railway pricing (as of 2024)
    const pricing = {
      starter: 5.0,   // $5/month for starter plan
      pro: 20.0,      // $20/month for pro plan
      team: 50.0      // $50/month for team plan
    };

    return pricing[plan as keyof typeof pricing] || pricing.starter;
  }
}

export default RailwayDeploymentService; 