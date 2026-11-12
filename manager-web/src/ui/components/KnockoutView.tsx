import type { StageResult } from '../../engine/competition';
import type { Club, MatchResult } from '../../engine/types';
import { ClubBadge } from './ClubBadge';
import { Panel } from './Panel';

const ROUND_NAMES: Record<number, string> = {
  1: 'Final',
  2: 'Semifinales',
  4: 'Cuartos de final',
  8: 'Octavos de final',
  16: 'Dieciseisavos de final',
  32: 'Treintaidosavos de final',
};

function roundName(winners: number): string {
  return ROUND_NAMES[winners] ?? `Ronda de ${winners * 2}`;
}

/**
 * Groups a knockout stage's flat match list into rounds. A round with W winners has W ties;
 * each tie is one match or two legs, detected by the same pair meeting again with venues swapped.
 */
function splitRounds(stage: StageResult): { winners: string[]; ties: MatchResult[][] }[] {
  const out: { winners: string[]; ties: MatchResult[][] }[] = [];
  let i = 0;
  for (const winners of stage.rounds) {
    const ties: MatchResult[][] = [];
    for (let t = 0; t < winners.length && i < stage.matches.length; t++) {
      const first = stage.matches[i];
      const next = stage.matches[i + 1];
      if (next && next.homeId === first.awayId && next.awayId === first.homeId) {
        ties.push([first, next]);
        i += 2;
      } else {
        ties.push([first]);
        i += 1;
      }
    }
    out.push({ winners, ties });
  }
  return out;
}

function Score({ m }: { m: MatchResult }) {
  return (
    <span className="score">
      {m.homeGoals}-{m.awayGoals}
      {m.penalties && (
        <span className="score__pens">
          {' '}
          ({m.penalties.home}-{m.penalties.away} pen.)
        </span>
      )}
    </span>
  );
}

export function KnockoutView({
  stage,
  title,
  clubs,
  highlight,
}: {
  stage: StageResult;
  title: string;
  clubs: Map<string, Club>;
  highlight?: string | null;
}) {
  const rounds = splitRounds(stage);
  return (
    <Panel title={title}>
      <div className="bracket">
        {rounds.map(({ winners, ties }) => (
          <section key={winners.length + '-' + winners[0]} className="bracket__round">
            <h4>{roundName(winners.length)}</h4>
            {ties.map((legs) => {
              const a = legs[0].homeId;
              const b = legs[0].awayId;
              const winner = winners.find((w) => w === a || w === b);
              return (
                <div key={a + b} className={'tie' + (highlight === a || highlight === b ? ' tie--mine' : '')}>
                  {[a, b].map((id) => (
                    <div key={id} className={'tie__club' + (winner === id ? ' tie__club--win' : '')}>
                      <ClubBadge club={clubs.get(id)} size={18} />
                      <span className="tie__name">{clubs.get(id)?.shortName ?? id}</span>
                    </div>
                  ))}
                  <div className="tie__scores">
                    {legs.map((m, k) => (
                      <span key={k}>
                        {legs.length === 2 && <span className="muted">{k === 0 ? 'Ida ' : 'Vuelta '}</span>}
                        <Score m={m} />
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </Panel>
  );
}
