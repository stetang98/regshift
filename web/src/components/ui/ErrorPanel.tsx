import type { ArtifactFailure } from '../../lib/load';
import { SectionLabel } from './SectionLabel';
import './ui.css';

interface ErrorPanelProps {
  failures: ArtifactFailure[];
  onRetry: () => void;
}

/** Exact per-artifact diagnostics — never a blank screen. */
export function ErrorPanel({ failures, onRetry }: ErrorPanelProps) {
  return (
    <section className="error-panel" role="alert" aria-labelledby="error-panel-heading">
      <SectionLabel>Artifact diagnostics</SectionLabel>
      <h1 id="error-panel-heading">Run artifacts could not be loaded</h1>
      <p>
        The console reads five JSON artifacts from <code>runs/demo/</code> under the site root.
        The following file(s) failed; the rest of the bundle was withheld to avoid rendering a
        partial review state.
      </p>
      <table className="error-file-table">
        <tbody>
          {failures.map((failure) => (
            <tr key={`${failure.file}:${failure.detail}`}>
              <td className="mono">{failure.file}</td>
              <td>{failure.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        Retry load
      </button>
    </section>
  );
}
