'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';

export default function SettingsPage() {
  const [github, setGithub] = useState<any>(null);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ai, setAi] = useState<any>(null);
  const [models, setModels] = useState<any>(null);

  async function refresh() {
    const [g, a, m] = await Promise.all([
      fetch('/api/github/status').then(r => r.json()),
      fetch('/api/ai/status').then(r => r.json()),
      fetch('/api/ai/models').then(r => r.json()),
    ]);
    setGithub(g); setAi(a); setModels(m);
  }

  useEffect(() => { refresh(); }, []);

  async function saveToken(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/github/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error || 'Failed');
      } else {
        setMsg(`Connected as @${data.username}`);
        setToken('');
      }
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!confirm('Disconnect GitHub? Tasks will pause until you reconnect.')) return;
    await fetch('/api/github/status', { method: 'DELETE' });
    await refresh();
  }

  return (
    <div className="p-8 max-w-3xl">
      <p className="text-xs font-mono uppercase tracking-wider text-muted">Settings</p>
      <h1 className="text-3xl font-semibold mt-1">Integrations</h1>

      <section className="panel p-6 mt-8" data-testid="github-settings-card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">GitHub</h2>
          {github?.connected ? (
            <span className="badge badge-ok" data-testid="github-status-badge"><CheckCircle2 size={12} /> Connected as @{github.username}</span>
          ) : (
            <span className="badge badge-warn" data-testid="github-status-badge"><XCircle size={12} /> Not connected</span>
          )}
        </div>
        <p className="text-sm text-muted mt-2">
          Paste a GitHub Personal Access Token (classic or fine-grained) with{' '}
          <span className="font-mono text-white">repo</span> scope. Tokens are AES-256-GCM
          encrypted before storage and never logged.
        </p>
        <form onSubmit={saveToken} className="mt-4 space-y-3" data-testid="github-token-form">
          <input
            type="password"
            placeholder="ghp_... or github_pat_..."
            className="input font-mono"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            data-testid="github-token-input"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || token.length < 20}
              data-testid="github-token-save"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Save & test
            </button>
            {github?.connected && (
              <button type="button" onClick={disconnect} className="btn btn-danger" data-testid="github-disconnect">
                <Trash2 size={14} /> Disconnect
              </button>
            )}
            {msg && <span className="text-sm text-muted" data-testid="github-token-msg">{msg}</span>}
          </div>
        </form>
        {github?.scopes && (
          <p className="text-xs font-mono text-muted mt-3">scopes: {github.scopes || 'none'}</p>
        )}
      </section>

      <section className="panel p-6 mt-6" data-testid="genx-settings-card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">GenX AI</h2>
          {ai?.ok ? (
            <span className="badge badge-ok" data-testid="genx-status-badge"><CheckCircle2 size={12} /> Key valid</span>
          ) : ai?.configured ? (
            <span className="badge badge-danger" data-testid="genx-status-badge"><XCircle size={12} /> Key invalid</span>
          ) : (
            <span className="badge badge-warn" data-testid="genx-status-badge"><XCircle size={12} /> Not configured</span>
          )}
        </div>
        <p className="text-sm text-muted mt-2">
          GenX is configured via server env vars{' '}
          <code className="font-mono text-white">GENX_API_KEY</code> and{' '}
          <code className="font-mono text-white">GENX_BASE_URL</code>. Set them in{' '}
          <code className="font-mono text-white">.env</code> and restart the app. We never expose the key to the browser.
        </p>
        <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
          <div className="panel p-3">
            <div className="text-xs text-muted">Default chat model</div>
            <div className="font-mono mt-1">{models?.models?.[0] || '—'}</div>
          </div>
          <div className="panel p-3">
            <div className="text-xs text-muted">Available models</div>
            <div className="font-mono mt-1 text-xs leading-relaxed line-clamp-3">
              {(models?.models || []).join(', ') || '—'}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <button className="btn" onClick={refresh} data-testid="genx-recheck">Re-test key</button>
          {ai?.error && (
            <p className="mt-3 text-xs text-danger font-mono">{ai.error}</p>
          )}
        </div>
      </section>
    </div>
  );
}
