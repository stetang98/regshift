import { useMemo, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { useDecisions } from '../../hooks/useDecisions';
import { buildHash, useHashRoute } from '../../hooks/useHashRoute';
import {
  DECISION_VALUES,
  FINDING_STATUSES,
  SEVERITIES,
  decisionLabel,
  decisionTone,
  formatDateTime,
  riskLabel,
  statusLabel,
  statusTone,
} from '../../lib/format';
import { computeReviewProgress, indexById } from '../../lib/matrix';
import type { Finding, Obligation, Proposal, ReviewDecision, RunBundle } from '../../lib/types';
import { ArticleChip } from '../ui/ArticleChip';
import { Badge } from '../ui/Badge';
import { ProgressMeter } from '../ui/ProgressMeter';
import { SectionLabel } from '../ui/SectionLabel';
import { FilterBar } from './FilterBar';
import type { FilterGroup } from './FilterBar';
import './review.css';

interface ReviewViewProps {
  bundle: RunBundle;
  params: Record<string, string>;
}

interface QueueRow {
  proposal: Proposal;
  finding: Finding | undefined;
  obligation: Obligation | undefined;
  decision: ReviewDecision | null;
}

export function ReviewView({ bundle, params }: ReviewViewProps) {
  const { run, proposals, findings, obligations } = bundle;
  const { decisions } = useDecisions(run.runId);
  const { navigate } = useHashRoute();
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  const findingById = useMemo(() => indexById(findings), [findings]);
  const obligationById = useMemo(() => indexById(obligations), [obligations]);

  const statusFilter = params.status ?? 'all';
  const riskFilter = params.risk ?? 'all';
  const decisionFilter = params.decision ?? 'all';

  const rows = useMemo<QueueRow[]>(
    () =>
      proposals.map((proposal) => ({
        proposal,
        finding: findingById[proposal.findingId],
        obligation: obligationById[proposal.obligationId],
        decision: decisions[proposal.id] ?? null,
      })),
    [proposals, findingById, obligationById, decisions],
  );

  const matchesStatus = (row: QueueRow, value: string) =>
    value === 'all' || row.finding?.status === value;
  const matchesRisk = (row: QueueRow, value: string) =>
    value === 'all' || row.proposal.riskLevel === value;
  const matchesDecision = (row: QueueRow, value: string) =>
    value === 'all' ||
    (value === 'pending' ? row.decision === null : row.decision?.decision === value);

  const visible = rows.filter(
    (row) =>
      matchesStatus(row, statusFilter) &&
      matchesRisk(row, riskFilter) &&
      matchesDecision(row, decisionFilter),
  );

  const setFilter = (key: 'status' | 'risk' | 'decision', value: string) => {
    const nextParams: Record<string, string | undefined> = {
      status: statusFilter === 'all' ? undefined : statusFilter,
      risk: riskFilter === 'all' ? undefined : riskFilter,
      decision: decisionFilter === 'all' ? undefined : decisionFilter,
      [key]: value === 'all' ? undefined : value,
    };
    navigate(buildHash('/review', nextParams));
  };

  const groups: FilterGroup[] = [
    {
      label: 'Finding status',
      value: statusFilter,
      onSelect: (value) => setFilter('status', value),
      options: [
        { value: 'all', label: 'All', count: rows.length },
        ...FINDING_STATUSES.map((status) => ({
          value: status,
          label: statusLabel(status),
          count: rows.filter((row) => matchesStatus(row, status)).length,
        })),
      ],
    },
    {
      label: 'Risk',
      value: riskFilter,
      onSelect: (value) => setFilter('risk', value),
      options: [
        { value: 'all', label: 'All', count: rows.length },
        ...SEVERITIES.map((risk) => ({
          value: risk,
          label: riskLabel(risk),
          count: rows.filter((row) => matchesRisk(row, risk)).length,
        })),
      ],
    },
    {
      label: 'Decision',
      value: decisionFilter,
      onSelect: (value) => setFilter('decision', value),
      options: [
        { value: 'all', label: 'All', count: rows.length },
        { value: 'pending', label: 'Pending', count: rows.filter((r) => r.decision === null).length },
        ...DECISION_VALUES.map((value) => ({
          value,
          label: decisionLabel(value),
          count: rows.filter((row) => row.decision?.decision === value).length,
        })),
      ],
    },
  ];

  const progress = computeReviewProgress(proposals, decisions);

  const onQueueKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'j', 'k'].includes(event.key)) return;
    const links = Array.from(
      tbodyRef.current?.querySelectorAll<HTMLAnchorElement>('a.review-row-link') ?? [],
    );
    if (links.length === 0) return;
    const active = document.activeElement;
    const current = links.findIndex((link) => link === active);
    const delta = event.key === 'ArrowDown' || event.key === 'j' ? 1 : -1;
    const next =
      current === -1
        ? delta === 1
          ? 0
          : links.length - 1
        : Math.min(links.length - 1, Math.max(0, current + delta));
    links[next]?.focus();
    event.preventDefault();
  };

  return (
    <div className="review">
      <header className="page-head">
        <SectionLabel>Queue</SectionLabel>
        <h1>Review queue</h1>
        <p className="page-sub">
          {progress.decided} of {progress.total} proposals decided. Every decision is recorded
          with a timestamp and lands in the exported audit report.
        </p>
        <div className="review-progress">
          <ProgressMeter
            total={progress.total}
            ariaLabel={`Review progress: ${progress.decided} of ${progress.total} decided`}
            segments={[
              { label: 'approved', value: progress.approved, tone: 'approved' },
              { label: 'needs work', value: progress.needsWork, tone: 'needs-work' },
              { label: 'rejected', value: progress.rejected, tone: 'rejected' },
              { label: 'pending', value: progress.pending, tone: 'pending' },
            ]}
          />
        </div>
      </header>

      <FilterBar groups={groups} />

      <table className="data-table review-table">
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Proposal</th>
            <th scope="col">Obligation</th>
            <th scope="col">Status</th>
            <th scope="col">Risk</th>
            <th scope="col">Effort</th>
            <th scope="col">Decision</th>
            <th scope="col">Decided at</th>
          </tr>
        </thead>
        <tbody ref={tbodyRef} onKeyDown={onQueueKeyDown}>
          {visible.map((row) => (
            <tr
              key={row.proposal.id}
              className="review-row"
              onClick={() => navigate(`/proposals/${row.proposal.id}`)}
            >
              <td className="mono">
                <a
                  className="review-row-link"
                  href={`#/proposals/${row.proposal.id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.proposal.id}
                </a>
              </td>
              <td className="review-title-cell">{row.proposal.title}</td>
              <td>
                {row.obligation !== undefined ? (
                  <ArticleChip articleRef={row.obligation.articleRef} title={row.obligation.title} />
                ) : (
                  <span className="mono">{row.proposal.obligationId}</span>
                )}
              </td>
              <td>
                {row.finding !== undefined ? (
                  <Badge tone={statusTone(row.finding.status)}>
                    {statusLabel(row.finding.status)}
                  </Badge>
                ) : (
                  '—'
                )}
              </td>
              <td>
                <Badge tone={row.proposal.riskLevel}>{riskLabel(row.proposal.riskLevel)}</Badge>
              </td>
              <td className="mono">{row.proposal.effort}</td>
              <td>
                <Badge tone={decisionTone(row.decision?.decision ?? null)}>
                  {decisionLabel(row.decision?.decision ?? null)}
                </Badge>
              </td>
              <td className="mono review-decided-cell">
                {row.decision !== null ? formatDateTime(row.decision.decidedAt) : '—'}
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={8} className="review-empty">
                No proposals match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="kbd-hint">
        Tab into the queue, then <kbd>↑</kbd>/<kbd>↓</kbd> or <kbd>j</kbd>/<kbd>k</kbd> to move,{' '}
        <kbd>Enter</kbd> to open.
      </p>
    </div>
  );
}
