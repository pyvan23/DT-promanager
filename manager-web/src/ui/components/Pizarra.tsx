import { bestEleven } from '../../engine/squad';
import { POSITION_LINE, type Player, type Position } from '../../engine/types';
import { overall, shortPlayerName } from '../format';

// The coach's chalkboard: the best eleven on a 4-4-2 drawn in chalk.

const ROWS: Record<string, { y: number; xs: number[] }> = {
  ARQ: { y: 90, xs: [50] },
  DEF: { y: 70, xs: [14, 38, 62, 86] },
  MED: { y: 46, xs: [14, 38, 62, 86] },
  DEL: { y: 20, xs: [36, 64] },
};

/** Left-to-right order inside a line: left-sided players first, right-sided last. */
const SIDE: Partial<Record<Position, number>> = { LI: 0, MI: 0, EI: 0, LD: 2, MD: 2, ED: 2 };

export function placeEleven(eleven: Player[]): { player: Player; x: number; y: number }[] {
  const out: { player: Player; x: number; y: number }[] = [];
  for (const line of ['ARQ', 'DEF', 'MED', 'DEL'] as const) {
    const row = ROWS[line];
    const players = eleven
      .filter((p) => POSITION_LINE[p.position] === line)
      .sort((a, b) => (SIDE[a.position] ?? 1) - (SIDE[b.position] ?? 1))
      .slice(0, row.xs.length);
    players.forEach((player, i) => {
      // Fewer players than slots (thin squads): centre them.
      const offset = Math.floor((row.xs.length - players.length) / 2);
      out.push({ player, x: row.xs[i + offset], y: row.y });
    });
  }
  // Players from other lines that filled gaps go on the bench row of the board.
  const placed = new Set(out.map((o) => o.player.id));
  eleven
    .filter((p) => !placed.has(p.id))
    .forEach((player, i) => out.push({ player, x: 20 + i * 20, y: 58 }));
  return out;
}

export function Pizarra({ squad, onPick }: { squad: Player[]; onPick?: (p: Player) => void }) {
  const placed = placeEleven(bestEleven(squad));
  return (
    <div className="pizarra">
      <svg className="pizarra__lines" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
        <g fill="none" stroke="var(--chalk)" strokeWidth="0.5" strokeLinecap="round" opacity="0.75">
          <rect x="4" y="4" width="92" height="132" rx="1" />
          <line x1="4" y1="70" x2="96" y2="70" />
          <circle cx="50" cy="70" r="11" />
          <rect x="26" y="4" width="48" height="20" />
          <rect x="38" y="4" width="24" height="8" />
          <rect x="26" y="116" width="48" height="20" />
          <rect x="38" y="128" width="24" height="8" />
          <path d="M40 24 A11 11 0 0 0 60 24" />
          <path d="M40 116 A11 11 0 0 1 60 116" />
        </g>
        {/* chalk arrows of the plan */}
        <g fill="none" stroke="var(--filete-yellow)" strokeWidth="0.55" strokeDasharray="1.6 1.4" opacity="0.7">
          <path d="M18 62 C12 48 14 36 22 26" />
          <path d="M82 62 C88 48 86 36 78 26" />
          <path d="M50 54 C46 44 52 36 48 28" />
        </g>
      </svg>
      <span className="pizarra__title">4-4-2</span>
      {placed.map(({ player, x, y }) => (
        <button
          key={player.id}
          className="pizarra__player"
          style={{ left: `${x}%`, top: `${(y / 100) * 100}%` }}
          onClick={() => onPick?.(player)}
          title={`${player.name} · ${player.position}`}
        >
          <span className="pizarra__dot">{overall(player)}</span>
          <span className="pizarra__name">{shortPlayerName(player.name)}</span>
          <span className="pizarra__pos">{player.position}</span>
        </button>
      ))}
    </div>
  );
}
