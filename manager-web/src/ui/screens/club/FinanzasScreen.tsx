import { useMemo } from 'react';
import { ledgerSummary } from '../../../engine/club';
import type { Transaction } from '../../../engine/game-types';
import { Panel } from '../../components/Panel';
import { CountUp, PersonaMessage } from '../../personas/PersonaMessage';
import { personaFor } from '../../personas/personas';
import { Amount, StatStrip } from './shared';
import { fmtDate, money, monthShort, TX_LABEL, type ScreenProps } from './util';

const KINDS = Object.keys(TX_LABEL) as Transaction['kind'][];

interface MonthPoint {
  key: string; // yyyy-mm
  label: string;
  balance: number; // at the end of the month (or today for the current month)
}

/** Balance at the end of each month of the season, walking back from today's balance. */
function balanceByMonth(ledger: readonly Transaction[], balance: number, season: number, today: string): MonthPoint[] {
  const [ty, tm] = today.split('-').map(Number);
  const lastMonth = ty > season ? 12 : ty < season ? 0 : tm;
  const points: MonthPoint[] = [];
  for (let m = 1; m <= lastMonth; m++) {
    const key = `${season}-${String(m).padStart(2, '0')}`;
    const after = ledger.filter((t) => t.date.slice(0, 7) > key).reduce((s, t) => s + t.amount, 0);
    points.push({ key, label: monthShort(m), balance: balance - after });
  }
  return points;
}

