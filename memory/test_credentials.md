# Amarktai Coder — Test Credentials

The testing agent should create fresh accounts via `POST /api/auth/register`.
A pre-seeded demo account is **not** provided because Amarktai stores GitHub
PATs encrypted at rest — seeding a "demo" GitHub connection would either
require committing a token (forbidden) or leave the demo unable to reach
GitHub. Each test run should:

1. Register a fresh user.
2. Optionally save a GitHub PAT (provided out-of-band) at
   `POST /api/github/connect` to exercise the repo flows.

## Demo account format
- Email pattern: `test_<timestamp>@amarktai.dev`
- Password: any 8+ chars (e.g. `Testpass123!`)

## Notes for the testing agent

- The app runs on the standard ingress: API calls are made via the
  preview URL `/api/...` and are proxied internally from FastAPI:8001
  to the Next.js process on :3000.
- The `/api/health` endpoint should always return `{"app":"ok","db":"ok"}`.
- `GENX_API_KEY` is intentionally blank in this preview. The UI clearly
  marks AI features as "Not configured" until the operator sets the key
  via env vars — this is correct behavior, not a bug.

## Database
- MariaDB on `localhost:3306`, DB `amarktai_coder`, user `amarktai` / `amarktai_dev_pw`.
- Managed via Prisma (`yarn prisma:push`).
