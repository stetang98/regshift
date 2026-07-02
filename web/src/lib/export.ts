/**
 * Audit report generation: a self-contained Markdown document tracing every
 * obligation through findings and proposals to the recorded human decision.
 *
 * `generateAuditReport` is pure (timestamp injected) so exports are
 * deterministic and testable.
 */
import {
  buildTraceabilityMatrix,
  computeReviewProgress,
  flattenTraceability,
  indexById,
} from './matrix';
import { decisionLabel, formatDateTime, formatDuration, statusLabel } from './format';
import type { DecisionMap, RunBundle } from './types';

export interface AuditReportInput {
  bundle: RunBundle;
  decisions: DecisionMap;
  /** ISO timestamp of report generation (injected for determinism). */
  generatedAt: string;
}

/** Escape a value for use inside a Markdown table cell. */
export function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

export function buildAuditFilename(runId: string, generatedAt: string): string {
  const day = generatedAt.slice(0, 10).replace(/-/g, '');
  const safeRun = runId.replace(/[^a-zA-Z0-9._-]/g, '-');
  return `regshift-audit-${safeRun}-${day}.md`;
}

export function generateAuditReport({ bundle, decisions, generatedAt }: AuditReportInput): string {
  const { run, obligations, findings, proposals } = bundle;
  const { rows, orphanProposals } = buildTraceabilityMatrix(
    obligations,
    findings,
    proposals,
    decisions,
  );
  const flat = flattenTraceability(rows);
  const progress = computeReviewProgress(proposals, decisions);
  const obligationById = indexById(obligations);
  const findingById = indexById(findings);

  const lines: string[] = [];
  const push = (line = '') => lines.push(line);

  push('# RegShift Audit Traceability Report');
  push();
  push(`> Run \`${run.runId}\` · generated ${formatDateTime(generatedAt)}`);
  push();

  push('## 1. Engagement summary');
  push();
  push(`| Field | Value |`);
  push(`| --- | --- |`);
  push(`| Regulation | ${escapeCell(run.regulation.title)} (${escapeCell(run.regulation.version)}) |`);
  push(`| Repository | ${escapeCell(run.repo.name)} — ${escapeCell(run.repo.url)} |`);
  push(`| Commit | \`${escapeCell(run.repo.commit)}\` |`);
  push(`| Scope | ${escapeCell(run.repo.scope.join(', '))} |`);
  push(`| Analysis model | ${escapeCell(run.model.name)} |`);
  push(`| Pipeline run | ${formatDateTime(run.createdAt)} · ${formatDuration(run.stats.durationSec)} |`);
  push(
    `| Coverage | ${run.stats.filesScanned} files scanned · ${run.stats.chunks} chunks · ` +
      `${run.stats.obligations} obligations · ${run.stats.findings} findings (${run.stats.gaps} gaps) |`,
  );
  push();

  push('## 2. Review outcome');
  push();
  push(
    `${progress.decided} of ${progress.total} proposals decided — ` +
      `${progress.approved} approved · ${progress.needsWork} needs work · ` +
      `${progress.rejected} rejected · ${progress.pending} pending.`,
  );
  push();

  push('## 3. Traceability matrix');
  push();
  push('| Obligation | Severity | Finding | Status | Proposal | Decision | Decided at | Comment |');
  push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const row of flat) {
    const obligation = `${row.obligation.articleRef} — ${row.obligation.title} (\`${row.obligation.id}\`)`;
    const finding =
      row.finding === null ? '_not assessed_' : `\`${row.finding.id}\``;
    const status = row.finding === null ? '—' : statusLabel(row.finding.status);
    const proposal =
      row.proposal === null
        ? row.finding !== null && (row.finding.status === 'gap' || row.finding.status === 'partial')
          ? '_none — unaddressed_'
          : '_no action required_'
        : `\`${row.proposal.id}\` ${escapeCell(row.proposal.title)}`;
    const decision = row.proposal === null ? '—' : decisionLabel(row.decision?.decision ?? null);
    const decidedAt = row.decision === null ? '—' : formatDateTime(row.decision.decidedAt);
    const comment =
      row.decision === null || row.decision.comment === '' ? '—' : escapeCell(row.decision.comment);
    push(
      `| ${escapeCell(obligation)} | ${severityCell(row.obligation.severity)} | ${finding} ` +
        `| ${status} | ${proposal} | ${decision} | ${decidedAt} | ${comment} |`,
    );
  }
  push();

  push('## 4. Decision log');
  push();
  const decided = proposals.filter((p) => decisions[p.id] !== undefined);
  if (decided.length === 0) {
    push('_No decisions recorded yet._');
    push();
  }
  for (const proposal of decided) {
    const decision = decisions[proposal.id];
    if (decision === undefined) continue;
    const obligation = obligationById[proposal.obligationId];
    const finding = findingById[proposal.findingId];
    push(`### ${proposal.id} — ${proposal.title}`);
    push();
    push(`- Decision: **${decisionLabel(decision.decision)}** at ${formatDateTime(decision.decidedAt)}`);
    push(`- Comment: ${decision.comment === '' ? '—' : decision.comment}`);
    push(
      `- Trace: ${obligation !== undefined ? `${obligation.articleRef} (${obligation.id})` : proposal.obligationId} -> ` +
        `${finding !== undefined ? `${finding.id} [${statusLabel(finding.status)}]` : proposal.findingId} -> ${proposal.id}`,
    );
    push(`- Risk ${proposal.riskLevel} · effort ${proposal.effort}`);
    push(`- Files: ${proposal.changes.map((c) => `\`${c.file}\` (${c.kind})`).join(', ')}`);
    push();
  }

  if (orphanProposals.length > 0) {
    push('## 5. Data integrity notes');
    push();
    push('The following proposals reference findings or obligations not present in the artifacts:');
    push();
    for (const p of orphanProposals) {
      push(`- \`${p.id}\` -> finding \`${p.findingId}\`, obligation \`${p.obligationId}\``);
    }
    push();
  }

  push('---');
  push();
  push(
    '_Method: obligations were extracted from the regulation text, mapped to code via ' +
      'static chunking plus LLM-assisted analysis, and every change proposal above was ' +
      'reviewed by a human. Decisions are recorded client-side by the RegShift review ' +
      'console; this document is the exportable audit trail of that review._',
  );
  push();
  return lines.join('\n');
}

function severityCell(severity: 'high' | 'medium' | 'low'): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

/** Trigger a client-side file download. No-op outside the browser. */
export function downloadTextFile(filename: string, content: string, mime = 'text/markdown'): void {
  if (typeof document === 'undefined') {
    return;
  }
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
