import { describe, expect, it } from 'vitest';
import { buildAuditFilename, escapeCell, generateAuditReport } from './export';
import type { DecisionMap, Finding, Obligation, Proposal, RunBundle } from './types';

function makeBundle(): RunBundle {
  const obligations: Obligation[] = [
    {
      id: 'OB-1',
      articleRef: 'Art. 9(1)',
      title: 'Keep | risky records',
      actor: 'Provider',
      trigger: 'always',
      requirement: 'do the thing',
      severity: 'high',
      sourceQuote: 'quote',
      sourceUrl: 'https://example.com',
    },
    {
      id: 'OB-2',
      articleRef: 'Art. 10',
      title: 'Unassessed duty',
      actor: 'Deployer',
      trigger: 'sometimes',
      requirement: 'other thing',
      severity: 'low',
      sourceQuote: 'quote',
      sourceUrl: 'https://example.com',
    },
  ];
  const findings: Finding[] = [
    {
      id: 'F-1',
      obligationId: 'OB-1',
      status: 'gap',
      confidence: 0.9,
      sites: [{ file: 'a.js', startLine: 1, endLine: 2, evidence: 'x', reason: 'y' }],
      summary: 'gap summary',
    },
    {
      id: 'F-2',
      obligationId: 'OB-1',
      status: 'compliant',
      confidence: 0.7,
      sites: [{ file: 'b.js', startLine: 3, endLine: 4, evidence: 'x', reason: 'y' }],
      summary: 'fine',
    },
  ];
  const proposals: Proposal[] = [
    {
      id: 'P-1',
      findingId: 'F-1',
      obligationId: 'OB-1',
      title: 'Fix the | gap',
      rationale: 'because',
      riskLevel: 'high',
      effort: 'M',
      changes: [
        { file: 'a.js', kind: 'modify', sketch: '--- a\n+++ b', isFullDiff: true },
        { file: 'c.js', kind: 'add', sketch: 'plan', isFullDiff: false },
      ],
      tests: ['t1'],
    },
    {
      id: 'P-2',
      findingId: 'F-1',
      obligationId: 'OB-1',
      title: 'Second fix',
      rationale: 'because too',
      riskLevel: 'low',
      effort: 'S',
      changes: [{ file: 'a.js', kind: 'modify', sketch: 'plan', isFullDiff: false }],
      tests: [],
    },
  ];
  return {
    run: {
      runId: 'run-test-01',
      createdAt: '2026-06-28T09:41:17Z',
      regulation: { title: 'EU AI Act', version: 'v1' },
      repo: { name: 'RepoX', url: 'https://example.com/repo', commit: 'abc1234', scope: ['api'] },
      model: { name: 'test-model' },
      stats: {
        filesScanned: 10,
        chunks: 20,
        obligations: 2,
        findings: 2,
        gaps: 1,
        proposals: 2,
        durationSec: 61,
      },
    },
    obligations,
    codemap: { files: [] },
    findings,
    proposals,
  };
}

const GENERATED_AT = '2026-07-01T12:00:00Z';

describe('generateAuditReport', () => {
  it('is deterministic and self-contained', () => {
    const bundle = makeBundle();
    const decisions: DecisionMap = {};
    const first = generateAuditReport({ bundle, decisions, generatedAt: GENERATED_AT });
    const second = generateAuditReport({ bundle, decisions, generatedAt: GENERATED_AT });

    expect(first).toBe(second);
    expect(first).toContain('# RegShift Audit Traceability Report');
    expect(first).toContain('run-test-01');
    expect(first).toContain('EU AI Act');
    expect(first).toContain('test-model');
    expect(first).toContain('01 Jul 2026, 12:00 UTC');
  });

  it('traces decided, pending, unaddressed and not-assessed rows', () => {
    const bundle = makeBundle();
    const decisions: DecisionMap = {
      'P-1': {
        decision: 'approved',
        comment: 'ship it | carefully',
        decidedAt: '2026-07-01T10:30:00Z',
      },
    };
    const report = generateAuditReport({ bundle, decisions, generatedAt: GENERATED_AT });

    // decided proposal row with escaped title and comment
    expect(report).toContain('Fix the \\| gap');
    expect(report).toContain('Approved');
    expect(report).toContain('01 Jul 2026, 10:30 UTC');
    expect(report).toContain('ship it \\| carefully');
    // undecided proposal is pending
    expect(report).toContain('| `P-2` Second fix | Pending | — | — |');
    // compliant finding without proposals
    expect(report).toContain('_no action required_');
    // obligation without findings
    expect(report).toContain('_not assessed_');
    // decision log lists files touched
    expect(report).toContain('### P-1 — Fix the | gap');
    expect(report).toContain('`a.js` (modify), `c.js` (add)');
    // review outcome line
    expect(report).toContain('1 of 2 proposals decided');
  });

  it('marks gap findings without proposals as unaddressed', () => {
    const bundle = makeBundle();
    const withoutProposals: RunBundle = { ...bundle, proposals: [] };
    const report = generateAuditReport({
      bundle: withoutProposals,
      decisions: {},
      generatedAt: GENERATED_AT,
    });
    expect(report).toContain('_none — unaddressed_');
  });

  it('reports orphan proposals under data integrity', () => {
    const bundle = makeBundle();
    const orphan: Proposal = {
      id: 'P-ORPHAN',
      findingId: 'F-404',
      obligationId: 'OB-1',
      title: 'Dangling',
      rationale: 'x',
      riskLevel: 'low',
      effort: 'S',
      changes: [],
      tests: [],
    };
    const report = generateAuditReport({
      bundle: { ...bundle, proposals: [...bundle.proposals, orphan] },
      decisions: {},
      generatedAt: GENERATED_AT,
    });
    expect(report).toContain('## 5. Data integrity notes');
    expect(report).toContain('P-ORPHAN');
  });
});

describe('escapeCell', () => {
  it('escapes pipes and flattens newlines', () => {
    expect(escapeCell('a|b')).toBe('a\\|b');
    expect(escapeCell('line one\nline two')).toBe('line one line two');
    expect(escapeCell('  padded  ')).toBe('padded');
  });
});

describe('buildAuditFilename', () => {
  it('derives a dated, sanitized filename', () => {
    expect(buildAuditFilename('run-test-01', GENERATED_AT)).toBe(
      'regshift-audit-run-test-01-20260701.md',
    );
    expect(buildAuditFilename('weird/run:id', GENERATED_AT)).toBe(
      'regshift-audit-weird-run-id-20260701.md',
    );
  });
});
