import { useDecisions } from '../../hooks/useDecisions';
import { buildHash } from '../../hooks/useHashRoute';
import {
  decisionLabel,
  decisionTone,
  effortLabel,
  riskLabel,
  statusLabel,
  statusTone,
} from '../../lib/format';
import type { RunBundle } from '../../lib/types';
import { ArticleChip } from '../ui/ArticleChip';
import { Badge } from '../ui/Badge';
import { EvidenceQuote } from '../ui/EvidenceQuote';
import { SectionLabel } from '../ui/SectionLabel';
import { ChangeCard } from './ChangeCard';
import { DecisionPanel } from './DecisionPanel';
import './proposals.css';

interface ProposalViewProps {
  bundle: RunBundle;
  proposalId: string;
}

export function ProposalView({ bundle, proposalId }: ProposalViewProps) {
  const { run, proposals, findings, obligations } = bundle;
  const { decisions, record, clear } = useDecisions(run.runId);

  const index = proposals.findIndex((p) => p.id === proposalId);
  const proposal = index === -1 ? null : proposals[index];

  if (proposal === null || proposal === undefined) {
    return (
      <section className="panel panel-pad" role="alert">
        <h1>Proposal not found</h1>
        <p className="measure">
          No proposal with id <code>{proposalId === '' ? '(none)' : proposalId}</code> exists in
          this run. Back to the <a href="#/review">review queue</a>.
        </p>
      </section>
    );
  }

  const finding = findings.find((f) => f.id === proposal.findingId) ?? null;
  const obligation = obligations.find((o) => o.id === proposal.obligationId) ?? null;
  const decision = decisions[proposal.id] ?? null;
  const prev = index > 0 ? proposals[index - 1] : undefined;
  const next = index < proposals.length - 1 ? proposals[index + 1] : undefined;

  return (
    <div className="proposal-view">
      <nav className="crumbs" aria-label="Proposal navigation">
        <a href="#/review">← Review queue</a>
        <span className="crumb-pos">
          {index + 1} / {proposals.length}
        </span>
        <span className="crumb-siblings">
          {prev !== undefined && <a href={`#/proposals/${prev.id}`}>‹ {prev.id}</a>}
          {next !== undefined && <a href={`#/proposals/${next.id}`}>{next.id} ›</a>}
        </span>
      </nav>

      <header className="page-head">
        <SectionLabel>Change proposal</SectionLabel>
        <h1>{proposal.title}</h1>
        <div className="proposal-chips">
          <code className="proposal-id">{proposal.id}</code>
          <Badge tone={proposal.riskLevel}>risk: {riskLabel(proposal.riskLevel)}</Badge>
          <Badge tone="neutral" title={effortLabel(proposal.effort)}>
            effort: {proposal.effort}
          </Badge>
          <Badge tone={decisionTone(decision?.decision ?? null)}>
            {decisionLabel(decision?.decision ?? null)}
          </Badge>
        </div>
      </header>

      <div className="trace-strip" aria-label="Traceability">
        <span className="trace-node">
          {obligation !== null ? (
            <>
              <ArticleChip articleRef={obligation.articleRef} href={obligation.sourceUrl} />
              <a href={buildHash('/obligations', { open: obligation.id })}>{obligation.title}</a>
            </>
          ) : (
            <span className="trace-missing">obligation {proposal.obligationId} not in register</span>
          )}
        </span>
        <span className="trace-arrow" aria-hidden="true">
          →
        </span>
        <span className="trace-node">
          {finding !== null ? (
            <>
              <code>{finding.id}</code>
              <Badge tone={statusTone(finding.status)}>{statusLabel(finding.status)}</Badge>
            </>
          ) : (
            <span className="trace-missing">finding {proposal.findingId} not in findings.json</span>
          )}
        </span>
        <span className="trace-arrow" aria-hidden="true">
          →
        </span>
        <span className="trace-node">
          <code>{proposal.id}</code> this proposal
        </span>
      </div>

      <section className="proposal-section">
        <SectionLabel>Rationale</SectionLabel>
        <p className="measure proposal-rationale">{proposal.rationale}</p>
      </section>

      {finding !== null && (
        <section className="proposal-section">
          <SectionLabel>Evidence — {finding.id}</SectionLabel>
          <p className="measure proposal-finding-summary">{finding.summary}</p>
          {finding.sites.map((site) => (
            <EvidenceQuote
              key={`${site.file}:${site.startLine}`}
              site={site}
              status={finding.status}
            />
          ))}
        </section>
      )}

      <section className="proposal-section">
        <SectionLabel>
          Proposed changes ({proposal.changes.length} file
          {proposal.changes.length === 1 ? '' : 's'})
        </SectionLabel>
        {proposal.changes.map((change, i) => (
          <ChangeCard key={`${change.file}:${i}`} change={change} />
        ))}
      </section>

      <section className="proposal-section">
        <SectionLabel>Verification plan</SectionLabel>
        <ul className="test-list">
          {proposal.tests.map((test) => (
            <li key={test}>{test}</li>
          ))}
        </ul>
      </section>

      <DecisionPanel
        decision={decision}
        onRecord={(value, comment) => record(proposal.id, value, comment)}
        onClear={() => clear(proposal.id)}
      />
    </div>
  );
}
