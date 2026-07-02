import type { DiffLine } from '../../lib/diff';
import './proposals.css';

interface DiffViewProps {
  lines: DiffLine[];
  file: string;
}

/** Two-gutter unified diff: old/new line numbers, +green / −red rows. */
export function DiffView({ lines, file }: DiffViewProps) {
  return (
    <div className="diff" role="figure" aria-label={`Unified diff for ${file}`}>
      <table className="diff-table">
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className={`diff-line diff-${line.kind}`}>
              <td className="diff-no" aria-hidden="true">
                {line.oldNo ?? ''}
              </td>
              <td className="diff-no" aria-hidden="true">
                {line.newNo ?? ''}
              </td>
              <td className="diff-text">{line.text === '' ? ' ' : line.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
