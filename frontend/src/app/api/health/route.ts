import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbOk = false;
  let dbError: string | undefined;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (e: any) {
    dbError = e?.message || 'db error';
  }
  return NextResponse.json({
    app: 'ok',
    db: dbOk ? 'ok' : 'error',
    dbError,
    timestamp: new Date().toISOString(),
  });
}
