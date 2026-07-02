# RegShift — Compliance Review Console

Static web console for the RegShift pipeline (Conduct Track). Loads real pipeline
artifacts (JSON), lets an enterprise reviewer walk **obligation → code impact →
change proposal**, record approve / needs-work / reject decisions, and export an
audit traceability report (Markdown download + print-optimized page for PDF).

React 19 · Vite · TypeScript strict · hash routing (`#/…`) — no backend, no server
rewrites; deploys as plain static files. Review decisions persist to
`localStorage` (`regshift.decisions.<runId>`) and never leave the browser.

## Commands

```bash
pnpm install       # once
pnpm dev           # dev server
pnpm build         # type-check + production build -> dist/
pnpm preview       # serve dist/ locally
pnpm test          # vitest: lib unit tests + route smoke tests
```

## Artifact contract

The app reads five files from `public/runs/demo/` (swap file-for-file with real
pipeline output — the UI codes against the schema, not the fixtures):

| File | Contents |
| --- | --- |
| `run.json` | run metadata: regulation, repo@commit, scope, model, stats |
| `obligations.json` | extracted duties with article refs + source quotes |
| `codemap.json` | scanned files and their chunks |
| `findings.json` | per-obligation status (gap/partial/compliant/n-a) with code evidence |
| `proposals.json` | change proposals with unified diffs / plan sketches + test plans |

TypeScript definitions of the exact schema: `src/lib/types.ts`.
Traceability derivation lives in `src/lib/matrix.ts`; report generation in
`src/lib/export.ts`.

## Routes

`#/` overview · `#/obligations` register · `#/impact` obligation↔file map ·
`#/proposals/:id` proposal detail + decision · `#/review` queue with filters ·
`#/audit` traceability matrix + export/print.
