import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getFile, getOctokitForUser, splitRepo } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const repo = searchParams.get('repo');
  const branch = searchParams.get('branch');
  const path = searchParams.get('path');
  if (!repo || !branch || !path) {
    return NextResponse.json({ error: 'repo, branch, path required' }, { status: 400 });
  }
  const o = await getOctokitForUser(user.id);
  if (!o) return NextResponse.json({ error: 'github not connected' }, { status: 400 });
  try {
    const { owner, repo: name } = splitRepo(repo);
    const file = await getFile(o, owner, name, branch, path);
    return NextResponse.json(file);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
