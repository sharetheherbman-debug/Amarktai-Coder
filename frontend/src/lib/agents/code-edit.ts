// CodeEditAgent
// Fetches the files specified by the planner and asks the LLM to produce
// new file contents. Returns proposed CodeChange[] (before/after).

import { AgentContext, AgentResult, recordStep } from './base';
import { getFile } from '../github';
import { genxChat } from '../genx';
import { lineDiff } from '../diff';

type Proposed = {
  path: string;
  beforeContent: string | null;
  afterContent: string;
  diff: string;
};

const MAX_FILE_BYTES = 80_000; // safety cap

export async function runCodeEdit(
  ctx: AgentContext,
  plan: any,
): Promise<AgentResult & { changes?: Proposed[] }> {
  await recordStep(ctx.task.id, 'CodeEditAgent', 'running', 'Generating code changes');
  try {
    const inspect: string[] = Array.from(
      new Set([...(plan?.filesToInspect || []), ...(plan?.filesToEdit || [])]),
    ).slice(0, 10) as string[];
    const fetched: { path: string; content: string }[] = [];
    for (const p of inspect) {
      try {
        const f = await getFile(ctx.octokit, ctx.owner, ctx.repo, ctx.task.baseBranch, p);
        const content = (f.content || '').slice(0, MAX_FILE_BYTES);
        fetched.push({ path: p, content });
      } catch {
        /* tolerate; planner may have referenced a non-existent path */
      }
    }
    const newFiles: string[] = (plan?.filesToCreate || []).slice(0, 6);

    const sys = `You are CodeEditAgent. Produce ONLY JSON with the shape:
{ "changes": [{ "path": string, "newContent": string, "rationale": string }] }
Rules:
- Output the FULL final content for each changed/new file in newContent.
- Do NOT abbreviate ("// rest of file unchanged" is FORBIDDEN). Output complete files.
- Limit changes to what the user's request strictly requires.
- Do not invent imports for libraries that aren't present.
- For new files, include them with their intended path and full content.
- Never include explanations outside the JSON.
- Never include code blocks fences around the JSON.`;
    const filesBlock = fetched
      .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
      .join('\n\n');
    const newFilesBlock = newFiles.length
      ? `\n\nNew files to create (paths only, you must provide full content):\n${newFiles.join('\n')}`
      : '';
    const user = `Task:\n${ctx.task.prompt}\n\nPlan:\n${JSON.stringify(plan).slice(
      0,
      3000,
    )}${newFilesBlock}\n\nExisting files:\n${filesBlock}`;
    const res = await genxChat({
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      purpose: 'coding',
      response_format: { type: 'json_object' },
      max_tokens: 4000,
    });
    let parsed: any = {};
    try {
      parsed = JSON.parse(res.content);
    } catch {
      parsed = { changes: [] };
    }
    const changes: Proposed[] = [];
    for (const c of parsed.changes || []) {
      if (!c?.path || typeof c.newContent !== 'string') continue;
      const before = fetched.find((f) => f.path === c.path)?.content ?? null;
      const after = c.newContent;
      if (before !== null && before === after) continue;
      changes.push({
        path: c.path,
        beforeContent: before,
        afterContent: after,
        diff: lineDiff(before || '', after),
      });
    }
    const summary = `Proposed ${changes.length} file change(s)`;
    await recordStep(ctx.task.id, 'CodeEditAgent', 'completed', summary);
    return {
      agent: 'CodeEditAgent',
      status: 'completed',
      summary,
      changes,
      data: { model: res.model, usage: { input: res.inputTokens, output: res.outputTokens } },
    };
  } catch (e: any) {
    const msg = e?.message || 'CodeEdit failed';
    await recordStep(ctx.task.id, 'CodeEditAgent', 'failed', msg);
    return { agent: 'CodeEditAgent', status: 'failed', summary: msg };
  }
}
