/** Dense information panel with a condensed title bar. */
export function Panel({
  title,
  aside,
  children,
  className = '',
  flush = false,
}: {
  title?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** No inner padding (tables that run edge to edge). */
  flush?: boolean;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || aside) && (
        <header className="panel__head">
          {title && <h3 className="panel__title">{title}</h3>}
          {aside && <div className="panel__aside">{aside}</div>}
        </header>
      )}
      <div className={flush ? 'panel__body panel__body--flush' : 'panel__body'}>{children}</div>
    </section>
  );
}

/** Horizontal bar 0-99, used for attributes and reputation. */
export function Bar({ value, max = 99, tone }: { value: number; max?: number; tone?: 'up' | 'down' | 'accent' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const tier = value >= 80 ? 'top' : value >= 65 ? 'good' : value >= 45 ? 'mid' : 'low';
  return (
    <span className={`bar bar--${tone ?? tier}`}>
      <span className="bar__fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Rating chip coloured by tier. */
export function Rating({ value }: { value: number }) {
  const tier = value >= 80 ? 'top' : value >= 65 ? 'good' : value >= 45 ? 'mid' : 'low';
  return <span className={`rating rating--${tier}`}>{value}</span>;
}

/** 1-5 stars from a 1-99 reputation. */
export function Stars({ reputation }: { reputation: number }) {
  // Bands follow the reputation ranges per division (top flight ~54-78, fifth tier ~20-36).
  const n = reputation >= 72 ? 5 : reputation >= 60 ? 4 : reputation >= 48 ? 3 : reputation >= 36 ? 2 : 1;
  return (
    <span className="stars" aria-label={`${n} de 5`} title={`Reputación ${reputation}`}>
      {'★'.repeat(n)}
      <span className="stars__off">{'★'.repeat(5 - n)}</span>
    </span>
  );
}
