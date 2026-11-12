// Transfer offers: how a selling club answers, what AI clubs bid each day, and moving
// players between clubs (permanent transfers and loans). All functions are pure.

import type { Contract, MarketState, OfferStatus, TransferOffer } from '../game-types';
import type { Rng } from '../rng';
import { POSITION_LINE, type Club, type Line, type Player, type World } from '../types';
import { bestEleven, lineRating, overall } from '../squad';
import { contractYears } from './contracts';
import { ageInSeason, fairWage, playerValue, roundMoney, COUNTRY_MARKET } from './valuation';
import { isWindowOpen } from './windows';

// ---------------------------------------------------------------- squad role

export type SquadRole = 'clave' | 'titular' | 'suplente';

/** Minimum players per line a club wants to keep. */
const MIN_DEPTH: Record<Line, number> = { ARQ: 2, DEF: 6, MED: 6, DEL: 3 };

/** Role of a player in his club's squad: key starter, starter or substitute. */
export function squadRole(player: Player, squad: readonly Player[]): SquadRole {
  const eleven = bestEleven(squad);
  if (!eleven.some((p) => p.id === player.id)) return 'suplente';
  const top3 = [...eleven].sort((a, b) => overall(b) - overall(a)).slice(0, 3);
  return top3.some((p) => p.id === player.id) ? 'clave' : 'titular';
}

const ROLE_PREMIUM: Record<SquadRole, number> = { clave: 1.6, titular: 1.3, suplente: 0.95 };

// ---------------------------------------------------------------- evaluating offers

export interface OfferResponse {
  status: OfferStatus;
  counterFee?: number;
}

export interface EvaluateOptions {
  /** The selling club has declared the player transferable (asks less). */
  transferListed?: boolean;
  /** The selling club has declared the player loanable. */
  loanListed?: boolean;
}

/**
 * Selling club's answer to an offer. Paying the release clause is always accepted.
 * Otherwise the club asks for the market value times a premium for the player's role
 * (key starter > starter > substitute) and for leaving the line short; offers close to the
 * asking price get a counter-offer.
 */
export function evaluateOffer(
  offer: TransferOffer,
  world: World,
  season: number,
  rng: Rng,
  options: EvaluateOptions = {},
): OfferResponse {
  const player = world.players.find((p) => p.id === offer.playerId);
  const seller = world.clubs.find((c) => c.id === offer.toClubId);
  if (!player || !seller || player.clubId !== seller.id || offer.fromClubId === seller.id) return { status: 'rechazada' };

  const clause = player.contract?.releaseClause;
  if (offer.kind === 'traspaso' && clause !== undefined && offer.fee >= clause) return { status: 'aceptada' };

  const squad = world.players.filter((p) => p.clubId === seller.id);
  const role = squadRole(player, squad);
  const line = POSITION_LINE[player.position];
  const depth = squad.filter((p) => POSITION_LINE[p.position] === line).length;
  const short = depth <= MIN_DEPTH[line];

  if (offer.kind === 'cesion') {
    if (role === 'clave' || (short && !options.loanListed)) return { status: 'rechazada' };
    const young = ageInSeason(player, season) <= 23;
    const chance = options.loanListed ? 0.95 : role === 'suplente' ? (young ? 0.8 : 0.55) : 0.15;
    return { status: rng.next() < chance ? 'aceptada' : 'rechazada' };
  }

  const value = playerValue(player, seller, season);
  let asking = value * ROLE_PREMIUM[role] * (short ? 1.25 : 1) * (options.transferListed ? 0.8 : 1);
  asking *= 0.95 + rng.next() * 0.15;
  if (clause !== undefined) asking = Math.min(asking, clause);
  asking = roundMoney(asking);

  if (offer.fee >= asking) return { status: 'aceptada' };
  if (offer.fee >= asking * 0.7) return { status: 'contraoferta', counterFee: asking };
  return { status: 'rechazada' };
}

// ---------------------------------------------------------------- AI activity

/** Default transfer budget for an AI club, from its reputation and league market. */
export function estimateTransferBudget(club: Club): number {
  const market = COUNTRY_MARKET[club.country] ?? 1;
  return roundMoney(6_000_000 * Math.exp(0.12 * (club.reputation - 70)) * market);
}

export interface AiActivityOptions {
  /** Money each club can spend; clubs missing here use `estimateTransferBudget`. */
  budgets?: Record<string, number>;
  /** The user's club: it never bids here, but its players can receive offers. */
  userClubId?: string;
  /** Upper bound of offers generated per day (default 3). */
  maxOffers?: number;
  /** Season used for values and contracts (default world.season). */
  season?: number;
}

