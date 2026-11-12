import type { Club } from '../../engine/types';
import { textColour } from './ClubBadge';

/** String of pennants in the club's colours, like the bunting hung in the stands. */
export function FlagStrip({ club, count = 64 }: { club: Club | undefined; count?: number }) {
  const primary = club?.colors.primary ?? '#5bc0eb';
  const secondary = club?.colors.secondary ?? '#ffffff';
  const W = 24;
  return (
    <div className="flag-strip" aria-hidden="true">
      <svg width={count * W} height="22" viewBox={`0 0 ${count * W} 22`}>
        <path d={`M0 2 Q ${(count * W) / 2} 5 ${count * W} 2`} stroke="var(--border-strong)" strokeWidth="1" fill="none" />
        {Array.from({ length: count }, (_, i) => {
          const x = i * W + 2;
          const a = i % 2 === 0 ? primary : secondary;
          const b = i % 2 === 0 ? secondary : primary;
          return (
            <g key={i}>
              <path d={`M${x} 2.5 H${x + 20} L${x + 10} 20 Z`} fill={a} />
              <path d={`M${x + 7} 2.5 H${x + 13} L${x + 10} 8 Z`} fill={b} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Perforated match ticket ("entrada") used to frame the next big action. */
export function Ticket({
  club,
  kicker,
  title,
  fields,
  stub,
  action,
}: {
  club: Club | undefined;
  kicker: string;
  title: string;
  fields: { label: string; value: string }[];
  stub: { label: string; value: string };
  action?: React.ReactNode;
}) {
  const primary = club?.colors.primary ?? '#1d6fa5';
  return (
    <div className="ticket" style={{ ['--ticket-color' as string]: primary, ['--ticket-ink' as string]: textColour(primary) }}>
      <div className="ticket__main">
        <span className="ticket__kicker">{kicker}</span>
        <span className="ticket__title">{title}</span>
        <dl className="ticket__fields">
          {fields.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
        {action && <div className="ticket__action">{action}</div>}
      </div>
      <div className="ticket__stub">
        <span className="ticket__stub-label">{stub.label}</span>
        <span className="ticket__stub-value">{stub.value}</span>
      </div>
    </div>
  );
}
