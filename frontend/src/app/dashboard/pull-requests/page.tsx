'use client';
import { useEffect, useState } from 'react';

export default function PullRequestsPage() {
  const [prs, setPrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pull-requests').then(r => r.json()).then(d => {
      setPrs(d.pullRequests || []); setLoading(false);
    });
  }, []);

  return (
    <div className="p-8 max-w-6xl">
      <p className="text-xs font-mono uppercase tracking-wider text-muted">Pull requests</p>
      <h1 className="text-3xl font-semibold mt-1">Opened by Amarktai Coder</h1>

      <div className="mt-6 panel">
        {loading ? (
          <p className="p-5 text-sm text-muted">Loading…</p>
        ) : prs.length === 0 ? (
          <p className="p-5 text-sm text-muted">No PRs yet.</p>
        ) : (
          <table className="w-full text-sm" data-testid="prs-table">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3">Repository</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Opened</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {prs.map((p: any) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-4 py-3 font-mono text-xs">{p.repoFullName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{p.branchName}</td>
                  <td className="px-4 py-3 max-w-md line-clamp-2 text-xs text-muted">{p.task?.prompt || '—'}</td>
                  <td className="px-4 py-3"><span className="badge">{p.status}</span></td>
                  <td className="px-4 py-3 text-xs text-muted font-mono">{new Date(p.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <a className="link-accent text-xs" href={p.prUrl} target="_blank" rel="noreferrer">Open on GitHub</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
