// PullRequestAgent
// Creates a working branch, commits approved changes, opens PR.

import { AgentContext, AgentResult, recordStep } from './base';
import { commitFiles, createBranch, openPullRequest } from '../github';
import { prisma } from '../db';

export async function runPullRequest(
  ctx: AgentContext,
  approvedChanges: { path: string; content: string }[],
  title: string,
  body: string,
): Promise<AgentResult & { prUrl?: string; branchName?: string }> {
  await recordStep(ctx.task.id, 'PullRequestAgent', 'running', 'Creating branch + PR');
  try {
    const safePrompt = (ctx.task.prompt || 'task').slice(0, 30).replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
    const branchName =
      ctx.task.workingBranch ||
      `amarktai/${safePrompt || 'task'}-${ctx.task.id.slice(0, 6)}`;

    await createBranch(ctx.octokit, ctx.owner, ctx.repo, ctx.task.baseBranch, branchName);
    await commitFiles(
      ctx.octokit,
      ctx.owner,
      ctx.repo,
      branchName,
      approvedChanges,
      `Amarktai Coder: ${ctx.task.prompt.slice(0, 60)}`,
    );
    const pr = await openPullRequest(
      ctx.octokit,
      ctx.owner,
      ctx.repo,
      branchName,
      ctx.task.baseBranch,
      title,
      body,
    );

    await prisma.task.update({
      where: { id: ctx.task.id },
      data: { workingBranch: branchName, pullRequestUrl: pr.url },
    });
    await prisma.pullRequest.upsert({
      where: { taskId: ctx.task.id },
      update: { prUrl: pr.url, branchName, status: pr.state || 'open' },
      create: {
        taskId: ctx.task.id,
        userId: ctx.task.userId,
        repoFullName: ctx.task.repoFullName,
        branchName,
        prUrl: pr.url,
        status: pr.state || 'open',
      },
    });

    const summary = `Opened PR #${pr.number}`;
    await recordStep(ctx.task.id, 'PullRequestAgent', 'completed', summary, pr.url);
    return {
      agent: 'PullRequestAgent',
      status: 'completed',
      summary,
      prUrl: pr.url,
      branchName,
    };
  } catch (e: any) {
    const msg = e?.message || 'PullRequest failed';
    await recordStep(ctx.task.id, 'PullRequestAgent', 'failed', msg);
    return { agent: 'PullRequestAgent', status: 'failed', summary: msg };
  }
}
