// @vitest-environment jsdom
/**
 * Route-by-route render smoke against the REAL demo fixtures: fetch is stubbed
 * to serve public/runs/demo/*.json through the app's own loader/validators, so
 * this also proves the shipped artifacts satisfy the schema contract.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const FIXTURE_DIR = resolve(process.cwd(), 'public/runs/demo');
const RUN_ID = 'demo';

function stubFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const name = String(input).split('/').pop() ?? '';
      try {
        const body = readFileSync(resolve(FIXTURE_DIR, name), 'utf8');
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => JSON.parse(body) as unknown,
        } as unknown as Response;
      } catch {
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({}),
        } as unknown as Response;
      }
    }),
  );
}

async function renderRoute(hash: string): Promise<void> {
  window.location.hash = hash;
  render(<App />);
  // Shell case-strip renders once artifacts are loaded.
  await screen.findAllByText(/EU AI Act \(Regulation \(EU\) 2024\/1689\)/);
}

function expectNoErrorPanel(): void {
  expect(screen.queryByText(/could not be loaded/i)).toBeNull();
  expect(screen.queryByText(/Something failed while rendering/i)).toBeNull();
}

beforeEach(() => {
  window.localStorage.clear();
  stubFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('route smoke (real fixtures)', () => {
  it('#/ renders the overview dossier', async () => {
    await renderRoute('#/');
    expect(screen.getByText('Compliance review dossier')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: /EU AI Act \(Regulation \(EU\) 2024\/1689\)/ }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open review queue' })).toBeTruthy();
    expect(screen.getByText('1,139')).toBeTruthy(); // chunks stat, formatted
    expectNoErrorPanel();
  });

  it('#/obligations renders the register with fixture content', async () => {
    await renderRoute('#/obligations');
    expect(screen.getByRole('heading', { name: 'Obligations register' })).toBeTruthy();
    expect(screen.getByText('Transparency Obligation for AI Systems Interacting Directly with Natural Persons')).toBeTruthy();
    // expand the first obligation and check its source quote appears
    fireEvent.click(screen.getByRole('button', { name: /Transparency Obligation for AI Systems Interacting/ }));
    expect(
      screen.getByText(/“Providers shall ensure that AI systems intended to interact directly/),
    ).toBeTruthy();
    expectNoErrorPanel();
  });

  it('#/impact renders both panes and cross-selects an obligation', async () => {
    await renderRoute('#/impact');
    expect(screen.getByRole('heading', { name: 'Impact map' })).toBeTruthy();
    expect(screen.getAllByText('chatV1.js').length).toBeGreaterThan(0);
    expectNoErrorPanel();
  });

  it('#/impact?ob=… highlights affected files with evidence', async () => {
    await renderRoute('#/impact?ob=OB-050-1');
    expect(await screen.findByText(/touches 2 files/)).toBeTruthy();
    // evidence quote from F-001 in messages.js
    expect(screen.getAllByText(/chatV1/).length).toBeGreaterThan(0);
    expectNoErrorPanel();
  });

  it('#/proposals/P-001 renders diff, tests and decision panel', async () => {
    await renderRoute('#/proposals/P-001');
    expect(
      screen.getByRole('heading', { name: /Implement basic risk management in chatV1 controller/ }),
    ).toBeTruthy();
    expect(screen.getByRole('figure', { name: /Unified diff for api\/server\/controllers/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Record decision' })).toBeTruthy();
    expectNoErrorPanel();
  });

  it('#/proposals/P-001 records a decision into localStorage', async () => {
    await renderRoute('#/proposals/P-001');
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.change(screen.getByLabelText(/Comment/), {
      target: { value: 'Ship with the config flag default-on.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record decision' }));

    // stamp meta, e.g. "recorded 01 Jul 2026, 12:00 UTC"
    expect(await screen.findByText(/recorded \d{2} \w{3} \d{4}/)).toBeTruthy();
    const stored = window.localStorage.getItem(`regshift.decisions.${RUN_ID}`);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored ?? '{}') as Record<string, { decision: string; comment: string }>;
    expect(parsed['P-001']?.decision).toBe('approved');
    expect(parsed['P-001']?.comment).toBe('Ship with the config flag default-on.');
  });

  it('#/proposals/unknown renders a not-found panel, not a blank screen', async () => {
    await renderRoute('#/proposals/P-999');
    expect(screen.getByRole('heading', { name: 'Proposal not found' })).toBeTruthy();
    expectNoErrorPanel();
  });

  it('#/review renders the queue with filters', async () => {
    await renderRoute('#/review');
    expect(screen.getByRole('heading', { name: 'Review queue' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'P-010' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Filter by Decision' })).toBeTruthy();
    expectNoErrorPanel();
  });

  it('#/audit renders the traceability matrix and export action', async () => {
    await renderRoute('#/audit');
    expect(screen.getByRole('heading', { name: 'Traceability matrix' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Export audit report/ })).toBeTruthy();
    expect(screen.getAllByText(/no proposal — unaddressed|no action required/).length).toBeGreaterThan(0);
    expectNoErrorPanel();
  });

  it('unknown route renders the not-found panel', async () => {
    await renderRoute('#/definitely-not-a-route');
    expect(screen.getByRole('heading', { name: 'Route not found' })).toBeTruthy();
    expectNoErrorPanel();
  });

  it('shows the diagnostic panel when an artifact is missing', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        const name = String(input).split('/').pop() ?? '';
        if (name === 'findings.json') {
          return {
            ok: false,
            status: 404,
            statusText: 'Not Found',
            json: async () => ({}),
          } as unknown as Response;
        }
        const body = readFileSync(resolve(FIXTURE_DIR, name), 'utf8');
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => JSON.parse(body) as unknown,
        } as unknown as Response;
      }),
    );
    window.location.hash = '#/';
    render(<App />);
    expect(await screen.findByText(/Run artifacts could not be loaded/)).toBeTruthy();
    expect(screen.getByText('findings.json')).toBeTruthy();
    expect(screen.getByText(/HTTP 404/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry load' })).toBeTruthy();
  });
});
