import { useEffect, useState } from 'react';
import { severityLabel } from '../../lib/format';
import type { TraceRow } from '../../lib/matrix';
import { ArticleChip } from '../ui/ArticleChip';
import { Badge } from '../ui/Badge';
import { SectionLabel } from '../ui/SectionLabel';
import { FindingRow } from './FindingRow';
import './obligations.css';

interface ObligationCardProps {
  row: TraceRow;
  defaultOpen: boolean;
}

export function ObligationCard({ row, defaultOpen }: ObligationCardProps) {
  const [isOpen, setOpen] = useState(defaultOpen);
  // Deep links (?open=OB-…) must expand the target even when the card is
  // already mounted — initial state alone ignores later navigations.
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  const { obligation, findings } = row;
  const bodyId = `${obligation.id}-body`;

  return (
    <article className={`obligation-card${isOpen ? ' is-open' : ''}`} id={obligation.id}>
      <button
        type="button"
        className="obligation-summary"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="obligation-ids">
          <ArticleChip articleRef={obligation.articleRef} />
          <code className="obligation-id">{obligation.id}</code>
        </span>
        <span className="obligation-title">{obligation.title}</span>
        <span className="obligation-meta">
          <Badge tone={obligation.severity}>{severityLabel(obligation.severity)}</Badge>
          <span className="obligation-count">
            {findings.length} finding{findings.length === 1 ? '' : 's'}
          </span>
          <span className="disclosure" aria-hidden="true">
            {isOpen ? '−' : '+'}
          </span>
        </span>
      </button>

      {isOpen && (
        <div className="obligation-body" id={bodyId}>
          <div className="obligation-fields">
            <div>
              <SectionLabel>Actor</SectionLabel>
              <p>{obligation.actor}</p>
            </div>
            <div>
              <SectionLabel>Trigger</SectionLabel>
              <p>{obligation.trigger}</p>
            </div>
          </div>

          <SectionLabel>Requirement</SectionLabel>
          <p className="obligation-req measure">{obligation.requirement}</p>

          <blockquote className="source-quote" cite={obligation.sourceUrl}>
            <p>“{obligation.sourceQuote}”</p>
            <footer>
              — <cite>{obligation.articleRef}</cite> ·{' '}
              <a href={obligation.sourceUrl} target="_blank" rel="noreferrer">
                source text
              </a>
            </footer>
          </blockquote>

          <div className="obligation-findings">
            <SectionLabel>Findings traced to this obligation</SectionLabel>
            {findings.length === 0 && <p className="empty-note">Not assessed in this run.</p>}
            {findings.map((traceFinding) => (
              <FindingRow
                key={traceFinding.finding.id}
                traceFinding={traceFinding}
                obligationId={obligation.id}
              />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
