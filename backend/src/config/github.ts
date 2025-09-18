export const githubConfig = {
  clientId: process.env.GITHUB_CLIENT_ID || '',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  redirectUri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:3001/api/auth/github/callback',
  scope: 'repo user',
  allowSignup: true
}; 