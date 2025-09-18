# 🚀 Forma Production Deployment System

## Overview

The Forma deployment system allows users to deploy their AI-generated projects to production with one click. Projects are deployed on Railway under the Forma umbrella, providing users with live URLs while maintaining cost control and management.

## Architecture

### Components

1. **Railway Service** (`/backend/src/services/railwayService.ts`)
   - Handles Railway API integration
   - Creates projects and services
   - Manages deployments and environment variables

2. **Deployment Controller** (`/backend/src/controllers/deploymentController.ts`)
   - Orchestrates the deployment process
   - Manages deployment lifecycle
   - Handles billing and usage tracking

3. **Database Schema**
   - Extended `projects` table with deployment fields
   - New `deployments` table for deployment history
   - New `deployment_usage` table for billing tracking

4. **Frontend Components**
   - Updated builder with deployment functionality
   - `DeploymentStatus` component for status display
   - Real-time deployment progress tracking

## Database Schema

### Projects Table Extensions
```sql
-- Essential Deployment Fields
isDeployed           BOOLEAN         DEFAULT false
deploymentUrl        STRING          -- Live production URL
subdomain            STRING UNIQUE   -- Unique subdomain under forma.dev
deploymentStatus     STRING          DEFAULT "not_deployed"
railwayServiceId     STRING          -- Railway service ID for management
lastDeployedAt       DATETIME
```

### New Tables

#### Deployments
```sql
CREATE TABLE deployments (
  id                STRING PRIMARY KEY,
  projectId         STRING,
  status            STRING,  -- building, success, failed, cancelled
  railwayServiceId  STRING,
  deploymentUrl     STRING,
  subdomain         STRING,
  triggeredBy       STRING,  -- user_manual, auto_deploy
  buildTime         INTEGER, -- Build time in seconds
  errorMessage      STRING,
  createdAt         DATETIME
);
```

#### Deployment Usage (Billing)
```sql
CREATE TABLE deployment_usage (
  id            STRING PRIMARY KEY,
  projectId     STRING,
  userId        STRING,
  deploymentId  STRING,
  monthlyCost   FLOAT DEFAULT 5.0,  -- Monthly hosting cost
  billingMonth  STRING,             -- YYYY-MM format
  isActive      BOOLEAN DEFAULT true,
  createdAt     DATETIME,
  updatedAt     DATETIME
);
```

## API Endpoints

### Deployment Management
- `POST /api/deployments/deploy` - Deploy a project
- `GET /api/deployments/status/:projectId` - Get deployment status
- `DELETE /api/deployments/:projectId` - Undeploy a project
- `GET /api/deployments/logs/:projectId` - Get deployment logs
- `GET /api/deployments/usage` - Get user's deployment usage

## Railway Integration

### Setup Requirements

1. **Railway API Token**
   ```bash
   RAILWAY_API_TOKEN=your_railway_api_token_here
   ```

2. **Railway Team ID**
   ```bash
   RAILWAY_TEAM_ID=your_railway_team_id_here
   ```

### How It Works

1. **Project Creation**: Creates a new Railway project for each deployment
2. **Service Setup**: Creates a web service within the Railway project
3. **Environment Variables**: Sets production environment variables
4. **Deployment**: Triggers deployment (currently simulated, needs GitHub integration)
5. **Domain Management**: Assigns unique subdomains under your domain

## Deployment Process

### 1. User Initiates Deployment
```typescript
// Frontend calls deployment API
const response = await fetch('/api/deployments/deploy', {
  method: 'POST',
  body: JSON.stringify({ projectId })
});
```

### 2. Backend Processing
1. **Validation**: Check user limits and project files
2. **Railway Project**: Create Railway project and service
3. **Framework Detection**: Detect project type (React, Next.js, etc.)
4. **File Preparation**: Prepare files for deployment
5. **Environment Setup**: Configure production environment
6. **Deployment**: Deploy to Railway (background process)
7. **Database Updates**: Update project and create billing records

### 3. Status Monitoring
- Real-time status polling
- Build progress tracking
- Error handling and reporting
- Success notifications with live URL

