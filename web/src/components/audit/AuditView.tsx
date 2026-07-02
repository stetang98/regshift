import { useMemo } from 'react';
import { useDecisions } from '../../hooks/useDecisions';
import { buildAuditFilename, downloadTextFile, generateAuditReport } from '../../lib/export';
import {
  decisionLabel,
  decisionTone,
  formatDateTime,
  severityLabel,
  statusLabel,
  statusTone,
} from '../../lib/format';
import {
  buildTraceabilityMatrix,
  computeReviewProgress,
  flattenTraceability,
} from '../../lib/matrix';
import type { RunBundle } from '../../lib/types';
import { ArticleChip } from '../ui/ArticleChip';
import { Badge } from '../ui/Badge';
import { SectionLabel } from '../ui/SectionLabel';
import './audit.css';

export function AuditView({ bundle }: { bundle: RunBundle }) {
  const { run, obligations, findings, proposals } = bundle;
  const { decisions } = useDecisions(run.runId);

  const matrix = useMemo(
    () => buildTraceabilityMatrix(obligations, findings, proposals, decisions),
    [obligations, findings, proposals, decisions],
  );
  const flat = useMemo(() => flattenTraceability(matrix.rows), [matrix]);
  const progress = useMemo(
    () => computeReviewProgress(proposals, decisions),
    [proposals, decisions],
  );

  const onExport = () => {
    const generatedAt = new Date().toISOString();
    const report = generateAuditReport({ bundle, decisions, generatedAt });
    downloadTextFile(buildAuditFilename(run.runId, generatedAt), report);
  };

  return (
    <div className="audit">
      <div className="print-only print-report-head">
        <h1>RegShift Audit Traceability Report</h1>
        <dl className="print-meta-grid">
          <dt>Run</dt>
          <dd>{run.runId}</dd>
          <dt>Regulation</dt>
          <dd>
            {run.regulation.title} ({run.regulation.version})
          </dd>
          <dt>Repository</dt>
          <dd>
            {run.repo.name} @ {run.repo.commit} · scope {run.repo.scope.join(', ')}
          </dd>
          <dt>Analysis model</dt>
          <dd>{run.model.name}</dd>
          <dt>Review state</dt>
          <dd>
            {progress.decided}/{progress.total} decided — {progress.approved} approved,{' '}
            {progress.needsWork} needs work, {progress.rejected} rejected, {progress.pending}{' '}
            pending
          </dd>
        </dl>
      </div>

      <header className="page-head no-print">
        <SectionLabel>Audit trail</SectionLabel>
        <h1>Traceability matrix</h1>
        <p className="page-sub">
          Every obligation traced through findings and proposals to its recorded human decision.
          Export the Markdown record, or print this page to PDF for a signed paper copy.
        </p>
        <div className="audit-actions">
          <button type="button" className="btn btn-primary" onClick={onExport}>
            Export audit report (.md)
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => window.print()}>
            Print report
          </button>
          <span className="audit-progress">
            {progress.decided}/{progress.total} decided · {progress.approved} approved ·{' '}
            {progress.needsWork} needs work · {progress.rejected} rejected
          </span>
        </div>
      </header>

      <table className="data-table audit-table">
        <thead>
          <tr>
            <th scope="col">Obligation</th>
            <th scope="col">Finding</th>
            <th scope="col">Proposal</th>
            <th scope="col">Decision</th>
            <th scope="col">Decided at</th>
          </tr>
        </thead>
        <tbody>
          {flat.map((row, i) => (
            <tr key={`${row.obligation.id}:${row.finding?.id ?? 'none'}:${row.proposal?.id ?? i}`}>
              {row.isFirstOfObligation && (
                <td rowSpan={row.obligationSpan} className="audit-ob-cell">
                  <div className="audit-ob-refline">
                    <ArticleChip
                      articleRef={row.obligation.articleRef}
                      href={row.obligation.sourceUrl}
                    />
                    <Badge tone={row.obligation.severity}>
                      {severityLabel(row.obligation.severity)}
                    </Badge>
                  </div>
                  <div className="audit-ob-title">{row.obligation.title}</div>
                  <code className="audit-ob-id">{row.obligation.id}</code>
                </td>
              )}
              {row.isFirstOfFinding && (
                <td rowSpan={row.findingSpan} className="audit-finding-cell">
                  {row.finding !== null ? (
                    <>
                      <code>{row.finding.id}</code>{' '}
                      <Badge tone={statusTone(row.finding.status)}>
                        {statusLabel(row.finding.status)}
                      </Badge>
                    </>
                  ) : (
                    <span className="empty-note">not assessed</span>
                  )}
                </td>
              )}
              <td className="audit-proposal-cell">
                {row.proposal !== null ? (
                  <a href={`#/proposals/${row.proposal.id}`}>
                    <code>{row.proposal.id}</code> {row.proposal.title}
                  </a>
                ) : row.finding !== null &&
                  (row.finding.status === 'gap' || row.finding.status === 'partial') ? (
                  <span className="unaddressed">no proposal — unaddressed</span>
                ) : (
                  <span className="empty-note">no action required</span>
                )}
              </td>
              <td>
                {row.proposal !== null ? (
                  <>
                    <Badge tone={decisionTone(row.decision?.decision ?? null)}>
                      {decisionLabel(row.decision?.decision ?? null)}
                    </Badge>
                    {row.decision !== null && row.decision.comment !== '' && (
                      <div className="audit-comment">“{row.decision.comment}”</div>
                    )}
                  </>
                ) : (
                  <span className="empty-note">—</span>
                )}
              </td>
              <td className="audit-time-cell">
                {row.decision !== null ? formatDateTime(row.decision.decidedAt) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {matrix.orphanProposals.length > 0 && (
        <section className="panel panel-pad audit-orphans" role="note">
          <SectionLabel>Data integrity</SectionLabel>
          <p>
            {matrix.orphanProposals.length} proposal(s) reference findings or obligations missing
            from the artifacts:{' '}
            {matrix.orphanProposals.map((p) => (
              <code key={p.id}>{p.id} </code>
            ))}
          </p>
        </section>
      )}

      <p className="audit-method no-print">
        Method: obligations extracted from the regulation text; mapped to code via static chunking
        plus LLM-assisted analysis ({run.model.name}); every proposal decided by a human reviewer.
        Decisions live in this browser and travel only via the exported report.
      </p>

      <div className="print-only print-signature">
        <div className="sig-cell">Reviewed by (name)</div>
        <div className="sig-cell">Role / function</div>
        <div className="sig-cell">Signature</div>
        <div className="sig-cell">Date</div>
      </div>
    </div>
  );
}
