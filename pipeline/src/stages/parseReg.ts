import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { jsonCall } from '../llm.js';
import { exists, parseFrontmatter, readJson, writeJson } from '../io.js';
import { ObligationDraftSchema, type Obligation } from '../types.js';

const ExtractionSchema = z.object({ obligations: z.array(ObligationDraftSchema).min(1).max(3) });

const SYSTEM = `You are a senior regulatory analyst preparing an engineering compliance workplan.
From the EU AI Act article provided, extract the 1-3 obligations that are most directly
actionable in the CODEBASE of a self-hosted enterprise AI chat platform (an operator that
deploys an LLM chat service for its staff or customers).

Rules:
- Each obligation must be atomic: one actor, one trigger, one required behaviour.
- "actor" is who must act (e.g. "provider", "deployer").
- "trigger" is the condition under which the requirement applies.
- "requirement" is the concrete behaviour, phrased so an engineer can check code against it.
- "severity": high if non-compliance risks core Art. 99 penalties or user harm, medium for
  process/documentation duties with code surface, low otherwise.
- "paragraphRef" is the paragraph number within this article, e.g. "1" or "2(a)".
- "sourceQuote" must be copied VERBATIM from the article text (max ~40 words).
- Skip obligations with no plausible code surface (pure organisational duties).
- At most 3 obligations. Every obligation object MUST contain exactly these keys:
  "title", "actor", "trigger", "requirement", "severity", "paragraphRef", "sourceQuote".
Return JSON: {"obligations": [...]}`;

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Find the text of paragraph `n` in the article body, for quote fallback. */
function paragraphText(body: string, ref: string): string | null {
  const num = ref.match(/^\d+/)?.[0];
  if (!num) return null;
  // (?![\s\S]) is true end-of-input — \Z does not exist in JS and `$` under
  // the m flag would stop at the first line break.
  const re = new RegExp(`^\\s*${num}\\.\\s+([\\s\\S]*?)(?=^\\s*\\d+\\.\\s|(?![\\s\\S]))`, 'm');
  const m = body.match(re);
  return m ? m[1]!.trim() : null;
}

export async function parseRegulation(corpusDir: string, checkpointDir?: string): Promise<Obligation[]> {
  const files = readdirSync(corpusDir)
    .filter((f) => /^art-\d+\.md$/.test(f))
    .sort();
  const obligations: Obligation[] = [];
  const failed: string[] = [];
  for (const file of files) {
    const { meta, body } = parseFrontmatter(readFileSync(join(corpusDir, file), 'utf8'));
    const articleNumber = (meta['articleNumber'] ?? file.replace(/\D/g, '')).replace(/^0+/, '');
    const title = meta['title'] ?? '';

    // Per-article checkpoint: a failed article never costs completed ones.
    const ckpt = checkpointDir ? join(checkpointDir, file.replace('.md', '.json')) : null;
    if (ckpt && exists(ckpt)) {
      obligations.push(...readJson<Obligation[]>(ckpt));
      console.log(`  parse-reg: Article ${articleNumber} — reused checkpoint`);
      continue;
    }

    console.log(`  parse-reg: Article ${articleNumber} — ${title}`);
    let drafts;
    try {
      ({ obligations: drafts } = await jsonCall(
        ExtractionSchema,
        SYSTEM,
        `Article ${articleNumber} — ${title}\n\n${body}`,
      ));
    } catch (err) {
      failed.push(`Article ${articleNumber}: ${(err as Error).message.slice(0, 160)}`);
      console.warn(`    ! Article ${articleNumber} extraction failed — skipped for this run`);
      continue;
    }
    const articleObligations: Obligation[] = [];
    drafts.forEach((d, i) => {
      // Keep quotes honest: if the model's "verbatim" quote is not in the text,
      // fall back to the opening of the referenced paragraph.
      let quote = d.sourceQuote;
      if (!normalize(body).includes(normalize(quote).slice(0, 80))) {
        const para = paragraphText(body, d.paragraphRef);
        quote = para ? para.slice(0, 240) : quote;
      }
      articleObligations.push({
        id: `OB-${articleNumber.padStart(3, '0')}-${i + 1}`,
        articleRef: `Art. ${articleNumber}(${d.paragraphRef})`,
        title: d.title,
        actor: d.actor,
        trigger: d.trigger,
        requirement: d.requirement,
        severity: d.severity,
        sourceQuote: quote,
        sourceUrl: meta['sourceUrl'] ?? '',
      });
    });
    if (ckpt) writeJson(ckpt, articleObligations);
    obligations.push(...articleObligations);
  }
  if (failed.length > 0) {
    console.warn(`  parse-reg: ${failed.length} article(s) failed — rerun to retry:\n    ${failed.join('\n    ')}`);
  }
  return obligations;
}
