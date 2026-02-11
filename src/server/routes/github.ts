// GitHub OAuth and integration routes

import { Router } from 'express';
import { Octokit } from '@octokit/rest';
import { getDatabase } from '../db/client.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

// OAuth state storage (in production, use Redis or similar)
const oauthStates = new Map<string, { userId: string; expiresAt: Date }>();

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'http://localhost:4000/api/auth/github/callback';

// Check if GitHub OAuth is configured
function isGitHubConfigured(): boolean {
  return !!(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);
}

// Get GitHub status
router.get('/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const prefs = await db.getUserPreferences(req.userId!);

    res.json({
      configured: isGitHubConfigured(),
      connected: !!prefs?.githubToken,
      username: prefs?.githubUsername || null,
    });
  } catch (error) {
    console.error('GitHub status error:', error);
    res.status(500).json({ error: 'Failed to get GitHub status' });
  }
});

// Initiate GitHub OAuth
router.get('/auth', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!isGitHubConfigured()) {
    return res.status(400).json({
      error: 'GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.',
    });
  }

  // Generate state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  oauthStates.set(state, {
    userId: req.userId!,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  });

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID!,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: 'repo user:email',
    state,
  });

  res.json({
    authUrl: `https://github.com/login/oauth/authorize?${params}`,
  });
});

// GitHub OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).send('Missing code or state parameter');
    }

    // Verify state
    const stateData = oauthStates.get(state as string);
    if (!stateData) {
      return res.status(400).send('Invalid state parameter');
    }

    if (new Date() > stateData.expiresAt) {
      oauthStates.delete(state as string);
      return res.status(400).send('State expired');
    }

    const userId = stateData.userId;
    oauthStates.delete(state as string);

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json() as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (tokenData.error) {
      return res.status(400).send(`GitHub error: ${tokenData.error_description}`);
    }

    if (!tokenData.access_token) {
      return res.status(400).send('No access token received from GitHub');
    }

    // Get user info
    const octokit = new Octokit({ auth: tokenData.access_token });
    const { data: user } = await octokit.users.getAuthenticated();

    // Save token and username
    const db = getDatabase();
    await db.upsertUserPreferences(userId, {
      githubToken: tokenData.access_token,
      githubUsername: user.login,
    });

    // Redirect back to app with success
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GitHub Connected</title>
          <style>
            body { font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; background: #0a0a0a; color: white; }
            .success { text-align: center; }
            h1 { color: #22c55e; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>GitHub Connected!</h1>
            <p>Connected as @${user.login}</p>
            <p>You can close this window.</p>
            <script>
              setTimeout(() => { window.close(); }, 2000);
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('GitHub callback error:', error);
    res.status(500).send('Failed to complete GitHub authentication');
  }
});

// Disconnect GitHub
router.post('/disconnect', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    await db.upsertUserPreferences(req.userId!, {
      githubToken: undefined,
      githubUsername: undefined,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('GitHub disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect GitHub' });
  }
});

// All routes below require authentication and GitHub connection
router.use(requireAuth);

async function getOctokit(userId: string): Promise<Octokit | null> {
  const db = getDatabase();
  const prefs = await db.getUserPreferences(userId);

  if (!prefs?.githubToken) {
    return null;
  }

  return new Octokit({ auth: prefs.githubToken });
}

// List user's repositories
router.get('/repos', async (req: AuthenticatedRequest, res) => {
  try {
    const octokit = await getOctokit(req.userId!);
    if (!octokit) {
      return res.status(401).json({ error: 'GitHub not connected' });
    }

    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 50,
    });

    res.json({
      repos: repos.map(r => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        description: r.description,
        url: r.html_url,
        private: r.private,
        defaultBranch: r.default_branch,
        updatedAt: r.updated_at,
      })),
    });
  } catch (error) {
    console.error('List repos error:', error);
    res.status(500).json({ error: 'Failed to list repositories' });
  }
});

// Get repository details
router.get('/repos/:owner/:repo', async (req: AuthenticatedRequest, res) => {
  try {
    const octokit = await getOctokit(req.userId!);
    if (!octokit) {
      return res.status(401).json({ error: 'GitHub not connected' });
    }

    const { owner, repo } = req.params;

    const [repoData, branches] = await Promise.all([
      octokit.repos.get({ owner, repo }),
      octokit.repos.listBranches({ owner, repo, per_page: 20 }),
    ]);

    res.json({
      repo: {
        id: repoData.data.id,
        name: repoData.data.name,
        fullName: repoData.data.full_name,
        description: repoData.data.description,
        url: repoData.data.html_url,
        private: repoData.data.private,
        defaultBranch: repoData.data.default_branch,
      },
      branches: branches.data.map(b => b.name),
    });
  } catch (error) {
    console.error('Get repo error:', error);
    res.status(500).json({ error: 'Failed to get repository' });
  }
});

// Create a new repository
router.post('/repos', async (req: AuthenticatedRequest, res) => {
  try {
    const octokit = await getOctokit(req.userId!);
    if (!octokit) {
      return res.status(401).json({ error: 'GitHub not connected' });
    }

    const { name, description, isPrivate } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Repository name is required' });
    }

    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate ?? true,
      auto_init: true,
    });

    res.status(201).json({
      repo: {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        defaultBranch: repo.default_branch,
      },
    });
  } catch (error) {
    console.error('Create repo error:', error);
    res.status(500).json({ error: 'Failed to create repository' });
  }
});

// Push files to repository
router.post('/repos/:owner/:repo/push', async (req: AuthenticatedRequest, res) => {
  try {
    const octokit = await getOctokit(req.userId!);
    if (!octokit) {
      return res.status(401).json({ error: 'GitHub not connected' });
    }

    const { owner, repo } = req.params;
    const { files, branch, message } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Files are required' });
    }

    // Get the default branch's SHA
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const targetBranch = branch || repoData.default_branch;

    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${targetBranch}`,
    });

    const baseSha = ref.object.sha;

    // Get the tree of the base commit
    const { data: baseCommit } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: baseSha,
    });

    // Create blobs for each file
    const blobs = await Promise.all(
      files.map(async (file: { path: string; content: string }) => {
        const { data: blob } = await octokit.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        });
        return { path: file.path, sha: blob.sha };
      })
    );

    // Create a new tree
    const { data: tree } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseCommit.tree.sha,
      tree: blobs.map(b => ({
        path: b.path,
        mode: '100644',
        type: 'blob',
        sha: b.sha,
      })),
    });

    // Create a commit
    const { data: commit } = await octokit.git.createCommit({
      owner,
      repo,
      message: message || 'Update from Brick Studio',
      tree: tree.sha,
      parents: [baseSha],
    });

    // Update the reference
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${targetBranch}`,
      sha: commit.sha,
    });

    res.json({
      commit: {
        sha: commit.sha,
        message: commit.message,
        url: commit.html_url,
      },
    });
  } catch (error) {
    console.error('Push error:', error);
    res.status(500).json({ error: 'Failed to push to repository' });
  }
});

export default router;
