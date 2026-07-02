import { describe, expect, it } from 'vitest';
import { diffStats, looksLikeUnifiedDiff, parseUnifiedDiff } from './diff';

const SAMPLE = [
  '--- a/x.js',
  '+++ b/x.js',
  '@@ -1,3 +1,4 @@',
  ' const a = 1;',
  '+const b = 2;',
  ' const c = 3;',
  ' const d = 4;',
  '@@ -10,2 +11,2 @@ function tail() {',
  '-  return old;',
  '+  return fresh;',
  '\\ No newline at end of file',
].join('\n');

describe('looksLikeUnifiedDiff', () => {
  it('detects hunk headers anywhere in the text', () => {
    expect(looksLikeUnifiedDiff(SAMPLE)).toBe(true);
    expect(looksLikeUnifiedDiff('just a plan:\n1. do things\n2. carefully')).toBe(false);
  });
});

describe('parseUnifiedDiff', () => {
  it('classifies lines and numbers them from hunk headers', () => {
    const lines = parseUnifiedDiff(SAMPLE);

    expect(lines.map((l) => l.kind)).toEqual([
      'meta',
      'meta',
      'hunk',
      'ctx',
      'add',
      'ctx',
      'ctx',
      'hunk',
      'del',
      'add',
      'note',
    ]);

    // first hunk: ctx 1/1, add -/2, ctx 2/3, ctx 3/4
    expect(lines[3]).toMatchObject({ oldNo: 1, newNo: 1 });
    expect(lines[4]).toMatchObject({ oldNo: null, newNo: 2 });
    expect(lines[5]).toMatchObject({ oldNo: 2, newNo: 3 });
    expect(lines[6]).toMatchObject({ oldNo: 3, newNo: 4 });

    // second hunk restarts numbering at -10 / +11
    expect(lines[8]).toMatchObject({ kind: 'del', oldNo: 10, newNo: null });
    expect(lines[9]).toMatchObject({ kind: 'add', oldNo: null, newNo: 11 });

    // meta and note lines carry no numbers
    expect(lines[0]).toMatchObject({ oldNo: null, newNo: null });
    expect(lines[10]).toMatchObject({ oldNo: null, newNo: null });
  });

  it('treats everything before the first hunk as meta', () => {
    const lines = parseUnifiedDiff('diff --git a b\nindex 123..456\n@@ -1,1 +1,1 @@\n ctx');
    expect(lines.map((l) => l.kind)).toEqual(['meta', 'meta', 'hunk', 'ctx']);
  });
});

describe('diffStats', () => {
  it('totals added and removed lines', () => {
    expect(diffStats(parseUnifiedDiff(SAMPLE))).toEqual({ added: 2, removed: 1 });
  });
});
