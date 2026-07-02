import type { DecisionValue, FindingStatus, RiskLevel, Severity } from './types';

export const FINDING_STATUSES: readonly FindingStatus[] = [
  'gap',
  'partial',
  'compliant',
  'not-applicable',
];
export const SEVERITIES: readonly Severity[] = ['high', 'medium', 'low'];
export const DECISION_VALUES: readonly DecisionValue[] = ['approved', 'needs-work', 'rejected'];

export function statusLabel(status: FindingStatus): string {
  switch (status) {
    case 'gap':
      return 'Gap';
    case 'partial':
      return 'Partial';
    case 'compliant':
      return 'Compliant';
    case 'not-applicable':
      return 'N/A';
  }
}

/** CSS tone suffix for a finding status (used as `badge-<tone>`). */
export function statusTone(status: FindingStatus): string {
  return status === 'not-applicable' ? 'na' : status;
}

export function severityLabel(severity: Severity): string {
  switch (severity) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
  }
}

export function riskLabel(risk: RiskLevel): string {
  return severityLabel(risk);
}

export function decisionLabel(decision: DecisionValue | null): string {
  switch (decision) {
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'needs-work':
      return 'Needs work';
    case null:
      return 'Pending';
  }
}

/** CSS tone suffix for a decision (used as `badge-<tone>`). */
export function decisionTone(decision: DecisionValue | null): string {
  return decision ?? 'pending';
}

export function effortLabel(effort: 'S' | 'M' | 'L'): string {
  switch (effort) {
    case 'S':
      return 'S — small';
    case 'M':
      return 'M — medium';
    case 'L':
      return 'L — large';
  }
}

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

/** "28 Jun 2026, 09:41 UTC" — rendered in UTC so exports are reproducible. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${DATE_TIME.format(date)} UTC`;
}

export function formatDuration(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) {
    return '—';
  }
  const min = Math.floor(totalSec / 60);
  const sec = Math.round(totalSec % 60);
  return min > 0 ? `${min} min ${sec} s` : `${sec} s`;
}

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString('en-US') : '—';
}

export function formatConfidence(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '—';
}
