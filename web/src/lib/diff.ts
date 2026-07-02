/**
 * Display-oriented unified-diff parsing.
 *
 * Not a patch engine: it classifies lines and derives old/new line numbers
 * from hunk headers so the UI can render a credible two-gutter diff. Inputs
 * that are not unified diffs should be rendered as plain plan text instead
 * (check with `looksLikeUnifiedDiff` first).
 */

export type DiffLineKind = 'meta' | 'hunk' | 'add' | 'del' | 'ctx' | 'note';

export interface DiffLine {
  kind: DiffLineKind;
  /** Line content including its +/-/space marker, exactly as authored. */
  text: string;
  oldNo: number | null;
  newNo: number | null;
}

const HUNK_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function looksLikeUnifiedDiff(text: string): boolean {
  return HUNK_RE.test(text) || text.split('\n').some((line) => HUNK_RE.test(line));
}

export function parseUnifiedDiff(text: string): DiffLine[] {
  const out: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;
  let inHunk = false;

  for (const line of text.split('\n')) {
    const hunk = HUNK_RE.exec(line);
    if (hunk !== null) {
      oldNo = Number.parseInt(hunk[1] ?? '0', 10);
      newNo = Number.parseInt(hunk[2] ?? '0', 10);
      inHunk = true;
      out.push({ kind: 'hunk', text: line, oldNo: null, newNo: null });
      continue;
    }
    if (line.startsWith('--- ') || line.startsWith('+++ ') || !inHunk) {
      inHunk = line.startsWith('--- ') || line.startsWith('+++ ') ? false : inHunk;
      out.push({ kind: 'meta', text: line, oldNo: null, newNo: null });
      continue;
    }
    if (line.startsWith('+')) {
      out.push({ kind: 'add', text: line, oldNo: null, newNo: newNo });
      newNo += 1;
      continue;
    }
    if (line.startsWith('-')) {
      out.push({ kind: 'del', text: line, oldNo: oldNo, newNo: null });
      oldNo += 1;
      continue;
    }
    if (line.startsWith('\\')) {
      // e.g. "\ No newline at end of file"
      out.push({ kind: 'note', text: line, oldNo: null, newNo: null });
      continue;
    }
    out.push({ kind: 'ctx', text: line, oldNo: oldNo, newNo: newNo });
    oldNo += 1;
    newNo += 1;
  }
  return out;
}

/** Quick add/del totals for a diff, for change-card summaries. */
export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.kind === 'add') added += 1;
    if (line.kind === 'del') removed += 1;
  }
  return { added, removed };
}
