import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  const gh = await prisma.gitHubConnection.findUnique({
    where: { userId: user.id },
    select: { githubUsername: true, tokenLastValidatedAt: true, scopes: true },
  });
  return NextResponse.json({ user, github: gh });
}
