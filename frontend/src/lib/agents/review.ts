// ReviewAgent
// Reviews diffs for risky changes (secrets, hard-coded creds, unsafe shell, mass deletes).
// LLM optional; runs heuristic checks first.

import { AgentContext, AgentResult, recordStep } from './base';
import { genxChat } from '../genx';

const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'AWS key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub token', re: /ghp_[A-Za-z0-9]{30,}/ },
  { name: 'OpenAI key', re: /sk-[A-Za-z0-9]{20,}/ },
  { name: 'Generic secret', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
];

export async function runReview(
  ctx: AgentContext,
  changes: { path: string; beforeContent: string | null; afterContent: string }[],
): Promise<AgentResult> {
  await recordStep(ctx.task.id, 'ReviewAgent', 'running', 'Reviewing diffs for risk and secrets');
  try {
    const flags: string[] = [];
    for (const c of changes) {
      for (const sp of SECRET_PATTERNS) {
        if (sp.re.test(c.afterContent)) flags.push(`${c.path}: potential ${sp.name}`);
      }
      if (c.beforeContent && c.afterContent.length < c.beforeContent.length * 0.2) {
        flags.push(`${c.path}: large deletion (>80% reduction)`);
      }
    }
    let llmRisk: any = null;
    try {
      const sys = `You are ReviewAgent. Given a list of file changes (path + summary), output JSON: { "risk": "low"|"medium"|"high", "concerns": string[] }. Be concise. Output JSON only.`;
      const compact = changes
        .map((c) => `path: ${c.path}\nbefore_len: ${c.beforeContent?.length || 0}\nafter_len: ${c.afterContent.length}\nfirst_diff_lines: ${(c.afterContent.split('\n').slice(0, 10).join('\n')).slice(0, 800)}`)
        .join('\n\n');
      const r = await genxChat({
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: compact.slice(0, 5000) },
        ],
        purpose: 'review',
        response_format: { type: 'json_object' },
        max_tokens: 400,
      });
      try {
        llmRisk = JSON.parse(r.content);
      } catch {
        llmRisk = null;
      }
    } catch {
      // ignore review LLM errors; heuristics already done
    }
    const concerns = [...flags, ...((llmRisk?.concerns as string[]) || [])];
    const risk = flags.length ? 'high' : (llmRisk?.risk || 'low');
    const summary = `Risk: ${risk}; ${concerns.length} concern(s)`;
    await recordStep(ctx.task.id, 'ReviewAgent', 'completed', summary, JSON.stringify({ concerns }));
    return {
      agent: 'ReviewAgent',
      status: 'completed',
      summary,
      data: { risk, concerns },
    };
  } catch (e: any) {
    const msg = e?.message || 'Review failed';
    await recordStep(ctx.task.id, 'ReviewAgent', 'failed', msg);
    return { agent: 'ReviewAgent', status: 'failed', summary: msg };
  }
}
