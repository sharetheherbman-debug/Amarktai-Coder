# Architecture

## High level

```
Browser ──HTTPS──► Next.js App (port 3000)
                     │
                     ├── App Router pages (RSC + Client components)
                     ├── /api/* route handlers  (Prisma ↔ MariaDB)
                     └── lib/agents/* (LLM via GenX, GitHub via Octokit)
                                 │
                                 ├── GitHub REST API  (octokit)
                                 └── GenX OpenAI-compatible API
```

Everything is one Next.js process. There is no separate Python backend in
production — the `backend/` folder here only houses a small FastAPI proxy
used inside the Emergent preview environment to forward `/api/*` traffic
from the ingress (port 8001) to the Next.js process (port 3000). On a VPS
deployment via `docker-compose.yml`, only the Next.js container and
MariaDB run.

## Data model (Prisma)

See `frontend/prisma/schema.prisma`. The full set:

- `User` — id, email, passwordHash, role, createdAt, updatedAt
- `GitHubConnection` — encrypted PAT, username, scopes, last-validated-at
- `RepositorySelection` — last opened repo/branch per user (lightweight)
- `Task` — repo, baseBranch, workingBranch, prompt, status, planJson, errorMessage, pullRequestUrl
- `TaskStep` — per-agent log line (agentName, status, summary, logs)
- `CodeChange` — proposed file change (filePath, before, after, diff, approved)
- `PullRequest` — repo, branchName, prUrl, status
- `ModelUsage` — model, inputTokens, outputTokens, estimatedCost
- `AuditLog` — userId, action, metadataJson

## Request lifecycle

1. Browser sends a request. If it hits `/dashboard/*`, `src/middleware.ts`
   short-circuits unauthenticated requests to `/login?next=...`.
2. Route handlers under `src/app/api/*` validate input with Zod, then call
   into `src/lib/*` (db, auth, github, genx, agents).
3. AI workflows go through the agent layer (`src/lib/agents/`) which is
   intentionally isolated so future agents (Aider/OpenHands adapters) can
   slot in without touching API routes.

## Why this layout

- **One process** → fewer moving pieces on a VPS. `docker compose up -d --build` and you're done.
- **Agent layer** → keeps LLM logic out of HTTP handlers. Each agent is a pure async function that records `TaskStep` rows as it runs.
- **No hidden state** → the database is the single source of truth. Anything you see in the UI (PR link, change diff, plan) was actually produced; we never fabricate completion badges.

## Security boundaries

- Browser only ever sees `/api` JSON or HTML. No client-side calls to GitHub or GenX.
- GitHub PATs are encrypted with AES-256-GCM (`src/lib/crypto.ts`) before storage. They never appear in logs.
- Session is a JWT cookie (`amarktai_session`, `httpOnly`, `sameSite=lax`).

See [SECURITY.md](SECURITY.md).
