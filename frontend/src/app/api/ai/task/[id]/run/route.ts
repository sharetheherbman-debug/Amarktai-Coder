import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getOctokitForUser, splitRepo } from '@/lib/github';
import {
  runCodeEdit,
  runPlanner,
  runRepoAudit,
  runRepoConnector,
  runReview,
} from '@/lib/agents';
import { isGenxConfigured } from '@/lib/genx';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task || task.userId !== user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  if (!isGenxConfigured()) {
    return NextResponse.json(
      { error: 'GENX_API_KEY is not configured. Set it under Settings.' },
      { status: 400 },
    );
  }
  const octokit = await getOctokitForUser(user.id);
  if (!octokit) return NextResponse.json({ error: 'github not connected' }, { status: 400 });
  const { owner, repo } = splitRepo(task.repoFullName);

  await prisma.task.update({
    where: { id: task.id },
    data: { status: 'running', errorMessage: null },
  });

  try {
    const ctx = { task, octokit, owner, repo };
    const conn = await runRepoConnector(ctx);
    if (conn.status === 'failed') throw new Error(conn.summary);

    const audit = await runRepoAudit(ctx);
    if (audit.status === 'failed') throw new Error(audit.summary);

    const plan = await runPlanner(ctx, audit.data?.audit, audit.data?.allPaths || []);
    if (plan.status === 'failed') throw new Error(plan.summary);

    await prisma.task.update({
      where: { id: task.id },
      data: {
        planJson: JSON.stringify({
          audit: audit.data?.audit,
          plan: plan.data?.plan,
        }),
      },
    });

    const edit = await runCodeEdit(ctx, plan.data?.plan);
    if (edit.status === 'failed') throw new Error(edit.summary);

    // wipe and save proposed changes
    await prisma.codeChange.deleteMany({ where: { taskId: task.id } });
    if (edit.changes && edit.changes.length) {
      await prisma.codeChange.createMany({
        data: edit.changes.map((c) => ({
          taskId: task.id,
          filePath: c.path,
          beforeContent: c.beforeContent,
          afterContent: c.afterContent,
          diff: c.diff,
          approved: false,
        })),
      });
    }
    const review = await runReview(ctx, edit.changes || []);

    const finalStatus = (edit.changes || []).length ? 'needs_approval' : 'completed';
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: finalStatus,
        completedAt: finalStatus === 'completed' ? new Date() : null,
      },
    });

    return NextResponse.json({
      ok: true,
      status: finalStatus,
      review: review.data,
      changeCount: (edit.changes || []).length,
    });
  } catch (e: any) {
    await prisma.task.update({
      where: { id: task.id },
      data: { status: 'failed', errorMessage: e?.message || 'task failed' },
    });
    return NextResponse.json({ error: e?.message || 'task failed' }, { status: 500 });
  }
}
