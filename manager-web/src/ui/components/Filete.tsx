// Original fileteado-style ornaments (scrolls, acanthus leaves, double lines) drawn as inline SVG.

type Corner = 'tl' | 'tr' | 'bl' | 'br';

const CORNER_TRANSFORM: Record<Corner, string> = {
  tl: '',
  tr: 'translate(48 0) scale(-1 1)',
  bl: 'translate(0 48) scale(1 -1)',
  br: 'translate(48 48) scale(-1 -1)',
};

/** Corner scroll: a sweeping stem ending in a curl, with an acanthus leaf and a bead. */
export function FileteCorner({ corner, size = 44 }: { corner: Corner; size?: number }) {
  return (
    <svg className={`filete-corner filete-corner--${corner}`} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <g transform={CORNER_TRANSFORM[corner]} fill="none" strokeLinecap="round">
        {/* double stem: colour line with a thin light shadow line, typical of the craft */}
        <path d="M3 45 C3 22 12 7 34 4" stroke="var(--filete-red)" strokeWidth="2.6" />
        <path d="M6.5 45 C6.5 25 15 11 34 8" stroke="var(--filete-gold)" strokeWidth="0.9" />
        {/* curl at the end of the stem */}
        <path d="M34 4 C43 3 46 12 39 15 C34 17 32 11 36 10.5" stroke="var(--filete-red)" strokeWidth="2.4" />
        {/* acanthus leaf */}
        <path d="M9 33 C13 24 20 22 23 14 C24 21 19 27 9 33 Z" fill="var(--filete-green)" stroke="none" />
        <path d="M10.5 31 C14 26 18 23 21.5 17" stroke="var(--filete-yellow)" strokeWidth="0.8" />
        {/* small counter-curl */}
        <path d="M3 30 C1 25 5 21 8.5 24" stroke="var(--filete-celeste)" strokeWidth="1.6" />
        <circle cx="38" cy="22" r="2" fill="var(--filete-yellow)" stroke="none" />
        <circle cx="25" cy="7.5" r="1.2" fill="var(--filete-celeste)" stroke="none" />
      </g>
    </svg>
  );
}

/** Horizontal divider: double line with a central motif of two facing scrolls and a diamond. */
export function FileteRule({ className = '' }: { className?: string }) {
  return (
    <div className={`filete-rule ${className}`} aria-hidden="true">
      <span className="filete-rule__line" />
      <svg width="92" height="18" viewBox="0 0 92 18">
        <g fill="none" strokeLinecap="round">
          <path d="M2 9 H24 C30 9 32 3 37 4 C41 5 40 10 36.5 9.5" stroke="var(--filete-red)" strokeWidth="1.8" />
          <path d="M90 9 H68 C62 9 60 15 55 14 C51 13 52 8 55.5 8.5" stroke="var(--filete-red)" strokeWidth="1.8" />
          <path d="M46 2 L52 9 L46 16 L40 9 Z" fill="var(--filete-yellow)" stroke="var(--filete-green)" strokeWidth="1.2" />
          <circle cx="46" cy="9" r="1.8" fill="var(--filete-red)" stroke="none" />
          <circle cx="30" cy="13" r="1.3" fill="var(--filete-celeste)" stroke="none" />
          <circle cx="62" cy="5" r="1.3" fill="var(--filete-celeste)" stroke="none" />
        </g>
      </svg>
      <span className="filete-rule__line" />
    </div>
  );
}

/** Box with four scroll corners, for title cards and special panels. */
export function FileteFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`filete-frame ${className}`}>
      <FileteCorner corner="tl" />
      <FileteCorner corner="tr" />
      <FileteCorner corner="bl" />
      <FileteCorner corner="br" />
      {children}
    </div>
  );
}
