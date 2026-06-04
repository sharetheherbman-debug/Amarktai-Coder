import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      steps: { orderBy: { createdAt: 'asc' } },
      changes: { orderBy: { createdAt: 'asc' } },
      pullRequest: true,
    },
  });
  if (!task || task.userId !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ task });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task || task.userId !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await prisma.task.delete({ where: { id: task.id } });
  return NextResponse.json({ ok: true });
}
