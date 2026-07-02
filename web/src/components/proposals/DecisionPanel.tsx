import { useEffect, useState } from 'react';
import { decisionLabel, formatDateTime } from '../../lib/format';
import type { DecisionValue, ReviewDecision } from '../../lib/types';
import { SectionLabel } from '../ui/SectionLabel';
import './proposals.css';

const OPTIONS: ReadonlyArray<{ value: DecisionValue; label: string }> = [
  { value: 'approved', label: 'Approve' },
  { value: 'needs-work', label: 'Needs work' },
  { value: 'rejected', label: 'Reject' },
];

interface DecisionPanelProps {
  decision: ReviewDecision | null;
  onRecord: (value: DecisionValue, comment: string) => void;
  onClear: () => void;
}

export function DecisionPanel({ decision, onRecord, onClear }: DecisionPanelProps) {
  const [choice, setChoice] = useState<DecisionValue | null>(decision?.decision ?? null);
  const [comment, setComment] = useState(decision?.comment ?? '');

  // Re-sync local form state when the stored decision changes (record/clear).
  useEffect(() => {
    setChoice(decision?.decision ?? null);
    setComment(decision?.comment ?? '');
  }, [decision]);

  return (
    <section className="decision-panel" aria-label="Review decision">
      <SectionLabel>Review decision</SectionLabel>

      {decision !== null && (
        <div className={`decision-stamp stamp-${decision.decision}`}>
          <span className="stamp-text">{decisionLabel(decision.decision)}</span>
          <span className="stamp-meta">recorded {formatDateTime(decision.decidedAt)}</span>
        </div>
      )}

      <div className="decision-options" role="group" aria-label="Decision options">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={choice === option.value}
            className={`decision-opt opt-${option.value}${
              choice === option.value ? ' is-selected' : ''
            }`}
            onClick={() => setChoice(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="decision-comment-label" htmlFor="decision-comment">
        Comment — recorded in the audit trail
      </label>
      <textarea
        id="decision-comment"
        className="decision-comment"
        rows={3}
        value={comment}
        placeholder="Why this decision. Appears verbatim in the exported report."
        onChange={(e) => setComment(e.target.value)}
      />

      <div className="decision-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={choice === null}
          onClick={() => {
            if (choice !== null) onRecord(choice, comment);
          }}
        >
          {decision === null ? 'Record decision' : 'Update decision'}
        </button>
        {decision !== null && (
          <button type="button" className="btn btn-quiet" onClick={onClear}>
            Clear decision
          </button>
        )}
        <span className="decision-note">stored locally, exported with the audit report</span>
      </div>
    </section>
  );
}