/**
 * Offers AI clubs make on `date`: a few per day, only inside a transfer window. Each buyer
 * looks for an upgrade on the weakest slot of its best eleven among players it can afford
 * (pending offers already count against its budget) and at clubs not far above its level.
 * Some offers are loans of young substitutes from bigger clubs.
 */
export function aiTransferActivity(
  world: World,
  market: MarketState,
  date: string,
  rng: Rng,
  options: AiActivityOptions = {},
): TransferOffer[] {
  if (market.windows.length > 0 && !isWindowOpen(market.windows, date)) return [];
  const season = options.season ?? world.season;
  const clubs = new Map(world.clubs.map((c) => [c.id, c]));
  const squads = new Map<string, Player[]>();
  for (const p of world.players) {
    if (!p.clubId) continue;
    const list = squads.get(p.clubId);
    if (list) list.push(p);
    else squads.set(p.clubId, [p]);
  }

  const committed = new Map<string, number>();
  const taken = new Set<string>(); // buyer|player pairs with a live offer
  for (const o of market.offers) {
    if (o.status !== 'pendiente' && o.status !== 'contraoferta') continue;
    committed.set(o.fromClubId, (committed.get(o.fromClubId) ?? 0) + o.fee);
    taken.add(`${o.fromClubId}|${o.playerId}`);
  }
  const available = (club: Club) =>
    (options.budgets?.[club.id] ?? estimateTransferBudget(club)) - (committed.get(club.id) ?? 0);

  const listed = new Set(market.transferList);
  const loanListed = new Set(market.loanList);
  const buyers = world.clubs.filter((c) => c.id !== options.userClubId && squads.has(c.id));
  const target = rng.int(0, options.maxOffers ?? 3);
  const offers: TransferOffer[] = [];

  for (let attempt = 0; attempt < target * 4 && offers.length < target && buyers.length > 0; attempt++) {
    const buyer = buyers[rng.int(0, buyers.length - 1)];
    const squad = squads.get(buyer.id)!;
    const eleven = bestEleven(squad);
    // Weakest starter slot.
    let weakLine: Line = 'MED';
    let weakRating = Infinity;
    for (const p of eleven) {
      const line = POSITION_LINE[p.position];
      const r = lineRating(p, line);
      if (r < weakRating) [weakLine, weakRating] = [line, r];
    }
    const loan = rng.next() < 0.2;
    const budget = available(buyer);
    if (!loan && budget <= 0) continue;
    const towardsUser = !!options.userClubId && rng.next() < 0.3;

    let best: { player: Player; seller: Club; score: number; value: number } | null = null;
    for (const p of world.players) {
      if (!p.clubId || p.clubId === buyer.id || p.youth || POSITION_LINE[p.position] !== weakLine) continue;
      if (towardsUser && p.clubId !== options.userClubId) continue;
      if (taken.has(`${buyer.id}|${p.id}`)) continue;
      const r = lineRating(p, weakLine);
      if (r < weakRating + 3 || r > weakRating + 18) continue;
      const seller = clubs.get(p.clubId);
      if (!seller) continue;
      const age = ageInSeason(p, season);
      if (age > 33) continue;
      if (loan) {
        if (age > 23 || seller.reputation < buyer.reputation + 5) continue;
      } else if (seller.reputation > buyer.reputation + 12) continue;
      const value = loan ? 0 : playerValue(p, seller, season);
      if (!loan && value * 0.85 > budget) continue;
      const score =
        r - weakRating + rng.next() * 6 + (listed.has(p.id) ? 4 : 0) + (loan && loanListed.has(p.id) ? 4 : 0);
      if (!best || score > best.score) best = { player: p, seller, score, value };
    }
    if (!best) continue;

    const { player, seller, value } = best;
    let fee = 0;
    if (!loan) {
      const clause = player.contract?.releaseClause;
      if (clause !== undefined && clause <= budget && clause <= value * 1.3) fee = clause;
      else fee = Math.min(budget, roundMoney(value * (0.8 + rng.next() * 0.35)));
      if (fee <= 0) continue;
    }
    const contract = offeredContract(player, buyer, season, loan, rng);
    offers.push({
      id: `of-${date}-${buyer.id}-${player.id}`,
      date,
      playerId: player.id,
      fromClubId: buyer.id,
      toClubId: seller.id,
      kind: loan ? 'cesion' : 'traspaso',
      fee,
      contract,
      status: 'pendiente',
    });
    committed.set(buyer.id, (committed.get(buyer.id) ?? 0) + fee);
    taken.add(`${buyer.id}|${player.id}`);
  }
  return offers;
}

