import { join, resolve } from 'node:path';
import { readJson, writeJson } from './io.js';
import { refineDiff } from './stages/refineDiffs.js';
import type { Finding, Obligation, Proposal } from './types.js';

/**
 * Post-pass: compile real unified diffs for the top proposals.
 * Usage: pnpm refine-diffs [--run-id demo] [--top 4]
 */
const ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(ROOT, '..', 'target', 'librechat');

const argv = process.argv.slice(2);
const runId = argv.includes('--run-id') ? argv[argv.indexOf('--run-id') + 1]! : 'demo';
const top = argv.includes('--top') ? Number(argv[argv.indexOf('--top') + 1]) : 4;

const runDir = join(ROOT, 'runs', runId);
const proposals = readJson<Proposal[]>(join(runDir, 'proposals.json'));
const findings = readJson<Finding[]>(join(runDir, 'findings.json'));
const obligations = readJson<Obligation[]>(join(runDir, 'obligations.json'));

const sevRank = { high: 3, medium: 2, low: 1 } as const;
const obById = new Map(obligations.map((o) => [o.id, o]));
const fById = new Map(findings.map((f) => [f.id, f]));

const targets = proposals
  .filter((p) => !p.changes.some((c) => c.isFullDiff))
  .filter((p) => (fById.get(p.findingId)?.sites.length ?? 0) > 0)
  .sort((a, b) => sevRank[obById.get(b.obligationId)?.severity ?? 'low'] - sevRank[obById.get(a.obligationId)?.severity ?? 'low'])
  .slice(0, top);

let refined = 0;
for (const proposal of targets) {
  const site = fById.get(proposal.findingId)!.sites[0]!;
  console.log(`refine: ${proposal.id} (${proposal.title.slice(0, 50)}) @ ${site.file}`);
  try {
    const diff = await refineDiff({ proposal, site }, REPO_ROOT);
    if (!diff) {
      console.warn('  anchor not found after retries — kept plan sketch');
      continue;
    }
    const idx = proposal.changes.findIndex((c) => c.file === site.file);
    const target = idx >= 0 ? idx : 0;
    proposal.changes[target] = { file: site.file, kind: 'modify', sketch: diff, isFullDiff: true };
    refined += 1;
  } catch (err) {
    console.warn(`  failed: ${(err as Error).message.slice(0, 120)}`);
  }
}

writeJson(join(runDir, 'proposals.json'), proposals);
console.log(`✓ refined ${refined}/${targets.length} proposals with compiled diffs`);
