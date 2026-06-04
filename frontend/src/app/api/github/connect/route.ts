import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encryptSecret } from '@/lib/crypto';
import { validateToken } from '@/lib/github';

const schema = z.object({ token: z.string().min(20) });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const token = parsed.data.token.trim();
  const v = await validateToken(token);
  if (!v.valid) {
    return NextResponse.json({ error: v.error || 'Invalid GitHub token' }, { status: 400 });
  }
  const enc = encryptSecret(token);
  await prisma.gitHubConnection.upsert({
    where: { userId: user.id },
    update: {
      encryptedToken: enc,
      githubUsername: v.username || null,
      scopes: v.scopes || null,
      tokenLastValidatedAt: new Date(),
    },
    create: {
      userId: user.id,
      encryptedToken: enc,
      githubUsername: v.username || null,
      scopes: v.scopes || null,
      tokenLastValidatedAt: new Date(),
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'github.connect',
      metadataJson: JSON.stringify({ username: v.username, scopes: v.scopes }),
    },
  });
  return NextResponse.json({ ok: true, username: v.username, scopes: v.scopes });
}
