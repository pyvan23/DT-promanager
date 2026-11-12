// Minute-by-minute match engine. A LiveMatch can be stepped (to watch or play part of the
// match, make substitutions and change tactics) or finished in one go; simulateMatchDetailed
// is exactly createLiveMatch(input).finish().

import { POSITION_LINE, type Line, type Player, type Position } from '../types';
import type { MatchEventKind, MatchStats, Mentality, PlayerCondition, Tactics } from '../game-types';
import { lineRating } from '../squad';
import { FORMATION_SLOTS, assignSlots, positionPenalty, slotRating } from './formations';
import { say, scoreLine, type PhraseKind } from './phrases';
import type {
  DetailedMatchReport,
  LiveEvent,
  LiveMatch,
  LiveState,
  LiveTeamState,
  MatchInjury,
  MatchInput,
  MatchPhase,
  OnPitchPlayer,
} from './types';

// ---------------------------------------------------------------- tuning

/** Shots per team per minute between equal sides (≈12 shots per match, ≈1.3 goals). */
const BASE_SHOT = 0.12;
/** Strength gap (in attribute points) that multiplies the shot rate by e. */
const GAP_SCALE = 55;
const BASE_PENALTY = 0.0014;
const BASE_OWN_GOAL = 0.00025;
const BASE_FOUL = 0.125;
const BASE_YELLOW = 0.22;
const BASE_RED = 0.0025;
const BASE_INJURY = 0.0011;
const BASE_CORNER = 0.018;
const MAX_SUBS = 5;
const MAX_WINDOWS = 3;

const MENTALITIES: Mentality[] = ['muy-defensiva', 'defensiva', 'equilibrada', 'ofensiva', 'muy-ofensiva'];
const MENTALITY_MOD: Record<Mentality, { att: number; def: number }> = {
  'muy-defensiva': { att: 0.8, def: 1.14 },
  defensiva: { att: 0.9, def: 1.07 },
  equilibrada: { att: 1, def: 1 },
  ofensiva: { att: 1.1, def: 0.93 },
  'muy-ofensiva': { att: 1.2, def: 0.86 },
};
const PRESSING_MOD = {
  baja: { mid: 0.96, def: 1.01, foul: 0.85, drain: 0.88 },
  media: { mid: 1, def: 1, foul: 1, drain: 1 },
  alta: { mid: 1.05, def: 0.98, foul: 1.2, drain: 1.22 },
};
const TEMPO_MOD = {
  lento: { shots: 0.92, poss: 0.02, drain: 0.92 },
  normal: { shots: 1, poss: 0, drain: 1 },
  rapido: { shots: 1.1, poss: -0.01, drain: 1.1 },
};
const MARKING_MOD = { zonal: { def: 1, foul: 1, drain: 1 }, hombre: { def: 1.03, foul: 1.12, drain: 1.05 } };

/** Contribution of each slot to attack, midfield and defence. */
const POS_WEIGHT: Record<Position, [number, number, number]> = {
  ARQ: [0, 0, 0],
  LD: [0.3, 0.3, 1],
  LI: [0.3, 0.3, 1],
  DFC: [0.1, 0.25, 1],
  MCD: [0.3, 1, 0.7],
  MC: [0.55, 1, 0.45],
  MD: [0.7, 0.85, 0.35],
  MI: [0.7, 0.85, 0.35],
  MCO: [0.9, 0.9, 0.2],
  ED: [1, 0.4, 0.15],
  EI: [1, 0.4, 0.15],
  DC: [1.1, 0.25, 0.1],
};
/** Totals of a full 4-4-2, used to normalise (fewer players ⇒ lower strength). */
const REF = { att: 5.5, mid: 5.3, def: 5.8 };

const SHOOT_WEIGHT: Record<Line, number> = { ARQ: 0, DEF: 0.12, MED: 0.42, DEL: 1 };
const ASSIST_WEIGHT: Record<Line, number> = { ARQ: 0.02, DEF: 0.35, MED: 1, DEL: 0.7 };
const FOUL_WEIGHT: Record<Line, number> = { ARQ: 0.05, DEF: 1, MED: 0.9, DEL: 0.5 };

const INJURIES: { description: string; min: number; max: number }[] = [
  { description: 'una contractura', min: 2, max: 7 },
  { description: 'un golpe en la rodilla', min: 1, max: 6 },
  { description: 'un esguince de tobillo', min: 7, max: 21 },
  { description: 'un desgarro', min: 14, max: 35 },
  { description: 'una distensión muscular', min: 5, max: 14 },
  { description: 'una lesión de ligamentos', min: 40, max: 120 },
];

// ---------------------------------------------------------------- helpers

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const DEFAULT_CONDITION = { fitness: 100, morale: 70, form: 50 };

