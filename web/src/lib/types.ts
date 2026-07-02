/**
 * RegShift artifact contract.
 *
 * These types mirror the JSON files the pipeline drops in `public/runs/<id>/`.
 * The app codes against this schema only — fixtures are replaceable
 * file-for-file with real pipeline output.
 */

export type Severity = 'high' | 'medium' | 'low';
export type FindingStatus = 'gap' | 'partial' | 'compliant' | 'not-applicable';
export type RiskLevel = 'high' | 'medium' | 'low';
export type Effort = 'S' | 'M' | 'L';
export type ChunkKind = 'function' | 'class' | 'route' | 'config' | 'component' | 'module';
export type ChangeKind = 'modify' | 'add';
export type DecisionValue = 'approved' | 'rejected' | 'needs-work';

/** run.json */
export interface RunStats {
  filesScanned: number;
  chunks: number;
  obligations: number;
  findings: number;
  gaps: number;
  proposals: number;
  durationSec: number;
}

export interface RunMeta {
  runId: string;
  createdAt: string;
  regulation: { title: string; version: string };
  repo: { name: string; url: string; commit: string; scope: string[] };
  model: { name: string };
  stats: RunStats;
}

/** obligations.json */
export interface Obligation {
  id: string;
  articleRef: string;
  title: string;
  actor: string;
  trigger: string;
  requirement: string;
  severity: Severity;
  sourceQuote: string;
  sourceUrl: string;
}

/** codemap.json */
export interface CodeChunk {
  id: string;
  kind: ChunkKind;
  name: string;
  startLine: number;
  endLine: number;
  signals: string[];
}

export interface CodeFile {
  path: string;
  lang: string;
  loc: number;
  chunks: CodeChunk[];
}

export interface CodeMap {
  files: CodeFile[];
}

/** findings.json */
export interface FindingSite {
  file: string;
  startLine: number;
  endLine: number;
  evidence: string;
  reason: string;
}

export interface Finding {
  id: string;
  obligationId: string;
  status: FindingStatus;
  confidence: number;
  sites: FindingSite[];
  summary: string;
}

/** proposals.json */
export interface ProposalChange {
  file: string;
  kind: ChangeKind;
  sketch: string;
  isFullDiff: boolean;
}

export interface Proposal {
  id: string;
  findingId: string;
  obligationId: string;
  title: string;
  rationale: string;
  riskLevel: RiskLevel;
  effort: Effort;
  changes: ProposalChange[];
  tests: string[];
}

/** Review decisions — persisted to localStorage, never sent anywhere. */
export interface ReviewDecision {
  decision: DecisionValue;
  comment: string;
  decidedAt: string;
}

export type DecisionMap = Record<string, ReviewDecision>;

/** The full set of loaded artifacts for one run. */
export interface RunBundle {
  run: RunMeta;
  obligations: Obligation[];
  codemap: CodeMap;
  findings: Finding[];
  proposals: Proposal[];
}
