import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { jsonCall } from '../llm.js';
import type { Finding, Proposal } from '../types.js';

/**
 * Small local models cannot reliably emit unified-diff syntax, so we never ask
 * for it. The model returns an INSERTION SPEC (verbatim anchor line + new
 * lines); the diff is then compiled deterministically with correct hunk math.
 */
const InsertionSchema = z.object({
  anchor: z.string().min(3),
  position: z.enum(['after', 'before']),
  newLines: z.array(z.string()).min(1).max(10),
});
type Insertion = z.infer<typeof InsertionSchema>;

const SYSTEM = `You are adding a minimal code insertion to ONE file of LibreChat
(Node/Express) to remediate a compliance gap. You are given the region of code
and the change plan.

Return JSON: {"anchor": "...", "position": "after" | "before", "newLines": ["...", ...]}

Rules:
- "anchor" MUST be one line copied CHARACTER-FOR-CHARACTER from the code shown
  (including its indentation). Choose a stable, distinctive line.
- "newLines" are 1-8 new source lines to insert, matching surrounding indentation
  and code style (CommonJS, existing logger/util conventions visible in the code).
- The insertion alone must be syntactically valid at that position.
- Smallest change that implements the plan. No rewrites of existing lines.`;

export interface DiffTarget {
  proposal: Proposal;
  site: Finding['sites'][number];
}

function findAnchorIndex(lines: string[], rawAnchor: string, preferFrom: number): number {
  // Models sometimes echo the "123| " numbering prefix — strip it first.
  const anchor = rawAnchor.replace(/^\s*\d+\|\s?/, '');
  const exact = (l: string): boolean => l === anchor;
  const trimmed = (l: string): boolean => l.trim() === anchor.trim();
  for (const match of [exact, trimmed]) {
    for (let i = preferFrom; i < lines.length; i++) if (match(lines[i]!)) return i;
    for (let i = 0; i < preferFrom; i++) if (match(lines[i]!)) return i;
  }
  // Last resort: unique substring match (≥12 chars of signal).
  const needle = anchor.trim();
  if (needle.length >= 12) {
    const hits = lines.map((l, i) => [l, i] as const).filter(([l]) => l.includes(needle));
    if (hits.length === 1) return hits[0]![1];
  }
  return -1;
}

/** Compile an insertion into a unified diff with exact hunk arithmetic. */
export function buildInsertionDiff(
  file: string,
  fileLines: string[],
  anchorIdx: number,
  position: 'after' | 'before',
  newLines: string[],
  context = 3,
): string {
  const insertAt = position === 'after' ? anchorIdx + 1 : anchorIdx; // 0-based index in old file
  const ctxStart = Math.max(0, insertAt - context);
  const ctxEnd = Math.min(fileLines.length, insertAt + context);
  const before = fileLines.slice(ctxStart, insertAt);
  const after = fileLines.slice(insertAt, ctxEnd);
  const oldStart = ctxStart + 1;
  const oldCount = before.length + after.length;
  const newCount = oldCount + newLines.length;
  const body = [
    ...before.map((l) => ` ${l}`),
    ...newLines.map((l) => `+${l}`),
    ...after.map((l) => ` ${l}`),
  ];
  return [
    `--- a/${file}`,
    `+++ b/${file}`,
    `@@ -${oldStart},${oldCount} +${oldStart},${newCount} @@`,
    ...body,
  ].join('\n');
}

export async function refineDiff(target: DiffTarget, repoRoot: string): Promise<string | null> {
  const { proposal, site } = target;
  const fileLines = readFileSync(join(repoRoot, site.file), 'utf8').split('\n');
  const regionStart = Math.max(0, site.startLine - 6);
  const regionEnd = Math.min(fileLines.length, site.endLine + 10);
  const numbered = fileLines
    .slice(regionStart, regionEnd)
    .map((l, i) => `${regionStart + i + 1}| ${l}`)
    .join('\n');

  for (let attempt = 0; attempt < 2; attempt++) {
    const spec: Insertion = await jsonCall(
      InsertionSchema,
      SYSTEM,
      `FILE: ${site.file}
CHANGE: ${proposal.title}
PLAN: ${proposal.changes[0]?.sketch.slice(0, 600) ?? proposal.rationale}
${attempt > 0 ? '\nYour previous anchor line was not found verbatim in the file. Copy an anchor line EXACTLY as shown after the "|".' : ''}
CODE (line| content):
\`\`\`
${numbered}
\`\`\``,
    );
    const idx = findAnchorIndex(fileLines, spec.anchor, site.startLine - 1);
    if (idx !== -1) {
      return buildInsertionDiff(site.file, fileLines, idx, spec.position, spec.newLines);
    }
  }
  return null;
}