function offeredContract(player: Player, buyer: Club, season: number, loan: boolean, rng: Rng): Contract {
  const fair = fairWage(player, buyer, season);
  if (loan) return { wage: roundMoney(Math.max(fair, player.contract?.wage ?? 0)), untilSeason: season };
  const [lo, hi] = contractYears(ageInSeason(player, season));
  return {
    wage: roundMoney(Math.max(fair * (1 + rng.next() * 0.25), (player.contract?.wage ?? 0) * 1.05)),
    untilSeason: season + rng.int(lo, hi) - 1,
  };
}

// ---------------------------------------------------------------- executing

/** What must be undone when a loan ends. */
export interface LoanRecord {
  playerId: string;
  parentClubId: string;
  loanClubId: string;
  /** Contract with the parent club, restored on return. */
  parentContract?: Contract;
  /** ISO date on which the player goes back (end of season by default). */
  returnDate: string;
}

function movePlayer(world: World, offer: TransferOffer, contract: Contract): World {
  const index = world.players.findIndex((p) => p.id === offer.playerId);
  if (index < 0) throw new Error(`Jugador inexistente: ${offer.playerId}`);
  const player = world.players[index];
  if (player.clubId !== offer.toClubId) throw new Error(`${player.name} ya no pertenece a ${offer.toClubId}`);
  if (!world.clubs.some((c) => c.id === offer.fromClubId)) throw new Error(`Club inexistente: ${offer.fromClubId}`);
  const players = world.players.slice();
  players[index] = { ...player, clubId: offer.fromClubId, contract: { ...contract } };
  return { ...world, players };
}

/**
 * Moves the player to the buying club with the offered contract, returning a new world
 * (the original is untouched). Loans go through `executeLoan` so the return is recorded;
 * calling this with a loan offer performs the loan and drops the record.
 */
export function executeTransfer(world: World, offer: TransferOffer): World {
  if (offer.kind === 'cesion') return executeLoan(world, offer).world;
  return movePlayer(world, offer, offer.contract);
}

/** Loans the player out until `returnDate` (default: last day of the world's season). */
export function executeLoan(
  world: World,
  offer: TransferOffer,
  returnDate = `${world.season}-12-31`,
): { world: World; loan: LoanRecord } {
  const player = world.players.find((p) => p.id === offer.playerId);
  const contract = { ...offer.contract, untilSeason: Number(returnDate.slice(0, 4)) };
  delete contract.releaseClause;
  const next = movePlayer(world, offer, contract);
  return {
    world: next,
    loan: {
      playerId: offer.playerId,
      parentClubId: offer.toClubId,
      loanClubId: offer.fromClubId,
      ...(player?.contract ? { parentContract: { ...player.contract } } : {}),
      returnDate,
    },
  };
}

/** Loans that end on or before `date`. */
export const dueLoans = (loans: readonly LoanRecord[], date: string) => loans.filter((l) => l.returnDate <= date);

/** Sends a loaned player back to his parent club (no-op if he has moved on meanwhile). */
export function returnLoan(world: World, loan: LoanRecord): World {
  const index = world.players.findIndex((p) => p.id === loan.playerId);
  if (index < 0 || world.players[index].clubId !== loan.loanClubId) return world;
  const players = world.players.slice();
  const { contract: _loanContract, ...rest } = players[index];
  void _loanContract;
  players[index] = {
    ...rest,
    clubId: loan.parentClubId,
    ...(loan.parentContract ? { contract: { ...loan.parentContract } } : {}),
  };
  return { ...world, players };
}

/**
 * Market after an offer was completed: the offer is accepted, every other live offer for
 * the player is withdrawn and he leaves the transfer and loan lists.
 */
export function marketAfterTransfer(market: MarketState, offer: TransferOffer): MarketState {
  return {
    ...market,
    transferList: market.transferList.filter((id) => id !== offer.playerId),
    loanList: market.loanList.filter((id) => id !== offer.playerId),
    offers: market.offers.map((o) => {
      if (o.id === offer.id) return { ...o, status: 'aceptada' };
      if (o.playerId === offer.playerId && (o.status === 'pendiente' || o.status === 'contraoferta'))
        return { ...o, status: 'retirada' };
      return o;
    }),
  };
}
