'use client';
import { useEffect, useMemo, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CodeEditor, DiffView, languageFromPath } from '@/components/editor';
import { FileTree } from '@/components/file-tree';
import {
  Send,
  Loader2,
  Play,
  GitBranch,
  CheckCircle2,
  X,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Eye,
  FileCode2,
} from 'lucide-react';

type Branch = { name: string; sha: string };
type TreeItem = { path: string; type: string; size?: number };
type ChatMsg = { role: 'user' | 'assistant'; content: string };

function WorkbenchInner() {
  const search = useSearchParams();
  const [repo, setRepo] = useState<string | null>(search.get('repo'));
  const [repos, setRepos] = useState<any[] | null>(null);
  const [branch, setBranch] = useState<string | null>(search.get('branch'));
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tree, setTree] = useState<TreeItem[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileLoading, setFileLoading] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [activeTask, setActiveTask] = useState<any | null>(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskPrompt, setTaskPrompt] = useState('');
  const [activeChangeIdx, setActiveChangeIdx] = useState(0);
  const [activeRightTab, setActiveRightTab] = useState<'chat' | 'task'>('task');
  const [genxOk, setGenxOk] = useState<boolean | null>(null);
  const [ghOk, setGhOk] = useState<boolean | null>(null);

  // load repos for the picker
  useEffect(() => {
    fetch('/api/github/status').then(r => r.json()).then((d) => setGhOk(!!d.connected));
    fetch('/api/ai/status').then(r => r.json()).then((d) => setGenxOk(!!d.ok));
    fetch('/api/github/repos').then(r => r.json()).then((d) => setRepos(d.repos || []));
  }, []);

  // load branches when repo changes
  useEffect(() => {
    if (!repo) return;
    fetch(`/api/github/branches?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json()).then(d => {
        setBranches(d.branches || []);
        if (!branch && d.branches?.length) setBranch(d.branches[0].name);
      });
  }, [repo]); // eslint-disable-line

  // load tree when repo/branch
  useEffect(() => {
    if (!repo || !branch) return;
    setLoadingTree(true);
    fetch(`/api/github/tree?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`)
      .then(r => r.json()).then(d => setTree(d.items || []))
      .finally(() => setLoadingTree(false));
    setSelected(null); setFileContent('');
  }, [repo, branch]);

  const openFile = useCallback(async (path: string) => {
    if (!repo || !branch) return;
    setSelected(path);
    setFileLoading(true);
    try {
      const res = await fetch(`/api/github/file?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`);
      const d = await res.json();
      if (!res.ok) {
        setFileContent('// ' + (d.error || 'Failed to load file'));
      } else {
        setFileContent(d.content || '');
      }
    } finally {
      setFileLoading(false);
    }
  }, [repo, branch]);

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const next: ChatMsg[] = [...chat, { role: 'user', content: chatInput }];
    setChat(next); setChatInput(''); setChatLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo, branch,
          selectedFiles: selected ? [selected] : [],
          messages: next,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setChat([...next, { role: 'assistant', content: `Error: ${d.error || 'chat failed'}` }]);
      } else {
        setChat([...next, { role: 'assistant', content: d.reply || '' }]);
      }
    } finally {
      setChatLoading(false);
    }
  }

  async function startTask() {
    if (!repo || !branch || !taskPrompt.trim()) return;
    setTaskLoading(true);
    try {
      // create
      const createRes = await fetch('/api/ai/task', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, baseBranch: branch, prompt: taskPrompt.trim() }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        alert(createData?.error || 'Failed to create task');
        return;
      }
      const id = createData.task.id;
      // run
      const runRes = await fetch(`/api/ai/task/${id}/run`, { method: 'POST' });
      const runData = await runRes.json();
      if (!runRes.ok) {
        alert(runData?.error || 'Run failed');
      }
      // load latest
      const detail = await fetch(`/api/ai/task/${id}`).then(r => r.json());
      setActiveTask(detail.task);
      setActiveRightTab('task');
      setActiveChangeIdx(0);
    } finally {
      setTaskLoading(false);
    }
  }

  async function refreshTask() {
    if (!activeTask?.id) return;
    const d = await fetch(`/api/ai/task/${activeTask.id}`).then(r => r.json());
    setActiveTask(d.task);
  }

  async function approveTask() {
    if (!activeTask?.id) return;
    setTaskLoading(true);
    try {
      const res = await fetch(`/api/ai/task/${activeTask.id}/approve`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { alert(d?.error || 'Approve failed'); return; }
      await refreshTask();
      alert(`PR opened: ${d.prUrl}`);
    } finally {
      setTaskLoading(false);
    }
  }

  async function rejectTask() {
    if (!activeTask?.id) return;
    if (!confirm('Reject all proposed changes?')) return;
    await fetch(`/api/ai/task/${activeTask.id}/reject`, { method: 'POST' });
    await refreshTask();
  }

  const plan = useMemo(() => {
    if (!activeTask?.planJson) return null;
    try { return JSON.parse(activeTask.planJson); } catch { return null; }
  }, [activeTask?.planJson]);

  const activeChange = activeTask?.changes?.[activeChangeIdx];

  return (
    <div className="grid grid-cols-[260px_1fr_440px] grid-rows-[auto_1fr] min-h-screen">
      {/* Top toolbar */}
      <div className="col-span-3 border-b border-line bg-ink-900 px-5 py-3 flex items-center gap-3" data-testid="workbench-toolbar">
        <p className="text-xs font-mono uppercase tracking-wider text-muted mr-2">Workbench</p>
        <select
          value={repo || ''}
          onChange={(e) => { setRepo(e.target.value); setBranch(null); }}
          className="input max-w-xs font-mono text-xs"
          data-testid="repo-select"
        >
          <option value="">— Select repo —</option>
          {(repos || []).map((r: any) => (
            <option key={r.fullName} value={r.fullName}>{r.fullName}</option>
          ))}
        </select>
        <select
          value={branch || ''}
          onChange={(e) => setBranch(e.target.value)}
          disabled={!repo}
          className="input max-w-[180px] font-mono text-xs"
          data-testid="branch-select"
        >
          <option value="">— Branch —</option>
          {branches.map((b) => (<option key={b.name} value={b.name}>{b.name}</option>))}
        </select>
        <div className="flex items-center gap-2 ml-auto text-xs">
          {ghOk === false && <span className="badge badge-warn"><AlertTriangle size={11} /> GitHub not connected</span>}
          {genxOk === false && <span className="badge badge-warn"><AlertTriangle size={11} /> GenX not configured</span>}
          {ghOk && genxOk && <span className="badge badge-ok"><CheckCircle2 size={11} /> Ready</span>}
        </div>
      </div>

      {/* File tree */}
      <aside className="border-r border-line bg-ink-900 overflow-y-auto" data-testid="file-tree-pane">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <span className="panel-title">Files</span>
          {loadingTree && <Loader2 size={12} className="animate-spin text-muted" />}
        </div>
        <div className="p-2">
          {!repo || !branch ? (
            <p className="text-xs text-muted px-2 py-2">Select repo + branch above.</p>
          ) : tree.length === 0 && !loadingTree ? (
            <p className="text-xs text-muted px-2 py-2">No files.</p>
          ) : (
            <FileTree items={tree as any} selected={selected} onSelect={openFile} />
          )}
        </div>
      </aside>

      {/* Editor area */}
      <section className="bg-ink-950 flex flex-col">
        <div className="px-4 py-2 border-b border-line bg-ink-900 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-mono text-muted truncate">
            <FileCode2 size={13} />
            {activeChange ? (
              <>
                <Eye size={11} className="text-accent" />
                <span>diff · {activeChange.filePath}</span>
              </>
            ) : selected ? (
              <span>{selected}</span>
            ) : (
              <span>Select a file</span>
            )}
            {fileLoading && <Loader2 size={11} className="animate-spin" />}
          </div>
          {activeChange && (
            <button className="btn btn-ghost text-xs" onClick={() => setActiveChangeIdx(-1)} title="Close diff">
              <X size={12} /> Close diff
            </button>
          )}
        </div>
        <div className="flex-1 min-h-0">
          {activeChange ? (
            <DiffView
              before={activeChange.beforeContent || ''}
              after={activeChange.afterContent || ''}
              language={languageFromPath(activeChange.filePath)}
            />
          ) : (
            <CodeEditor
              value={fileContent}
              language={languageFromPath(selected || undefined)}
              readOnly
            />
          )}
        </div>
      </section>

      {/* Right panel: chat + task */}
      <aside className="border-l border-line bg-ink-900 flex flex-col" data-testid="ai-pane">
        <div className="flex border-b border-line">
          <button
            className={`flex-1 px-3 py-2.5 text-xs font-mono uppercase tracking-wider ${activeRightTab === 'task' ? 'text-accent bg-ink-800' : 'text-muted'}`}
            onClick={() => setActiveRightTab('task')}
            data-testid="tab-task"
          >
            Task
          </button>
          <button
            className={`flex-1 px-3 py-2.5 text-xs font-mono uppercase tracking-wider ${activeRightTab === 'chat' ? 'text-accent bg-ink-800' : 'text-muted'}`}
            onClick={() => setActiveRightTab('chat')}
            data-testid="tab-chat"
          >
            Chat
          </button>
        </div>

        {activeRightTab === 'chat' ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-3 space-y-3" data-testid="chat-list">
              {chat.length === 0 && (
                <div className="text-xs text-muted">
                  Ask anything about the selected file. The AI sees the file you have open.
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={m.role === 'user' ? '' : ''}>
                  <div className="text-[10px] font-mono uppercase text-muted mb-1">{m.role}</div>
                  <pre className={`whitespace-pre-wrap text-sm font-${m.role === 'user' ? 'sans' : 'mono'} leading-relaxed`}>
                    {m.content}
                  </pre>
                </div>
              ))}
              {chatLoading && <div className="text-xs text-muted"><Loader2 size={12} className="inline animate-spin" /> thinking…</div>}
            </div>
            <div className="border-t border-line p-2">
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="Ask about this file or repo…"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
                  data-testid="chat-input"
                />
                <button className="btn btn-primary" disabled={chatLoading || !chatInput.trim()} onClick={sendChat} data-testid="chat-send">
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-3 border-b border-line">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted">
                New task on {repo || '—'} @ {branch || '—'}
              </label>
              <textarea
                rows={3}
                className="input mt-1 h-auto py-2"
                placeholder="e.g. Audit the repo and list issues, or Fix the login error handling…"
                value={taskPrompt}
                onChange={(e) => setTaskPrompt(e.target.value)}
                data-testid="task-prompt"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  className="btn btn-primary"
                  disabled={!repo || !branch || !taskPrompt.trim() || taskLoading}
                  onClick={startTask}
                  data-testid="task-run"
                >
                  {taskLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  Plan & propose
                </button>
                {activeTask && (
                  <button className="btn btn-ghost" onClick={refreshTask} title="Refresh">
                    <RefreshCw size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3" data-testid="task-detail">
              {!activeTask ? (
                <p className="text-xs text-muted">No active task. Describe what you want changed and click Plan & propose.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted">task</span>
                    <span className={`badge ${badgeClass(activeTask.status)}`}>{activeTask.status.replace('_', ' ')}</span>
                  </div>
                  <pre className="text-xs font-mono whitespace-pre-wrap text-muted">{activeTask.prompt}</pre>

                  {activeTask.errorMessage && (
                    <div className="text-xs text-danger font-mono">{activeTask.errorMessage}</div>
                  )}

                  {plan?.plan && (
                    <div className="panel p-3 mt-2">
                      <div className="text-xs uppercase tracking-wider text-accent mb-2 flex items-center gap-1.5"><Sparkles size={12}/> Plan</div>
                      <ul className="text-xs space-y-1.5 list-disc pl-4">
                        {(plan.plan.steps || []).map((s: any, i: number) => (
                          <li key={i}><span className="font-semibold">{s.title}</span> — <span className="text-muted">{s.description}</span></li>
                        ))}
                      </ul>
                      {plan.plan.risk && (
                        <div className="mt-2 text-[10px] font-mono text-muted">risk: {plan.plan.risk}</div>
                      )}
                    </div>
                  )}

                  {activeTask.changes?.length > 0 && (
                    <div className="panel p-3 mt-2">
                      <div className="text-xs uppercase tracking-wider text-accent mb-2 flex items-center gap-1.5"><GitBranch size={12}/> Changed files</div>
                      <ul className="space-y-1">
                        {activeTask.changes.map((c: any, i: number) => (
                          <li key={c.id}>
                            <button
                              onClick={() => setActiveChangeIdx(i)}
                              className={`block w-full text-left text-xs font-mono px-2 py-1 rounded ${activeChangeIdx === i ? 'bg-ink-800 text-accent' : 'text-muted hover:text-white hover:bg-ink-800/60'}`}
                              data-testid={`change-link-${i}`}
                            >
                              {c.filePath}
                            </button>
                          </li>
                        ))}
                      </ul>
                      {activeTask.status === 'needs_approval' && (
                        <div className="mt-3 flex items-center gap-2">
                          <button className="btn btn-primary text-xs" onClick={approveTask} disabled={taskLoading} data-testid="approve-task">
                            <CheckCircle2 size={12} /> Approve & open PR
                          </button>
                          <button className="btn btn-danger text-xs" onClick={rejectTask} disabled={taskLoading} data-testid="reject-task">
                            <X size={12} /> Reject
                          </button>
                        </div>
                      )}
                      {activeTask.pullRequestUrl && (
                        <a className="text-xs link-accent mt-3 block" href={activeTask.pullRequestUrl} target="_blank" rel="noreferrer">
                          → View PR
                        </a>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function badgeClass(status: string) {
  if (status === 'completed') return 'badge-ok';
  if (status === 'needs_approval') return 'badge-warn';
  if (status === 'running') return 'badge-info';
  if (status === 'failed' || status === 'rejected') return 'badge-danger';
  return '';
}

export default function WorkbenchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted text-sm">Loading workbench…</div>}>
      <WorkbenchInner />
    </Suspense>
  );
}
