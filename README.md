<div align="center">

# RegShift — Make Regulation Move

**A new regulation drops. Your enterprise codebase has weeks of compliance archaeology ahead — RegShift turns it into an afternoon, with a human approving every step.**

Built for **UK AI Agent Hackathon EP5 × Conduct** (Conduct Track: *Make Legacy Move*).

**Live console:** [regshift.vercel.app](https://regshift.vercel.app) · **Demo video:** `<VIDEO_URL>` · Apache-2.0

</div>

---

## The slow process we picked

Conduct's brief: *"Pick a slow, inefficient process that happens at large enterprises today… identify a specific task that enterprise teams spend weeks on. Then build something that does it in hours."*

Ours is the one every regulated company just lived through with GDPR and is living through again with the EU AI Act: **regulatory change lands on a legacy codebase.**

Today that means: legal reads the regulation → writes requirement memos → business analysts map them to systems → engineers grep an undocumented codebase → impact spreadsheets → change tickets → an audit trail assembled by hand for the regulator. For one regulation against one system, that is **weeks of specialist time** — and the EU AI Act's high-risk obligations start applying **2 August 2026**.

RegShift runs that chain end-to-end in **one afternoon**:

```
regulation text ──► atomic obligations ──► impact map on the real codebase (with evidence)
                                              │
   auditor-ready traceability matrix ◄── human approves/rejects ◄── change proposals + diffs
```

The human stays in control at the exact point control matters: **nothing ships without a recorded human decision per change** — and the export is the audit artifact a regulator actually asks for (obligation → code evidence → decision → timestamp).

## What the demo shows

A real run of **EU AI Act (Regulation (EU) 2024/1689)** against **[LibreChat](https://github.com/danny-avila/LibreChat)** (a production-grade, 267-file self-hosted AI chat platform — the kind of system thousands of enterprises deployed in the last three years), pinned at commit `8683ecc`:

| | |
|---|---|
| Files scanned / code chunks | **267 / 1,139** (354 routes extracted) |
| Obligations extracted (8 articles) | **24** — each atomic: actor, trigger, requirement, verbatim source quote |
| Findings | **24** — 17 gaps, 2 partial, 5 not-applicable |
| Change proposals | **19**, every one with a **compiled unified diff** |
| Wall-clock | **11 min 32 s** — entirely on a MacBook, zero cloud calls |

Flagship example: **Art. 50(1)** (*users must be told they're talking to an AI*) → RegShift pins it to the two response controllers where disclosure belongs (`agents/request.js`, `assistants/chatV1.js`), marks the gap with quoted evidence, and proposes the minimal insertion — which a reviewer then approves or rejects in the console.

## Try it in 2 minutes (judges)

1. Open the live console: **[regshift.vercel.app](https://regshift.vercel.app)** — you land on the **dossier**: real run, real numbers.
2. **Obligations** → expand *Art. 50(1)* — verbatim source quote, severity, actor.
3. **Impact map** → select the same obligation — see exactly which files it touches and why (quoted code evidence).
4. Open a **proposal** → read the compiled diff → click **Approve** (or reject — your call; that's the point).
5. **Audit** → *Export audit report* — your decision is now in a regulator-ready traceability matrix.

Everything you clicked through is unmodified pipeline output. No mock data anywhere.

## Why local-first is the headline feature

The pipeline's default brain is **qwen2.5-coder:7b running locally via Ollama**. That is a deliberate enterprise decision, not a budget one:

- The input to this tool is **your proprietary codebase plus your compliance posture** — the two things a bank or an SAP shop will never post to a cloud API.
- RegShift runs **air-gapped**: source code, obligations, findings and decisions never leave the machine. The demo run made **zero external calls**.
- Any OpenAI-compatible endpoint plugs in via two env vars (`LLM_PROVIDER=openai`, `LLM_BASE_URL=…`) if your compliance team clears a hosted model.

## Honest engineering (what the model does — and doesn't)

Small local models are unreliable narrators, so RegShift is built as **deterministic scaffolding with narrow LLM duties**:

- **Retrieval is deterministic.** 13 signal detectors (AST + pattern rules: *stores-user-data*, *renders-ai-output*, *logging*, …) plus BM25 decide *where to look*. The model never free-ranges over the repo.
- **The model answers narrow questions.** "Does this obligation apply to this code location, and is the required behaviour present?" — one obligation × one site per call, JSON-schema-validated with self-repair retries.
- **Diffs are compiled, not generated.** The model emits an insertion spec (verbatim anchor line + new lines); RegShift builds the unified diff with exact hunk arithmetic. A 7B model cannot produce broken diff syntax here, because it never writes diff syntax.
- **Every stage checkpoints.** Crash, rerun, and it resumes obligation-by-obligation.
- **Known limits, stated plainly:** verdicts are advisory with a visible confidence share; obligation extraction was human-spot-checked for the demo corpus; proposal quality is 7B-grade — which is precisely why the product is a *review console with mandatory human decisions*, not an auto-merger. Judgment stays human; RegShift removes the archaeology.

## Run it yourself

```bash
# 1. Local model (one-time, ~4.7 GB)
brew install ollama && brew services start ollama
ollama pull qwen2.5-coder:7b

# 2. Pipeline — full run against LibreChat
git clone --depth 1 https://github.com/danny-avila/LibreChat.git target/librechat
cd pipeline && pnpm install
pnpm pipeline --run-id myrun            # parse → map → match → plan (checkpointed)
pnpm refine-diffs --run-id myrun        # compile unified diffs for proposals

# 3. Console
bash ../scripts/sync-artifacts.sh myrun
cd ../web && pnpm install && pnpm dev

# Tests
cd pipeline && pnpm test                # 11 tests — detectors, diff compiler, chunker
cd web && pnpm vitest run               # 28 tests — matrix, export, diff render, route smoke
```

## Repo layout

| Path | What |
|---|---|
| `pipeline/` | 4-stage CLI: `parse-reg` → `map-code` → `match` → `plan`, plus the diff compiler (`refine-diffs`) |
| `pipeline/data/regulation/eu-ai-act/` | Verbatim article corpus (8 articles, sourced + dated) |
| `pipeline/runs/demo/` | The real run artifacts shown in the console |
| `web/` | Review console — React 19, static, no backend; decisions in localStorage; audit export |
| `docs/superpowers/specs/` | Design doc (written before the first line of code) |
| `scripts/` | Artifact sync |

## Track fit

- **Conduct — Make Legacy Move (primary):** a named weeks-long enterprise process → hours, on a real legacy-scale codebase, with the human-in-control loop Conduct's own product philosophy demands.
- **GCC — AI for Good (Category 2):** compliance transparency as civic infrastructure — the traceability matrix format is open, forkable, and regulation-agnostic (point the corpus at DORA, PSD3, or your sector's rulebook).

## Team

Solo — **Ste Tang** ([@Stetang3438](https://x.com/Stetang3438) · GitHub [stetang98](https://github.com/stetang98)) building with Claude Code.

Apache-2.0.
