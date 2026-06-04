import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { decryptSecret } from '@/lib/crypto';
import { validateToken } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const conn = await prisma.gitHubConnection.findUnique({ where: { userId: user.id } });
  if (!conn) return NextResponse.json({ connected: false });
  try {
    const token = decryptSecret(conn.encryptedToken);
    const v = await validateToken(token);
    if (!v.valid) {
      return NextResponse.json({
        connected: false,
        savedUsername: conn.githubUsername,
        error: v.error || 'Token no longer valid',
      });
    }
    // refresh metadata
    await prisma.gitHubConnection.update({
      where: { userId: user.id },
      data: {
        githubUsername: v.username || conn.githubUsername,
        scopes: v.scopes || conn.scopes,
        tokenLastValidatedAt: new Date(),
      },
    });
    return NextResponse.json({
      connected: true,
      username: v.username,
      scopes: v.scopes,
      lastValidatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ connected: false, error: e?.message || 'decrypt failed' });
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await prisma.gitHubConnection.deleteMany({ where: { userId: user.id } });
  await prisma.auditLog.create({
    data: { userId: user.id, action: 'github.disconnect', metadataJson: '{}' },
  });
  return NextResponse.json({ ok: true });
}
