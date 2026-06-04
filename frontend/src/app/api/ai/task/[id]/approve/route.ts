import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getOctokitForUser, splitRepo } from '@/lib/github';
import { runPullRequest } from '@/lib/agents';

const schema = z
  .object({
    changeIds: z.array(z.string()).optional(),
    title: z.string().optional(),
    body: z.string().optional(),
  })
  .default({});

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: { changes: true },
  });
  if (!task || task.userId !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });

  const allow = parsed.data.changeIds && parsed.data.changeIds.length
    ? new Set(parsed.data.changeIds)
    : null;
  const approved = (task.changes || []).filter((c) => (allow ? allow.has(c.id) : true));
  if (!approved.length) return NextResponse.json({ error: 'No changes to approve' }, { status: 400 });

  // mark approval
  await prisma.codeChange.updateMany({
    where: { id: { in: approved.map((c) => c.id) } },
    data: { approved: true },
  });

  const o = await getOctokitForUser(user.id);
  if (!o) return NextResponse.json({ error: 'github not connected' }, { status: 400 });
  const { owner, repo } = splitRepo(task.repoFullName);
  const ctx = { task, octokit: o, owner, repo };
  const result = await runPullRequest(
    ctx,
    approved.map((c) => ({ path: c.filePath, content: c.afterContent })),
    parsed.data.title || `Amarktai: ${task.prompt.slice(0, 60)}`,
    parsed.data.body ||
      `Automated change set proposed by Amarktai Coder.\n\nTask: ${task.prompt}\nApproved files:\n${approved
        .map((c) => `- ${c.filePath}`)
        .join('\n')}`,
  );
  if (result.status === 'failed') {
    await prisma.task.update({
      where: { id: task.id },
      data: { status: 'failed', errorMessage: result.summary },
    });
    return NextResponse.json({ error: result.summary }, { status: 500 });
  }
  await prisma.task.update({
    where: { id: task.id },
    data: { status: 'completed', completedAt: new Date() },
  });
  return NextResponse.json({
    ok: true,
    prUrl: result.prUrl,
    branchName: result.branchName,
  });
}
