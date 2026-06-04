'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, AlertTriangle, GitPullRequest, ListChecks } from 'lucide-react';

export default function DashboardPage() {
  const [github, setGithub] = useState<any>(null);
  const [ai, setAi] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [prs, setPrs] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/github/status').then(r => r.json()).then(setGithub).catch(() => {});
    fetch('/api/ai/status').then(r => r.json()).then(setAi).catch(() => {});
    fetch('/api/ai/task').then(r => r.json()).then(d => setTasks(d.tasks || [])).catch(() => {});
    fetch('/api/pull-requests').then(r => r.json()).then(d => setPrs(d.pullRequests || [])).catch(() => {});
  }, []);

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-muted">Overview</p>
          <h1 className="text-3xl font-semibold mt-1">Workspace</h1>
        </div>
        <Link href="/dashboard/workbench" className="btn btn-primary" data-testid="open-workbench-btn">
          Open Repo Workbench <ArrowRight size={14} />
        </Link>
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-4">
        <StatusCard
          testid="status-github"
          title="GitHub"
          ok={!!github?.connected}
          okText={github?.connected ? `Connected as @${github?.username || 'unknown'}` : null}
          errText={!github ? 'Loading…' : github?.error || 'Not connected'}
          actionHref="/dashboard/settings"
          actionLabel={github?.connected ? 'Manage token' : 'Connect GitHub'}
        />
        <StatusCard
          testid="status-genx"
          title="GenX AI"
          ok={!!ai?.ok}
          okText={ai?.ok ? 'Key valid · ready to plan, edit, review' : null}
          errText={!ai ? 'Loading…' : (ai?.error || 'Not configured')}
          actionHref="/dashboard/settings"
          actionLabel={ai?.configured ? 'Re-test key' : 'Configure GenX'}
        />
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-4">
        <div className="panel p-5" data-testid="recent-tasks-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-accent">
              <ListChecks size={16} /> <span className="text-xs uppercase tracking-wider">Recent tasks</span>
            </div>
            <Link href="/dashboard/tasks" className="text-xs link-accent">View all</Link>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted mt-4">No tasks yet. Run your first one from the workbench.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {tasks.slice(0, 5).map((t: any) => (
                <li key={t.id} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                  <div>
                    <div className="text-sm font-medium line-clamp-1">{t.prompt}</div>
                    <div className="text-xs text-muted font-mono">{t.repoFullName} @ {t.baseBranch}</div>
                  </div>
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-5" data-testid="recent-prs-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-accent">
              <GitPullRequest size={16} /> <span className="text-xs uppercase tracking-wider">Recent pull requests</span>
            </div>
            <Link href="/dashboard/pull-requests" className="text-xs link-accent">View all</Link>
          </div>
          {prs.length === 0 ? (
            <p className="text-sm text-muted mt-4">No PRs yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {prs.slice(0, 5).map((p: any) => (
                <li key={p.id} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                  <div>
                    <div className="text-sm font-medium line-clamp-1">{p.repoFullName}</div>
                    <div className="text-xs text-muted font-mono">{p.branchName}</div>
                  </div>
                  <a href={p.prUrl} target="_blank" rel="noreferrer" className="text-xs link-accent">Open</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  testid, title, ok, okText, errText, actionHref, actionLabel,
}: any) {
  return (
    <div className="panel p-5" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted">{title}</div>
        {ok ? (
          <span className="badge badge-ok"><CheckCircle2 size={12} /> Connected</span>
        ) : (
          <span className="badge badge-warn"><AlertTriangle size={12} /> Action required</span>
        )}
      </div>
      <div className="mt-3 text-sm">{ok ? okText : errText}</div>
      <div className="mt-4">
        <Link href={actionHref} className="btn">{actionLabel}</Link>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: 'badge',
    running: 'badge badge-info',
    needs_approval: 'badge badge-warn',
    completed: 'badge badge-ok',
    failed: 'badge badge-danger',
    rejected: 'badge badge-danger',
  };
  return <span className={map[status] || 'badge'}>{status.replace('_', ' ')}</span>;
}
