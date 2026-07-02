import { useMemo } from 'react';
import { useDecisions } from '../../hooks/useDecisions';
import {
  formatDateTime,
  formatDuration,
  formatNumber,
  severityLabel,
  statusLabel,
  statusTone,
} from '../../lib/format';
import { computeReviewProgress, countBySeverity, countByStatus } from '../../lib/matrix';
import type { RunBundle } from '../../lib/types';
import { ProgressMeter } from '../ui/ProgressMeter';
import { SectionLabel } from '../ui/SectionLabel';
import { DistRow } from './DistRow';
import './overview.css';

export function OverviewView({ bundle }: { bundle: RunBundle }) {
  const { run, obligations, findings, proposals } = bundle;
  const { decisions } = useDecisions(run.runId);

  const severity = useMemo(() => countBySeverity(obligations), [obligations]);
  const status = useMemo(() => countByStatus(findings), [findings]);
  const progress = useMemo(
    () => computeReviewProgress(proposals, decisions),
    [proposals, decisions],
  );
  const maxSeverity = Math.max(1, ...Object.values(severity));
  const maxStatus = Math.max(1, ...Object.values(status));

  return (
    <div className="overview">
      <header className="dossier-head" aria-labelledby="dossier-heading">
        <SectionLabel>Compliance review dossier</SectionLabel>
        <h1 id="dossier-heading">{run.regulation.title}</h1>
        <p className="dossier-sub">
          reviewed against{' '}
          <a href={run.repo.url} target="_blank" rel="noreferrer">
            {run.repo.name}
          </a>{' '}
          <code>@{run.repo.commit}</code> · scope <code>{run.repo.scope.join(', ')}</code> ·
          analyzed by <code>{run.model.name}</code>
        </p>
      </header>

      <dl className="dossier-meta">
        <div>
          <dt>Run</dt>
          <dd>{run.runId}</dd>
        </div>
        <div>
          <dt>Executed</dt>
          <dd>{formatDateTime(run.createdAt)}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{formatDuration(run.stats.durationSec)}</dd>
        </div>
        <div>
          <dt>Regulation version</dt>
          <dd>{run.regulation.version}</dd>
        </div>
      </dl>

      <section aria-label="Pipeline statistics" className="stat-row">
        <StatTile value={run.stats.filesScanned} label="files scanned" />
        <StatTile value={run.stats.chunks} label="code chunks" />
        <StatTile value={run.stats.obligations} label="obligations" />
        <StatTile value={run.stats.findings} label="findings" />
        <StatTile value={run.stats.gaps} label="gaps" accent />
        <StatTile value={run.stats.proposals} label="proposals" />
      </section>

      <div className="overview-grid">
        <section className="panel panel-pad" aria-label="Obligations by severity">
          <SectionLabel>Obligations by severity</SectionLabel>
          <div className="dist-list">
            <DistRow label={severityLabel('high')} count={severity.high} max={maxSeverity} tone="high" href="#/obligations" />
            <DistRow label={severityLabel('medium')} count={severity.medium} max={maxSeverity} tone="medium" href="#/obligations" />
            <DistRow label={severityLabel('low')} count={severity.low} max={maxSeverity} tone="low" href="#/obligations" />
          </div>
        </section>

        <section className="panel panel-pad" aria-label="Findings by status">
          <SectionLabel>Findings by status</SectionLabel>
          <div className="dist-list">
            {(['gap', 'partial', 'compliant', 'not-applicable'] as const).map((s) => (
              <DistRow
                key={s}
                label={statusLabel(s)}
                count={status[s]}
                max={maxStatus}
                tone={statusTone(s)}
                href="#/impact"
              />
            ))}
          </div>
        </section>

        <section className="panel panel-pad review-cta" aria-label="Review progress">
          <SectionLabel>Review progress</SectionLabel>
          <p className="review-count">
            <strong>{progress.decided}</strong> of {progress.total} proposals decided
          </p>
          <ProgressMeter
            total={progress.total}
            ariaLabel={`Review progress: ${progress.decided} of ${progress.total} proposals decided`}
            segments={[
              { label: 'approved', value: progress.approved, tone: 'approved' },
              { label: 'needs work', value: progress.needsWork, tone: 'needs-work' },
              { label: 'rejected', value: progress.rejected, tone: 'rejected' },
              { label: 'pending', value: progress.pending, tone: 'pending' },
            ]}
          />
          <div className="cta-row">
            <a className="btn btn-primary" href="#/review">
              Open review queue
            </a>
            <a className="btn btn-quiet" href="#/audit">
              Audit trail
            </a>
          </div>
        </section>
      </div>

      <section className="protocol" aria-label="Review protocol">
        <SectionLabel>Review protocol</SectionLabel>
        <ol className="protocol-steps">
          <li>
            <a href="#/obligations">
              <span className="step-no">01</span>
              <span className="step-name">Read the obligations register</span>
              <span className="step-desc">what the regulation demands, with source quotes</span>
            </a>
          </li>
          <li>
            <a href="#/impact">
              <span className="step-no">02</span>
              <span className="step-name">Inspect the impact map</span>
              <span className="step-desc">where each duty touches the codebase, with evidence</span>
            </a>
          </li>
          <li>
            <a href="#/review">
              <span className="step-no">03</span>
              <span className="step-name">Decide the change proposals</span>
              <span className="step-desc">approve, reject, or send back with comments</span>
            </a>
          </li>
          <li>
            <a href="#/audit">
              <span className="step-no">04</span>
              <span className="step-name">Export the audit report</span>
              <span className="step-desc">a traceable record of every decision</span>
            </a>
          </li>
        </ol>
      </section>
    </div>
  );
}

function StatTile({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className={`stat${accent ? ' stat-accent' : ''}`}>
      <div className="stat-num">{formatNumber(value)}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
