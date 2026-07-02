import { useMemo } from 'react';
import { diffStats, looksLikeUnifiedDiff, parseUnifiedDiff } from '../../lib/diff';
import type { ProposalChange } from '../../lib/types';
import { Badge } from '../ui/Badge';
import { CodeRef } from '../ui/CodeRef';
import { DiffView } from './DiffView';
import './proposals.css';

export function ChangeCard({ change }: { change: ProposalChange }) {
  const isDiff = change.isFullDiff && looksLikeUnifiedDiff(change.sketch);
  const lines = useMemo(
    () => (isDiff ? parseUnifiedDiff(change.sketch) : []),
    [isDiff, change.sketch],
  );
  const stats = useMemo(() => diffStats(lines), [lines]);

  return (
    <article className="change-card">
      <header className="change-head">
        <Badge tone={change.kind === 'add' ? 'compliant' : 'neutral'}>{change.kind}</Badge>
        <CodeRef file={change.file} />
        {isDiff ? (
          <span className="diff-stat">
            <span className="diff-stat-add">+{stats.added}</span>{' '}
            <span className="diff-stat-del">−{stats.removed}</span>
          </span>
        ) : (
          <span className="plan-tag">plan sketch</span>
        )}
      </header>
      {isDiff ? (
        <DiffView lines={lines} file={change.file} />
      ) : (
        <pre className="plan-sketch">{change.sketch}</pre>
      )}
    </article>
  );
}
