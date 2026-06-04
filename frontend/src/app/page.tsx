import Link from 'next/link';
import { ArrowRight, GitPullRequest, ShieldCheck, Wand2, Terminal, FileDiff } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-ink-950 text-white">
      <div className="bg-grid-soft">
        {/* Nav */}
        <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" data-testid="brand-link" className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-accent" />
            <span className="font-mono text-sm tracking-wider">amarktai/coder</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost" data-testid="nav-login">
              Sign in
            </Link>
            <Link href="/register" className="btn btn-primary" data-testid="nav-register">
              Get started <ArrowRight size={14} />
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-24">
          <div className="grid lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-7">
              <div className="badge mb-5" data-testid="hero-tag">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" /> Repo-aware coding agent
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold leading-[1.02] tracking-tight">
                Plan smarter.
                <br />
                <span className="text-accent">Code faster.</span>
                <br />
                Ship safer.
              </h1>
              <p className="mt-6 text-base sm:text-lg text-muted max-w-xl">
                Amarktai Coder reads your real GitHub repository, drafts a plan,
                proposes diffs, and ships them through a pull request — never
                committing to <code className="font-mono text-accent">main</code> behind your
                back.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/register" className="btn btn-primary" data-testid="hero-register">
                  Create an account <ArrowRight size={14} />
                </Link>
                <Link href="/login" className="btn" data-testid="hero-login">
                  I have an account
                </Link>
                <a
                  href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-muted hover:text-white"
                >
                  Need a GitHub PAT? →
                </a>
              </div>

              <div className="mt-10 flex items-center gap-3 text-xs font-mono text-muted">
                <span className="kbd">$</span>
                <span>open repo · audit · plan · diff · approve · PR</span>
              </div>
            </div>

            {/* Workbench preview */}
            <div className="lg:col-span-5">
              <div className="panel p-4 shadow-glow">
                <div className="flex items-center gap-2 px-2 py-1.5 border-b border-line">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-warn/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-ok/70" />
                  <span className="ml-2 text-[11px] font-mono text-muted">workbench / app/login/page.tsx</span>
                </div>
                <pre className="text-[12px] leading-relaxed font-mono p-3 overflow-hidden text-muted">
{`-  if (!user) redirect("/login");
+  if (!user) return notFound();
+  // log the access for audit
+  logger.info({ userId: user.id }, "dashboard.access");`}
                </pre>
                <div className="px-3 py-2 border-t border-line flex items-center justify-between text-[11px] font-mono">
                  <span className="text-muted">3 files changed</span>
                  <span className="badge badge-accent">PR ready</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <FeatureCard icon={<Terminal size={14} />} label="Read repo" />
                <FeatureCard icon={<Wand2 size={14} />} label="Draft plan" />
                <FeatureCard icon={<FileDiff size={14} />} label="Review diff" />
              </div>
            </div>
          </div>
        </section>

        <div className="glow-divider max-w-6xl mx-auto" />

        {/* Capabilities */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-3 gap-6">
            <Capability
              icon={<Terminal size={16} />}
              title="Inspects real files"
              copy="No hallucinated source. Files are fetched live via the GitHub API and shown to the model."
            />
            <Capability
              icon={<Wand2 size={16} />}
              title="Plans before editing"
              copy="A planner agent breaks the task into steps and decides which files to touch."
            />
            <Capability
              icon={<FileDiff size={16} />}
              title="Diffs you can approve"
              copy="Every proposed change ships with a side-by-side diff. Approve, reject, or edit before commit."
            />
            <Capability
              icon={<GitPullRequest size={16} />}
              title="Branch + PR, never main"
              copy="Approved changes land on a new branch and open a pull request. You merge when ready."
            />
            <Capability
              icon={<ShieldCheck size={16} />}
              title="Secrets stay private"
              copy="GitHub tokens are encrypted at rest with AES-256-GCM. Nothing prints to logs."
            />
            <Capability
              icon={<Wand2 size={16} />}
              title="Composable agents"
              copy="RepoAudit, Planner, CodeEdit, Review and PullRequest agents are isolated and swappable."
            />
          </div>
        </section>

        <footer className="max-w-6xl mx-auto px-6 py-12 flex items-center justify-between text-xs text-muted font-mono">
          <span>© Amarktai Coder</span>
          <span>v0.1 · MVP</span>
        </footer>
      </div>
    </main>
  );
}

function FeatureCard({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="panel px-3 py-3 flex items-center gap-2 text-xs font-mono">
      <span className="text-accent">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function Capability({
  icon,
  title,
  copy,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2 text-accent">{icon}<span className="text-xs font-mono uppercase tracking-wider">capability</span></div>
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted">{copy}</p>
    </div>
  );
}
