// RepoAuditAgent
// Reads tree + key files (package.json, README, config) and asks the LLM to
// summarize the stack and likely build/test commands.

import { AgentContext, AgentResult, recordStep } from './base';
import { getFile, getTree } from '../github';
import { genxChat } from '../genx';

const KEY_FILES = [
  'package.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'requirements.txt',
  'pyproject.toml',
  'Pipfile',
  'go.mod',
  'Cargo.toml',
  'composer.json',
  'Gemfile',
  'next.config.js',
  'next.config.mjs',
  'tsconfig.json',
  'Dockerfile',
  'docker-compose.yml',
  '.env.example',
  'README.md',
  'tailwind.config.js',
  'tailwind.config.ts',
  'vite.config.ts',
  'vite.config.js',
];

export async function runRepoAudit(ctx: AgentContext): Promise<AgentResult> {
  await recordStep(ctx.task.id, 'RepoAuditAgent', 'running', 'Auditing repository');
  try {
    const tree = await getTree(ctx.octokit, ctx.owner, ctx.repo, ctx.task.baseBranch);
    const paths: string[] = tree.items.filter((i: any) => i.type === 'blob').map((i: any) => i.path);
    const present = KEY_FILES.filter((f: string) => paths.includes(f));
    const fetched: { path: string; content: string }[] = [];
    for (const p of present.slice(0, 8)) {
      try {
        const f = await getFile(ctx.octokit, ctx.owner, ctx.repo, ctx.task.baseBranch, p);
        fetched.push({ path: p, content: (f.content || '').slice(0, 6000) });
      } catch {
        /* skip */
      }
    }
    const treePreview = paths.slice(0, 200).join('\n');
    const filesBlock = fetched
      .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
      .join('\n\n');

    const sys = `You are RepoAuditAgent. Given a repository's file tree and key config files, output a JSON object with keys:
- stack: short string describing the language/framework
- entryPoints: array of likely runnable entry files
- buildCommand: best-guess build command or null
- testCommand: best-guess test command or null
- runCommand: best-guess dev/run command or null
- envFiles: array of env files present
- issues: array of obvious problems (missing scripts, missing .env.example, etc.)
- summary: 2-3 sentence human summary
Only return JSON. No prose outside the JSON.`;
    const user = `Repository: ${ctx.owner}/${ctx.repo} @ ${ctx.task.baseBranch}\n\nFile tree (first 200):\n${treePreview}\n\nKey files:\n${filesBlock}`;
    const res = await genxChat({
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      purpose: 'audit',
      response_format: { type: 'json_object' },
      max_tokens: 1200,
    });
    let parsed: any = null;
    try {
      parsed = JSON.parse(res.content);
    } catch {
      parsed = { summary: res.content };
    }
    const summary = parsed?.summary || `Audited ${paths.length} files in ${ctx.owner}/${ctx.repo}`;
    await recordStep(
      ctx.task.id,
      'RepoAuditAgent',
      'completed',
      summary,
      JSON.stringify({ usage: { in: res.inputTokens, out: res.outputTokens } }),
    );
    return {
      agent: 'RepoAuditAgent',
      status: 'completed',
      summary,
      data: { audit: parsed, allPaths: paths, model: res.model, usage: { input: res.inputTokens, output: res.outputTokens } },
    };
  } catch (e: any) {
    const msg = e?.message || 'RepoAudit failed';
    await recordStep(ctx.task.id, 'RepoAuditAgent', 'failed', msg);
    return { agent: 'RepoAuditAgent', status: 'failed', summary: msg };
  }
}
