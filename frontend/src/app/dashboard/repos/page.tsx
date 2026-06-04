'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ExternalLink, Lock, GitBranch } from 'lucide-react';

export default function ReposPage() {
  const [repos, setRepos] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch('/api/github/repos')
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || 'Failed to list repos');
        }
        return r.json();
      })
      .then((d) => setRepos(d.repos))
      .catch((e) => setErr(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!repos) return null;
    const t = q.trim().toLowerCase();
    if (!t) return repos;
    return repos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(t) ||
        (r.description || '').toLowerCase().includes(t) ||
        (r.language || '').toLowerCase().includes(t),
    );
  }, [repos, q]);

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-muted">Repositories</p>
          <h1 className="text-3xl font-semibold mt-1">Your GitHub repos</h1>
        </div>
        <Link href="/dashboard/settings" className="btn">Manage token</Link>
      </div>

      <div className="mt-6 panel p-3 flex items-center gap-2">
        <Search size={16} className="text-muted ml-1" />
        <input
          data-testid="repo-search"
          className="input border-none bg-transparent focus:shadow-none"
          placeholder="Search by name, language, description"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {err && (
        <div className="panel p-5 mt-6 border-danger/30 text-danger" data-testid="repos-error">
          {err}.{' '}
          <Link href="/dashboard/settings" className="link-accent">
            Go to Settings →
          </Link>
        </div>
      )}

      {!err && repos === null && (
        <p className="text-sm text-muted mt-6" data-testid="repos-loading">Loading…</p>
      )}

      {filtered && filtered.length === 0 && (
        <p className="text-sm text-muted mt-6">No repositories match your search.</p>
      )}

      <ul className="mt-6 grid md:grid-cols-2 gap-4" data-testid="repos-list">
        {(filtered || []).map((r: any) => (
          <li key={r.fullName} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-mono text-muted">{r.owner}</div>
                <Link
                  href={`/dashboard/workbench?repo=${encodeURIComponent(r.fullName)}&branch=${encodeURIComponent(r.defaultBranch)}`}
                  className="text-base font-semibold hover:text-accent block truncate"
                  data-testid={`repo-link-${r.fullName}`}
                >
                  {r.name}
                </Link>
              </div>
              <div className="flex items-center gap-2">
                {r.private && <span className="badge"><Lock size={11} /> private</span>}
                <a
                  href={r.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost text-xs"
                  title="Open on GitHub"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
            <p className="text-sm text-muted mt-2 line-clamp-2 min-h-[2.5rem]">
              {r.description || 'No description.'}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted font-mono">
                <GitBranch size={12} /> {r.defaultBranch}
                {r.language && <span className="badge ml-2">{r.language}</span>}
              </div>
              <Link
                href={`/dashboard/workbench?repo=${encodeURIComponent(r.fullName)}&branch=${encodeURIComponent(r.defaultBranch)}`}
                className="btn btn-primary text-xs"
                data-testid={`open-workbench-${r.fullName}`}
              >
                Open
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
