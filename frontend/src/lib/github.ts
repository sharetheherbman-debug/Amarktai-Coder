import { Octokit } from 'octokit';
import { decryptSecret } from './crypto';
import { prisma } from './db';

export async function getOctokitForUser(userId: string): Promise<Octokit | null> {
  const conn = await prisma.gitHubConnection.findUnique({ where: { userId } });
  if (!conn) return null;
  const token = decryptSecret(conn.encryptedToken);
  return new Octokit({ auth: token });
}

export async function validateToken(token: string): Promise<{
  valid: boolean;
  username?: string;
  scopes?: string;
  error?: string;
}> {
  try {
    const o = new Octokit({ auth: token });
    const res = await o.request('GET /user');
    const scopes = (res.headers as any)?.['x-oauth-scopes'] || '';
    return { valid: true, username: (res.data as any)?.login, scopes };
  } catch (e: any) {
    return { valid: false, error: e?.message || 'Token validation failed' };
  }
}

export async function listRepos(o: Octokit) {
  // First page only for MVP; sorted by recent push
  const res = await o.request('GET /user/repos', {
    per_page: 100,
    sort: 'pushed',
    affiliation: 'owner,collaborator,organization_member',
  });
  return (res.data as any[]).map((r) => ({
    fullName: r.full_name,
    name: r.name,
    owner: r.owner?.login,
    private: r.private,
    defaultBranch: r.default_branch,
    description: r.description,
    htmlUrl: r.html_url,
    updatedAt: r.updated_at,
    pushedAt: r.pushed_at,
    language: r.language,
  }));
}

export async function listBranches(o: Octokit, owner: string, repo: string) {
  const res = await o.request('GET /repos/{owner}/{repo}/branches', {
    owner,
    repo,
    per_page: 100,
  });
  return (res.data as any[]).map((b) => ({ name: b.name, sha: b.commit?.sha }));
}

export async function getTree(o: Octokit, owner: string, repo: string, branch: string) {
  // get branch sha
  const ref = await o.request('GET /repos/{owner}/{repo}/branches/{branch}', {
    owner,
    repo,
    branch,
  });
  const sha = (ref.data as any).commit.sha;
  const tree = await o.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
    owner,
    repo,
    tree_sha: sha,
    recursive: 'true',
  });
  return {
    truncated: (tree.data as any).truncated,
    items: ((tree.data as any).tree || []).map((t: any) => ({
      path: t.path,
      type: t.type,
      size: t.size,
      sha: t.sha,
    })),
  };
}

export async function getFile(o: Octokit, owner: string, repo: string, branch: string, path: string) {
  try {
    const res = await o.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner,
      repo,
      path,
      ref: branch,
    });
    const data: any = res.data;
    if (Array.isArray(data) || data.type !== 'file') {
      throw new Error('Path is not a file');
    }
    const content =
      data.encoding === 'base64'
        ? Buffer.from(data.content, 'base64').toString('utf8')
        : data.content;
    return { path, sha: data.sha, size: data.size, content };
  } catch (e: any) {
    throw new Error(e?.message || 'Failed to read file');
  }
}

export async function createBranch(
  o: Octokit,
  owner: string,
  repo: string,
  baseBranch: string,
  newBranch: string,
) {
  const ref = await o.request('GET /repos/{owner}/{repo}/git/refs/heads/{branch}', {
    owner,
    repo,
    branch: baseBranch,
  });
  const sha = (ref.data as any).object.sha;
  try {
    await o.request('POST /repos/{owner}/{repo}/git/refs', {
      owner,
      repo,
      ref: `refs/heads/${newBranch}`,
      sha,
    });
  } catch (e: any) {
    if (!String(e?.message || '').toLowerCase().includes('reference already exists')) {
      throw e;
    }
  }
  return { branch: newBranch, baseSha: sha };
}

export async function commitFiles(
  o: Octokit,
  owner: string,
  repo: string,
  branch: string,
  files: { path: string; content: string }[],
  message: string,
) {
  // Get current HEAD of branch
  const refRes = await o.request('GET /repos/{owner}/{repo}/git/refs/heads/{branch}', {
    owner,
    repo,
    branch,
  });
  const headSha = (refRes.data as any).object.sha;

  // Get base tree
  const commitRes = await o.request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', {
    owner,
    repo,
    commit_sha: headSha,
  });
  const baseTreeSha = (commitRes.data as any).tree.sha;

  // Create blobs
  const blobs = await Promise.all(
    files.map(async (f) => {
      const blob = await o.request('POST /repos/{owner}/{repo}/git/blobs', {
        owner,
        repo,
        content: Buffer.from(f.content, 'utf8').toString('base64'),
        encoding: 'base64',
      });
      return { path: f.path, sha: (blob.data as any).sha };
    }),
  );

  // Create new tree
  const newTree = await o.request('POST /repos/{owner}/{repo}/git/trees', {
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: blobs.map((b) => ({
      path: b.path,
      mode: '100644',
      type: 'blob',
      sha: b.sha,
    })),
  });

  // Create commit
  const newCommit = await o.request('POST /repos/{owner}/{repo}/git/commits', {
    owner,
    repo,
    message,
    tree: (newTree.data as any).sha,
    parents: [headSha],
  });

  // Update ref
  await o.request('PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}', {
    owner,
    repo,
    branch,
    sha: (newCommit.data as any).sha,
    force: false,
  });

  return { commitSha: (newCommit.data as any).sha };
}

export async function openPullRequest(
  o: Octokit,
  owner: string,
  repo: string,
  head: string,
  base: string,
  title: string,
  body: string,
) {
  const res = await o.request('POST /repos/{owner}/{repo}/pulls', {
    owner,
    repo,
    title,
    head,
    base,
    body,
  });
  return {
    url: (res.data as any).html_url,
    number: (res.data as any).number,
    state: (res.data as any).state,
  };
}

export function splitRepo(repoFullName: string): { owner: string; repo: string } {
  const [owner, repo] = repoFullName.split('/');
  if (!owner || !repo) throw new Error('repo must be owner/name');
  return { owner, repo };
}
