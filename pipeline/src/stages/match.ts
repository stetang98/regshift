import MiniSearch from 'minisearch';
import { join } from 'node:path';
import { jsonCall } from '../llm.js';
import { exists, readJson, readLines, writeJson } from '../io.js';
import { ARTICLE_SIGNAL_HINTS } from '../detectors.js';
import { SiteVerdictSchema, type Codemap, type Finding, type Obligation } from '../types.js';

const MAX_CANDIDATES = 12;
const MAX_SNIPPET_LINES = 70;

interface CandidateDoc {
  id: string;
  path: string;
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  signals: string[];
  text: string;
}

const SYSTEM = `You are a compliance-focused senior engineer. You are given ONE regulatory
obligation and ONE code location from a self-hosted AI chat platform (LibreChat).
Judge this code location against the obligation.

Return JSON:
{"relevant": bool,        // is this code surface where the obligation applies?
 "status": "gap" | "partial" | "compliant" | "not-applicable",
 "reason": "one or two sentences, concrete, reference what the code does"}

Rules:
- "gap": the obligation applies here and the required behaviour is absent.
- "partial": some of the required behaviour exists but is incomplete.
- "compliant": the required behaviour is implemented here.
- "not-applicable": obligation does not apply to this code (then relevant=false).
- Judge ONLY from the code shown. Do not invent behaviour you cannot see.`;

function buildIndex(codemap: Codemap, repoRoot: string): { ms: MiniSearch<CandidateDoc>; docs: Map<string, CandidateDoc> } {
  const docs = new Map<string, CandidateDoc>();
  const ms = new MiniSearch<CandidateDoc>({
    fields: ['name', 'path', 'signals', 'text'],
    storeFields: ['path', 'name', 'kind', 'startLine', 'endLine', 'signals'],
    extractField: (doc, field) =>
      field === 'signals' ? doc.signals.join(' ') : String(doc[field as keyof CandidateDoc] ?? ''),
  });
  for (const file of codemap.files) {
    for (const chunk of file.chunks) {
      const snippet = readLines(join(repoRoot, file.path), chunk.startLine, Math.min(chunk.endLine, chunk.startLine + MAX_SNIPPET_LINES));
      const doc: CandidateDoc = {
        id: chunk.id,
        path: file.path,
        name: chunk.name,
        kind: chunk.kind,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        signals: chunk.signals,
        text: snippet.slice(0, 1500),
      };
      docs.set(doc.id, doc);
      ms.add(doc);
    }
  }
  return { ms, docs };
}

