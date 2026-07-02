/**
 * Artifact loading with per-file diagnostics.
 *
 * Network, HTTP-status, JSON-parse and key-field failures are attributed to a
 * specific artifact file so the UI renders an exact diagnostic panel instead
 * of a blank screen. Validation is intentionally structural (ids, arrays and
 * the fields navigation depends on) rather than exhaustive — deeper shape
 * errors fall through to the render error boundary.
 */
import type { CodeMap, Finding, Obligation, Proposal, RunBundle, RunMeta } from './types';

export interface ArtifactFailure {
  file: string;
  detail: string;
}

export class ArtifactError extends Error {
  readonly failure: ArtifactFailure;

  constructor(file: string, detail: string) {
    super(`${file}: ${detail}`);
    this.name = 'ArtifactError';
    this.failure = { file, detail };
  }
}

export class RunBundleError extends Error {
  readonly failures: ArtifactFailure[];

  constructor(failures: ArtifactFailure[]) {
    super(`failed to load ${failures.length} artifact(s)`);
    this.name = 'RunBundleError';
    this.failures = failures;
  }
}

export const DEFAULT_RUN_ID = 'demo';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(obj: Record<string, unknown>, key: string, file: string): void {
  if (typeof obj[key] !== 'string') {
    throw new ArtifactError(file, `expected string field "${key}"`);
  }
}

async function fetchArtifact(baseUrl: string, runId: string, file: string): Promise<unknown> {
  const url = `${baseUrl}runs/${runId}/${file}`;
  let response: Response;
  try {
    // Bounded fetch: a hung request must surface the diagnostic panel (which
    // has the retry button) instead of spinning forever.
    response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new ArtifactError(file, `network error fetching ${url}: ${detail}`);
  }
  if (!response.ok) {
    throw new ArtifactError(file, `HTTP ${response.status} ${response.statusText} at ${url}`);
  }
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new ArtifactError(file, `response at ${url} is not valid JSON`);
  }
}

function validateRun(value: unknown, file: string): RunMeta {
  if (!isRecord(value)) throw new ArtifactError(file, 'expected a JSON object');
  requireString(value, 'runId', file);
  requireString(value, 'createdAt', file);
  const { regulation, repo, model, stats } = value;
  if (!isRecord(regulation) || typeof regulation.title !== 'string') {
    throw new ArtifactError(file, 'expected regulation.title string');
  }
  if (!isRecord(repo) || typeof repo.name !== 'string' || !Array.isArray(repo.scope)) {
    throw new ArtifactError(file, 'expected repo { name, url, commit, scope[] }');
  }
  if (!isRecord(model) || typeof model.name !== 'string') {
    throw new ArtifactError(file, 'expected model.name string');
  }
  if (!isRecord(stats) || typeof stats.obligations !== 'number') {
    throw new ArtifactError(file, 'expected numeric stats block');
  }
  return value as unknown as RunMeta;
}

function validateIdArray(value: unknown, file: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new ArtifactError(file, 'expected a JSON array');
  value.forEach((item, i) => {
    if (!isRecord(item) || typeof item.id !== 'string') {
      throw new ArtifactError(file, `item ${i} is missing a string "id"`);
    }
  });
  return value as Record<string, unknown>[];
}

function validateObligations(value: unknown, file: string): Obligation[] {
  const items = validateIdArray(value, file);
  items.forEach((item, i) => {
    if (typeof item.articleRef !== 'string' || typeof item.severity !== 'string') {
      throw new ArtifactError(file, `item ${i} is missing articleRef/severity`);
    }
  });
  return items as unknown as Obligation[];
}

function validateCodemap(value: unknown, file: string): CodeMap {
  if (!isRecord(value) || !Array.isArray(value.files)) {
    throw new ArtifactError(file, 'expected { files: [...] }');
  }
  value.files.forEach((item, i) => {
    if (!isRecord(item) || typeof item.path !== 'string' || !Array.isArray(item.chunks)) {
      throw new ArtifactError(file, `files[${i}] is missing path/chunks`);
    }
  });
  return value as unknown as CodeMap;
}

function validateFindings(value: unknown, file: string): Finding[] {
  const items = validateIdArray(value, file);
  items.forEach((item, i) => {
    if (typeof item.obligationId !== 'string' || !Array.isArray(item.sites)) {
      throw new ArtifactError(file, `item ${i} is missing obligationId/sites`);
    }
  });
  return items as unknown as Finding[];
}

function validateProposals(value: unknown, file: string): Proposal[] {
  const items = validateIdArray(value, file);
  items.forEach((item, i) => {
    if (typeof item.findingId !== 'string' || !Array.isArray(item.changes)) {
      throw new ArtifactError(file, `item ${i} is missing findingId/changes`);
    }
  });
  return items as unknown as Proposal[];
}

export async function loadRunBundle(
  baseUrl: string,
  runId: string = DEFAULT_RUN_ID,
): Promise<RunBundle> {
  const results = await Promise.allSettled([
    fetchArtifact(baseUrl, runId, 'run.json').then((v) => validateRun(v, 'run.json')),
    fetchArtifact(baseUrl, runId, 'obligations.json').then((v) =>
      validateObligations(v, 'obligations.json'),
    ),
    fetchArtifact(baseUrl, runId, 'codemap.json').then((v) => validateCodemap(v, 'codemap.json')),
    fetchArtifact(baseUrl, runId, 'findings.json').then((v) =>
      validateFindings(v, 'findings.json'),
    ),
    fetchArtifact(baseUrl, runId, 'proposals.json').then((v) =>
      validateProposals(v, 'proposals.json'),
    ),
  ] as const);

  const failures: ArtifactFailure[] = [];
  for (const result of results) {
    if (result.status === 'rejected') {
      const reason: unknown = result.reason;
      if (reason instanceof ArtifactError) {
        failures.push(reason.failure);
      } else {
        failures.push({
          file: '(unknown)',
          detail: reason instanceof Error ? reason.message : String(reason),
        });
      }
    }
  }
  if (failures.length > 0) {
    throw new RunBundleError(failures);
  }

  const [run, obligations, codemap, findings, proposals] = results as [
    PromiseFulfilledResult<RunMeta>,
    PromiseFulfilledResult<Obligation[]>,
    PromiseFulfilledResult<CodeMap>,
    PromiseFulfilledResult<Finding[]>,
    PromiseFulfilledResult<Proposal[]>,
  ];

  return {
    run: run.value,
    obligations: obligations.value,
    codemap: codemap.value,
    findings: findings.value,
    proposals: proposals.value,
  };
}
