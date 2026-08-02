import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Target, Sparkles, Link2, BarChart2, Check } from 'lucide-react';
import { MatchScoreBadge } from '@/components/features/MatchScoreBadge';

export const metadata: Metadata = {
  title: 'Landed — AI Job Application Tracker',
  description:
    'Track every application, paste a URL to auto-fill job details, and see which roles you match best — powered by AI.',
};

// ── Demo data for the hero console panel ────────────────────────────────────

const demoMatches = [
  {
    company: 'Supabase',
    title: 'Developer Experience Engineer',
    score: 91,
    matched: ['TypeScript', 'Next.js', 'PostgreSQL'],
    missing: [],
  },
  {
    company: 'Vercel',
    title: 'Senior Frontend Engineer',
    score: 78,
    matched: ['React', 'Next.js', 'TypeScript'],
    missing: ['GraphQL'],
  },
  {
    company: 'Linear',
    title: 'Full Stack Engineer',
    score: 74,
    matched: ['React', 'TypeScript', 'Node.js'],
    missing: [],
  },
  {
    company: 'Figma',
    title: 'Frontend Engineer, Core Editor',
    score: 52,
    matched: ['TypeScript', 'React'],
    missing: ['WebAssembly', 'C++'],
  },
];

// ── Kanban mini preview ──────────────────────────────────────────────────────

const demoKanban = [
  { status: 'saved', label: 'Saved', color: 'bg-ink/25', jobs: ['Linear', 'PlanetScale'] },
  { status: 'applied', label: 'Applied', color: 'bg-blue-400', jobs: ['Stripe', 'Cloudflare'] },
  { status: 'interview', label: 'Interview', color: 'bg-amber-400', jobs: ['Vercel'] },
  { status: 'offer', label: 'Offer', color: 'bg-green-400', jobs: ['Supabase'] },
];

// ── Features ─────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Link2,
    title: 'Paste a URL, done.',
    body: 'Drop a job posting link — AI extracts company, title, salary, skills, and location. No typing.',
  },
  {
    icon: BarChart2,
    title: 'Kanban that stays out of your way.',
    body: 'Five stages. Drag to move. Clean, fast, and exactly as dense as a daily-use tool should be.',
  },
  {
    icon: Sparkles,
    title: 'Know where you rank.',
    body: 'Upload your resume once. Every tracked job gets a fit score based on semantic similarity — not keyword guessing.',
  },
];

