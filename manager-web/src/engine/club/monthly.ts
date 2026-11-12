// Monthly accounts: wages, TV money, sponsor, insurance, stadium upkeep and other income.

import type { ClubState, Transaction } from '../game-types';
import type { Rng } from '../rng';
import type { Player } from '../types';
import type { ClubContext } from './club-types';
import { annualTvIncome, countryEconomy, estimatedAnnualRevenue, estimateWage, monthlyMemberIncome } from './economy';
import { addTransactions } from './ledger';

/** Monthly insurance premium as a share of the insured wage. */
export const INSURANCE_PREMIUM = 0.04;
/** Share of the wage the insurer pays back while an insured player is injured. */
export const INSURANCE_COVER = 0.75;
/** Running costs (travel, security, admin) as a share of the expected yearly revenue. */
export const OPERATING_COST_SHARE = 0.18;

/**
 * Monthly wage of each squad player. Contracts first; for players without one, the estimate
 * from the club context, or (without context) the wage budget split by quality.
 */
export function squadWages(state: ClubState, players: readonly Player[], context?: ClubContext): Map<string, number> {
  const out = new Map<string, number>();
  const missing = players.filter((p) => !p.contract);
  for (const p of players) if (p.contract) out.set(p.id, p.contract.wage);
  if (missing.length === 0) return out;
  if (context) {
    for (const p of missing) out.set(p.id, estimateWage(p, context.club, context.division.level));
    return out;
  }
  const weight = (p: Player) => Math.exp(0.08 * p.attributes.quality) * (p.youth ? 0.1 : 1);
  const totalWeight = players.reduce((s, p) => s + weight(p), 0);
  const pot = state.finances.wageBudget / 1.2;
  for (const p of missing) out.set(p.id, Math.round((pot * weight(p)) / totalWeight));
  return out;
}

const monthLabel = (date: string) => {
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${months[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
};

/**
 * Settles one month. `players` may contain the whole world: only the club's own are paid.
 * `context` (club + division) enables TV, membership and merchandising income; without it TV is
 * estimated from the wage budget.
 */
export function monthlyUpdate(state: ClubState, players: readonly Player[], date: string, rng: Rng, context?: ClubContext): ClubState {
  const squad = players.filter((p) => p.clubId === state.clubId);
  const wages = squadWages(state, squad, context);
  const label = monthLabel(date);
  const season = Number(date.slice(0, 4));
  const tx: Transaction[] = [];
  const add = (kind: Transaction['kind'], amount: number, description: string) =>
    tx.push({ date, kind, amount: Math.round(amount), description });

  const wageTotal = [...wages.values()].reduce((s, w) => s + w, 0);
  add('sueldos', -wageTotal, `Sueldos de jugadores (${label})`);
  add('empleados', -state.staff.reduce((s, m) => s + m.wage, 0), `Sueldos de empleados (${label})`);

  // Insurance: premiums for insured players, cover for those injured.
  const insured = squad.filter((p) => p.contract?.insured);
  const premiums = insured.reduce((s, p) => s + (wages.get(p.id) ?? 0) * INSURANCE_PREMIUM, 0);
  const cover = insured
    .filter((p) => (p.condition?.injuryDays ?? 0) > 0)
    .reduce((s, p) => s + (wages.get(p.id) ?? 0) * INSURANCE_COVER, 0);
  add('seguros', -premiums, `Primas de seguros (${insured.length} jugadores)`);
  add('seguros', cover, 'Cobertura del seguro por lesionados');

  // TV and sponsor, prorated by month.
  const tvYear = context ? annualTvIncome(context.club, context.division.level) : (state.finances.wageBudget / 1.2) * 12 * 0.45;
  add('tv', tvYear / 12, `Derechos de TV (${label})`);
  const sponsor = state.finances.sponsor;
  if (sponsor && sponsor.untilSeason >= season) add('sponsor', sponsor.perSeason / 12, `Sponsor ${sponsor.name} (${label})`);

  // Stadium upkeep: per seat, scaled by the local price level, plus pitch care.
  const priceLevel = context ? countryEconomy(context.club.country).ticketTop : state.stadium.ticketPrice;
  const perSeat = 0.04 * priceLevel * (0.8 + 0.4 * (state.stadium.pitchQuality / 100));
  add('estadio', -state.stadium.capacity * perSeat, `Mantenimiento del estadio (${label})`);

  if (context) {
    const members = monthlyMemberIncome(context.club, context.division.level, state.stadium.capacity);
    add('otros', members, `Cuotas sociales (${label})`);
    const merch = (estimatedAnnualRevenue(context.club, context.division.level) * 0.03 * (0.8 + 0.4 * rng.next())) / 12;
    add('otros', merch, `Merchandising y otros ingresos (${label})`);
    const operating = (estimatedAnnualRevenue(context.club, context.division.level) * OPERATING_COST_SHARE) / 12;
    add('otros', -operating, `Gastos operativos: viajes, seguridad, administración (${label})`);
  }

  return addTransactions(state, tx);
}
