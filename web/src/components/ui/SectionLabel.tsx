import type { ReactNode } from 'react';
import './ui.css';

/** Small-caps kicker used to label document sections. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="section-label">{children}</div>;
}
