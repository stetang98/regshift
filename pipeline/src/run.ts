import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { exists, readJson, writeJson } from './io.js';
import { modelName } from './llm.js';
import { parseRegulation } from './stages/parseReg.js';
import { buildCodemap } from './stages/mapCode.js';
import { matchObligations } from './stages/match.js';
import { planChanges } from './stages/plan.js';
import type { Codemap, Finding, Obligation, Proposal, Run } from './types.js';

const ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(ROOT, '..', 'target', 'librechat');
const CORPUS = join(ROOT, 'data', 'regulation', 'eu-ai-act');
const SCOPE = ['api/server'];

interface Args {
  runId: string;
  stages: Set<string>;
  force: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { runId: 'demo', stages: new Set(['parse', 'map', 'match', 'plan']), force: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--run-id' && argv[i + 1]) args.runId = argv[++i]!;
    else if (argv[i] === '--stages' && argv[i + 1]) args.stages = new Set(argv[++i]!.split(','));
    else if (argv[i] === '--force') args.force = true;
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const runDir = join(ROOT, 'runs', args.runId);
  const t0 = Date.now();
  const path = (name: string): string => join(runDir, name);
  const stage = (name: string): boolean => args.stages.has(name);
  const fresh = (name: string): boolean => args.force || !exists(path(name));

  console.log(`RegShift pipeline — run "${args.runId}" (${[...args.stages].join(',')})`);

  let obligations: Obligation[];
  if (stage('parse') && fresh('obligations.json')) {
    obligations = await parseRegulation(CORPUS);
    writeJson(path('obligations.json'), obligations);
    console.log(`✓ parse-reg: ${obligations.length} obligations`);
  } else {
    obligations = exists(path('obligations.json')) ? readJson<Obligation[]>(path('obligations.json')) : [];
    console.log(`• parse-reg: reused checkpoint (${obligations.length})`);
  }

  let codemap: Codemap;
  if (stage('map') && fresh('codemap.json')) {
    codemap = buildCodemap(REPO_ROOT, SCOPE);
    writeJson(path('codemap.json'), codemap);
    console.log(`✓ map-code: ${codemap.files.length} files, ${codemap.files.reduce((n, f) => n + f.chunks.length, 0)} chunks`);
  } else {
    codemap = exists(path('codemap.json')) ? readJson<Codemap>(path('codemap.json')) : { files: [] };
    console.log(`• map-code: reused checkpoint (${codemap.files.length} files)`);
  }

  let findings: Finding[];
  if (stage('match') && fresh('findings.json')) {
    findings = await matchObligations(obligations, codemap, REPO_ROOT);
    writeJson(path('findings.json'), findings);
    console.log(`✓ match: ${findings.length} findings, ${findings.filter((f) => f.status === 'gap').length} gaps`);
  } else {
    findings = exists(path('findings.json')) ? readJson<Finding[]>(path('findings.json')) : [];
    console.log(`• match: reused checkpoint (${findings.length})`);
  }

  let proposals: Proposal[];
  if (stage('plan') && fresh('proposals.json')) {
    proposals = await planChanges(findings, obligations, REPO_ROOT);
    writeJson(path('proposals.json'), proposals);
    console.log(`✓ plan: ${proposals.length} proposals`);
  } else {
    proposals = exists(path('proposals.json')) ? readJson<Proposal[]>(path('proposals.json')) : [];
    console.log(`• plan: reused checkpoint (${proposals.length})`);
  }

  const commit = execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim();
  const run: Run = {
    runId: args.runId,
    createdAt: new Date().toISOString(),
    regulation: { title: 'EU AI Act (Regulation (EU) 2024/1689)', version: 'OJ L, 12.7.2024' },
    repo: { name: 'LibreChat', url: 'https://github.com/danny-avila/LibreChat', commit, scope: SCOPE },
    model: { name: modelName() },
    stats: {
      filesScanned: codemap.files.length,
      chunks: codemap.files.reduce((n, f) => n + f.chunks.length, 0),
      obligations: obligations.length,
      findings: findings.length,
      gaps: findings.filter((f) => f.status === 'gap').length,
      proposals: proposals.length,
      durationSec: Math.round((Date.now() - t0) / 1000),
    },
  };
  writeJson(path('run.json'), run);
  console.log(`✓ run.json written — ${run.stats.durationSec}s total`);
}

main().catch((err) => {
  console.error('pipeline failed:', err);
  process.exit(1);
});
