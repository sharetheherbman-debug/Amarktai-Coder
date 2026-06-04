import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOctokitForUser, listRepos } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const o = await getOctokitForUser(user.id);
  if (!o) return NextResponse.json({ error: 'github not connected' }, { status: 400 });
  try {
    const repos = await listRepos(o);
    return NextResponse.json({ repos });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed to list repos' }, { status: 500 });
  }
}
