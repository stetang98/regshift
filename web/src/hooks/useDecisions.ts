import { useCallback, useEffect, useState } from 'react';
import type { DecisionMap, DecisionValue, ReviewDecision } from '../lib/types';

/**
 * Review decisions, persisted per run to localStorage under
 * `regshift.decisions.<runId>`. Decisions never leave the browser.
 */
const STORAGE_PREFIX = 'regshift.decisions.';
const VALID_DECISIONS: readonly string[] = ['approved', 'rejected', 'needs-work'];

export function storageKeyFor(runId: string): string {
  return `${STORAGE_PREFIX}${runId}`;
}

/** Read and sanitize persisted decisions; corrupt entries are dropped. */
export function readDecisions(runId: string): DecisionMap {
  try {
    const raw = window.localStorage.getItem(storageKeyFor(runId));
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const out: Record<string, ReviewDecision> = {};
    for (const [proposalId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) continue;
      const entry = value as Partial<ReviewDecision>;
      if (typeof entry.decision !== 'string' || !VALID_DECISIONS.includes(entry.decision)) continue;
      out[proposalId] = {
        decision: entry.decision as DecisionValue,
        comment: typeof entry.comment === 'string' ? entry.comment : '',
        decidedAt: typeof entry.decidedAt === 'string' ? entry.decidedAt : new Date(0).toISOString(),
      };
    }
    return out;
  } catch (err) {
    console.error('regshift: could not read stored decisions', err);
    return {};
  }
}

function writeDecisions(runId: string, decisions: DecisionMap): void {
  try {
    window.localStorage.setItem(storageKeyFor(runId), JSON.stringify(decisions));
  } catch (err) {
    console.error('regshift: could not persist decisions', err);
  }
}

export interface UseDecisions {
  decisions: DecisionMap;
  record: (proposalId: string, decision: DecisionValue, comment: string) => void;
  clear: (proposalId: string) => void;
}

export function useDecisions(runId: string): UseDecisions {
  const [decisions, setDecisions] = useState<DecisionMap>(() => readDecisions(runId));

  useEffect(() => {
    setDecisions(readDecisions(runId));
  }, [runId]);

  const record = useCallback(
    (proposalId: string, decision: DecisionValue, comment: string) => {
      setDecisions((prev) => {
        const next: DecisionMap = {
          ...prev,
          [proposalId]: { decision, comment: comment.trim(), decidedAt: new Date().toISOString() },
        };
        writeDecisions(runId, next);
        return next;
      });
    },
    [runId],
  );

  const clear = useCallback(
    (proposalId: string) => {
      setDecisions((prev) => {
        if (!(proposalId in prev)) return prev;
        const next: DecisionMap = { ...prev };
        delete next[proposalId];
        writeDecisions(runId, next);
        return next;
      });
    },
    [runId],
  );

  return { decisions, record, clear };
}
