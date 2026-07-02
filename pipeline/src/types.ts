import { z } from 'zod';

export const Severity = z.enum(['high', 'medium', 'low']);
export const FindingStatus = z.enum(['gap', 'partial', 'compliant', 'not-applicable']);

export const ObligationSchema = z.object({
  id: z.string().regex(/^OB-\d{3}-\d+$/),
  articleRef: z.string().min(3),
  title: z.string().min(5),
  actor: z.string().min(3),
  trigger: z.string().min(5),
  requirement: z.string().min(10),
  severity: Severity,
  sourceQuote: z.string().min(10),
  sourceUrl: z.string().url(),
});
export type Obligation = z.infer<typeof ObligationSchema>;

/** LLM raw extraction shape before ids/urls are stamped deterministically. */
export const ObligationDraftSchema = z.object({
  title: z.string().min(5),
  actor: z.string().min(3),
  trigger: z.string().min(5),
  requirement: z.string().min(10),
  severity: Severity,
  paragraphRef: z.string().min(1),
  sourceQuote: z.string().min(10),
});
export type ObligationDraft = z.infer<typeof ObligationDraftSchema>;

export const ChunkKind = z.enum(['function', 'class', 'route', 'config', 'component', 'module']);
export const ChunkSchema = z.object({
  id: z.string(),
  kind: ChunkKind,
  name: z.string(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  signals: z.array(z.string()),
});
export type Chunk = z.infer<typeof ChunkSchema>;

export const CodeFileSchema = z.object({
  path: z.string(),
  lang: z.string(),
  loc: z.number().int().nonnegative(),
  chunks: z.array(ChunkSchema),
});
export const CodemapSchema = z.object({ files: z.array(CodeFileSchema) });
export type Codemap = z.infer<typeof CodemapSchema>;

export const SiteSchema = z.object({
  file: z.string(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  evidence: z.string(),
  reason: z.string(),
});
export const FindingSchema = z.object({
  id: z.string().regex(/^F-\d{3}$/),
  obligationId: z.string(),
  status: FindingStatus,
  confidence: z.number().min(0).max(1),
  sites: z.array(SiteSchema),
  summary: z.string().min(10),
});
export type Finding = z.infer<typeof FindingSchema>;

/** LLM per-site classification output. */
export const SiteVerdictSchema = z.object({
  relevant: z.boolean(),
  status: FindingStatus,
  reason: z.string().min(5),
});
export type SiteVerdict = z.infer<typeof SiteVerdictSchema>;

export const ChangeSchema = z.object({
  file: z.string(),
  kind: z.enum(['modify', 'add']),
  sketch: z.string().min(10),
  isFullDiff: z.boolean(),
});
export const ProposalSchema = z.object({
  id: z.string().regex(/^P-\d{3}$/),
  findingId: z.string(),
  obligationId: z.string(),
  title: z.string().min(5),
  rationale: z.string().min(20),
  riskLevel: Severity,
  effort: z.enum(['S', 'M', 'L']),
  changes: z.array(ChangeSchema).min(1),
  tests: z.array(z.string()).min(1),
});
export type Proposal = z.infer<typeof ProposalSchema>;

/** LLM proposal draft before ids are stamped. */
export const ProposalDraftSchema = ProposalSchema.omit({ id: true, findingId: true, obligationId: true, changes: true }).extend({
  changes: z.array(ChangeSchema.omit({ isFullDiff: true })).min(1),
});
export type ProposalDraft = z.infer<typeof ProposalDraftSchema>;

export const RunSchema = z.object({
  runId: z.string(),
  createdAt: z.string(),
  regulation: z.object({ title: z.string(), version: z.string() }),
  repo: z.object({ name: z.string(), url: z.string(), commit: z.string(), scope: z.array(z.string()) }),
  model: z.object({ name: z.string() }),
  stats: z.object({
    filesScanned: z.number(),
    chunks: z.number(),
    obligations: z.number(),
    findings: z.number(),
    gaps: z.number(),
    proposals: z.number(),
    durationSec: z.number(),
  }),
});
export type Run = z.infer<typeof RunSchema>;
