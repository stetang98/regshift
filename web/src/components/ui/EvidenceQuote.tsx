import { statusTone } from '../../lib/format';
import type { FindingSite, FindingStatus } from '../../lib/types';
import { CodeRef } from './CodeRef';
import './ui.css';

interface EvidenceQuoteProps {
  site: FindingSite;
  status: FindingStatus;
}

/** Quoted code evidence with file:line attribution and analyst reasoning. */
export function EvidenceQuote({ site, status }: EvidenceQuoteProps) {
  return (
    <figure className={`evidence evidence-${statusTone(status)}`}>
      <figcaption className="evidence-head">
        <CodeRef file={site.file} startLine={site.startLine} endLine={site.endLine} />
      </figcaption>
      <pre className="evidence-code">{site.evidence}</pre>
      <p className="evidence-reason">{site.reason}</p>
    </figure>
  );
}
