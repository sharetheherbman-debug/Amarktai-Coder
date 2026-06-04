# GitHub workflow

Amarktai Coder never commits to your default branch on its own.

## What happens when you click "Approve & open PR"

1. The task already has a `baseBranch` (whatever you had selected when you
   started it).
2. `PullRequestAgent` creates a new branch named
   `amarktai/<slug>-<task-id-prefix>` from the base branch.
3. It assembles a single commit containing every approved `CodeChange`,
   then pushes it to the new branch via the Git Data API
   (blobs → tree → commit → ref update).
4. It opens a PR from the new branch back into the base branch with a
   body that lists every file changed and includes the task prompt.
5. The PR URL is stored on the `Task` and a `PullRequest` row, and shown
   in `/dashboard/pull-requests`.

## PAT scopes you need

For private repositories: `repo` (full).
For public repositories: `public_repo` is enough.

Fine-grained PATs work too; grant **Read & Write** on **Contents** and
**Pull Requests** for the repos you want Amarktai to touch.

## What we will not do

- Push directly to `main` / `master` / your default branch.
- Force-push.
- Delete branches.
- Touch repos you didn't explicitly select.
- Use your token for anything other than the action you took.

## Token storage

Personal Access Tokens are AES-256-GCM encrypted with the server-side
`ENCRYPTION_KEY` before being written to MariaDB. They are decrypted only
inside server-side route handlers and are never sent back to the browser.

## Disconnecting

`/dashboard/settings` → *Disconnect*. This removes the encrypted token
from the database. No further GitHub calls can be made until you save a
new one.
