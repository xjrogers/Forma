import { Octokit } from '@octokit/rest';
import { githubConfig } from '../config/github';

interface CreateRepositoryParams {
  name: string;
  description?: string;
  private?: boolean;
}

interface GitHubOAuthResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

export class GitHubService {
  private octokit: Octokit;
  private static instances = new Map<string, GitHubService>();

  private constructor(accessToken?: string) {
    this.octokit = new Octokit({
      auth: accessToken || process.env.GITHUB_ACCESS_TOKEN,
      request: {
        timeout: 5000 // 5 second timeout
      }
    });
  }

  // Use singleton pattern per token
  static getInstance(accessToken?: string): GitHubService {
    const key = accessToken || 'default';
    if (!this.instances.has(key)) {
      this.instances.set(key, new GitHubService(accessToken));
    }
    return this.instances.get(key)!;
  }

  async getAuthenticatedUser() {
    try {
      const { data } = await this.octokit.users.getAuthenticated();
      return data;
    } catch (error) {
      console.error('GitHub API error - getAuthenticatedUser:', error);
      throw new Error('Failed to get GitHub user info');
    }
  }

  async createRepository(params: CreateRepositoryParams) {
    try {
      const { name, description = '', private: isPrivate = true } = params;
      
      // Try to create with original name first
      let finalName = name;
      let attempt = 0;
      const maxAttempts = 10;
      
      while (attempt < maxAttempts) {
        try {
      const response = await this.octokit.repos.createForAuthenticatedUser({
            name: finalName,
        description,
        private: isPrivate,
        auto_init: true // Initialize with README
      });

      return response.data;
        } catch (createError: any) {
          // Check if it's a name conflict error
          if (createError.status === 422 && 
              createError.response?.data?.errors?.some((err: any) => 
                err.field === 'name' && err.code === 'custom' && 
                err.message.includes('already exists'))) {
            
            attempt++;
            finalName = `${name}-${attempt + 1}`;
            console.log(`🔄 Repository name conflict, trying: ${finalName}`);
            continue;
          }
          
          // If it's not a name conflict, re-throw the error
          throw createError;
        }
      }
      
      throw new Error(`Failed to create repository after ${maxAttempts} attempts`);
    } catch (error) {
      console.error('GitHub API error - createRepository:', error);
      if (error instanceof Error && error.message.includes('Bad credentials')) {
        throw new Error('GitHub authentication failed');
      }
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new Error('REPOSITORY_NAME_EXISTS');
      }
      throw new Error('Failed to create GitHub repository');
    }
  }

  async updateRepositoryVisibility(owner: string, repo: string, isPrivate: boolean) {
    try {
      console.log(`🔄 Updating repository visibility: ${owner}/${repo} to ${isPrivate ? 'private' : 'public'}`);
      
      const { data } = await this.octokit.repos.update({
        owner,
        repo,
        private: isPrivate
      });

      console.log(`✅ Repository visibility updated successfully: ${data.full_name} is now ${data.private ? 'private' : 'public'}`);
      
      return {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        private: data.private,
        html_url: data.html_url,
        description: data.description
      };
    } catch (error: any) {
      console.error('❌ GitHub API error - updateRepositoryVisibility:', error);
      
      // Preserve GitHub API error details for better error handling
      if (error.status) {
        const githubError = new Error(error.message || 'GitHub API error');
        (githubError as any).status = error.status;
        (githubError as any).response = error.response;
        throw githubError;
      }
      
      if (error instanceof Error && error.message.includes('Bad credentials')) {
        throw new Error('GitHub authentication failed');
      }
      
      throw new Error('Failed to update repository visibility');
    }
  }

  async deleteRepository(repoName: string) {
    try {
      const owner = process.env.GITHUB_USERNAME;
      if (!owner) {
        throw new Error('GITHUB_USERNAME environment variable is not set');
      }

      await this.octokit.repos.delete({
        owner,
        repo: repoName
      });
    } catch (error) {
      console.error('GitHub API error - deleteRepository:', error);
      throw new Error('Failed to delete GitHub repository');
    }
  }

  async createBranch(repoName: string, branchName: string, sourceBranch = 'main') {
    try {
      const owner = process.env.GITHUB_USERNAME;
      if (!owner) {
        throw new Error('GITHUB_USERNAME environment variable is not set');
      }

      // Get the SHA of the source branch
      const { data: ref } = await this.octokit.git.getRef({
        owner,
        repo: repoName,
        ref: `heads/${sourceBranch}`
      });

      // Create new branch
      await this.octokit.git.createRef({
        owner,
        repo: repoName,
        ref: `refs/heads/${branchName}`,
        sha: ref.object.sha
      });
    } catch (error) {
      console.error('GitHub API error - createBranch:', error);
      throw new Error('Failed to create branch');
    }
  }

  async validateAndSetupBranch(repoOwner: string, repoName: string, branchName: string, createIfMissing = false) {
    try {
      console.log(`🔍 Validating branch "${branchName}" in ${repoOwner}/${repoName}`);
      
      // First, try to get the branch to see if it exists
      try {
        const { data: branch } = await this.octokit.repos.getBranch({
          owner: repoOwner,
          repo: repoName,
          branch: branchName
        });
        
        console.log(`✅ Branch "${branchName}" exists`);
        return {
          exists: true,
          created: false,
          branch: {
            name: branch.name,
            sha: branch.commit.sha,
            protected: branch.protected
          }
        };
      } catch (branchError: any) {
        if (branchError.status === 404) {
          console.log(`❌ Branch "${branchName}" does not exist`);
          
          if (!createIfMissing) {
            throw new Error(`Branch "${branchName}" does not exist in the repository`);
          }
          
          // Get the default branch to use as source
          const { data: repo } = await this.octokit.repos.get({
            owner: repoOwner,
            repo: repoName
          });
          
          const defaultBranch = repo.default_branch;
          console.log(`🌿 Creating branch "${branchName}" from "${defaultBranch}"`);
          
          // Get the SHA of the default branch
          const { data: ref } = await this.octokit.git.getRef({
            owner: repoOwner,
            repo: repoName,
            ref: `heads/${defaultBranch}`
          });
          
          // Create the new branch
          const { data: newRef } = await this.octokit.git.createRef({
            owner: repoOwner,
            repo: repoName,
            ref: `refs/heads/${branchName}`,
            sha: ref.object.sha
          });
          
          console.log(`✅ Created branch "${branchName}"`);
          return {
            exists: false,
            created: true,
            branch: {
              name: branchName,
              sha: newRef.object.sha,
              protected: false
            }
          };
        } else {
          throw branchError;
        }
      }
    } catch (error: any) {
      console.error('❌ GitHub API error - validateAndSetupBranch:', error);
      if (error.status) {
        const githubError = new Error(error.message || 'GitHub API error');
        (githubError as any).status = error.status;
        (githubError as any).response = error.response;
        throw githubError;
      }
      if (error instanceof Error && error.message.includes('Bad credentials')) {
        throw new Error('GitHub authentication failed');
      }
      throw new Error(`Failed to validate branch: ${error.message || 'Unknown error'}`);
    }
  }

  async pushFilesToRepository(repoOwner: string, repoName: string, files: Array<{ path: string; content: string }>, branch = 'main') {
    try {
      console.log(`🚀 Pushing ${files.length} files to ${repoOwner}/${repoName}:${branch}`);

      // Get the current commit SHA
      const { data: ref } = await this.octokit.git.getRef({
        owner: repoOwner,
        repo: repoName,
        ref: `heads/${branch}`
      });

      const currentCommitSha = ref.object.sha;
      console.log(`📍 Current commit SHA: ${currentCommitSha}`);

      // Get the current tree
      const { data: currentCommit } = await this.octokit.git.getCommit({
        owner: repoOwner,
        repo: repoName,
        commit_sha: currentCommitSha
      });

      // Create blobs for all files
      const blobs = await Promise.all(
        files.map(async (file) => {
          const { data: blob } = await this.octokit.git.createBlob({
            owner: repoOwner,
            repo: repoName,
            content: Buffer.from(file.content, 'utf8').toString('base64'),
            encoding: 'base64'
          });
          return {
            path: file.path,
            sha: blob.sha,
            mode: '100644' as const,
            type: 'blob' as const
          };
        })
      );

      console.log(`📄 Created ${blobs.length} blobs`);

      // Create new tree with all files
      const { data: newTree } = await this.octokit.git.createTree({
        owner: repoOwner,
        repo: repoName,
        base_tree: currentCommit.tree.sha,
        tree: blobs
      });

      console.log(`🌳 Created new tree: ${newTree.sha}`);

      // Check if there are actually any changes
      if (newTree.sha === currentCommit.tree.sha) {
        console.log(`📋 No changes detected - tree SHA matches current commit`);
        return {
          commitSha: currentCommitSha,
          commitUrl: `https://github.com/${repoOwner}/${repoName}/commit/${currentCommitSha}`,
          filesUpdated: 0,
          noChanges: true
        };
      }

      // Create new commit
      const { data: newCommit } = await this.octokit.git.createCommit({
        owner: repoOwner,
        repo: repoName,
        message: `Update project files - ${new Date().toISOString()}`,
        tree: newTree.sha,
        parents: [currentCommitSha]
      });

      console.log(`💾 Created new commit: ${newCommit.sha}`);

      // Update the reference
      await this.octokit.git.updateRef({
        owner: repoOwner,
        repo: repoName,
        ref: `heads/${branch}`,
        sha: newCommit.sha
      });

      console.log(`✅ Successfully pushed ${files.length} files to ${repoOwner}/${repoName}:${branch}`);

      return {
        commitSha: newCommit.sha,
        commitUrl: newCommit.html_url,
        filesUpdated: files.length,
        noChanges: false
      };

    } catch (error) {
      console.error('GitHub API error - pushFilesToRepository:', error);
      if (error instanceof Error && error.message.includes('Bad credentials')) {
        throw new Error('GitHub authentication failed');
      }
      throw new Error('Failed to push files to GitHub repository');
    }
  }

  async getRepositoryInfo(repoOwner: string, repoName: string) {
    try {
      const { data: repo } = await this.octokit.repos.get({
        owner: repoOwner,
        repo: repoName
      });

      return {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch,
        private: repo.private
      };
    } catch (error) {
      console.error('GitHub API error - getRepositoryInfo:', error);
      throw new Error('Failed to get repository information');
    }
  }

  async getUserRepositories() {
    try {
      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100
      });
      
      return data.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        default_branch: repo.default_branch,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        size: repo.size,
        updated_at: repo.updated_at,
        topics: repo.topics || []
      }));
    } catch (error) {
      console.error('GitHub API error - getUserRepositories:', error);
      throw new Error('Failed to get user repositories');
    }
  }

  static getAuthUrl(state: string, isPopup: boolean = false) {
    const redirectUri = isPopup 
      ? `${githubConfig.redirectUri}?popup=true`
      : githubConfig.redirectUri;
      
    const params = new URLSearchParams({
      client_id: githubConfig.clientId,
      redirect_uri: redirectUri,
      scope: githubConfig.scope,
      state,
      allow_signup: String(githubConfig.allowSignup)
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  static async exchangeCode(code: string): Promise<{ accessToken: string; tokenType: string; scope: string }> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          client_id: githubConfig.clientId,
          client_secret: githubConfig.clientSecret,
          code
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      const data = await response.json() as GitHubOAuthResponse;
      if (data.error) {
        console.error('GitHub OAuth error:', data);
        throw new Error(data.error_description || 'Failed to exchange code');
      }

      return {
        accessToken: data.access_token,
        tokenType: data.token_type,
        scope: data.scope
      };
    } catch (error) {
      console.error('GitHub OAuth error - exchangeCode:', error);
      throw new Error('Failed to exchange GitHub code for token');
    }
  }

  // Cleanup method
  static cleanup() {
    this.instances.clear();
  }
}

// Handle cleanup
process.on('beforeExit', () => {
  GitHubService.cleanup();
});

// Export a singleton instance for general use
export const githubService = GitHubService.getInstance(); 