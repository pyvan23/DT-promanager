import type { GameState } from '../../engine/game/game';
import { CompetitionTrophy } from './Trophy';
import './competitions.css';

export interface Title {
  competitionId: string;
  name: string;
  season: number;
}

/** Titles won by the user's club: this season's finished runs plus last season's summary. */
export function userTitles(game: GameState): Title[] {
  const me = game.userClubId;
  const nameOf = (id: string) =>
    game.calendar.names[id] ?? game.world.divisions.find((d) => d.id === id)?.name ?? game.world.competitions.find((c) => c.id === id)?.name ?? id;
  const out: Title[] = [];
  const seen = new Set<string>();
  const push = (id: string, season: number) => {
    const key = `${id}:${season}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ competitionId: id, name: nameOf(id), season });
  };
  for (const [id, run] of Object.entries(game.calendar.runs)) if (run.champion === me) push(id, game.calendar.season);
  const s = game.lastSummary;
  if (s) {
    for (const d of s.divisions) if (d.result?.champion === me) push(d.divisionId, s.season);
    for (const c of s.competitions) if (c.result?.champion === me) push(c.competitionId, s.season);
  }
  return out.sort((a, b) => b.season - a.season);
}

/** Trophy cabinet of the user's club; renders nothing without titles. */
export function TrophyCabinet({ game }: { game: GameState }) {
  const titles = userTitles(game);
  if (!titles.length) return null;
  return (
    <div className="vitrina" aria-label="Vitrina de trofeos">
      {titles.map((t) => (
        <div key={`${t.competitionId}:${t.season}`} className="vitrina__item">
          <CompetitionTrophy id={t.competitionId} size={60} title={t.name} />
          <span className="vitrina__name">{t.name}</span>
          <span className="vitrina__season">{t.season}</span>
        </div>
      ))}
    </div>
  );
}
