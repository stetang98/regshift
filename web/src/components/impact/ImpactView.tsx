import { useMemo } from 'react';
import { buildHash } from '../../hooks/useHashRoute';
import { severityLabel, statusTone } from '../../lib/format';
import { buildImpactIndex, indexById } from '../../lib/matrix';
import type { RunBundle } from '../../lib/types';
import { SectionLabel } from '../ui/SectionLabel';
import { FilePane } from './FilePane';
import './impact.css';

interface ImpactViewProps {
  bundle: RunBundle;
  params: Record<string, string>;
}

export function ImpactView({ bundle, params }: ImpactViewProps) {
  const { run, obligations, findings, codemap } = bundle;
  const impact = useMemo(() => buildImpactIndex(findings), [findings]);
  const obligationById = useMemo(() => indexById(obligations), [obligations]);
  const findingById = useMemo(() => indexById(findings), [findings]);

  const selectedFile = params.file ?? null;
  const selectedOb = selectedFile === null ? (params.ob ?? null) : null;

  const relatedObligations = useMemo(() => {
    if (selectedFile === null) return new Set<string>();
    return new Set((impact.byFile[selectedFile] ?? []).map((hit) => hit.obligationId));
  }, [impact, selectedFile]);

  const summary = (() => {
    if (selectedOb !== null) {
      const hits = impact.byObligation[selectedOb] ?? [];
      const files = new Set(hits.map((h) => h.file)).size;
      const sites = hits.reduce((n, h) => n + h.sites.length, 0);
      const obligation = obligationById[selectedOb];
      return {
        title: obligation !== undefined ? `${obligation.articleRef} — ${obligation.title}` : selectedOb,
        detail: `touches ${files} file${files === 1 ? '' : 's'} · ${sites} site${sites === 1 ? '' : 's'}`,
      };
    }
    if (selectedFile !== null) {
      const hits = impact.byFile[selectedFile] ?? [];
      const obs = new Set(hits.map((h) => h.obligationId)).size;
      const sites = hits.reduce((n, h) => n + h.sites.length, 0);
      return {
        title: selectedFile,
        detail: `touched by ${obs} obligation${obs === 1 ? '' : 's'} · ${sites} site${sites === 1 ? '' : 's'}`,
      };
    }
    return null;
  })();

  return (
    <div className="impact">
      <header className="page-head">
        <SectionLabel>Cross-navigation</SectionLabel>
        <h1>Impact map</h1>
        <p className="page-sub">
          Where the regulation touches the code. Select an obligation to see the files and
          evidence it maps to; select a file to see which duties reach into it.
        </p>
      </header>

      <div className="impact-selection" aria-live="polite">
        {summary !== null ? (
          <>
            <span className="impact-selection-title">{summary.title}</span>
            <span className="impact-selection-detail">{summary.detail}</span>
            <a className="impact-clear" href="#/impact">
              clear ×
            </a>
          </>
        ) : (
          <span className="impact-selection-hint">
            No selection — pick an obligation on the left or a file on the right.
          </span>
        )}
      </div>

      <div className="impact-grid">
        <section className="impact-pane" aria-label="Obligations">
          <div className="impact-pane-head">
            <SectionLabel>Obligations</SectionLabel>
            <span className="impact-pane-note">{obligations.length} in register</span>
          </div>
          <ul className="ob-pane-list">
            {obligations.map((obligation) => {
              const hits = impact.byObligation[obligation.id] ?? [];
              const fileCount = new Set(hits.map((h) => h.file)).size;
              const siteCount = hits.reduce((n, h) => n + h.sites.length, 0);
              const tones = [...new Set(hits.map((h) => statusTone(h.status)))];
              const isSelected = selectedOb === obligation.id;
              const isRelated = relatedObligations.has(obligation.id);
              const isDimmed =
                (selectedFile !== null && !isRelated) || (selectedOb !== null && !isSelected);
              const className = [
                'ob-pane-row',
                isSelected ? 'is-selected' : '',
                isRelated ? 'is-related' : '',
                isDimmed ? 'is-dimmed' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <li key={obligation.id}>
                  <a
                    className={className}
                    href={isSelected ? '#/impact' : buildHash('/impact', { ob: obligation.id })}
                    aria-current={isSelected ? 'true' : undefined}
                  >
                    <span className="ob-pane-ref">{obligation.articleRef}</span>
                    <span className="ob-pane-title">{obligation.title}</span>
                    <span className="ob-pane-meta">
                      <span
                        className={`sev-tick sev-${obligation.severity}`}
                        title={`severity: ${severityLabel(obligation.severity)}`}
                      />
                      {fileCount > 0 ? (
                        <span className="ob-pane-counts">
                          {fileCount}f · {siteCount}s
                        </span>
                      ) : (
                        <span className="ob-pane-counts">no sites</span>
                      )}
                      <span className="hit-dots" aria-hidden="true">
                        {tones.map((tone) => (
                          <span key={tone} className={`hit-dot dot-${tone}`} />
                        ))}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>

        <FilePane
          codemap={codemap}
          impact={impact}
          selectedOb={selectedOb}
          selectedFile={selectedFile}
          obligationById={obligationById}
          findingById={findingById}
          filesScanned={run.stats.filesScanned}
        />
      </div>
    </div>
  );
}
