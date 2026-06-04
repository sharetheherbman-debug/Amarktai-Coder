// PlannerAgent
// Converts the user's prompt + audit summary into a structured task plan.

import { AgentContext, AgentResult, recordStep } from './base';
import { genxChat } from '../genx';

export async function runPlanner(
  ctx: AgentContext,
  audit: any,
  allPaths: string[],
): Promise<AgentResult> {
  await recordStep(ctx.task.id, 'PlannerAgent', 'running', 'Drafting task plan');
  try {
    const sys = `You are PlannerAgent. Given a coding task and a repo audit, output ONLY JSON with shape:
{
  "steps": [{ "title": string, "description": string }],
  "filesToInspect": string[],   // existing files you NEED to read before editing
  "filesToCreate": string[],    // new files you intend to add (empty if none)
  "filesToEdit": string[],      // existing files you intend to modify
  "risk": "low" | "medium" | "high",
  "notes": string
}
Rules:
- Only reference paths that exist in the provided file list (for inspect/edit). New files in filesToCreate may use new paths.
- Be conservative. Prefer the smallest possible change set.
- Cap filesToInspect to 8 entries.
- Return JSON only.`;
    const treePreview = (allPaths || []).slice(0, 400).join('\n');
    const user = `User prompt:\n${ctx.task.prompt}\n\nAudit summary:\n${JSON.stringify(
      audit || {},
    ).slice(0, 4000)}\n\nFile list (first 400):\n${treePreview}`;
    const res = await genxChat({
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      purpose: 'plan',
      response_format: { type: 'json_object' },
      max_tokens: 1200,
    });
    let plan: any = {};
    try {
      plan = JSON.parse(res.content);
    } catch {
      plan = { steps: [], notes: res.content };
    }
    const summary = `Plan: ${(plan.steps || []).length} steps, ${
      (plan.filesToEdit || []).length
    } edits, ${(plan.filesToCreate || []).length} new files (risk: ${plan.risk || 'low'})`;
    await recordStep(ctx.task.id, 'PlannerAgent', 'completed', summary);
    return {
      agent: 'PlannerAgent',
      status: 'completed',
      summary,
      data: { plan, model: res.model, usage: { input: res.inputTokens, output: res.outputTokens } },
    };
  } catch (e: any) {
    const msg = e?.message || 'Planner failed';
    await recordStep(ctx.task.id, 'PlannerAgent', 'failed', msg);
    return { agent: 'PlannerAgent', status: 'failed', summary: msg };
  }
}
