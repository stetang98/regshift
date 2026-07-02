import './ui.css';

interface ArticleChipProps {
  articleRef: string;
  /** When present, the chip links to the regulation source in a new tab. */
  href?: string;
  title?: string;
}

/** Legal-citation chip, e.g. "Art. 50(1)". */
export function ArticleChip({ articleRef, href, title }: ArticleChipProps) {
  if (href !== undefined) {
    return (
      <a className="article-chip" href={href} target="_blank" rel="noreferrer" title={title}>
        {articleRef}
      </a>
    );
  }
  return (
    <span className="article-chip" title={title}>
      {articleRef}
    </span>
  );
}
