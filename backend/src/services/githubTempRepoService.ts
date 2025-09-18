import { Octokit } from '@octokit/rest';
import { randomUUID } from 'crypto';

export class GitHubTempRepoService {
  private octokit: Octokit;
  private tempRepoPrefix = 'forma-temp-';

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
    });
  }

  /**
   * Create a temporary GitHub repository for deployment
   */
  async createTempRepo(projectName: string): Promise<{ repoName: string; repoUrl: string }> {
    const repoName = `${this.tempRepoPrefix}${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${randomUUID().slice(0, 8)}`;
    
    try {
      // Create repo under the Forma organization/user account
      const { data: repo } = await (this.octokit.repos as any).create({
        name: repoName,
        description: `🚀 Forma deployment: ${projectName} | Auto-generated for production deployment`,
        private: true,
        auto_init: true,
        // Optional: Create under organization if you have one
        // org: 'your-org-name'
      });

      return {
        repoName: repo.full_name,
        repoUrl: repo.clone_url
      };
    } catch (error) {
      console.error('Failed to create temp repo:', error);
      throw new Error('Failed to create temporary GitHub repository');
    }
  }

  /**
   * Upload project files to the temporary repository
   */
  async uploadFiles(repoName: string, files: Array<{ path: string; content: string }>): Promise<void> {
    const [owner, repo] = repoName.split('/');

    try {
      // Get the default branch SHA
      const { data: ref } = await this.octokit.git.getRef({
        owner,
        repo,
        ref: 'heads/main'
      });

      const baseSha = ref.object.sha;

      // Create blobs for all files
      const blobs = await Promise.all(
        files.map(async (file) => {
          const { data: blob } = await this.octokit.git.createBlob({
            owner,
            repo,
            content: Buffer.from(file.content).toString('base64'),
            encoding: 'base64'
          });
          return {
            path: file.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blob.sha
          };
        })
      );

      // Create tree
      const { data: tree } = await this.octokit.git.createTree({
        owner,
        repo,
        base_tree: baseSha,
        tree: blobs
      });

      // Create commit
      const { data: commit } = await this.octokit.git.createCommit({
        owner,
        repo,
        message: 'Deploy Forma project',
        tree: tree.sha,
        parents: [baseSha]
      });

      // Update reference
      await this.octokit.git.updateRef({
        owner,
        repo,
        ref: 'heads/main',
        sha: commit.sha
      });

      console.log(`✅ Files uploaded to ${repoName}`);
    } catch (error) {
      console.error('Failed to upload files:', error);
      throw new Error('Failed to upload files to GitHub repository');
    }
  }

  /**
   * Delete the temporary repository after deployment
   */
  async deleteTempRepo(repoName: string): Promise<void> {
    const [owner, repo] = repoName.split('/');

    try {
      await this.octokit.repos.delete({
        owner,
        repo
      });
      console.log(`🗑️ Deleted temp repo: ${repoName}`);
    } catch (error) {
      console.error('Failed to delete temp repo:', error);
      // Don't throw error - cleanup failure shouldn't break deployment
    }
  }

  /**
   * Connect Railway service to GitHub repository
   */
  async connectToRailway(railwayService: any, repoName: string): Promise<void> {
    // This would integrate with Railway's API to connect the service to the GitHub repo
    // Implementation depends on Railway's specific API for GitHub integration
    console.log(`🔗 Connecting Railway service ${railwayService.id || 'unknown'} to ${repoName}`);
    
    // Railway API call would go here
    // await railwayService.connectToGitHub(repoName);
  }
}

export default GitHubTempRepoService; 