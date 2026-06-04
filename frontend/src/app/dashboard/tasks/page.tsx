'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ai/task').then(r => r.json()).then((d) => {
      setTasks(d.tasks || []); setLoading(false);
    });
  }, []);

  return (
    <div className="p-8 max-w-6xl">
      <p className="text-xs font-mono uppercase tracking-wider text-muted">Tasks</p>
      <h1 className="text-3xl font-semibold mt-1">All AI tasks</h1>

      <div className="mt-6 panel">
        {loading ? (
          <p className="text-sm text-muted p-5">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted p-5">
            No tasks yet. Start one from the{' '}
            <Link href="/dashboard/workbench" className="link-accent">workbench</Link>.
          </p>
        ) : (
          <table className="w-full text-sm" data-testid="tasks-table">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3">Prompt</th>
                <th className="px-4 py-3">Repo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">PR</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t: any) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="px-4 py-3 max-w-sm">
                    <div className="line-clamp-2">{t.prompt}</div>
                    {t.errorMessage && <div className="text-xs text-danger font-mono mt-1">{t.errorMessage}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{t.repoFullName} @ {t.baseBranch}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${statusClass(t.status)}`}>{t.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {t.pullRequestUrl ? (
                      <a className="link-accent" href={t.pullRequestUrl} target="_blank" rel="noreferrer">Open</a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted font-mono">{new Date(t.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function statusClass(s: string) {
  if (s === 'completed') return 'badge-ok';
  if (s === 'needs_approval') return 'badge-warn';
  if (s === 'running') return 'badge-info';
  if (s === 'failed' || s === 'rejected') return 'badge-danger';
  return '';
}