export default function LandingPage() {
  return (
    <div className="bg-bg text-ink">

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav className="border-b border-line sticky top-0 z-40 bg-bg/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 bg-ink rounded-sm flex items-center justify-center">
              <Target size={13} className="text-bg" />
            </div>
            <span className="font-semibold tracking-tight text-sm">Landed</span>
          </Link>

          <div className="flex items-center gap-5">
            <Link
              href="/login"
              className="text-sm text-ink-muted hover:text-ink transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 bg-ink text-bg text-sm font-medium px-4 py-2 rounded-md hover:bg-ink/90 transition-colors"
            >
              Get started
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      {/* Editorial layer — General Sans display, generous whitespace */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 lg:pt-28 lg:pb-20">
        <div className="max-w-3xl">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-line rounded-full mb-8">
            <Sparkles size={12} className="text-signal" />
            <span className="text-xs font-mono text-ink-muted uppercase tracking-widest">
              AI-powered job tracking
            </span>
          </div>

          {/* Headline — General Sans, display weight */}
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-ink leading-[1.1] tracking-tight mb-6"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Track every application.{' '}
            <span className="text-ink/40">Match smarter.</span>{' '}
            <span className="text-signal">Land faster.</span>
          </h1>

          {/* Body — Newsreader serif, editorial layer */}
          <p
            className="text-lg sm:text-xl text-ink-muted leading-relaxed mb-10 max-w-2xl"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Paste a job URL and AI fills the details. Upload your resume once and see every
            tracked role ranked by how well you match — with a short explanation of why.
          </p>

          <div className="flex items-center gap-4 flex-wrap">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-ink text-bg font-semibold px-6 py-3 rounded-md hover:bg-ink/90 active:scale-[0.98] transition-all"
            >
              Start tracking free
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/board"
              className="text-sm text-ink-muted hover:text-ink transition-colors flex items-center gap-1.5"
            >
              View demo board
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Console demo ────────────────────────────────────────────────────── */}
      {/* Console layer — dark panel, signal orange, mono labels */}
      <section className="bg-panel py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-6">

          <div className="mb-10">
            <p className="text-[10px] font-mono uppercase tracking-widest text-panel-fg/40 mb-2">
              Best Matches — Live Preview
            </p>
            <p className="text-2xl font-semibold text-panel-fg" style={{ fontFamily: 'var(--font-display)' }}>
              Know exactly where to focus.
            </p>
          </div>

          {/* Two-column demo: kanban mini + match scores */}
          <div className="grid lg:grid-cols-2 gap-6">

            {/* Left: Mini kanban */}
            <div className="space-y-3">
              <p className="text-[9px] font-mono uppercase tracking-widest text-panel-fg/30 mb-4">
                Your Board
              </p>
              <div className="grid grid-cols-2 gap-2">
                {demoKanban.map(({ status, label, color, jobs }) => (
                  <div key={status} className="border border-panel-fg/10 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={['w-1.5 h-1.5 rounded-full', color].join(' ')} />
                      <span className="text-[9px] font-mono uppercase tracking-widest text-panel-fg/50">
                        {label}
                      </span>
                    </div>
                    {jobs.map((job) => (
                      <div key={job} className="bg-panel-fg/5 px-2 py-1.5 rounded-sm">
                        <p className="text-[10px] text-panel-fg/70 font-medium truncate">{job}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Match scores */}
            <div className="space-y-2">
              <p className="text-[9px] font-mono uppercase tracking-widest text-panel-fg/30 mb-4">
                Ranked by Fit Score
              </p>
              {demoMatches.map((match, i) => (
                <div
                  key={i}
                  className="border border-panel-fg/10 p-3 flex items-center gap-4 hover:border-panel-fg/20 transition-colors"
                >
                  <MatchScoreBadge score={match.score} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-panel-fg/50 font-mono mb-0.5">{match.company}</p>
                    <p className="text-xs text-panel-fg font-medium truncate">{match.title}</p>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {match.matched.slice(0, 2).map((s) => (
                        <span key={s} className="text-[9px] font-mono px-1 py-0.5 bg-green-500/10 text-green-400 border border-green-500/15 rounded-sm flex items-center gap-0.5">
                          <Check size={7} />
                          {s}
                        </span>
                      ))}
                      {match.missing.slice(0, 1).map((s) => (
                        <span key={s} className="text-[9px] font-mono px-1 py-0.5 bg-red-500/8 text-red-400/70 border border-red-500/15 rounded-sm">
                          ✗ {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 lg:py-20">
        <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted mb-10">
          How it works
        </p>
        <div className="grid sm:grid-cols-3 gap-8 lg:gap-12">
          {features.map(({ icon: Icon, title, body }, i) => (
            <div key={i} className="space-y-3">
              <div className="w-9 h-9 border border-line flex items-center justify-center rounded-sm">
                <Icon size={16} className="text-ink-muted" />
              </div>
              <h3 className="text-base font-semibold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                {title}
              </h3>
              <p className="text-sm text-ink-muted leading-relaxed" style={{ fontFamily: 'var(--font-serif)' }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section className="border-t border-line py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted mb-10">
            Pricing
          </p>
          <div className="grid sm:grid-cols-2 gap-px border border-line overflow-hidden max-w-2xl">
            {/* Free */}
            <div className="bg-bg p-6 space-y-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-ink-muted">Free</p>
                <p className="text-3xl font-bold text-ink mt-1">$0</p>
                <p className="text-sm text-ink-muted mt-1">Forever. No card required.</p>
              </div>
              <ul className="space-y-2">
                {['Manual job entry', 'URL auto-extraction', 'Kanban board', 'Dashboard'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-ink-muted">
                    <Check size={13} className="text-ink shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center gap-2 border border-line text-ink text-sm font-medium px-4 py-2.5 rounded-md hover:border-ink/30 hover:bg-ink/4 transition-all"
              >
                Get started
              </Link>
            </div>
            {/* Premium */}
            <div className="bg-ink p-6 space-y-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-panel-fg/50">Premium</p>
                <p className="text-3xl font-bold text-panel-fg mt-1">$9<span className="text-lg font-normal text-panel-fg/50">/mo</span></p>
                <p className="text-sm text-panel-fg/50 mt-1">Cancel any time.</p>
              </div>
              <ul className="space-y-2">
                {[
                  'Everything in Free',
                  'Resume upload & parsing',
                  'Best Matches tab',
                  'AI match explanations',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-panel-fg/70">
                    <Check size={13} className="text-signal shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center gap-2 bg-signal text-panel text-sm font-semibold px-4 py-2.5 rounded-md hover:bg-signal/90 transition-all"
              >
                Start 7-day free trial
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-line py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-ink rounded-sm flex items-center justify-center">
              <Target size={11} className="text-bg" />
            </div>
            <span className="text-sm font-medium text-ink">Landed</span>
          </div>
          <p className="text-xs text-ink-muted font-mono">
            Built by Kit Adrian Diocares · Portfolio project
          </p>
        </div>
      </footer>
    </div>
  );
}
