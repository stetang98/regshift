/**
 * Deterministic signal detectors. These run on raw chunk source and drive
 * candidate retrieval — the LLM never decides *where* to look, only *what*
 * a located site means. Keeping retrieval deterministic is what makes the
 * pipeline reliable on small local models and explainable to auditors.
 */
export interface Detector {
  id: string;
  label: string;
  pattern: RegExp;
}

export const DETECTORS: Detector[] = [
  { id: 'model-call', label: 'Calls an AI model / completion API', pattern: /\b(openai|anthropic|completions?|chatcompletion|generatetext|invokemodel|llm|bedrock|ollama)\b/i },
  { id: 'ai-output-response', label: 'Returns AI-generated content to users', pattern: /\b(res\.(json|send|write|end)|sendmessage|onprogress|streamresponse)\b[\s\S]{0,200}?\b(message|completion|response|text|token)\b/i },
  { id: 'stream-response', label: 'Streams output (SSE/websocket)', pattern: /text\/event-stream|\bsse\b|res\.write\(|websocket/i },
  { id: 'stores-user-data', label: 'Persists user data', pattern: /\.(save|create|insertmany|updateone|updatemany|findoneandupdate|bulkwrite)\s*\(|new\s+\w*(message|conversation|user|session)\w*\s*\(/i },
  { id: 'retention-delete', label: 'Deletes / expires stored data', pattern: /\.(deleteone|deletemany|findoneanddelete|remove)\s*\(|\bttl\b|expiresafterseconds|\bprune|\bpurge/i },
  { id: 'logging', label: 'Writes logs', pattern: /\blogger\.(info|warn|error|debug|verbose)|winston|console\.(log|info|warn|error)/i },
  { id: 'auth-gate', label: 'Authentication / authorization boundary', pattern: /requirejwtauth|passport|authenticate|checkban|\bjwt\b|authorization\s*header/i },
  { id: 'moderation', label: 'Moderation / abuse control', pattern: /moderat\w+|violation|\bban\b|denylist|blocklist|flagged/i },
  { id: 'rate-limit', label: 'Rate limiting / abuse throttling', pattern: /ratelimit|rate-limit|limiter|toomanyrequests|429/i },
  { id: 'user-facing-config', label: 'User-facing configuration surface', pattern: /appconfig|startupconfig|customconfig|interfaceconfig/i },
  { id: 'disclosure-ui', label: 'Disclosure / consent / terms surface', pattern: /disclaimer|consent|terms\s*of|privacy\s*policy|watermark|ai[-_\s]?generated/i },
  { id: 'error-handling', label: 'Error handling boundary', pattern: /catch\s*\(|\.catch\(|errorhandler|onerror/i },
  { id: 'file-upload', label: 'Handles user file uploads', pattern: /multer|upload|formdata|multipart/i },
];

export function detectSignals(source: string): string[] {
  const hits: string[] = [];
  for (const d of DETECTORS) {
    if (d.pattern.test(source)) hits.push(d.id);
  }
  return hits;
}

/**
 * Which signals matter for which regulation area. Keys are matched against
 * the obligation's articleRef prefix. Used to boost deterministic candidates
 * alongside BM25 — the mapping itself is part of the audit story.
 */
export const ARTICLE_SIGNAL_HINTS: Record<string, string[]> = {
  'Art. 9': ['error-handling', 'moderation', 'rate-limit'],
  'Art. 10': ['stores-user-data', 'file-upload', 'retention-delete'],
  'Art. 12': ['logging', 'model-call', 'ai-output-response'],
  'Art. 13': ['user-facing-config', 'disclosure-ui', 'model-call'],
  'Art. 14': ['auth-gate', 'moderation', 'user-facing-config'],
  'Art. 15': ['auth-gate', 'rate-limit', 'error-handling', 'file-upload'],
  'Art. 26': ['logging', 'auth-gate', 'user-facing-config'],
  'Art. 50': ['disclosure-ui', 'ai-output-response', 'stream-response', 'user-facing-config'],
};
