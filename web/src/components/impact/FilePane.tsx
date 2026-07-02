import { useMemo, useState } from 'react';
import { buildHash } from '../../hooks/useHashRoute';
import { statusLabel, statusTone } from '../../lib/format';
import type { FileImpact, ImpactIndex } from '../../lib/matrix';
import type { CodeFile, CodeMap, Finding, Obligation } from '../../lib/types';
import { Badge } from '../ui/Badge';
import { CodeRef } from '../ui/CodeRef';
import { EvidenceQuote } from '../ui/EvidenceQuote';
import { SectionLabel } from '../ui/SectionLabel';
import './impact.css';

interface FilePaneProps {
  codemap: CodeMap;
  impact: ImpactIndex;
  selectedOb: string | null;
  selectedFile: string | null;
  obligationById: Record<string, Obligation>;
  findingById: Record<string, Finding>;
  filesScanned: number;
}

interface FileEntry {
  path: string;
  file: CodeFile | null;
  hits: FileImpact[];
}

export function FilePane(props: FilePaneProps) {
  const { codemap, impact, selectedOb, selectedFile, obligationById, findingById, filesScanned } =
    props;
  const [filter, setFilter] = useState('');

  const entries = useMemo<FileEntry[]>(() => {
    const mapped: FileEntry[] = codemap.files.map((file) => ({
      path: file.path,
      file,
      hits: impact.byFile[file.path] ?? [],
    }));
    // Files referenced by findings but absent from the codemap still render.
    const known = new Set(codemap.files.map((f) => f.path));
    const extras: FileEntry[] = Object.keys(impact.byFile)
      .filter((path) => !known.has(path))
      .map((path) => ({ path, file: null, hits: impact.byFile[path] ?? [] }));
    return [...mapped, ...extras];
  }, [codemap, impact]);

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const filtered =
      query === '' ? entries : entries.filter((e) => e.path.toLowerCase().includes(query));
    if (selectedOb === null) return filtered;
    const isAffected = (e: FileEntry) => e.hits.some((h) => h.obligationId === selectedOb);
    return [...filtered].sort((a, b) => Number(isAffected(b)) - Number(isAffected(a)));
  }, [entries, filter, selectedOb]);

  return (
    <section className="impact-pane" aria-label="Files in scope">
      <div className="impact-pane-head">
        <SectionLabel>Files</SectionLabel>
        <span className="impact-pane-note">
          {entries.length} chunk-bearing of {filesScanned} scanned
        </span>
        <input
          type="search"
          className="file-filter"
          placeholder="filter paths…"
          aria-label="Filter file paths"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <ul className="file-pane-list">
        {visible.map((entry) => {
          const obHits =
            selectedOb === null
              ? []
              : entry.hits.filter((h) => h.obligationId === selectedOb);
          const isSelected = selectedFile === entry.path;
          const isAffected = selectedOb !== null && obHits.length > 0;
          const isDimmed =
            (selectedOb !== null && !isAffected) || (selectedFile !== null && !isSelected);
          const tones = [...new Set(entry.hits.map((h) => statusTone(h.status)))];
          const detailHits = isSelected ? entry.hits : obHits;
          const className = [
            'file-row',
            isSelected ? 'is-selected' : '',
            isAffected ? 'is-affected' : '',
            isDimmed ? 'is-dimmed' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li key={entry.path} className={className}>
              <a
                className="file-row-link"
                href={isSelected ? '#/impact' : buildHash('/impact', { file: entry.path })}
                aria-current={isSelected ? 'true' : undefined}
              >
                <CodeRef file={entry.path} />
                <span className="file-row-meta">
                  {entry.file !== null ? (
                    <span className="file-loc">
                      {entry.file.loc} loc · {entry.file.chunks.length} chunks
                    </span>
                  ) : (
                    <span className="file-loc">not in codemap</span>
                  )}
                  <span className="hit-dots" aria-hidden="true">
                    {tones.map((tone) => (
                      <span key={tone} className={`hit-dot dot-${tone}`} />
                    ))}
                  </span>
                </span>
              </a>
              {(isSelected || isAffected) && detailHits.length > 0 && (
                <FileDetail
                  hits={detailHits}
                  showChunks={isSelected}
                  file={entry.file}
                  obligationById={obligationById}
                  findingById={findingById}
                />
              )}
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="file-empty">No files match “{filter}”.</li>
        )}
      </ul>
    </section>
  );
}

interface FileDetailProps {
  hits: FileImpact[];
  showChunks: boolean;
  file: CodeFile | null;
  obligationById: Record<string, Obligation>;
  findingById: Record<string, Finding>;
}

function FileDetail({ hits, showChunks, file, obligationById, findingById }: FileDetailProps) {
  return (
    <div className="file-detail">
      {showChunks && file !== null && file.chunks.length > 0 && (
        <table className="chunk-table" aria-label={`Chunks in ${file.path}`}>
          <tbody>
            {file.chunks.map((chunk) => (
              <tr key={chunk.id}>
                <td className="chunk-kind">{chunk.kind}</td>
                <td className="chunk-name">{chunk.name}</td>
                <td className="chunk-lines">
                  L{chunk.startLine}–{chunk.endLine}
                </td>
                <td className="chunk-signals">
                  {chunk.signals.map((signal) => (
                    <span key={signal} className="signal-tag">
                      {signal}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {hits.map((hit) => {
        const obligation = obligationById[hit.obligationId];
        const finding = findingById[hit.findingId];
        return (
          <div key={`${hit.findingId}:${hit.file}`} className="file-hit">
            <div className="file-hit-head">
              <a href={buildHash('/impact', { ob: hit.obligationId })} className="file-hit-ob">
                {obligation !== undefined
                  ? `${obligation.articleRef} — ${obligation.title}`
                  : hit.obligationId}
              </a>
              <code className="file-hit-finding">{hit.findingId}</code>
              <Badge tone={statusTone(hit.status)}>{statusLabel(hit.status)}</Badge>
            </div>
            {finding !== undefined && <p className="file-hit-summary">{finding.summary}</p>}
            {hit.sites.map((site) => (
              <EvidenceQuote key={`${site.file}:${site.startLine}`} site={site} status={hit.status} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
