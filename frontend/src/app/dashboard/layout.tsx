'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Settings,
  GitBranch,
  Folder,
  GitPullRequest,
  ListChecks,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Me = { user: { id: string; email: string } | null; github?: any };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/me', { cache: 'no-store' });
        if (r.status === 401) {
          router.push('/login');
          return;
        }
        const data = await r.json();
        setMe(data);
      } catch {
        router.push('/login');
      }
    })();
  }, [router]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const nav = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/repos', label: 'Repositories', icon: Folder },
    { href: '/dashboard/workbench', label: 'Workbench', icon: GitBranch },
    { href: '/dashboard/tasks', label: 'Tasks', icon: ListChecks },
    { href: '/dashboard/pull-requests', label: 'Pull requests', icon: GitPullRequest },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-ink-950 text-white grid grid-cols-[240px_1fr]">
      <aside className="border-r border-line bg-ink-900 sticky top-0 h-screen flex flex-col" data-testid="dashboard-sidebar">
        <div className="px-5 py-5 flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-accent" />
          <Link href="/" className="font-mono text-sm tracking-wider">
            amarktai/coder
          </Link>
        </div>
        <nav className="px-3 flex-1 space-y-0.5">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                data-testid={`nav-${n.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={cn(
                  'flex items-center gap-2.5 px-3 h-9 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-ink-800 text-white border border-line'
                    : 'text-muted hover:text-white hover:bg-ink-800/60',
                )}
              >
                <Icon size={15} className={active ? 'text-accent' : ''} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          <div className="text-xs text-muted px-2 mb-2 font-mono truncate" data-testid="user-email">
            {me?.user?.email || '—'}
          </div>
          <button
            className="btn btn-ghost w-full justify-start text-sm"
            onClick={logout}
            data-testid="logout-btn"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-h-screen">{children}</main>
    </div>
  );
}
