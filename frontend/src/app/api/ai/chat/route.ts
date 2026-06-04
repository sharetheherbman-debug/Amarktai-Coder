import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { genxChat, isGenxConfigured } from '@/lib/genx';
import { getFile, getOctokitForUser, splitRepo } from '@/lib/github';
import { prisma } from '@/lib/db';

const schema = z.object({
  repo: z.string().optional(),
  branch: z.string().optional(),
  selectedFiles: z.array(z.string()).max(8).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      }),
    )
    .min(1),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isGenxConfigured()) {
    return NextResponse.json(
      { error: 'GENX_API_KEY not configured. Set it under Settings.' },
      { status: 400 },
    );
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });

  const repoFiles: { path: string; content: string }[] = [];
  if (parsed.data.repo && parsed.data.branch && parsed.data.selectedFiles?.length) {
    const o = await getOctokitForUser(user.id);
    if (!o) return NextResponse.json({ error: 'github not connected' }, { status: 400 });
    const { owner, repo: name } = splitRepo(parsed.data.repo);
    for (const p of parsed.data.selectedFiles.slice(0, 8)) {
      try {
        const f = await getFile(o, owner, name, parsed.data.branch, p);
        repoFiles.push({ path: p, content: (f.content || '').slice(0, 12000) });
      } catch {
        /* tolerate */
      }
    }
  }

  const sys = `You are AmarktaiCoder, an AI coding assistant.
${
  parsed.data.repo
    ? `Selected repository: ${parsed.data.repo} @ branch ${parsed.data.branch || 'unknown'}.`
    : 'No repository is currently selected.'
}
Rules:
- If you need to inspect a file that has not been provided, say so and ask the user to include it (or to run an "Audit & plan" task).
- Never claim a change was committed. Only the "Run task" workflow can commit. Chat is read-only.
- Be concise. Use markdown for code blocks. Prefer short, surgical suggestions.
${repoFiles.length ? `\nYou have been given the contents of these files:\n${repoFiles.map((f) => f.path).join(', ')}` : ''}`;

  const filesBlock = repoFiles
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n');

  const messages = [
    { role: 'system' as const, content: sys + (filesBlock ? `\n\n${filesBlock}` : '') },
    ...parsed.data.messages,
  ];

  try {
    const res = await genxChat({ messages, purpose: 'chat', max_tokens: 1500 });
    await prisma.modelUsage.create({
      data: {
        userId: user.id,
        model: res.model,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
      },
    });
    return NextResponse.json({
      reply: res.content,
      model: res.model,
      usage: { input: res.inputTokens, output: res.outputTokens },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'chat failed' }, { status: 500 });
  }
}