function BalanceChart({ points }: { points: MonthPoint[] }) {
  if (points.length === 0) return <p className="muted">Todavía no hay meses para mostrar.</p>;
  const W = 560;
  const H = 200;
  const pad = { l: 64, r: 12, t: 12, b: 26 };
  const values = points.map((p) => p.balance);
  let lo = Math.min(0, ...values);
  let hi = Math.max(0, ...values);
  if (hi === lo) hi = lo + 1;
  const span = hi - lo;
  lo -= span * 0.05;
  hi += span * 0.05;
  const x = (i: number) => pad.l + ((W - pad.l - pad.r) * (points.length === 1 ? 0.5 : i / (points.length - 1)));
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
  const ticks = [hi - (hi - lo) * 0.05, (hi + lo) / 2, lo + (hi - lo) * 0.05];
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ');
  const area = `${path} L${x(points.length - 1).toFixed(1)},${y(Math.max(lo, 0)).toFixed(1)} L${x(0).toFixed(1)},${y(Math.max(lo, 0)).toFixed(1)} Z`;
  return (
    <svg className="cl-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Saldo a fin de cada mes">
      {ticks.map((t) => (
        <g key={t}>
          <line className="cl-chart__grid" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
          <text className="cl-chart__tick" x={pad.l - 6} y={y(t) + 4} textAnchor="end">{money(t)}</text>
        </g>
      ))}
      {lo < 0 && hi > 0 && <line className="cl-chart__zero" x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} />}
      <path className="cl-chart__area" d={area} />
      <path className="cl-chart__line" d={path} />
      {points.map((p, i) => (
        <g key={p.key}>
          <circle className={p.balance < 0 ? 'cl-chart__dot cl-chart__dot--neg' : 'cl-chart__dot'} cx={x(i)} cy={y(p.balance)} r={3.5}>
            <title>{`${p.label}: ${money(p.balance)}`}</title>
          </circle>
          <text className="cl-chart__tick" x={x(i)} y={H - 8} textAnchor="middle">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

export function FinanzasScreen({ game }: ScreenProps) {
  const fin = game.club.finances;
  const date = game.calendar.date;
  const season = game.calendar.season;
  const monthFrom = `${date.slice(0, 7)}-01`;

  const month = useMemo(() => ledgerSummary(fin.ledger, monthFrom, date), [fin.ledger, monthFrom, date]);
  const year = useMemo(() => ledgerSummary(fin.ledger, `${season}-01-01`, `${season}-12-31`), [fin.ledger, season]);
  const totals = useMemo(() => {
    const inRange = (from: string, to: string) => fin.ledger.filter((t) => t.date >= from && t.date <= to);
    const split = (list: Transaction[]) => ({
      income: list.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
      expense: list.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0),
    });
    return { month: split(inRange(monthFrom, date)), year: split(inRange(`${season}-01-01`, `${season}-12-31`)) };
  }, [fin.ledger, monthFrom, date, season]);
  const points = useMemo(() => balanceByMonth(fin.ledger, fin.balance, season, date), [fin.ledger, fin.balance, season, date]);

  const wageBill = game.world.players.filter((p) => p.clubId === game.userClubId).reduce((s, p) => s + (p.contract?.wage ?? 0), 0);
  const staffBill = game.club.staff.reduce((s, m) => s + m.wage, 0);
  const recent = fin.ledger.slice(-40).reverse();
  const usedKinds = KINDS.filter((k) => month[k] !== 0 || year[k] !== 0);

  const net = totals.month.income + totals.month.expense;
  const treasurerText =
    fin.balance < 0
      ? `Estamos en rojo: ${money(fin.balance)}. No firmo un cheque más hasta que vendamos a alguien o bajemos sueldos.`
      : `En caja hay ${money(fin.balance)}. Este mes ${net >= 0 ? `vamos ganando ${money(net)}` : `vamos perdiendo ${money(-net)}`}${wageBill > fin.wageBudget ? ', y la masa salarial ya pasó el presupuesto: ojo con los sueldos' : ', y los sueldos están dentro del presupuesto'}.${fin.sponsor ? '' : ' Y no tenemos sponsor, eh.'}`;

  return (
    <div className="stack cl-screen">
      <div className="persona-panel">
        <PersonaMessage persona={personaFor(game, 'tesorero')} text={treasurerText} variant="compact" tone={fin.balance < 0 ? 'urgente' : undefined} />
      </div>
      <StatStrip
        items={[
          { label: 'Saldo', value: <span className={fin.balance < 0 ? 'cl-down' : undefined}><CountUp value={fin.balance} format={(n) => money(n)} /></span> },
          { label: 'Presupuesto de fichajes', value: money(fin.transferBudget) },
          { label: 'Presupuesto de sueldos', value: `${money(fin.wageBudget)}/mes`, hint: <>Plantel: <span className={wageBill > fin.wageBudget ? 'cl-down' : undefined}>{money(wageBill)}</span> · Empleados: {money(staffBill)}</> },
          { label: 'Sponsor', value: fin.sponsor ? money(fin.sponsor.perSeason) : '—', hint: fin.sponsor ? `${fin.sponsor.name} · hasta ${fin.sponsor.untilSeason}` : 'Sin sponsor' },
        ]}
      />

      <div className="cl-two">
        <Panel title="Ingresos y gastos" aside={<span className="muted">Mes actual · Temporada {season}</span>} flush>
          <div className="table-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  <th className="left">Concepto</th>
                  <th>Este mes</th>
                  <th>Temporada</th>
                </tr>
              </thead>
              <tbody>
                {usedKinds.map((k) => (
                  <tr key={k}>
                    <td className="left">{TX_LABEL[k]}</td>
                    <td><Amount value={month[k]} /></td>
                    <td><Amount value={year[k]} /></td>
                  </tr>
                ))}
                {usedKinds.length === 0 && <tr><td colSpan={3} className="empty">Sin movimientos esta temporada.</td></tr>}
                <tr className="cl-total">
                  <td className="left">Ingresos</td>
                  <td><Amount value={totals.month.income} /></td>
                  <td><Amount value={totals.year.income} /></td>
                </tr>
                <tr className="cl-total">
                  <td className="left">Gastos</td>
                  <td><Amount value={totals.month.expense} /></td>
                  <td><Amount value={totals.year.expense} /></td>
                </tr>
                <tr className="cl-total cl-total--net">
                  <td className="left">Resultado</td>
                  <td><Amount value={totals.month.income + totals.month.expense} /></td>
                  <td><Amount value={totals.year.income + totals.year.expense} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Saldo por mes" aside={<span className="muted">a fin de cada mes</span>}>
          <BalanceChart points={points} />
        </Panel>
      </div>

      <Panel title="Últimos movimientos" aside={<span className="muted">{fin.ledger.length} en total</span>} flush>
        <div className="table-wrap cl-scroll">
          <table className="grid-table">
            <thead>
              <tr>
                <th className="left">Fecha</th>
                <th className="left">Tipo</th>
                <th className="left">Detalle</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t, i) => (
                <tr key={`${t.date}-${i}`}>
                  <td className="left">{fmtDate(t.date)}</td>
                  <td className="left"><span className="chip">{TX_LABEL[t.kind]}</span></td>
                  <td className="left cl-wrap">{t.description}</td>
                  <td className="strong"><Amount value={t.amount} /></td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={4} className="empty">Sin movimientos.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
