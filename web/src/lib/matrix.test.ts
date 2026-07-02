import { describe, expect, it } from 'vitest';
import {
  buildImpactIndex,
  buildTraceabilityMatrix,
  computeReviewProgress,
  countBySeverity,
  countByStatus,
  flattenTraceability,
  indexById,
} from './matrix';
import type { DecisionMap, Finding, Obligation, Proposal } from './types';

const obligation = (id: string, severity: Obligation['severity'] = 'high'): Obligation => ({
  id,
  articleRef: `Art. ${id}`,
  title: `Obligation ${id}`,
  actor: 'Provider',
  trigger: 'trigger',
  requirement: 'requirement',
  severity,
  sourceQuote: 'quote',
  sourceUrl: 'https://example.com',
});

const finding = (
  id: string,
  obligationId: string,
  status: Finding['status'] = 'gap',
  files: string[] = ['a.js'],
): Finding => ({
  id,
  obligationId,
  status,
  confidence: 0.8,
  sites: files.map((file, i) => ({
    file,
    startLine: 10 + i,
    endLine: 12 + i,
    evidence: 'const x = 1;',
    reason: 'because',
  })),
  summary: `summary ${id}`,
});

const proposal = (id: string, findingId: string, obligationId: string): Proposal => ({
  id,
  findingId,
  obligationId,
  title: `Proposal ${id}`,
  rationale: 'rationale',
  riskLevel: 'medium',
  effort: 'S',
  changes: [{ file: 'a.js', kind: 'modify', sketch: 'plan', isFullDiff: false }],
  tests: ['test one'],
});

describe('buildTraceabilityMatrix', () => {
  it('nests findings under obligations and proposals under findings, with decisions attached', () => {
    const obligations = [obligation('OB-1'), obligation('OB-2', 'low')];
    const findings = [finding('F-1', 'OB-1'), finding('F-2', 'OB-1', 'compliant'), finding('F-3', 'OB-2')];
    const proposals = [proposal('P-1', 'F-1', 'OB-1'), proposal('P-2', 'F-1', 'OB-1')];
    const decisions: DecisionMap = {
      'P-1': { decision: 'approved', comment: 'ok', decidedAt: '2026-07-01T10:00:00Z' },
    };

    const { rows, orphanProposals } = buildTraceabilityMatrix(
      obligations,
      findings,
      proposals,
      decisions,
    );

    expect(orphanProposals).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.findings.map((tf) => tf.finding.id)).toEqual(['F-1', 'F-2']);
    expect(rows[0]?.findings[0]?.proposals.map((tp) => tp.proposal.id)).toEqual(['P-1', 'P-2']);
    expect(rows[0]?.findings[0]?.proposals[0]?.decision?.decision).toBe('approved');
    expect(rows[0]?.findings[0]?.proposals[1]?.decision).toBeNull();
    expect(rows[0]?.findings[1]?.proposals).toEqual([]);
  });

  it('keeps obligations with no findings and reports orphan proposals', () => {
    const obligations = [obligation('OB-1'), obligation('OB-EMPTY')];
    const findings = [finding('F-1', 'OB-1'), finding('F-GHOST', 'OB-MISSING')];
    const proposals = [
      proposal('P-OK', 'F-1', 'OB-1'),
      proposal('P-NO-FINDING', 'F-404', 'OB-1'),
      proposal('P-BAD-OB', 'F-GHOST', 'OB-MISSING'),
    ];

    const { rows, orphanProposals } = buildTraceabilityMatrix(obligations, findings, proposals, {});

    expect(rows[1]?.findings).toEqual([]);
    expect(orphanProposals.map((p) => p.id).sort()).toEqual(['P-BAD-OB', 'P-NO-FINDING']);
  });
});

