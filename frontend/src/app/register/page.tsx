'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Registration failed');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-ink-950 grid place-items-center px-6">
      <div className="w-full max-w-md panel p-8" data-testid="register-card">
        <Link href="/" className="flex items-center gap-2 text-sm font-mono text-muted mb-6">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-accent" />
          amarktai/coder
        </Link>
        <h1 className="text-3xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted mt-1">Email and password. No third-party sign-in.</p>

        <form onSubmit={submit} className="mt-6 space-y-3" data-testid="register-form">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted">Email</label>
            <input
              data-testid="register-email"
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
              data-testid="register-password"
              className="input mt-1"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted">Confirm password</label>
            <input
              data-testid="register-confirm"
              className="input mt-1"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && (
            <div className="text-sm text-danger" data-testid="register-error">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full justify-center mt-2"
            data-testid="register-submit"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="text-sm text-muted mt-6">
          Already have an account?{' '}
          <Link href="/login" className="link-accent" data-testid="register-login-link">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