function candidatesFor(ob: Obligation, ms: MiniSearch<CandidateDoc>, docs: Map<string, CandidateDoc>): CandidateDoc[] {
  const artKey = ob.articleRef.replace(/\(.*$/, ''); // "Art. 50(1)" -> "Art. 50"
  const hintSignals = new Set(ARTICLE_SIGNAL_HINTS[artKey] ?? []);
  const query = `${ob.title} ${ob.requirement}`;
  const ranked = ms.search(query, { prefix: true, fuzzy: 0.1 }).map((r) => r.id as string);

  // Deterministic boost: chunks carrying hinted signals go first, BM25 fills the rest.
  const bySignal = [...docs.values()]
    .filter((d) => d.signals.some((s) => hintSignals.has(s)))
    .sort((a, b) => b.signals.length - a.signals.length)
    .map((d) => d.id);

  const ordered: string[] = [];
  for (const id of [...bySignal.slice(0, 8), ...ranked]) {
    if (!ordered.includes(id)) ordered.push(id);
    if (ordered.length >= MAX_CANDIDATES) break;
  }
  return ordered.map((id) => docs.get(id)!).filter(Boolean);
}

const STATUS_RANK = { gap: 3, partial: 2, compliant: 1, 'not-applicable': 0 } as const;

/**
 * Time-budgeted execution: the sandboxed shell that hosts long runs enforces a
 * hard wall-clock cap, so stages exit cleanly before it and resume from
 * checkpoints on the next invocation. `complete=false` means "rerun me".
 */
export function timeBudgetMs(): number {
  return Number(process.env.REGSHIFT_TIME_BUDGET_MS ?? 0) || Number.POSITIVE_INFINITY;
}

export async function matchObligations(
  obligations: Obligation[],
  codemap: Codemap,
  repoRoot: string,
  checkpointDir?: string,
): Promise<{ findings: Finding[]; complete: boolean }> {
  const { ms, docs } = buildIndex(codemap, repoRoot);
  const findings: Finding[] = [];
  let fCounter = 0;
  const started = Date.now();

  for (const ob of obligations) {
    if (Date.now() - started > timeBudgetMs()) {
      console.log(`  match: time budget exhausted after ${fCounter} obligations — rerun to continue`);
      return { findings, complete: false };
    }
    // Per-obligation checkpoint: a crash mid-run only costs the current obligation.
    const ckpt = checkpointDir ? join(checkpointDir, `${ob.id}.json`) : null;
    if (ckpt && exists(ckpt)) {
      const cached = readJson<Omit<Finding, 'id'>>(ckpt);
      fCounter += 1;
      findings.push({ ...cached, id: `F-${String(fCounter).padStart(3, '0')}` });
      console.log(`  match: ${ob.id} — reused checkpoint`);
      continue;
    }
    const cands = candidatesFor(ob, ms, docs);
    console.log(`  match: ${ob.id} ${ob.articleRef} — ${cands.length} candidates`);
    const sites: Finding['sites'] = [];
    const votes: Record<string, number> = {};

    for (const cand of cands) {
      const snippet = readLines(join(repoRoot, cand.path), cand.startLine, Math.min(cand.endLine, cand.startLine + MAX_SNIPPET_LINES));
      try {
        const verdict = await jsonCall(
          SiteVerdictSchema,
          SYSTEM,
          `OBLIGATION ${ob.articleRef} — ${ob.title}
Actor: ${ob.actor}
Trigger: ${ob.trigger}
Requirement: ${ob.requirement}

CODE LOCATION ${cand.path}:${cand.startLine}-${cand.endLine} (${cand.kind} ${cand.name}, signals: ${cand.signals.join(', ') || 'none'})
\`\`\`
${snippet}
\`\`\``,
        );
        if (verdict.relevant && verdict.status !== 'not-applicable') {
          votes[verdict.status] = (votes[verdict.status] ?? 0) + 1;
          sites.push({
            file: cand.path,
            startLine: cand.startLine,
            endLine: cand.endLine,
            evidence: snippet.split('\n').slice(0, 12).join('\n'),
            reason: verdict.reason,
          });
        }
      } catch (err) {
        console.warn(`    ! ${cand.id}: ${(err as Error).message.slice(0, 120)} — skipped`);
      }
    }

    // Deterministic aggregation: worst relevant status wins; confidence is the
    // share of relevant sites that agree with the winning status.
    const relevantCount = sites.length;
    let status: Finding['status'] = 'not-applicable';
    for (const s of ['gap', 'partial', 'compliant'] as const) {
      if ((votes[s] ?? 0) > 0 && STATUS_RANK[s] >= STATUS_RANK[status]) status = s;
    }
    if (relevantCount === 0) status = 'not-applicable';
    const confidence = relevantCount === 0 ? 0.3 : Math.round(((votes[status] ?? 0) / relevantCount) * 100) / 100;

    fCounter += 1;
    const finding: Finding = {
      id: `F-${String(fCounter).padStart(3, '0')}`,
      obligationId: ob.id,
      status,
      confidence,
      sites: sites.slice(0, 6),
      summary:
        relevantCount === 0
          ? `No code surface in scope was judged relevant to ${ob.articleRef}.`
          : `${relevantCount} relevant site(s); ${votes['gap'] ?? 0} gap, ${votes['partial'] ?? 0} partial, ${votes['compliant'] ?? 0} compliant. Overall: ${status}.`,
    };
    if (ckpt) {
      const { id: _id, ...rest } = finding;
      writeJson(ckpt, rest);
    }
    findings.push(finding);
  }
  return { findings, complete: true };
}