function attackScore(p: Player): number {
  const a = p.attributes;
  return 0.28 * a.shooting + 0.15 * a.heading + 0.2 * a.dribbling + 0.15 * a.passing + 0.1 * a.speed + 0.12 * a.quality;
}
function midScore(p: Player): number {
  const a = p.attributes;
  return 0.32 * a.passing + 0.2 * a.quality + 0.15 * a.dribbling + 0.15 * a.tackling + 0.18 * a.stamina;
}
function defScore(p: Player): number {
  const a = p.attributes;
  return 0.35 * a.tackling + 0.15 * a.heading + 0.15 * a.speed + 0.15 * a.quality + 0.1 * a.aggression + 0.1 * a.stamina;
}
function finishing(p: Player): number {
  const a = p.attributes;
  return 0.55 * a.shooting + 0.3 * a.heading + 0.15 * a.quality;
}

function pick<T>(items: readonly T[], weight: (t: T) => number, r: number): T | undefined {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) return items[0];
  let x = r * total;
  for (const it of items) {
    x -= Math.max(0, weight(it));
    if (x < 0) return it;
  }
  return items[items.length - 1];
}

interface Track {
  side: 0 | 1;
  slot: Position;
  entered: number;
  left?: number;
  goals: number;
  assists: number;
  shots: number;
  onTarget: number;
  saves: number;
  conceded: number;
  yellow: number;
  red: boolean;
  ownGoals: number;
  penaltyMissed: number;
}

interface Side {
  idx: 0 | 1;
  clubId: string;
  name: string;
  tactics: Tactics;
  onPitch: OnPitchPlayer[];
  bench: string[];
  subsUsed: number;
  windowsUsed: number;
  lastWindowTick: number;
  sentOff: string[];
  ai: boolean;
  goals: number;
  lateChange: boolean;
  penaltyTakerId?: string;
  /** Minutes of regular time at which the AI considers substitutions. */
  subMinutes: number[];
}

interface Strength {
  att: number;
  mid: number;
  def: number;
  gk: number;
}

// ---------------------------------------------------------------- live match

