import { NextResponse } from 'next/server';
import { genxValidateKey, isGenxConfigured } from '@/lib/genx';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const configured = isGenxConfigured();
  if (!configured) {
    return NextResponse.json({ configured: false, ok: false, error: 'GENX_API_KEY not set' });
  }
  const r = await genxValidateKey();
  return NextResponse.json({ configured: true, ok: r.ok, error: r.error });
}
