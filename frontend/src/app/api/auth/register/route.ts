import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, setSessionCookie, signSessionToken } from '@/lib/auth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { email, password } = parsed.data;
  const lower = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: lower } });
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email: lower, passwordHash },
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: 'user.register', metadataJson: JSON.stringify({}) },
  });
  const token = signSessionToken({ userId: user.id, email: user.email });
  setSessionCookie(token);
  return NextResponse.json({ id: user.id, email: user.email });
}
