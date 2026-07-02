import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export function exists(path: string): boolean {
  return existsSync(path);
}

/** Recursively list files under `root` matching `exts`, skipping noise dirs. */
export function walkFiles(root: string, exts: string[]): string[] {
  const skip = new Set(['node_modules', '.git', '__tests__', '__mocks__', 'coverage', 'dist']);
  const out: string[] = [];
  const visit = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (!skip.has(name)) visit(full);
      } else if (
        exts.some((e) => name.endsWith(e)) &&
        !/\.(test|spec)\.[jt]sx?$/.test(name)
      ) {
        out.push(full);
      }
    }
  };
  visit(root);
  return out.sort();
}

export function readLines(path: string, startLine: number, endLine: number): string {
  const lines = readFileSync(path, 'utf8').split('\n');
  return lines.slice(startLine - 1, endLine).join('\n');
}

/** Minimal frontmatter parser for our regulation corpus files. */
export function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) meta[kv[1]!] = kv[2]!.replace(/^["']|["']$/g, '');
  }
  return { meta, body: raw.slice(m[0].length) };
}
