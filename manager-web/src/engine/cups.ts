// Resolves cup entrants from data-driven entry rules and plays the season's cups.

import { runCompetition, type CompetitionResult, type StrengthOf } from './competition';
import type { Rng } from './rng';
import type { CompetitionDef, CompetitionFormat, EntryRule, World } from './types';

export interface CompetitionSeason {
  competitionId: string;
  entrants: string[];
  result?: CompetitionResult;
  /** Why the competition was not played (e.g. not enough qualified clubs yet). */
  pending?: string;
}

/** Division order used by the rules: last season's ranking, or reputation in the first season. */
function divisionOrder(world: World, divisionId: string): string[] {
  const ranked = world.qualification?.rankings[divisionId];
  if (ranked?.length) return ranked;
  const division = world.divisions.find((d) => d.id === divisionId);
  if (!division) return [];
  const reputation = new Map(world.clubs.map((c) => [c.id, c.reputation]));
  return [...division.clubIds].sort((a, b) => (reputation.get(b) ?? 0) - (reputation.get(a) ?? 0));
}

/** Clubs that finished in `place` (1-based) of every group of a played stage. */
function groupPlace(played: Map<string, CompetitionResult>, rule: Extract<EntryRule, { kind: 'group-place' }>): string[] {
  const stage = played.get(rule.competitionId)?.stages.find((s) => s.stageId === rule.stageId);
  return stage ? stage.tables.map((t) => t[rule.place - 1]?.clubId).filter((id): id is string => !!id) : [];
}

/**
 * Entrants in seeding order, plus clubs joining at later stages. A club qualifies once:
 * if a rule yields a club that is already in (this cup or an earlier continental cup),
 * the spot passes down the same division's table, as in real qualification.
 */
export function resolveEntrants(
  def: CompetitionDef,
  world: World,
  played: Map<string, CompetitionResult>,
  taken: Set<string>,
): { entrants: string[]; extra: Record<string, string[]> } {
  const entrants: string[] = [];
  const extra: Record<string, string[]> = {};
  const inCup = new Set<string>();
  const usable = (id: string) => !inCup.has(id) && !taken.has(id);
  const add = (id: string) => {
    inCup.add(id);
    entrants.push(id);
  };

  const firstDivision = def.entries.find((r): r is Extract<EntryRule, { kind: 'division' }> => r.kind === 'division');
  // Spots lost to duplicates or missing champions, refilled from division tables below.
  const spill: string[] = [];
  for (const rule of def.entries) {
    switch (rule.kind) {
      case 'division': {
        const order = divisionOrder(world, rule.divisionId).slice(rule.from - 1, rule.to);
        for (const id of order) usable(id) ? add(id) : spill.push(rule.divisionId);
        break;
      }
      case 'champion': {
        const id = world.qualification?.champions[rule.competitionId];
        if (id && usable(id)) add(id);
        else {
          const fallback = rule.fallbackDivisionId ?? firstDivision?.divisionId;
          if (fallback) spill.push(fallback);
        }
        break;
      }
      case 'group-place': {
        const ids = groupPlace(played, rule).filter((id) => !inCup.has(id));
        (extra[rule.joinStageId] ??= []).push(...ids);
        ids.forEach((id) => inCup.add(id));
        break;
      }
      case 'clubs':
        for (const id of rule.clubIds) if (usable(id)) add(id);
        break;
    }
  }

  // Refill each lost spot with the next club below this cup's places in that division's table.
  for (const divisionId of spill) {
    const lastPlace = Math.max(
      0,
      ...def.entries.filter((r) => r.kind === 'division' && r.divisionId === divisionId).map((r) => (r as { to: number }).to),
    );
    const next = divisionOrder(world, divisionId).slice(lastPlace).find(usable);
    if (next) add(next);
  }
  return { entrants, extra };
}

/** Orders cups so that every cup comes after the ones listed in its `after`. */
export function cupOrder(defs: CompetitionDef[]): CompetitionDef[] {
  const done = new Set<string>();
  const order: CompetitionDef[] = [];
  const visit = (def: CompetitionDef, stack: string[]) => {
    if (done.has(def.id)) return;
    if (stack.includes(def.id)) throw new Error(`Cycle in competition order: ${[...stack, def.id].join(' → ')}`);
    for (const dep of def.after ?? []) {
      const d = defs.find((x) => x.id === dep);
      if (d) visit(d, [...stack, def.id]);
    }
    done.add(def.id);
    order.push(def);
  };
  defs.forEach((d) => visit(d, []));
  return order;
}

export function playCups(
  world: World,
  formats: Map<string, CompetitionFormat>,
  strength: StrengthOf,
  rng: Rng,
): CompetitionSeason[] {
  const played = new Map<string, CompetitionResult>();
  const continentalTaken = new Set<string>();
  const seasons: CompetitionSeason[] = [];

  for (const def of cupOrder(world.competitions)) {
    const format = formats.get(def.formatId);
    if (!format) throw new Error(`Unknown format ${def.formatId} for competition ${def.id}`);
    const { entrants, extra } = resolveEntrants(def, world, played, def.scope === 'continental' ? continentalTaken : new Set());
    if (entrants.length !== def.size) {
      seasons.push({
        competitionId: def.id,
        entrants,
        pending: `Faltan clubes clasificados: ${entrants.length} de ${def.size} (se completará al sumar más países).`,
      });
      continue;
    }
    const result = runCompetition(format, entrants, strength, rng, extra);
    played.set(def.id, result);
    if (def.scope === 'continental') [...entrants, ...Object.values(extra).flat()].forEach((id) => continentalTaken.add(id));
    seasons.push({ competitionId: def.id, entrants, result });
  }
  return seasons;
}
