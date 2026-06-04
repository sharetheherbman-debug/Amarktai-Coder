import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { prisma } from './db';

const COOKIE_NAME = 'amarktai_session';

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET not configured');
  return s;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signSessionToken(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, getSecret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN as any) || '7d',
  });
}

export function verifySessionToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as any;
    if (!decoded?.userId || !decoded?.email) return null;
    return { userId: decoded.userId, email: decoded.email };
  } catch {
    return null;
  }
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
}

export function readSessionFromCookies(): { userId: string; email: string } | null {
  const c = cookies().get(COOKIE_NAME);
  if (!c?.value) return null;
  return verifySessionToken(c.value);
}

export function readSessionFromRequest(req: NextRequest): { userId: string; email: string } | null {
  const tok = req.cookies.get(COOKIE_NAME)?.value;
  if (!tok) return null;
  return verifySessionToken(tok);
}

export async function getCurrentUser() {
  const session = readSessionFromCookies();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;
  // never leak password hash
  const { passwordHash, ...safe } = user;
  return safe;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
