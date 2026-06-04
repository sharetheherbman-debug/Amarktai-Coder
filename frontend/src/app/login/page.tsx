'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Login failed');
        return;
      }
      router.push(next);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-ink-950 grid place-items-center px-6">
      <div className="w-full max-w-md panel p-8" data-testid="login-card">
        <Link href="/" className="flex items-center gap-2 text-sm font-mono text-muted mb-6">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-accent" />
          amarktai/coder
        </Link>
        <h1 className="text-3xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted mt-1">Welcome back. Connect your GitHub and ship.</p>

        <form onSubmit={submit} className="mt-6 space-y-3" data-testid="login-form">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted">Email</label>
            <input
              data-testid="login-email"
              className="input mt-1"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted">Password</label>
            <input
              data-testid="login-password"
              className="input mt-1"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <div className="text-sm text-danger" data-testid="login-error">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full justify-center mt-2"
            data-testid="login-submit"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="text-sm text-muted mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="link-accent" data-testid="login-register-link">
            Create one
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-ink-950" />}>
      <LoginForm />
    </Suspense>
  );
}
