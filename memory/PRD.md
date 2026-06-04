# Amarktai Coder — PRD / Progress

## Original problem statement (verbatim summary)
Build **Amarktai Coder**, a production-grade MVP of a GitHub + Codex-style AI
coding platform. The stack is Next.js + TypeScript + Tailwind + Prisma +
MariaDB with JWT credentials auth, Octokit GitHub integration, Monaco
editor + diff viewer, and an internal agent layer (RepoConnector,
RepoAudit, Planner, CodeEdit, Review, PullRequest). External services are
restricted to the GitHub API and the GenX API (OpenAI-compatible). No
billing, video, voice, or marketing tooling. Tokens encrypted at rest. PRs
always opened to a fresh branch, never `main`. Acceptance criteria include
working register/login, GitHub PAT validation, repo browsing, Monaco
editor + diff viewer, AI plan → diff → approve → branch → commit → PR
flow, and a clean Docker Compose deployment.

## Tech decisions
- Stack: **Next.js 14 (App Router) + TypeScript** (per user choice)
- DB: **MariaDB 11** via Prisma (mysql provider)
- Auth: **email/password + JWT** (httpOnly cookie)
- GitHub: **PAT-based**, AES-256-GCM encrypted at rest
- LLM: **GenX OpenAI-compatible** via env vars (key set later in settings/env)
- Editor: **@monaco-editor/react** (file viewer + DiffEditor for diffs)
- Deployment: **docker-compose** (app + MariaDB), `prisma db push` on boot

## Architecture
- Single Next.js process serves both UI and `/api/*` routes
- Agents live under `src/lib/agents/*` and record `TaskStep` rows as they run
- `backend/server.py` exists only for the Emergent preview: it's a small
  FastAPI httpx reverse proxy that forwards `/api/*` from ingress:8001 to
  the Next.js process on :3000. It is NOT used in `docker-compose` deploys.

## Personas
- **Solo founder / indie dev** with private repos who wants the AI to draft PRs they review.
- **Small team tech lead** who needs an audit trail (Task → CodeChange → PR) for every change.

## Implemented (2026-02-04)
- Landing page, login, register, JWT session middleware
- `/api/health`, `/api/auth/{register,login,logout}`, `/api/me`
- GitHub: `connect`, `status`, `repos`, `branches`, `tree`, `file`, `branch`, `commit`, `pull-request`
- AI: `models`, `status`, `chat`, `task` create/run/approve/reject + detail
- Pages: `/dashboard` (overview), `/settings`, `/repos`, `/workbench`, `/tasks`, `/pull-requests`
- Monaco editor (read-only) + side-by-side DiffEditor
- Six agents (RepoConnector, RepoAudit, Planner, CodeEdit, Review, PullRequest)
- AES-256-GCM token encryption
- Docker setup: `frontend/Dockerfile` (multi-stage standalone) + `docker-compose.yml` (db + app)
- Docs: ARCHITECTURE, AGENTS, GITHUB_WORKFLOW, SECURITY, DEPLOYMENT
- `.env.example`, `.gitignore`

## Verified
- `yarn typecheck` ✔
- `yarn build` ✔ (20 routes, all pages compile)
- `/api/health` → `{"app":"ok","db":"ok"}` ✔
- Register → cookie set → `/api/me` returns user ✔
- Middleware redirects unauth `/dashboard/*` to `/login?next=...` ✔
- GitHub & AI status both return `connected:false / configured:false` cleanly (no fake states) ✔

## Backlog (P1)
- GitHub OAuth (currently PAT only; user opted PAT for MVP)
- Multi-file approve (currently approve-all per task; UI for cherry-picking is wired in API but not yet in UI)
- Task re-run / iteration (currently 1 run per task)
- Repo audit caching to avoid re-fetching the tree on every task

## Backlog (P2)
- Adapter for OpenHands / Aider behind the same agent interface
- Streaming chat responses
- Task cost tracking (we already record token counts)

## Known limitations
- `GENX_API_KEY` is blank in this preview environment — AI features are
  clearly disabled in the UI until the operator sets it. This is correct
  behavior (per problem statement: "No fake task completed status").
