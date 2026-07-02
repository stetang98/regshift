import type { MouseEvent, ReactNode } from 'react';
import type { RunMeta } from '../../lib/types';

const NAV_ITEMS: ReadonlyArray<{ href: string; section: string; label: string }> = [
  { href: '#/', section: '', label: 'Overview' },
  { href: '#/obligations', section: 'obligations', label: 'Obligations' },
  { href: '#/impact', section: 'impact', label: 'Impact map' },
  { href: '#/review', section: 'review', label: 'Review' },
  { href: '#/audit', section: 'audit', label: 'Audit' },
];

interface AppShellProps {
  run: RunMeta | null;
  activeSection: string;
  children: ReactNode;
}

export function AppShell({ run, activeSection, children }: AppShellProps) {
  // Proposal detail belongs to the review workflow in the nav.
  const active = activeSection === 'proposals' ? 'review' : activeSection;

  const skipToContent = (event: MouseEvent<HTMLAnchorElement>) => {
    // Plain anchor would collide with hash routing; move focus manually.
    event.preventDefault();
    document.getElementById('main-content')?.focus();
  };

  return (
    <div className="app">
      <a className="skip-link" href="#main-content" onClick={skipToContent}>
        Skip to content
      </a>
      <header className="masthead no-print">
        <div className="masthead-inner">
          <a className="wordmark" href="#/">
            RegShift
            <span className="wordmark-tagline">make regulation move</span>
          </a>
          <nav aria-label="Main navigation" className="app-nav">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.section}
                href={item.href}
                aria-current={active === item.section ? 'page' : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        {run !== null && (
          <div className="case-strip">
            <div className="case-strip-inner">
              <span>{run.regulation.title}</span>
              <span className="sep">×</span>
              <span>
                {run.repo.name}@{run.repo.commit}
              </span>
              <span className="sep">·</span>
              <span>scope {run.repo.scope.join(', ')}</span>
              <span className="sep">·</span>
              <span>{run.model.name}</span>
            </div>
          </div>
        )}
      </header>
      <main id="main-content" tabIndex={-1} className="app-main">
        {children}
      </main>
      <footer className="app-footer no-print">
        <div className="app-footer-inner">
          <span>{run !== null ? `run ${run.runId} · pipeline artifacts: runs/demo/` : 'RegShift console'}</span>
          <span>static artifacts · review decisions stay in this browser (localStorage)</span>
        </div>
      </footer>
    </div>
  );
}
