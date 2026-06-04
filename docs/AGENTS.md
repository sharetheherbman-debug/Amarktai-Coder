# Agents

All AI work is split across small, focused agents. Each one is an `async`
function in `frontend/src/lib/agents/`. They record their progress as
`TaskStep` rows so the UI can show step-by-step logs without us having to
invent fake progress bars.

## Pipeline

```
RepoConnector → RepoAudit → Planner → CodeEdit → Review → (user approves) → PullRequest
```

If any step fails, the task is marked `failed` with `errorMessage`. The
pipeline never advances past a failure.

## 1. RepoConnectorAgent — `repo-connector.ts`
Verifies the user's GitHub token can access the repo and that the
requested base branch exists. Cheap, no LLM call.

## 2. RepoAuditAgent — `repo-audit.ts`
Fetches the file tree and a curated set of key files (`package.json`,
`README.md`, `Dockerfile`, `next.config.js`, etc.), then asks the LLM to
output a structured JSON audit:
```json
{ "stack": "...", "buildCommand": "...", "testCommand": "...",
  "issues": [...], "summary": "..." }
```

## 3. PlannerAgent — `planner.ts`
Takes the user prompt + the audit and asks for:
```json
{ "steps": [...], "filesToInspect": [...], "filesToEdit": [...],
  "filesToCreate": [...], "risk": "low|medium|high", "notes": "..." }
```
The planner is constrained to reference files that actually exist for
`filesToInspect`/`filesToEdit` (validated against the tree).

## 4. CodeEditAgent — `code-edit.ts`
Fetches the contents of every file the planner asked to inspect/edit.
Asks the model to return:
```json
{ "changes": [{ "path": "...", "newContent": "...", "rationale": "..." }] }
```
Full file contents are required — no `// ... rest unchanged`. The agent
computes `(before, after, diff)` for each change and persists them as
`CodeChange` rows with `approved = false`.

## 5. ReviewAgent — `review.ts`
Runs heuristic + LLM checks for secrets, large deletions, and high-risk
edits. Adds concerns to the task. The UI shows risk badges based on this.

## 6. PullRequestAgent — `pull-request.ts`
Only runs after the user clicks **Approve**. Creates a working branch
`amarktai/<slug>-<task-id>` from `baseBranch`, commits the approved files
as a single commit, opens a PR, and stores the URL on the Task + a new
`PullRequest` row.

## Adding new agents

The shape is intentionally simple. Each new agent should:

1. Accept an `AgentContext` (or whatever it needs).
2. Call `recordStep(taskId, 'YourAgent', 'running', ...)` at the start and
   `'completed' | 'failed'` at the end.
3. Return `AgentResult` and any structured data the caller needs.

That's it. You can wire an Aider-style adapter or an OpenHands runner in
the same way — replace `runCodeEdit` with an adapter that returns
`Proposed[]` and the rest of the pipeline doesn't need to change.
