import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task || task.userId !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await prisma.codeChange.deleteMany({ where: { taskId: task.id } });
  await prisma.task.update({
    where: { id: task.id },
    data: { status: 'rejected', completedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
