# Security

## Passwords

- Stored as bcrypt hashes (cost 10). The plaintext password never appears
  in logs or in any DB column.
- Login responds with the same HTTP 401 whether the email exists or not —
  we don't leak account existence.

## Sessions

- JWT signed with `JWT_SECRET` (HS256).
- Stored in an `httpOnly`, `sameSite=lax` cookie named `amarktai_session`.
- `secure=true` is forced when `NODE_ENV=production`.
- `/dashboard/*` is gated by `src/middleware.ts`. API routes additionally
  re-check the session inside the route handler and scope all queries by
  `userId`, so users can never read another user's data.

## GitHub tokens

- AES-256-GCM (`src/lib/crypto.ts`) with a 96-bit random IV per token.
- Auth tag is stored alongside, so tampering is detectable.
- The encryption key comes from `ENCRYPTION_KEY` (64-hex-char preferred,
  but any string is SHA-256-hashed to a 32-byte key as a fallback).
- Tokens are never logged. They are not exposed via any API route. They
  are only decrypted inside the server-side `getOctokitForUser()` helper.

## Input validation

Every API route uses Zod schemas (`z.object(...).safeParse(body)`) before
touching the database or calling third-party APIs.

## What we don't do

- We do not store GenX prompts/responses verbatim — only token counts via
  `ModelUsage`.
- We do not allow arbitrary file paths in `repo` — `splitRepo()` requires
  `owner/name`.
- We never call the GitHub or GenX APIs from the browser. All upstream
  calls happen server-side.
- We don't display "connected" or "ready" badges unless the underlying
  check actually passed in this request.

## Reporting

Found a vulnerability? Open a private issue or email the maintainer. Do
not file a public issue with reproduction steps.
