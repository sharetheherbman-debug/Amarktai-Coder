# Amarktai Coder

> **Plan smarter. Code faster. Ship safer.**

Amarktai Coder is a self-hostable, GitHub + Codex-style AI coding workbench.
You connect a GitHub Personal Access Token, pick a repository, chat with a
repo-aware AI, let it draft a plan and propose file changes, review the
diffs, and ship them through a pull request — never to `main` directly.

## What this is (and isn't)

✅ AI coding workbench scoped to **one repo + one branch**.
✅ Reads **real files** via the GitHub API (no hallucinated source).
✅ Plans → edits → review → branch → commit → PR. You approve every step.
✅ Email/password auth (JWT). PAT-based GitHub connection. Tokens encrypted at rest.

❌ No billing, payments, video, voice, image generation, or marketing tools.
❌ No silent commits to `main`.
❌ No fake "connected" or "completed" states — those badges only light up if the underlying check actually passes.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Prisma ORM + MariaDB 11
- JWT credentials auth + bcrypt password hashing
- Octokit for the GitHub API
- Monaco editor (file viewer + side-by-side diff)
- Zod input validation
- AES-256-GCM token encryption
- Docker Compose for local + VPS deployment

## Project layout

```
amarktai-coder/
├── README.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── docs/
│   ├── ARCHITECTURE.md
│   ├── AGENTS.md
│   ├── GITHUB_WORKFLOW.md
│   ├── SECURITY.md
│   └── DEPLOYMENT.md
├── backend/            # Lightweight ingress proxy used in the Emergent preview only
└── frontend/           # The Next.js app (everything else lives here)
    ├── Dockerfile
    ├── package.json
    ├── prisma/
    │   └── schema.prisma
    └── src/
        ├── app/        # App router (pages + /api routes)
        ├── components/ # Monaco editor wrapper, file tree
        └── lib/        # db, auth, crypto, github, genx, agents/*
```

## Quick start (Docker)

```bash
cp .env.example .env
# Edit .env: set JWT_SECRET, ENCRYPTION_KEY (64 hex chars), GENX_API_KEY
docker compose up -d --build
open http://localhost:3000
```

That spins up MariaDB + the app, runs `prisma db push` on boot, and exposes
the app on `:3000`.

## Local dev (without Docker)

```bash
# 1. Bring up MariaDB locally and create the database
#    (or point DATABASE_URL at any MariaDB/MySQL)
cd frontend
cp ../.env.example .env
yarn install
yarn prisma:push
yarn dev
```

Then open `http://localhost:3000`.

## Required env vars

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | MariaDB DSN, e.g. `mysql://amarktai:pw@db:3306/amarktai_coder` |
| `JWT_SECRET` | Long random string used to sign session JWTs |
| `ENCRYPTION_KEY` | 64 hex chars (32 bytes). Used to AES-256-GCM encrypt GitHub tokens |
| `GENX_API_KEY` | Your GenX API key. Without it, AI features are clearly disabled |
| `GENX_BASE_URL` | Defaults to `https://query.genx.sh/v1` |
| `GENX_DEFAULT_CHAT_MODEL` | Default chat model id |
| `GENX_DEFAULT_CODING_MODEL` | Default coding model id |

## End-to-end flow

1. `/register` → create user
2. `/dashboard/settings` → paste GitHub PAT (`repo` scope), click *Save & test*
3. `/dashboard/repos` → pick a repo, click *Open*
4. `/dashboard/workbench` → browse files, open them in Monaco, chat with the AI
5. Right pane → type "Audit this repo and tell me what is broken" → *Plan & propose*
6. Inspect the plan, click any changed file to see the side-by-side diff
7. *Approve & open PR* → the system creates `amarktai/<task>-<id>`, commits the approved files, opens a PR, and the URL appears in `/dashboard/pull-requests`

## Acceptance checklist

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/AGENTS.md`](docs/AGENTS.md) for design.
Acceptance tests:
- `yarn typecheck` passes
- `yarn build` passes
- `/api/health` returns `{"app":"ok","db":"ok"}`
- Register + Login + Dashboard redirect when unauthenticated
- Settings: PAT validates and badges flip to ✓ only after the token validates against GitHub
- Workbench: a repo selected from the dropdown is the same one the AI sees

## License

Released as open-source; pick what suits you. The MVP code uses only free/open-source dependencies. The only external services it calls are the GitHub API and the GenX API.
