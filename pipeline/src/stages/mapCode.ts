import { readFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { parse } from '@babel/parser';
import type { Node } from '@babel/types';
import { walkFiles } from '../io.js';
import { detectSignals } from '../detectors.js';
import type { Codemap, Chunk } from '../types.js';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'use', 'all']);

function pluginsFor(ext: string): ('typescript' | 'jsx')[] {
  if (ext === '.ts') return ['typescript'];
  if (ext === '.tsx') return ['typescript', 'jsx'];
  return ['jsx'];
}

interface RawChunk {
  kind: Chunk['kind'];
  name: string;
  startLine: number;
  endLine: number;
}

function nodeLines(node: Node): { startLine: number; endLine: number } | null {
  if (!node.loc) return null;
  return { startLine: node.loc.start.line, endLine: node.loc.end.line };
}

/** Extract top-level structures we care about; nested detail stays inside its parent chunk. */
function extractChunks(body: Node[]): RawChunk[] {
  const chunks: RawChunk[] = [];
  for (const node of body) {
    const lines = nodeLines(node);
    if (!lines) continue;
    switch (node.type) {
      case 'FunctionDeclaration':
        if (node.id) chunks.push({ kind: 'function', name: node.id.name, ...lines });
        break;
      case 'ClassDeclaration':
        if (node.id) chunks.push({ kind: 'class', name: node.id.name, ...lines });
        break;
      case 'VariableDeclaration':
        for (const decl of node.declarations) {
          if (
            decl.id.type === 'Identifier' &&
            decl.init &&
            (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression')
          ) {
            chunks.push({ kind: 'function', name: decl.id.name, ...lines });
          }
        }
        break;
      case 'ExpressionStatement': {
        const expr = node.expression;
        if (
          expr.type === 'CallExpression' &&
          expr.callee.type === 'MemberExpression' &&
          expr.callee.object.type === 'Identifier' &&
          ['router', 'app'].includes(expr.callee.object.name) &&
          expr.callee.property.type === 'Identifier' &&
          HTTP_METHODS.has(expr.callee.property.name)
        ) {
          const first = expr.arguments[0];
          const path = first && first.type === 'StringLiteral' ? first.value : '';
          chunks.push({
            kind: 'route',
            name: `${expr.callee.property.name.toUpperCase()} ${path}`.trim(),
            ...lines,
          });
        }
        break;
      }
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
        if ('declaration' in node && node.declaration) {
          chunks.push(...extractChunks([node.declaration]));
        }
        break;
      default:
        break;
    }
  }
  return chunks;
}

export function buildCodemap(repoRoot: string, scope: string[]): Codemap {
  const files: Codemap['files'] = [];
  for (const dir of scope) {
    for (const abs of walkFiles(join(repoRoot, dir), ['.js', '.jsx', '.ts', '.tsx'])) {
      const rel = relative(repoRoot, abs);
      const source = readFileSync(abs, 'utf8');
      const lineCount = source.split('\n').length;
      let raw: RawChunk[] = [];
      try {
        const ast = parse(source, {
          sourceType: 'unambiguous',
          plugins: pluginsFor(extname(abs)),
          errorRecovery: true,
        });
        raw = extractChunks(ast.program.body as Node[]);
      } catch {
        console.warn(`  map-code: failed to parse ${rel} — indexed as a single module chunk`);
      }
      if (raw.length === 0) {
        raw = [{ kind: 'module', name: rel.split('/').pop() ?? rel, startLine: 1, endLine: lineCount }];
      }
      const sourceLines = source.split('\n');
      const chunks: Chunk[] = raw.map((c, i) => ({
        id: `${rel}#${i}`,
        kind: c.kind,
        name: c.name,
        startLine: c.startLine,
        endLine: c.endLine,
        signals: detectSignals(sourceLines.slice(c.startLine - 1, c.endLine).join('\n')),
      }));
      files.push({ path: rel, lang: extname(abs).slice(1), loc: lineCount, chunks });
    }
  }
  return { files };
}
