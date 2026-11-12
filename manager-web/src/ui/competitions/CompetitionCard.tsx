import { CompetitionLogo } from './CompetitionLogo';
import { MotifLayer } from './CompetitionHero';
import { identityOf, paletteVars } from './identity';
import './competitions.css';

/** Small cover used as a button in the competition picker. */
export function CompetitionCard({
  id,
  name,
  sub,
  active,
  mine,
  pending,
  onClick,
}: {
  id: string;
  name: string;
  sub?: string;
  active?: boolean;
  mine?: boolean;
  pending?: boolean;
  onClick: () => void;
}) {
  const ident = identityOf(id);
  return (
    <button
      type="button"
      className={'comp-card' + (active ? ' comp-card--active' : '') + (pending ? ' comp-card--pending' : '')}
      style={paletteVars(ident.palette)}
      aria-pressed={active}
      onClick={onClick}
      title={name}
    >
      <MotifLayer motif={ident.motif} small />
      <CompetitionLogo id={id} name={name} size={38} />
      <span className="comp-card__text">
        <span className="comp-card__name">{name}</span>
        {sub && <span className="comp-card__sub">{sub}</span>}
      </span>
      {mine && <span className="comp-card__flag" title="Juega tu club" />}
    </button>
  );
}
