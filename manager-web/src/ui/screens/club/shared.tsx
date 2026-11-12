// Small components shared by the club screens (mercado, finanzas, estadio, empleados, directiva).

import { POSITION_LINE, type Position } from '../../../engine/types';
import { money } from './util';
import './club.css';

const LINE_CLASS = { ARQ: 'arq', DEF: 'def', MED: 'med', DEL: 'del' } as const;

export function PosTag({ position }: { position: Position }) {
  return <span className={`pos pos--${LINE_CLASS[POSITION_LINE[position]]}`}>{position}</span>;
}

/** Amount coloured by sign. */
export function Amount({ value, signed = true }: { value: number; signed?: boolean }) {
  return <span className={value > 0 ? 'cl-up' : value < 0 ? 'cl-down' : 'muted'}>{money(value, signed)}</span>;
}

export function StatStrip({ items }: { items: { label: string; value: React.ReactNode; hint?: React.ReactNode }[] }) {
  return (
    <div className="strip-stats cl-strip" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <div key={it.label}>
          <span>{it.label}</span>
          <b>{it.value}</b>
          {it.hint && <small className="muted tiny">{it.hint}</small>}
        </div>
      ))}
    </div>
  );
}
