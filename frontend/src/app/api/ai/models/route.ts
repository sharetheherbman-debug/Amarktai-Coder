import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { genxListModels, isGenxConfigured } from '@/lib/genx';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const out = await genxListModels();
  return NextResponse.json({ ...out, configured: isGenxConfigured() });
}
