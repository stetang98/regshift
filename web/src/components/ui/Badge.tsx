import type { ReactNode } from 'react';
import './ui.css';

interface BadgeProps {
  /** Tone suffix: gap | partial | compliant | na | high | medium | low |
   *  approved | rejected | needs-work | pending | neutral */
  tone: string;
  children: ReactNode;
  title?: string;
}

export function Badge({ tone, children, title }: BadgeProps) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}
