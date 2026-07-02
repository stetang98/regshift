/**
 * Traceability derivation: obligation -> findings -> proposals -> decision.
 *
 * Pure functions over the artifact schema. Defensive about referential
 * integrity (a proposal pointing at an unknown finding is reported as an
 * orphan, never silently dropped).
 */
import type {
  DecisionMap,
  Finding,
  FindingSite,
  FindingStatus,
  Obligation,
  Proposal,
  ReviewDecision,
  Severity,
} from './types';

export interface TraceProposal {
  proposal: Proposal;
  decision: ReviewDecision | null;
}

export interface TraceFinding {
  finding: Finding;
  proposals: TraceProposal[];
}

export interface TraceRow {
  obligation: Obligation;
  findings: TraceFinding[];
}

export interface TraceabilityMatrix {
  rows: TraceRow[];
  /** Proposals unreachable through obligations -> findings (broken references). */
  orphanProposals: Proposal[];
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = [...(out[k] ?? []), item];
  }
  return out;
}

export function indexById<T extends { id: string }>(items: readonly T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of items) {
    out[item.id] = item;
  }
  return out;
}

export function buildTraceabilityMatrix(
  obligations: readonly Obligation[],
  findings: readonly Finding[],
  proposals: readonly Proposal[],
  decisions: DecisionMap,
): TraceabilityMatrix {
  const findingsByObligation = groupBy(findings, (f) => f.obligationId);
  const proposalsByFinding = groupBy(proposals, (p) => p.findingId);
  const findingById = indexById(findings);
  const obligationIds = new Set(obligations.map((o) => o.id));

  const rows: TraceRow[] = obligations.map((obligation) => ({
    obligation,
    findings: (findingsByObligation[obligation.id] ?? []).map((finding) => ({
      finding,
      proposals: (proposalsByFinding[finding.id] ?? []).map((proposal) => ({
        proposal,
        decision: decisions[proposal.id] ?? null,
      })),
    })),
  }));

  const orphanProposals = proposals.filter((p) => {
    const finding = findingById[p.findingId];
    return finding === undefined || !obligationIds.has(finding.obligationId);
  });

  return { rows, orphanProposals };
}

/** One row of the flattened audit table, with rowspan bookkeeping. */
export interface AuditRow {
  obligation: Obligation;
  finding: Finding | null;
  proposal: Proposal | null;
  decision: ReviewDecision | null;
  obligationSpan: number;
  findingSpan: number;
  isFirstOfObligation: boolean;
  isFirstOfFinding: boolean;
}

export function flattenTraceability(rows: readonly TraceRow[]): AuditRow[] {
  const out: AuditRow[] = [];
  for (const row of rows) {
    const obligationSpan =
      row.findings.length === 0
        ? 1
        : row.findings.reduce((n, tf) => n + Math.max(1, tf.proposals.length), 0);

    if (row.findings.length === 0) {
      out.push({
        obligation: row.obligation,
        finding: null,
        proposal: null,
        decision: null,
        obligationSpan,
        findingSpan: 1,
        isFirstOfObligation: true,
        isFirstOfFinding: true,
      });
      continue;
    }

    let isFirstOfObligation = true;
    for (const tf of row.findings) {
      const findingSpan = Math.max(1, tf.proposals.length);
      if (tf.proposals.length === 0) {
        out.push({
          obligation: row.obligation,
          finding: tf.finding,
          proposal: null,
          decision: null,
          obligationSpan,
          findingSpan,
          isFirstOfObligation,
          isFirstOfFinding: true,
        });
        isFirstOfObligation = false;
        continue;
      }
      let isFirstOfFinding = true;
      for (const tp of tf.proposals) {
        out.push({
          obligation: row.obligation,
          finding: tf.finding,
          proposal: tp.proposal,
          decision: tp.decision,
          obligationSpan,
          findingSpan,
          isFirstOfObligation,
          isFirstOfFinding,
        });
        isFirstOfObligation = false;
        isFirstOfFinding = false;
      }
    }
  }
  return out;
}

export interface ReviewProgress {
  total: number;
  decided: number;
  approved: number;
  rejected: number;
  needsWork: number;
  pending: number;
}

export function computeReviewProgress(
  proposals: readonly Proposal[],
  decisions: DecisionMap,
): ReviewProgress {
  let approved = 0;
  let rejected = 0;
  let needsWork = 0;
  for (const proposal of proposals) {
    const decision = decisions[proposal.id];
    if (decision === undefined) continue;
    if (decision.decision === 'approved') approved += 1;
    else if (decision.decision === 'rejected') rejected += 1;
    else needsWork += 1;
  }
  const decided = approved + rejected + needsWork;
  return {
    total: proposals.length,
    decided,
    approved,
    rejected,
    needsWork,
    pending: proposals.length - decided,
  };
}

export function countBySeverity(obligations: readonly Obligation[]): Record<Severity, number> {
  const out: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  for (const o of obligations) {
    out[o.severity] += 1;
  }
  return out;
}

export function countByStatus(findings: readonly Finding[]): Record<FindingStatus, number> {
  const out: Record<FindingStatus, number> = {
    gap: 0,
    partial: 0,
    compliant: 0,
    'not-applicable': 0,
  };
  for (const f of findings) {
    out[f.status] += 1;
  }
  return out;
}

/** One finding's touch on one file (a finding may touch several files). */
export interface FileImpact {
  file: string;
  findingId: string;
  obligationId: string;
  status: FindingStatus;
  sites: FindingSite[];
}

export interface ImpactIndex {
  byObligation: Record<string, FileImpact[]>;
  byFile: Record<string, FileImpact[]>;
}

/** Bidirectional obligation <-> file index derived from finding sites. */
export function buildImpactIndex(findings: readonly Finding[]): ImpactIndex {
  const byObligation: Record<string, FileImpact[]> = {};
  const byFile: Record<string, FileImpact[]> = {};

  for (const finding of findings) {
    const sitesByFile = groupBy(finding.sites, (site) => site.file);
    for (const [file, sites] of Object.entries(sitesByFile)) {
      const impact: FileImpact = {
        file,
        findingId: finding.id,
        obligationId: finding.obligationId,
        status: finding.status,
        sites,
      };
      byObligation[finding.obligationId] = [...(byObligation[finding.obligationId] ?? []), impact];
      byFile[file] = [...(byFile[file] ?? []), impact];
    }
  }
  return { byObligation, byFile };
}