describe('flattenTraceability', () => {
  it('computes rowspans across findings and proposals', () => {
    const obligations = [obligation('OB-1'), obligation('OB-EMPTY')];
    const findings = [finding('F-1', 'OB-1'), finding('F-2', 'OB-1', 'compliant')];
    const proposals = [proposal('P-1', 'F-1', 'OB-1'), proposal('P-2', 'F-1', 'OB-1')];

    const { rows } = buildTraceabilityMatrix(obligations, findings, proposals, {});
    const flat = flattenTraceability(rows);

    // OB-1: F-1 has two proposals (2 rows) + F-2 with none (1 row); OB-EMPTY: 1 row.
    expect(flat).toHaveLength(4);
    expect(flat[0]?.obligationSpan).toBe(3);
    expect(flat[0]?.findingSpan).toBe(2);
    expect(flat[0]?.isFirstOfObligation).toBe(true);
    expect(flat[1]?.isFirstOfObligation).toBe(false);
    expect(flat[1]?.isFirstOfFinding).toBe(false);
    expect(flat[2]?.finding?.id).toBe('F-2');
    expect(flat[2]?.proposal).toBeNull();
    expect(flat[3]?.obligation.id).toBe('OB-EMPTY');
    expect(flat[3]?.finding).toBeNull();
    expect(flat[3]?.obligationSpan).toBe(1);
  });
});

describe('computeReviewProgress', () => {
  it('counts every decision bucket and pending remainder', () => {
    const proposals = [
      proposal('P-1', 'F-1', 'OB-1'),
      proposal('P-2', 'F-1', 'OB-1'),
      proposal('P-3', 'F-1', 'OB-1'),
      proposal('P-4', 'F-1', 'OB-1'),
    ];
    const decisions: DecisionMap = {
      'P-1': { decision: 'approved', comment: '', decidedAt: '2026-07-01T10:00:00Z' },
      'P-2': { decision: 'rejected', comment: '', decidedAt: '2026-07-01T10:01:00Z' },
      'P-3': { decision: 'needs-work', comment: '', decidedAt: '2026-07-01T10:02:00Z' },
    };

    expect(computeReviewProgress(proposals, decisions)).toEqual({
      total: 4,
      decided: 3,
      approved: 1,
      rejected: 1,
      needsWork: 1,
      pending: 1,
    });
  });
});

describe('count helpers', () => {
  it('zero-fills severities and statuses', () => {
    expect(countBySeverity([obligation('OB-1', 'high')])).toEqual({ high: 1, medium: 0, low: 0 });
    expect(countByStatus([finding('F-1', 'OB-1', 'partial')])).toEqual({
      gap: 0,
      partial: 1,
      compliant: 0,
      'not-applicable': 0,
    });
  });
});

describe('buildImpactIndex', () => {
  it('is bidirectional and groups sites per file', () => {
    const findings = [
      finding('F-1', 'OB-1', 'gap', ['a.js', 'b.js', 'a.js']),
      finding('F-2', 'OB-2', 'partial', ['a.js']),
    ];

    const index = buildImpactIndex(findings);

    expect(index.byObligation['OB-1']?.map((hit) => hit.file).sort()).toEqual(['a.js', 'b.js']);
    const aHitForF1 = index.byObligation['OB-1']?.find((hit) => hit.file === 'a.js');
    expect(aHitForF1?.sites).toHaveLength(2); // two sites in a.js grouped into one hit
    expect(index.byFile['a.js']?.map((hit) => hit.findingId).sort()).toEqual(['F-1', 'F-2']);
    expect(index.byFile['b.js']?.[0]?.obligationId).toBe('OB-1');
    expect(index.byFile['b.js']?.[0]?.status).toBe('gap');
  });
});

describe('indexById', () => {
  it('maps ids to items', () => {
    const items = [obligation('OB-1'), obligation('OB-2')];
    const index = indexById(items);
    expect(index['OB-2']?.title).toBe('Obligation OB-2');
    expect(index['OB-404']).toBeUndefined();
  });
});
