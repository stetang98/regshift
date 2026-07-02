import './overview.css';

interface DistRowProps {
  label: string;
  count: number;
  max: number;
  tone: string;
  href?: string;
}

/** Labeled proportional bar: text carries identity, color reinforces it. */
export function DistRow({ label, count, max, tone, href }: DistRowProps) {
  const width = max > 0 ? (count / max) * 100 : 0;
  const body = (
    <>
      <span className="dist-label">{label}</span>
      <span className="dist-count">{count}</span>
      <span className="dist-track" aria-hidden="true">
        <span className={`dist-fill meter-${tone}`} style={{ width: `${width}%` }} />
      </span>
    </>
  );
  if (href !== undefined) {
    return (
      <a className="dist-row" href={href} aria-label={`${label}: ${count}`}>
        {body}
      </a>
    );
  }
  return <div className="dist-row">{body}</div>;
}
