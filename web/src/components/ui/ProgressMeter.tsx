import './ui.css';

export interface MeterSegment {
  label: string;
  value: number;
  tone: string;
}

interface ProgressMeterProps {
  segments: MeterSegment[];
  total: number;
  ariaLabel: string;
  /** Show a text legend under the bar (identity is never color-alone). */
  legend?: boolean;
}

/** Proportional segmented meter with 2px surface gaps between fills. */
export function ProgressMeter({ segments, total, ariaLabel, legend = true }: ProgressMeterProps) {
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div>
      <div className="meter" role="img" aria-label={ariaLabel}>
        {visible.map((segment) => (
          <span
            key={segment.label}
            className={`meter-seg meter-${segment.tone}`}
            style={{ width: `${total > 0 ? (segment.value / total) * 100 : 0}%` }}
          />
        ))}
      </div>
      {legend && (
        <div className="meter-legend">
          {segments.map((segment) => (
            <span key={segment.label}>
              <span className={`legend-swatch meter-${segment.tone}`} aria-hidden="true" />
              {segment.label} <span className="num">{segment.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
