import { describe, expect, test } from 'vitest';
import { join } from 'node:path';
import { detectSignals, DETECTORS, ARTICLE_SIGNAL_HINTS } from '../src/detectors.js';
import { extractJson } from '../src/llm.js';
import { parseFrontmatter } from '../src/io.js';
import { buildCodemap } from '../src/stages/mapCode.js';

const FIXTURE_REPO = join(import.meta.dirname, 'fixtures', 'mini-repo');

describe('detectors', () => {
  test('flags model calls, storage, logging and deletion in a chat route', () => {
    const src = `const completion = await openai.chat.completions.create({});
      await Message.create({ text }); logger.info('x'); await Message.deleteOne({});`;
    const signals = detectSignals(src);
    expect(signals).toContain('model-call');
    expect(signals).toContain('stores-user-data');
    expect(signals).toContain('logging');
    expect(signals).toContain('retention-delete');
  });

  test('stays silent on plain utility code', () => {
    expect(detectSignals('export const add = (a, b) => a + b;')).toEqual([]);
  });

  test('every article hint references a real detector id', () => {
    const ids = new Set(DETECTORS.map((d) => d.id));
    for (const hints of Object.values(ARTICLE_SIGNAL_HINTS)) {
      for (const hint of hints) expect(ids.has(hint)).toBe(true);
    }
  });
});

describe('extractJson', () => {
  test('pulls JSON out of fenced prose', () => {
    const raw = 'Here you go:\n```json\n{"a": 1, "b": "x}y"}\n```\nDone.';
    expect(JSON.parse(extractJson(raw))).toEqual({ a: 1, b: 'x}y' });
  });

  test('handles nested arrays and escaped quotes', () => {
    const raw = 'noise [{"q": "she said \\"hi\\"", "n": [1, 2]}] trailing';
    expect(JSON.parse(extractJson(raw))).toEqual([{ q: 'she said "hi"', n: [1, 2] }]);
  });

  test('throws when no JSON is present', () => {
    expect(() => extractJson('no structured data here')).toThrow();
  });
});

describe('parseFrontmatter', () => {
  test('splits meta from body', () => {
    const { meta, body } = parseFrontmatter('---\narticleNumber: 50\ntitle: Transparency\n---\n1. Providers shall…');
    expect(meta['articleNumber']).toBe('50');
    expect(body.startsWith('1. Providers')).toBe(true);
  });

  test('passes through files without frontmatter', () => {
    const { meta, body } = parseFrontmatter('plain text');
    expect(meta).toEqual({});
    expect(body).toBe('plain text');
  });
});

describe('buildInsertionDiff', () => {
  const lines = ['const a = 1;', 'function send(res) {', '  res.json({ ok: true });', '}', 'module.exports = send;'];

  test('inserts after anchor with correct hunk arithmetic', async () => {
    const { buildInsertionDiff } = await import('../src/stages/refineDiffs.js');
    const diff = buildInsertionDiff('api/x.js', lines, 1, 'after', ['  res.set("X-AI-Generated", "true");']);
    expect(diff).toContain('--- a/api/x.js');
    expect(diff).toContain('+++ b/api/x.js');
    expect(diff).toContain('@@ -1,5 +1,6 @@');
    expect(diff).toContain('+  res.set("X-AI-Generated", "true");');
    const plus = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
    expect(plus).toHaveLength(1);
  });

  test('clamps context at file boundaries', async () => {
    const { buildInsertionDiff } = await import('../src/stages/refineDiffs.js');
    const diff = buildInsertionDiff('api/x.js', lines, 4, 'after', ['// audit trail']);
    expect(diff).toContain('@@ -3,3 +3,4 @@');
    expect(diff.trim().endsWith('+// audit trail')).toBe(true);
  });
});

describe('buildCodemap', () => {
  test('extracts routes, functions and signals from the fixture repo', () => {
    const codemap = buildCodemap(FIXTURE_REPO, ['api/server']);
    expect(codemap.files).toHaveLength(2);

    const chat = codemap.files.find((f) => f.path.endsWith('chat.js'));
    expect(chat).toBeDefined();
    const routeNames = chat!.chunks.filter((c) => c.kind === 'route').map((c) => c.name);
    expect(routeNames).toContain('POST /chat');
    expect(routeNames).toContain('DELETE /chat/:id');
    const post = chat!.chunks.find((c) => c.name === 'POST /chat')!;
    expect(post.signals).toEqual(expect.arrayContaining(['model-call', 'stores-user-data', 'logging']));

    const util = codemap.files.find((f) => f.path.endsWith('util.ts'));
    const fnNames = util!.chunks.filter((c) => c.kind === 'function').map((c) => c.name);
    expect(fnNames).toEqual(expect.arrayContaining(['formatTitle', 'sumTokens']));
  });
});
