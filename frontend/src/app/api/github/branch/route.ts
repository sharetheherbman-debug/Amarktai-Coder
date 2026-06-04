import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { createBranch, getOctokitForUser, splitRepo } from '@/lib/github';

const schema = z.object({
  repo: z.string().regex(/^[^/]+\/[^/]+$/),
  baseBranch: z.string().min(1),
  newBranch: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  const o = await getOctokitForUser(user.id);
  if (!o) return NextResponse.json({ error: 'github not connected' }, { status: 400 });
  try {
    const { owner, repo: name } = splitRepo(parsed.data.repo);
    const out = await createBranch(o, owner, name, parsed.data.baseBranch, parsed.data.newBranch);
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
