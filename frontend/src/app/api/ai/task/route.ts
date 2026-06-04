import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

const schema = z.object({
  repo: z.string().regex(/^[^/]+\/[^/]+$/),
  baseBranch: z.string().min(1),
  prompt: z.string().min(4),
});

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  const t = await prisma.task.create({
    data: {
      userId: user.id,
      repoFullName: parsed.data.repo,
      baseBranch: parsed.data.baseBranch,
      prompt: parsed.data.prompt,
      status: 'queued',
    },
  });
  return NextResponse.json({ task: t });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const tasks = await prisma.task.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { steps: true, changes: true, pullRequest: true },
  });
  return NextResponse.json({ tasks });
}
