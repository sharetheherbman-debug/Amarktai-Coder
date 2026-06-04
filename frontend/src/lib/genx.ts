// GenX client (OpenAI-compatible Chat Completions)
// Uses node fetch; no extra dep.

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type GenxChatRequest = {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' } | { type: 'text' };
  purpose?: 'chat' | 'coding' | 'audit' | 'review' | 'plan';
};

export type GenxChatResult = {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  raw: any;
};

function pickModel(purpose: GenxChatRequest['purpose']) {
  const coding = process.env.GENX_DEFAULT_CODING_MODEL || 'gpt-4o';
  const chat = process.env.GENX_DEFAULT_CHAT_MODEL || 'gpt-4o-mini';
  switch (purpose) {
    case 'coding':
    case 'audit':
    case 'review':
    case 'plan':
      return coding;
    case 'chat':
    default:
      return chat;
  }
}

export function isGenxConfigured(): boolean {
  return !!process.env.GENX_API_KEY && !!process.env.GENX_BASE_URL;
}

export async function genxChat(req: GenxChatRequest): Promise<GenxChatResult> {
  const apiKey = process.env.GENX_API_KEY;
  const baseUrl = process.env.GENX_BASE_URL || 'https://query.genx.sh/v1';
  if (!apiKey) {
    throw new Error('GENX_API_KEY is not configured. Add it in /dashboard/settings.');
  }
  const model = req.model || pickModel(req.purpose);
  const body: any = {
    model,
    messages: req.messages,
    temperature: req.temperature ?? 0.2,
  };
  if (req.max_tokens) body.max_tokens = req.max_tokens;
  if (req.response_format) body.response_format = req.response_format;

  const resp = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    let detail = '';
    try {
      detail = await resp.text();
    } catch {}
    throw new Error(`GenX error ${resp.status}: ${detail.slice(0, 500)}`);
  }
  const data: any = await resp.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const usage = data?.usage || {};
  return {
    content,
    model: data?.model || model,
    inputTokens: usage.prompt_tokens || 0,
    outputTokens: usage.completion_tokens || 0,
    raw: data,
  };
}

export async function genxValidateKey(): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.GENX_API_KEY) return { ok: false, error: 'GENX_API_KEY not set' };
  try {
    await genxChat({
      messages: [
        { role: 'system', content: 'You are a healthcheck. Reply with the single token: ok' },
        { role: 'user', content: 'ping' },
      ],
      max_tokens: 4,
      purpose: 'chat',
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'GenX validation failed' };
  }
}

export async function genxListModels(): Promise<{ models: string[]; configured: boolean }> {
  const configured = isGenxConfigured();
  const fallback = [
    process.env.GENX_DEFAULT_CHAT_MODEL || 'gpt-4o-mini',
    process.env.GENX_DEFAULT_CODING_MODEL || 'gpt-4o',
  ];
  if (!configured) return { models: Array.from(new Set(fallback)), configured: false };
  try {
    const baseUrl = process.env.GENX_BASE_URL || 'https://query.genx.sh/v1';
    const apiKey = process.env.GENX_API_KEY!;
    const resp = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) return { models: Array.from(new Set(fallback)), configured: true };
    const data: any = await resp.json();
    const ids: string[] = (data?.data || [])
      .map((m: any) => m.id)
      .filter((x: any) => typeof x === 'string');
    if (!ids.length) return { models: Array.from(new Set(fallback)), configured: true };
    return { models: ids, configured: true };
  } catch {
    return { models: Array.from(new Set(fallback)), configured: true };
  }
}