## Billing System

### Cost Structure
- **Starter Plan**: $5/month per deployment
- **Pro Plan**: $20/month per deployment
- **Team Plan**: $50/month per deployment

### Usage Tracking
- Monthly billing records per project
- Active/inactive deployment tracking
- Cost calculation based on user plan
- Integration with existing Stripe billing

### User Limits
- **Free Plan**: 0 deployments
- **Starter Plan**: 1 concurrent deployment
- **Business Plan**: 3 concurrent deployments

## Framework Support

### Automatic Detection
The system automatically detects project frameworks:

1. **Next.js**: Detects `next` dependency or `next.config.js`
2. **React**: Detects `react` dependency
3. **Vue**: Detects `vue` dependency
4. **Express**: Detects `express` dependency
5. **Static**: Detects `index.html`
6. **Node.js**: Default fallback

### Build Configuration
Automatically generates appropriate `package.json` and build scripts:

```typescript
// Next.js Example
{
  "scripts": {
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

## Security & Limitations

### Security Features
- User authentication required
- Project ownership validation
- Deployment limits based on plan
- Secure Railway API integration
- Environment variable protection

### Current Limitations
1. **File Upload**: Currently simulated - needs GitHub integration or direct file upload
2. **Custom Domains**: Basic support - needs DNS management
3. **SSL Certificates**: Handled by Railway automatically
4. **Build Logs**: Basic implementation - needs real-time streaming

## Frontend Integration

### Builder Page Updates
- Deployment button with loading states
- Real-time deployment progress
- Success/failure notifications
- Deployment status polling

### Deployment Status Component
```typescript
<DeploymentStatus 
  projectId={project.id}
  onStatusChange={(status) => console.log(status)}
/>
```

Features:
- Live deployment status
- Build time and error information
- Quick actions (view logs, undeploy)
- Direct links to live applications

## Future Enhancements

### Phase 2 Features
1. **GitHub Integration**: Direct deployment from GitHub repos
2. **Custom Domains**: Full custom domain support with DNS management
3. **Environment Variables**: User-configurable environment variables
4. **Scaling**: Auto-scaling based on traffic
5. **Analytics**: Deployment analytics and performance monitoring

### Phase 3 Features
1. **CI/CD Pipeline**: Automated deployments on code changes
2. **Staging Environments**: Preview deployments for testing
3. **Database Integration**: Managed database provisioning
4. **Team Collaboration**: Multi-user deployment management
5. **Advanced Monitoring**: APM and error tracking

## Getting Started

### 1. Environment Setup
Add Railway credentials to your `.env` file:
```bash
RAILWAY_API_TOKEN=your_token_here
RAILWAY_TEAM_ID=your_team_id_here
```

### 2. Database Migration
The schema changes are designed to be added without data loss. Update your database schema to include the new fields and tables.

### 3. Railway Account Setup
1. Create a Railway account
2. Generate an API token
3. Get your team ID
4. Configure billing for your Railway account

### 4. Testing
1. Create a test project with files
2. Click the "Publish" button in the builder
3. Monitor deployment progress
4. Verify the live URL works

## Troubleshooting

### Common Issues

1. **Railway API Errors**
   - Check API token validity
   - Verify team ID is correct
   - Ensure Railway account has sufficient credits

2. **Deployment Failures**
   - Check project has valid files
   - Verify package.json is properly formatted
   - Review deployment logs for build errors

3. **Billing Issues**
   - Ensure user has active subscription
   - Check deployment limits haven't been exceeded
   - Verify Stripe integration is working

### Debug Mode
Enable debug logging by setting:
```bash
NODE_ENV=development
DEBUG=forma:deployment
```

## Support

For deployment system issues:
1. Check deployment logs via the UI
2. Review Railway dashboard for service status
3. Monitor database for deployment records
4. Check server logs for API errors

This deployment system provides a solid foundation for production deployments while maintaining simplicity and cost control. The modular design allows for easy expansion and customization as your needs grow. 