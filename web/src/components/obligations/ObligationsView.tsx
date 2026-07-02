import { useMemo } from 'react';
import { buildTraceabilityMatrix } from '../../lib/matrix';
import type { RunBundle } from '../../lib/types';
import { SectionLabel } from '../ui/SectionLabel';
import { ObligationCard } from './ObligationCard';
import './obligations.css';

interface ObligationsViewProps {
  bundle: RunBundle;
  params: Record<string, string>;
}

export function ObligationsView({ bundle, params }: ObligationsViewProps) {
  const { run, obligations, findings, proposals } = bundle;
  // Decisions are irrelevant to the register; trace with an empty map.
  const matrix = useMemo(
    () => buildTraceabilityMatrix(obligations, findings, proposals, {}),
    [obligations, findings, proposals],
  );
  const openId = params.open ?? null;

  return (
    <div>
      <header className="page-head">
        <SectionLabel>Register</SectionLabel>
        <h1>Obligations register</h1>
        <p className="page-sub">
          {obligations.length} duties extracted from {run.regulation.title}, each quoted from the
          source text. Expand an entry to read the requirement and walk into its findings and
          change proposals.
        </p>
      </header>
      <div className="obligation-list">
        {matrix.rows.map((row) => (
          <ObligationCard
            key={row.obligation.id}
            row={row}
            defaultOpen={openId === row.obligation.id}
          />
        ))}
      </div>
    </div>
  );
}
