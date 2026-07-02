import type { z } from 'zod';

/**
 * LLM client with two providers:
 *  - "ollama" (default): native Ollama /api/chat — lets us force JSON output
 *    (`format: "json"`) and set `num_ctx`, both critical for small local models.
 *  - "openai": any OpenAI-compatible /v1/chat/completions endpoint, so judges
 *    can point LLM_BASE_URL/LLM_API_KEY at a hosted model without code changes.
 */
const PROVIDER = process.env.LLM_PROVIDER ?? 'ollama';
const BASE_URL = process.env.LLM_BASE_URL ?? 'http://localhost:11434';
const MODEL = process.env.LLM_MODEL ?? 'qwen2.5-coder:7b';
const API_KEY = process.env.LLM_API_KEY ?? '';
const NUM_CTX = Number(process.env.LLM_NUM_CTX ?? 12288);
// Ollama defaults num_predict to 128, which silently truncates structured
// output — under JSON grammar the model "legally" closes objects early and
// drops required fields. Always set an explicit generous budget.
const NUM_PREDICT = Number(process.env.LLM_NUM_PREDICT ?? 2048);
const MAX_ATTEMPTS = 3;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LlmError extends Error {
  constructor(message: string, readonly attempts: string[]) {
    super(message);
    this.name = 'LlmError';
  }
}

async function chatOllama(messages: ChatMessage[], json: boolean): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
      ...(json ? { format: 'json' } : {}),
      options: { temperature: 0.1, num_ctx: NUM_CTX, num_predict: NUM_PREDICT },
    }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { message?: { content?: string } };
  return body.message?.content ?? '';
}

async function chatOpenAi(messages: ChatMessage[], json: boolean): Promise<string> {
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(API_KEY ? { authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.1,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`llm ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return body.choices?.[0]?.message?.content ?? '';
}

export function chat(messages: ChatMessage[], json = false): Promise<string> {
  return PROVIDER === 'openai' ? chatOpenAi(messages, json) : chatOllama(messages, json);
}

/** Pull the first balanced JSON value out of possibly-noisy model output. */
export function extractJson(text: string): string {
  const cleaned = text.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error('no JSON found in output');
  const open = cleaned[start] as '[' | '{';
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) return cleaned.slice(start, i + 1);
  }
  throw new Error('unbalanced JSON in output');
}

/**
 * Structured call: prompt → JSON → zod-validated value.
 * On parse/validation failure the error is fed back to the model (≤3 attempts).
 */
export async function jsonCall<T>(schema: z.ZodType<T>, system: string, user: string): Promise<T> {
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  const attempts: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const raw = await chat(messages, true);
    try {
      return schema.parse(JSON.parse(extractJson(raw)));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      attempts.push(`attempt ${attempt}: ${detail.slice(0, 400)}`);
      messages.push(
        { role: 'assistant', content: raw.slice(0, 2000) },
        {
          role: 'user',
          content: `Your previous output failed validation: ${detail.slice(0, 600)}\nReturn ONLY corrected JSON matching the required shape. No prose.`,
        },
      );
    }
  }
  throw new LlmError(`LLM output failed validation after ${MAX_ATTEMPTS} attempts`, attempts);
}

export function modelName(): string {
  return PROVIDER === 'openai' ? MODEL : `${MODEL} (local via Ollama)`;
}