export function createLiveMatch(input: MatchInput): LiveMatch {
  const { rng, players } = input;
  const knockout = input.knockout;
  const neutral = input.neutral ?? false;
  const nameOf = (clubId: string) => input.names?.[clubId] ?? clubId;
  const player = (id: string): Player => {
    const p = players.get(id);
    if (!p) throw new Error(`Jugador desconocido: ${id}`);
    return p;
  };
  const cond = (id: string): Pick<PlayerCondition, 'fitness' | 'morale' | 'form'> => player(id).condition ?? DEFAULT_CONDITION;

  const tracks = new Map<string, Track>();
  const events: LiveEvent[] = [];
  const injuries: MatchInjury[] = [];
  const stats: MatchStats = {
    possession: [50, 50],
    shots: [0, 0],
    shotsOnTarget: [0, 0],
    corners: [0, 0],
    fouls: [0, 0],
    yellow: [0, 0],
    red: [0, 0],
  };
  let possessionSum = 0;
  let ticks = 0;

  const makeSide = (idx: 0 | 1): Side => {
    const sheet = idx === 0 ? input.home : input.away;
    const slots = FORMATION_SLOTS[sheet.tactics.formation];
    const onPitch: OnPitchPlayer[] = sheet.lineup.starters.slice(0, 11).map((id, i) => ({
      playerId: id,
      position: slots[i].position,
      energy: cond(id).fitness,
      yellow: 0,
    }));
    for (const op of onPitch) tracks.set(op.playerId, newTrack(idx, op.position, 0));
    const ai = (idx === 0 ? input.ai?.home : input.ai?.away) ?? true;
    return {
      idx,
      clubId: sheet.clubId,
      name: nameOf(sheet.clubId),
      tactics: { ...sheet.tactics },
      onPitch,
      bench: sheet.lineup.bench.filter((id) => !sheet.lineup.starters.includes(id)).slice(0, 9),
      subsUsed: 0,
      windowsUsed: 0,
      lastWindowTick: -1,
      sentOff: [],
      ai,
      goals: 0,
      lateChange: false,
      penaltyTakerId: sheet.lineup.penaltyTakerId,
      subMinutes: idx === 0 ? [60, 70, 80] : [62, 72, 82],
    };
  };
  const newTrack = (side: 0 | 1, slot: Position, entered: number): Track => ({
    side,
    slot,
    entered,
    goals: 0,
    assists: 0,
    shots: 0,
    onTarget: 0,
    saves: 0,
    conceded: 0,
    yellow: 0,
    red: false,
    ownGoals: 0,
    penaltyMissed: 0,
  });

  const sides: [Side, Side] = [makeSide(0), makeSide(1)];
  const sideOf = (clubId: string): Side => {
    const s = sides.find((x) => x.clubId === clubId);
    if (!s) throw new Error(`El club ${clubId} no juega este partido`);
    return s;
  };
  const rival = (s: Side) => sides[1 - s.idx];

  // Clock: period 1-4 (two halves + two halves of extra time), regular minute and stoppage minute.
  let phase: MatchPhase = 'not-started';
  let period = 1;
  let minute = 1;
  let added = 0;
  let addedTotal = 0;
  const addedTime: number[] = [];
  let lastMinute = 0;
  let lastAdded = 0;
  let penalties: { home: number; away: number } | undefined;
  let report: DetailedMatchReport | undefined;
  const PERIOD_END = [0, 45, 90, 105, 120];

  const scoreText = () => scoreLine(sides[0].name, sides[0].goals, sides[1].goals, sides[1].name);
  const nameP = (id: string | undefined) => (id ? player(id).name : '');

  function emit(
    kind: MatchEventKind,
    side: Side,
    text: string,
    playerId?: string,
    otherPlayerId?: string,
    at?: { minute: number; added?: number },
  ): LiveEvent {
    const ev: LiveEvent = {
      minute: at?.minute ?? minute,
      kind,
      clubId: side.clubId,
      text,
      score: [sides[0].goals, sides[1].goals],
    };
    const add = at ? at.added : added;
    if (add) ev.added = add;
    if (playerId) ev.playerId = playerId;
    if (otherPlayerId) ev.otherPlayerId = otherPlayerId;
    events.push(ev);
    return ev;
  }
  const phrase = (kind: PhraseKind, side: Side, p?: string, o?: string, d?: string) =>
    say(kind, rng, { p: nameP(p), o: nameP(o), t: side.name, r: rival(side).name, s: scoreText(), d });

  // ---------------------------------------------------------------- strength

  function condFactor(op: OnPitchPlayer): number {
    const c = cond(op.playerId);
    return (0.72 + 0.28 * (op.energy / 100)) * (0.958 + 0.06 * (c.morale / 100)) * (0.97 + 0.06 * (c.form / 100));
  }

  function strength(s: Side): Strength {
    let att = 0;
    let mid = 0;
    let def = 0;
    let gk = 25;
    for (const op of s.onPitch) {
      const p = player(op.playerId);
      const cf = condFactor(op);
      const pen = positionPenalty(p, op.position);
      if (op.position === 'ARQ') {
        gk = (lineRating(p, 'ARQ') + pen) * cf;
        continue;
      }
      const [wa, wm, wd] = POS_WEIGHT[op.position];
      att += wa * (attackScore(p) + pen) * cf;
      mid += wm * (midScore(p) + pen) * cf;
      def += wd * (defScore(p) + pen) * cf;
    }
    const t = s.tactics;
    const ment = MENTALITY_MOD[t.mentality];
    const press = PRESSING_MOD[t.pressing];
    const mark = MARKING_MOD[t.marking];
    const home = s.idx === 0 && !neutral;
    // Beyond the lost contribution, a side with fewer players has to cover more ground.
    const outfield = s.onPitch.filter((op) => op.position !== 'ARQ').length;
    const numbers = Math.min(1, outfield / 10) ** 0.8;
    att *= numbers;
    mid *= numbers;
    def *= numbers;
    return {
      att: (att / REF.att) * ment.att * (home ? 1.05 : 1),
      mid: (mid / REF.mid) * press.mid * (home ? 1.03 : 1),
      def: (def / REF.def) * ment.def * press.def * mark.def * (home ? 1.02 : 1),
      gk: Math.max(1, gk),
    };
  }

  // ---------------------------------------------------------------- substitutions

  /** Minute used for minutes played: breaks count as the end of the previous period. */
  const clockMinute = () => (phase === 'half-time' ? 45 : phase === 'before-extra-time' ? 90 : minute);
  const isBreak = () => phase === 'half-time' || phase === 'before-extra-time' || phase === 'not-started';
  const canSub = (s: Side) => s.subsUsed < MAX_SUBS && (isBreak() || s.lastWindowTick === ticks || s.windowsUsed < MAX_WINDOWS);

  function doSub(s: Side, outId: string, inId: string, slot?: Position): LiveEvent {
    const idx = s.onPitch.findIndex((op) => op.playerId === outId);
    const position = slot ?? s.onPitch[idx].position;
    if (!isBreak() && s.lastWindowTick !== ticks) {
      s.windowsUsed++;
      s.lastWindowTick = ticks;
    }
    s.subsUsed++;
    s.bench = s.bench.filter((id) => id !== inId);
    const incoming: OnPitchPlayer = { playerId: inId, position, energy: cond(inId).fitness, yellow: 0 };
    if (idx >= 0) s.onPitch[idx] = incoming;
    else s.onPitch.push(incoming);
    const t = tracks.get(outId);
    if (t && t.left === undefined) t.left = clockMinute();
    tracks.set(inId, newTrack(s.idx, position, clockMinute()));
    return emit('substitution', s, phrase('substitution', s, outId, inId), outId, inId);
  }

  function bestBenchFor(s: Side, slot: Position): string | undefined {
    let best: string | undefined;
    let bestV = -Infinity;
    for (const id of s.bench) {
      const p = player(id);
      if (slot !== 'ARQ' && p.position === 'ARQ') continue;
      const v = slotRating(p, slot) * (0.72 + 0.28 * (cond(id).fitness / 100));
      if (v > bestV) {
        bestV = v;
        best = id;
      }
    }
    return best;
  }

  function effective(op: OnPitchPlayer): number {
    return slotRating(player(op.playerId), op.position) * condFactor(op);
  }

  /** The keeper left the pitch: bring the reserve keeper or put an outfield player in goal. */
  function replaceKeeper(s: Side) {
    if (s.onPitch.some((op) => op.position === 'ARQ') || s.onPitch.length === 0) return;
    const reserve = s.bench.find((id) => player(id).position === 'ARQ');
    if (reserve && canSub(s) && s.onPitch.length > 1) {
      const order: Line[] = ['DEL', 'MED', 'DEF'];
      for (const line of order) {
        const cands = s.onPitch.filter((op) => POSITION_LINE[op.position] === line);
        if (!cands.length) continue;
        const weakest = cands.reduce((a, b) => (effective(b) < effective(a) ? b : a));
        doSub(s, weakest.playerId, reserve, 'ARQ');
        return;
      }
    }
    const stand = s.onPitch.reduce((a, b) =>
      player(b.playerId).attributes.goalkeeping > player(a.playerId).attributes.goalkeeping ? b : a,
    );
    stand.position = 'ARQ';
  }

  function removeFromPitch(s: Side, id: string) {
    const op = s.onPitch.find((x) => x.playerId === id);
    s.onPitch = s.onPitch.filter((x) => x.playerId !== id);
    const t = tracks.get(id);
    if (t && t.left === undefined) t.left = clockMinute();
    if (op?.position === 'ARQ') replaceKeeper(s);
  }

  function aiSubs(s: Side) {
    if (!s.ai || period !== 2 || added > 0) return;
    const w = s.subMinutes.indexOf(minute);
    if (w < 0 || !canSub(s)) return;
    const maxNow = w === s.subMinutes.length - 1 ? MAX_SUBS : Math.min(MAX_SUBS, 2 * (w + 1));
    const cands = s.onPitch
      .filter((op) => op.position !== 'ARQ')
      .map((op) => {
        const p = player(op.playerId);
        const cardRisk = op.yellow > 0 && p.attributes.aggression > 55 && POSITION_LINE[op.position] !== 'DEL' ? 12 : 0;
        return { op, need: 100 - op.energy + cardRisk };
      })
      .sort((a, b) => b.need - a.need);
    for (const { op, need } of cands) {
      if (s.subsUsed >= maxNow || !canSub(s)) break;
      if (need < 15) break;
      const inId = bestBenchFor(s, op.position);
      if (!inId) break;
      const fresh = slotRating(player(inId), op.position) * (0.72 + 0.28 * (cond(inId).fitness / 100));
      if (fresh < effective(op) - 4 - (need > 30 ? 4 : 0)) continue;
      doSub(s, op.playerId, inId);
    }
  }

  function aiTactics(s: Side) {
    if (!s.ai || s.lateChange || period !== 2 || added > 0) return;
    const diff = s.goals - rival(s).goals;
    const i = MENTALITIES.indexOf(s.tactics.mentality);
    if (minute === 75 && diff < 0 && i < 4) {
      s.tactics = { ...s.tactics, mentality: MENTALITIES[i + 1] };
      s.lateChange = true;
    } else if (minute === 82 && diff === 1 && i > 0) {
      s.tactics = { ...s.tactics, mentality: MENTALITIES[i - 1] };
      s.lateChange = true;
    }
  }

  // ---------------------------------------------------------------- events

  function scoreGoal(s: Side) {
    s.goals++;
    for (const op of rival(s).onPitch) {
      const t = tracks.get(op.playerId)!;
      t.conceded++;
    }
  }

  function chooseShooter(s: Side): OnPitchPlayer | undefined {
    return pick(
      s.onPitch,
      (op) => {
        const p = player(op.playerId);
        const w = op.position === 'MCO' ? 0.65 : SHOOT_WEIGHT[POSITION_LINE[op.position]];
        return w * (finishing(p) / 50) ** 2 * condFactor(op);
      },
      rng.next(),
    );
  }

  function keeperOf(s: Side): OnPitchPlayer | undefined {
    return s.onPitch.find((op) => op.position === 'ARQ');
  }

  function shot(s: Side, st: Strength, opp: Strength) {
    const shooter = chooseShooter(s);
    if (!shooter) return;
    const sp = player(shooter.playerId);
    const tr = tracks.get(shooter.playerId)!;
    const fin = finishing(sp) * condFactor(shooter);
    stats.shots[s.idx]++;
    tr.shots++;
    const pOn = clamp(0.34 + (fin - 60) / 400 + (st.att - opp.def) / 800, 0.15, 0.6);
    const keeper = keeperOf(rival(s));
    if (rng.next() >= pOn) {
      if (rng.next() < 0.25) stats.corners[s.idx]++;
      emit('chance', s, phrase('chance', s, shooter.playerId), shooter.playerId);
      return;
    }
    stats.shotsOnTarget[s.idx]++;
    tr.onTarget++;
    const pGoal = clamp(0.3 + (fin - opp.gk) / 300, 0.1, 0.6);
    if (rng.next() < pGoal) {
      tr.goals++;
      let assist: OnPitchPlayer | undefined;
      if (rng.next() < 0.75) {
        assist = pick(
          s.onPitch.filter((op) => op !== shooter),
          (op) => ASSIST_WEIGHT[POSITION_LINE[op.position]] * (player(op.playerId).attributes.passing / 50) ** 2,
          rng.next(),
        );
      }
      if (assist) tracks.get(assist.playerId)!.assists++;
      scoreGoal(s);
      const header = rng.next() < (0.6 * sp.attributes.heading) / (sp.attributes.heading + sp.attributes.shooting);
      const kind: PhraseKind = header ? 'goal-header' : assist ? 'goal-assist' : 'goal';
      emit('goal', s, phrase(kind, s, shooter.playerId, assist?.playerId), shooter.playerId, assist?.playerId);
      return;
    }
    if (keeper) tracks.get(keeper.playerId)!.saves++;
    if (rng.next() < 0.33) stats.corners[s.idx]++;
    emit('save', s, phrase('save', s, shooter.playerId, keeper?.playerId), shooter.playerId, keeper?.playerId);
  }

  function chooseFouler(s: Side): OnPitchPlayer | undefined {
    return pick(
      s.onPitch,
      (op) => FOUL_WEIGHT[POSITION_LINE[op.position]] * (player(op.playerId).attributes.aggression / 50) ** 2,
      rng.next(),
    );
  }

  /** Card decision for a foul by `op` of side `s`. */
  function card(s: Side, op: OnPitchPlayer, severity = 1) {
    const aggr = player(op.playerId).attributes.aggression;
    const late = period >= 2 && minute >= 75 ? 1.15 : 1;
    const r = rng.next();
    const pRed = BASE_RED * (aggr / 60);
    const pYellow = BASE_YELLOW * (0.6 + aggr / 150) * late * severity * (op.yellow ? 0.3 : 1);
    const tr = tracks.get(op.playerId)!;
    if (r < pRed) {
      tr.red = true;
      stats.red[s.idx]++;
      s.sentOff.push(op.playerId);
      emit('red', s, phrase('red', s, op.playerId), op.playerId);
      removeFromPitch(s, op.playerId);
    } else if (r < pRed + pYellow) {
      op.yellow++;
      tr.yellow++;
      stats.yellow[s.idx]++;
      if (op.yellow >= 2) {
        tr.red = true;
        stats.red[s.idx]++;
        s.sentOff.push(op.playerId);
        emit('second-yellow', s, phrase('second-yellow', s, op.playerId), op.playerId);
        removeFromPitch(s, op.playerId);
      } else {
        emit('yellow', s, phrase('yellow', s, op.playerId), op.playerId);
      }
    }
  }

  function foul(s: Side) {
    const op = chooseFouler(s);
    if (!op) return;
    stats.fouls[s.idx]++;
    card(s, op);
  }

  function penalty(s: Side) {
    const def = rival(s);
    const fouler = pick(
      def.onPitch.filter((op) => op.position !== 'ARQ'),
      (op) => FOUL_WEIGHT[POSITION_LINE[op.position]] * player(op.playerId).attributes.aggression,
      rng.next(),
    );
    const onPitchIds = s.onPitch.map((op) => op.playerId);
    const takerId =
      s.penaltyTakerId && onPitchIds.includes(s.penaltyTakerId)
        ? s.penaltyTakerId
        : s.onPitch
            .filter((op) => op.position !== 'ARQ')
            .map((op) => op.playerId)
            .sort((a, b) => penaltySkill(player(b)) - penaltySkill(player(a)))[0];
    if (!takerId) return;
    const awarded = say('penalty-awarded', rng, { t: s.name, r: def.name, o: nameP(fouler?.playerId) });
    if (fouler) stats.fouls[def.idx]++;
    stats.shots[s.idx]++;
    const tr = tracks.get(takerId)!;
    tr.shots++;
    const keeper = keeperOf(def);
    const gk = keeper ? lineRating(player(keeper.playerId), 'ARQ') : 20;
    const pScore = clamp(0.76 + (penaltySkill(player(takerId)) - gk) / 300, 0.55, 0.92);
    const r = rng.next();
    if (r < pScore) {
      stats.shotsOnTarget[s.idx]++;
      tr.onTarget++;
      tr.goals++;
      scoreGoal(s);
      emit('penalty-goal', s, `${awarded} ${phrase('penalty-goal', s, takerId)}`, takerId);
    } else {
      tr.penaltyMissed++;
      const saved = rng.next() < 0.6 && keeper;
      if (saved) {
        stats.shotsOnTarget[s.idx]++;
        tr.onTarget++;
        tracks.get(keeper.playerId)!.saves++;
      }
      const text = saved ? phrase('penalty-saved', s, takerId, keeper.playerId) : phrase('penalty-wide', s, takerId);
      emit('penalty-miss', s, `${awarded} ${text}`, takerId, saved ? keeper.playerId : undefined);
    }
    if (fouler && def.onPitch.includes(fouler) && rng.next() < 0.4) card(def, fouler, 3);
  }

  function ownGoal(s: Side) {
    const def = rival(s);
    const op = pick(
      def.onPitch,
      (o) => (POSITION_LINE[o.position] === 'DEF' ? 1 : POSITION_LINE[o.position] === 'MED' ? 0.3 : 0.08),
      rng.next(),
    );
    if (!op) return;
    tracks.get(op.playerId)!.ownGoals++;
    scoreGoal(s);
    // clubId is the club credited with the goal; playerId is the unlucky defender.
    emit('own-goal', s, phrase('own-goal', def, op.playerId), op.playerId);
  }

  function injury(s: Side) {
    const op = pick(s.onPitch, (o) => (o.position === 'ARQ' ? 0.3 : 1.4 - o.energy / 100), rng.next());
    if (!op) return;
    const kind = INJURIES[Math.floor(rng.next() * INJURIES.length)];
    const days = kind.min + Math.floor(rng.next() * (kind.max - kind.min + 1));
    injuries.push({ playerId: op.playerId, clubId: s.clubId, minute, days, description: kind.description });
    emit('injury', s, phrase('injury', s, op.playerId, undefined, kind.description), op.playerId);
    const inId = canSub(s) ? bestBenchFor(s, op.position) : undefined;
    if (inId && (op.position !== 'ARQ' || player(inId).position === 'ARQ')) doSub(s, op.playerId, inId);
    else removeFromPitch(s, op.playerId);
  }

  function drain(s: Side) {
    const t = s.tactics;
    const mul = PRESSING_MOD[t.pressing].drain * TEMPO_MOD[t.tempo].drain * MARKING_MOD[t.marking].drain;
    for (const op of s.onPitch) {
      const stamina = player(op.playerId).attributes.stamina;
      const d = 0.3 * (1.45 - stamina / 100) * mul * (op.position === 'ARQ' ? 0.25 : 1);
      op.energy = Math.max(0, op.energy - d);
    }
  }

  function playMinute() {
    ticks++;
    const st = [strength(sides[0]), strength(sides[1])];
    const t0 = sides[0].tactics;
    const t1 = sides[1].tactics;
    const possHome = clamp(
      0.5 + (st[0].mid - st[1].mid) / 180 + TEMPO_MOD[t0.tempo].poss - TEMPO_MOD[t1.tempo].poss,
      0.28,
      0.72,
    );
    possessionSum += possHome;
    const poss = [possHome, 1 - possHome];
    const tempo = [TEMPO_MOD[t0.tempo].shots, TEMPO_MOD[t1.tempo].shots];
    for (const s of sides) {
      const i = s.idx;
      const o = 1 - i;
      if (s.onPitch.length === 0) continue;
      const gap = Math.exp((st[i].att - st[o].def) / GAP_SCALE);
      const rate = clamp(BASE_SHOT * (poss[i] / 0.5) ** 0.3 * gap * tempo[i] * Math.sqrt(tempo[o]), 0, 0.5);
      if (rng.next() < rate) shot(s, st[i], st[o]);
      if (rng.next() < BASE_PENALTY * gap) penalty(s);
      if (rng.next() < BASE_OWN_GOAL) ownGoal(s);
      if (rng.next() < BASE_CORNER * Math.sqrt(poss[i] / 0.5)) stats.corners[i]++;
      const aggr =
        s.onPitch.reduce((a, op) => a + player(op.playerId).attributes.aggression, 0) / Math.max(1, s.onPitch.length);
      const foulRate =
        BASE_FOUL *
        ((1 - poss[i]) / 0.5) ** 0.7 *
        (0.5 + aggr / 110) *
        PRESSING_MOD[s.tactics.pressing].foul *
        MARKING_MOD[s.tactics.marking].foul;
      if (rng.next() < foulRate) foul(s);
      if (rng.next() < BASE_INJURY) injury(s);
    }
    for (const s of sides) drain(s);
    for (const s of sides) {
      aiTactics(s);
      aiSubs(s);
    }
  }

  // ---------------------------------------------------------------- clock

  const tied = () => {
    const agg = knockout?.aggregate ?? { home: 0, away: 0 };
    return sides[0].goals + agg.home === sides[1].goals + agg.away;
  };

  function shootout() {
    phase = 'penalties';
    const at = { minute: period >= 3 ? 120 : 90 };
    const kickers = sides.map((s) => {
      const outfield = s.onPitch
        .filter((op) => op.position !== 'ARQ')
        .map((op) => op.playerId)
        .sort((a, b) => penaltySkill(player(b)) - penaltySkill(player(a)));
      if (s.penaltyTakerId && outfield.includes(s.penaltyTakerId)) {
        outfield.splice(outfield.indexOf(s.penaltyTakerId), 1);
        outfield.unshift(s.penaltyTakerId);
      }
      const gk = keeperOf(s);
      return gk ? [...outfield, gk.playerId] : outfield;
    });
    const score = [0, 0];
    const kick = (i: 0 | 1, n: number) => {
      const s = sides[i];
      const list = kickers[i];
      if (!list.length) return;
      const id = list[n % list.length];
      const keeper = keeperOf(rival(s));
      const gk = keeper ? lineRating(player(keeper.playerId), 'ARQ') : 20;
      const ok = rng.next() < clamp(0.75 + (penaltySkill(player(id)) - gk) / 300, 0.55, 0.92);
      if (ok) score[i]++;
      const text = say(ok ? 'shootout-goal' : 'shootout-miss', rng, { p: player(id).name, o: nameP(keeper?.playerId) });
      emit('shootout', s, `${text} (${score[0]}-${score[1]})`, id, ok ? undefined : keeper?.playerId, at);
    };
    let n = 0;
    for (; n < 5; n++) {
      kick(0, n);
      if (decided(score, n, 0)) break;
      kick(1, n);
      if (decided(score, n, 1)) break;
    }
    if (score[0] === score[1]) {
      for (n = 5; score[0] === score[1] && n < 60; n++) {
        kick(0, n);
        kick(1, n);
      }
      if (score[0] === score[1]) score[rng.next() < 0.5 ? 0 : 1]++; // safety, never in practice
    }
    penalties = { home: score[0], away: score[1] };
    const winner = score[0] > score[1] ? sides[0] : sides[1];
    const s = `${Math.max(score[0], score[1])}-${Math.min(score[0], score[1])}`;
    emit('full-time', winner, `${say('full-time', rng, { s: scoreText() })} ${say('shootout-end', rng, { t: winner.name, s })}`, undefined, undefined, at);
  }

  function endPeriod() {
    addedTime.push(addedTotal);
    if (period === 1) {
      emit('half-time', sides[0], phrase('half-time', sides[0]));
      phase = 'half-time';
      period = 2;
      minute = 46;
    } else if (period === 2 || period === 4) {
      if (knockout?.needWinner && tied()) {
        if (period === 2 && knockout.extraTime) {
          emit('extra-time', sides[0], phrase('extra-time', sides[0]));
          phase = 'before-extra-time';
          period = 3;
          minute = 91;
        } else {
          shootout();
          end();
        }
      } else {
        emit('full-time', sides[0], phrase('full-time', sides[0]));
        end();
      }
    } else {
      emit('half-time', sides[0], phrase('extra-half', sides[0]));
      period = 4;
      minute = 106;
    }
    added = 0;
    addedTotal = 0;
  }

  function stoppage(): number {
    const r = rng.next();
    const busy = Math.min(2, Math.floor(events.filter((e) => e.kind === 'substitution' || e.kind === 'injury').length / 4));
    if (period === 1) return 1 + Math.floor(r * 4);
    if (period === 2) return 2 + Math.floor(r * 4) + busy;
    return Math.floor(r * 3);
  }

  /** Plays one minute of the clock; returns false when the match is over. */
  function tick(): boolean {
    if (phase === 'finished' || phase === 'penalties') return false;
    if (phase === 'not-started') {
      emit('kickoff', sides[0], phrase('kickoff', sides[0]), undefined, undefined, { minute: 1 });
      phase = 'first-half';
    } else if (phase === 'half-time') phase = 'second-half';
    else if (phase === 'before-extra-time') phase = 'extra-time';
    playMinute();
    lastMinute = minute;
    lastAdded = added;
    if (added === 0 && minute < PERIOD_END[period]) minute++;
    else {
      if (added === 0) addedTotal = stoppage();
      if (added < addedTotal) added++;
      else endPeriod();
    }
    return true;
  }

  function end() {
    phase = 'finished';
    report = buildReport();
  }

  // ---------------------------------------------------------------- report

  function buildReport(): DetailedMatchReport {
    const total = period >= 3 ? 120 : 90;
    const ratings: Record<string, number> = {};
    const minutesPlayed: Record<string, number> = {};
    for (const [id, t] of tracks) {
      const p = player(id);
      const mins = Math.max(0, (t.left ?? total) - t.entered);
      minutesPlayed[id] = Math.max(1, mins);
      const line = POSITION_LINE[t.slot];
      const mine = sides[t.side];
      const diff = mine.goals - rival(mine).goals;
      let r = 6;
      r += clamp((slotRating(p, t.slot) - 62) / 25, -0.8, 0.8);
      r += t.goals * (line === 'DEL' ? 1 : 1.2) + t.assists * 0.6 + t.onTarget * 0.1 - (t.shots - t.onTarget) * 0.05;
      if (line === 'ARQ') r += t.saves * 0.25 - t.conceded * 0.35 + (t.conceded === 0 && mins >= 60 ? 0.6 : 0);
      if (line === 'DEF') r += -t.conceded * 0.15 + (t.conceded === 0 && mins >= 60 ? 0.4 : 0);
      r += diff > 0 ? 0.35 : diff < 0 ? -0.3 : 0;
      r -= t.yellow * 0.25 + (t.red ? 1.5 : 0) + t.ownGoals + t.penaltyMissed * 0.8;
      r += (rng.next() + rng.next() - 1) * 0.8;
      r = 6 + (r - 6) * clamp(mins / 60, 0.4, 1);
      ratings[id] = Math.round(clamp(r, 1, 10) * 10) / 10;
    }
    return {
      homeId: sides[0].clubId,
      awayId: sides[1].clubId,
      homeGoals: sides[0].goals,
      awayGoals: sides[1].goals,
      ...(penalties ? { penalties } : {}),
      events: [...events],
      stats: currentStats(),
      ratings,
      minutesPlayed,
      injuries: [...injuries],
      addedTime: [...addedTime],
      extraTime: period >= 3,
      sentOff: [...sides[0].sentOff, ...sides[1].sentOff],
    };
  }

  function currentStats(): MatchStats {
    const home = ticks ? Math.round((possessionSum / ticks) * 100) : 50;
    return {
      possession: [home, 100 - home],
      shots: [...stats.shots],
      shotsOnTarget: [...stats.shotsOnTarget],
      corners: [...stats.corners],
      fouls: [...stats.fouls],
      yellow: [...stats.yellow],
      red: [...stats.red],
    };
  }

  const teamState = (s: Side): LiveTeamState => ({
    clubId: s.clubId,
    goals: s.goals,
    tactics: { ...s.tactics },
    onPitch: s.onPitch.map((op) => ({ ...op })),
    bench: [...s.bench],
    subsUsed: s.subsUsed,
    subsLeft: MAX_SUBS - s.subsUsed,
    windowsLeft: Math.max(0, MAX_WINDOWS - s.windowsUsed),
    sentOff: [...s.sentOff],
    ai: s.ai,
  });

  // ---------------------------------------------------------------- public API

  return {
    get events() {
      return events;
    },
    step(n: number) {
      const from = events.length;
      for (let i = 0; i < n; i++) if (!tick()) break;
      return events.slice(from);
    },
    state(): LiveState {
      return {
        minute: lastMinute,
        added: lastAdded,
        phase,
        homeGoals: sides[0].goals,
        awayGoals: sides[1].goals,
        ...(penalties ? { penalties } : {}),
        stats: currentStats(),
        home: teamState(sides[0]),
        away: teamState(sides[1]),
        finished: phase === 'finished',
      };
    },
    substitute(clubId, outId, inId) {
      const s = sideOf(clubId);
      if (phase === 'finished' || phase === 'penalties') throw new Error('El partido ya terminó');
      if (!s.onPitch.some((op) => op.playerId === outId)) throw new Error('Ese jugador no está en la cancha');
      if (!s.bench.includes(inId)) throw new Error('Ese jugador no está disponible en el banco');
      if (s.subsUsed >= MAX_SUBS) throw new Error('Ya hiciste los cinco cambios');
      if (!canSub(s)) throw new Error('No quedan ventanas de cambio');
      return doSub(s, outId, inId);
    },
    setTactics(clubId, tactics) {
      const s = sideOf(clubId);
      const formationChanged = tactics.formation !== s.tactics.formation;
      s.tactics = { ...tactics };
      if (!formationChanged) return;
      const slots = FORMATION_SLOTS[tactics.formation].map((sl) => sl.position).slice(1);
      const keeper = keeperOf(s);
      const outfield = s.onPitch.filter((op) => op !== keeper);
      const assigned = assignSlots(
        outfield.map((op) => player(op.playerId)),
        slots,
      );
      assigned.forEach((id, j) => {
        const op = outfield.find((o) => o.playerId === id);
        if (op) op.position = slots[j];
      });
    },
    setAi(clubId, on) {
      sideOf(clubId).ai = on;
    },
    finish() {
      while (tick());
      return report!;
    },
  };
}

function penaltySkill(p: Player): number {
  return 0.7 * p.attributes.shooting + 0.3 * p.attributes.quality;
}

/** Shoot-out over before five kicks each? `n` is the round (0-based), `last` who just kicked. */
function decided(score: number[], n: number, last: 0 | 1): boolean {
  const kicksHome = n + 1;
  const kicksAway = last === 1 ? n + 1 : n;
  const leftHome = 5 - kicksHome;
  const leftAway = 5 - kicksAway;
  return score[0] + leftHome < score[1] || score[1] + leftAway < score[0];
}
