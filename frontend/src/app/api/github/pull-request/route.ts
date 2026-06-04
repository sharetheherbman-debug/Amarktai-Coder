import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getOctokitForUser, openPullRequest, splitRepo } from '@/lib/github';

const schema = z.object({
  repo: z.string().regex(/^[^/]+\/[^/]+$/),
  head: z.string().min(1),
  base: z.string().min(1),
  title: z.string().min(1),
  body: z.string().default(''),
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
    const pr = await openPullRequest(
      o,
      owner,
      name,
      parsed.data.head,
      parsed.data.base,
      parsed.data.title,
      parsed.data.body,
    );
    return NextResponse.json(pr);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
