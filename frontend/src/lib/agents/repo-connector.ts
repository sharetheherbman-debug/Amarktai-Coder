// RepoConnectorAgent
// Resolves repo metadata from GitHub and verifies access.

import { AgentContext, AgentResult, recordStep } from './base';
import { listBranches } from '../github';

export async function runRepoConnector(ctx: AgentContext): Promise<AgentResult> {
  await recordStep(ctx.task.id, 'RepoConnectorAgent', 'running', 'Verifying GitHub access');
  try {
    const branches = await listBranches(ctx.octokit, ctx.owner, ctx.repo);
    const exists = branches.some((b) => b.name === ctx.task.baseBranch);
    if (!exists) {
      const msg = `Base branch '${ctx.task.baseBranch}' not found in repository`;
      await recordStep(ctx.task.id, 'RepoConnectorAgent', 'failed', msg);
      return { agent: 'RepoConnectorAgent', status: 'failed', summary: msg };
    }
    const summary = `Connected to ${ctx.owner}/${ctx.repo} (${branches.length} branches)`;
    await recordStep(ctx.task.id, 'RepoConnectorAgent', 'completed', summary);
    return {
      agent: 'RepoConnectorAgent',
      status: 'completed',
      summary,
      data: { branches: branches.map((b) => b.name) },
    };
  } catch (e: any) {
    const msg = e?.message || 'RepoConnector failed';
    await recordStep(ctx.task.id, 'RepoConnectorAgent', 'failed', msg);
    return { agent: 'RepoConnectorAgent', status: 'failed', summary: msg };
  }
}
