import './ui.css';

interface CodeRefProps {
  file: string;
  startLine?: number;
  endLine?: number;
}

/** Monospace file reference with dimmed directory and optional line range. */
export function CodeRef({ file, startLine, endLine }: CodeRefProps) {
  const lastSlash = file.lastIndexOf('/');
  const dir = lastSlash === -1 ? '' : file.slice(0, lastSlash + 1);
  const base = lastSlash === -1 ? file : file.slice(lastSlash + 1);
  return (
    <code className="code-ref">
      {dir !== '' && <span className="code-ref-dir">{dir}</span>}
      {base}
      {startLine !== undefined && (
        <span className="code-ref-lines">
          :{startLine}
          {endLine !== undefined && endLine !== startLine ? `–${endLine}` : ''}
        </span>
      )}
    </code>
  );
}
