import { join } from 'node:path';
import { z } from 'zod';
import { jsonCall } from '../llm.js';
import { exists, readJson, readLines, writeJson } from '../io.js';
import { timeBudgetMs } from './match.js';
import { ProposalDraftSchema, type Finding, type Obligation, type Proposal } from '../types.js';

const FULL_DIFF_COUNT = 3;

const PLAN_SYSTEM = `You are a staff engineer writing a remediation proposal for a compliance
finding in LibreChat (a Node/Express AI chat platform). You are given the obligation and the
code sites where a gap was found. Produce ONE focused change proposal.

Return JSON:
{"title": "...",                       // imperative, <= 12 words
 "rationale": "...",                   // why this change satisfies the obligation, 2-4 sentences
 "riskLevel": "high"|"medium"|"low",   // risk of NOT making the change
 "effort": "S"|"M"|"L",
 "changes": [{"file": "path", "kind": "modify"|"add", "sketch": "stepwise plan for this file"}],
 "tests": ["...", "..."]}              // concrete test cases proving the change works

Rules:
- Propose the SMALLEST change that satisfies the requirement. No rewrites.
- Prefer modifying the exact sites given; add new files only when unavoidable.
- "sketch" must reference real function/route names from the evidence.
- Tests must be verifiable behaviours, not vague statements.`;

const DIFF_SYSTEM = `You are writing a unified diff for ONE file of LibreChat implementing the
change described. You are given the current code of the relevant region.

Return JSON: {"diff": "..."} where diff is a valid unified diff:
- the FIRST TWO LINES must be exactly the two header lines given in the user message
- hunk headers "@@ -start,count +start,count @@"
- context lines prefixed with a space, removals with "-", additions with "+"
- keep the change minimal and consistent with the surrounding code style
- the diff must apply to the code shown (line numbers may be approximate but content must match)`;

const DiffSchema = z.object({ diff: z.string().min(40) });

/** Accept slightly off header forms from small models, then normalise to a/ b/. */
function normalizeUnifiedDiff(diff: string, file: string): string | null {
  if (!diff.includes('@@')) return null;
  const lines = diff.replace(/\r\n/g, '\n').split('\n');
  const fromIdx = lines.findIndex((l) => l.startsWith('---') && l.includes(file));
  const toIdx = lines.findIndex((l) => l.startsWith('+++') && l.includes(file));
  if (fromIdx === -1 || toIdx === -1) return null;
  lines[fromIdx] = `--- a/${file}`;
  lines[toIdx] = `+++ b/${file}`;
  return lines.join('\n');
}

export async function planChanges(
  findings: Finding[],
  obligations: Obligation[],
  repoRoot: string,
  checkpointDir?: string,
): Promise<{ proposals: Proposal[]; complete: boolean }> {
  const byId = new Map(obligations.map((o) => [o.id, o]));
  const actionable = findings
    .filter((f) => f.status === 'gap' || f.status === 'partial')
    .sort((a, b) => {
      const sevRank = { high: 3, medium: 2, low: 1 } as const;
      const sa = sevRank[byId.get(a.obligationId)?.severity ?? 'low'];
      const sb = sevRank[byId.get(b.obligationId)?.severity ?? 'low'];
      return sb - sa;
    });

  const proposals: Proposal[] = [];
  const started = Date.now();
  for (const [i, finding] of actionable.entries()) {
    const ob = byId.get(finding.obligationId);
    if (!ob) continue;
    if (Date.now() - started > timeBudgetMs()) {
      console.log(`  plan: time budget exhausted after ${proposals.length} proposals — rerun to continue`);
      return { proposals, complete: false };
    }
    const ckpt = checkpointDir ? join(checkpointDir, `${finding.id}.json`) : null;
    if (ckpt && exists(ckpt)) {
      const cached = readJson<Omit<Proposal, 'id'>>(ckpt);
      proposals.push({ ...cached, id: `P-${String(proposals.length + 1).padStart(3, '0')}` });
      console.log(`  plan: ${finding.id} — reused checkpoint`);
      continue;
    }
    console.log(`  plan: ${finding.id} (${ob.articleRef}, ${finding.status})`);
    const sitesBlock = finding.sites
      .map((s) => `${s.file}:${s.startLine}-${s.endLine}\nWhy flagged: ${s.reason}\n\`\`\`\n${s.evidence}\n\`\`\``)
      .join('\n\n');
    try {
      const draft = await jsonCall(
        ProposalDraftSchema,
        PLAN_SYSTEM,
        `OBLIGATION ${ob.articleRef} — ${ob.title}\nRequirement: ${ob.requirement}\nFinding status: ${finding.status}\n\nSITES:\n${sitesBlock}`,
      );

      const changes: Proposal['changes'] = draft.changes.map((c) => ({ ...c, isFullDiff: false }));

      // Flagship diffs for the top findings by severity: ask for a real unified
      // diff against the primary site's current code, keep only if well-formed.
      if (i < FULL_DIFF_COUNT && finding.sites.length > 0) {
        const primary = finding.sites[0]!;
        const context = readLines(join(repoRoot, primary.file), Math.max(1, primary.startLine - 5), primary.endLine + 10);
        try {
          const { diff } = await jsonCall(
            DiffSchema,
            DIFF_SYSTEM,
            `FILE: ${primary.file}\nREQUIRED HEADER LINES:\n--- a/${primary.file}\n+++ b/${primary.file}\n\nCHANGE: ${draft.title}\nPLAN: ${changes[0]?.sketch ?? draft.rationale}\n\nCURRENT CODE (lines ${Math.max(1, primary.startLine - 5)}-${primary.endLine + 10}):\n\`\`\`\n${context}\n\`\`\``,
          );
          const normalized = normalizeUnifiedDiff(diff, primary.file);
          if (normalized) {
            const idx = changes.findIndex((c) => c.file === primary.file);
            const target = idx >= 0 ? idx : 0;
            changes[target] = { file: primary.file, kind: 'modify', sketch: normalized, isFullDiff: true };
          }
        } catch (err) {
          console.warn(`    ! diff generation failed: ${(err as Error).message.slice(0, 120)} — keeping plan sketch`);
        }
      }

      const proposal: Proposal = {
        id: `P-${String(proposals.length + 1).padStart(3, '0')}`,
        findingId: finding.id,
        obligationId: ob.id,
        title: draft.title,
        rationale: draft.rationale,
        riskLevel: draft.riskLevel,
        effort: draft.effort,
        changes,
        tests: draft.tests,
      };
      if (ckpt) {
        const { id: _id, ...rest } = proposal;
        writeJson(ckpt, rest);
      }
      proposals.push(proposal);
    } catch (err) {
      console.warn(`    ! proposal failed for ${finding.id}: ${(err as Error).message.slice(0, 120)} — skipped`);
    }
  }
  return { proposals, complete: true };
}
