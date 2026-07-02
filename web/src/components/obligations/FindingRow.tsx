import { buildHash } from '../../hooks/useHashRoute';
import { formatConfidence, statusLabel, statusTone } from '../../lib/format';
import type { TraceFinding } from '../../lib/matrix';
import { Badge } from '../ui/Badge';
import { CodeRef } from '../ui/CodeRef';
import './obligations.css';

interface FindingRowProps {
  traceFinding: TraceFinding;
  obligationId: string;
}

export function FindingRow({ traceFinding, obligationId }: FindingRowProps) {
  const { finding, proposals } = traceFinding;
  return (
    <div className="finding-row">
      <div className="finding-head">
        <code className="finding-id">{finding.id}</code>
        <Badge tone={statusTone(finding.status)}>{statusLabel(finding.status)}</Badge>
        <span className="finding-confidence" title="Analysis confidence (0–1)">
          conf {formatConfidence(finding.confidence)}
        </span>
        <a className="finding-impact-link" href={buildHash('/impact', { ob: obligationId })}>
          impact map →
        </a>
      </div>
      <p className="finding-summary measure">{finding.summary}</p>
      <ul className="finding-sites">
        {finding.sites.map((site) => (
          <li key={`${site.file}:${site.startLine}`}>
            <CodeRef file={site.file} startLine={site.startLine} endLine={site.endLine} />
          </li>
        ))}
      </ul>
      {proposals.length > 0 && (
        <div className="finding-proposals">
          {proposals.map((traceProposal) => (
            <a
              key={traceProposal.proposal.id}
              className="proposal-link"
              href={`#/proposals/${traceProposal.proposal.id}`}
            >
              <code>{traceProposal.proposal.id}</code> {traceProposal.proposal.title}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
