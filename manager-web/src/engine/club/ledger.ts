// Ledger helpers: every money movement is a Transaction, and the balance always moves with it.

import type { ClubState, Transaction } from '../game-types';

/** Appends transactions to the ledger and updates the balance (zero-amount entries are dropped). */
export function addTransactions(state: ClubState, transactions: readonly Transaction[]): ClubState {
  const real = transactions.filter((t) => t.amount !== 0);
  if (real.length === 0) return state;
  const delta = real.reduce((s, t) => s + t.amount, 0);
  return {
    ...state,
    finances: {
      ...state.finances,
      balance: state.finances.balance + delta,
      ledger: [...state.finances.ledger, ...real],
    },
  };
}

export const ledgerTotal = (ledger: readonly Transaction[]): number => ledger.reduce((s, t) => s + t.amount, 0);

/** Income and expenses per kind for a date range (ISO strings, inclusive). */
export function ledgerSummary(ledger: readonly Transaction[], from = '0000-01-01', to = '9999-12-31'): Record<Transaction['kind'], number> {
  const out: Record<Transaction['kind'], number> = {
    taquilla: 0, tv: 0, sponsor: 0, premios: 0, traspaso: 0, sueldos: 0, empleados: 0, estadio: 0, seguros: 0, otros: 0,
  };
  for (const t of ledger) if (t.date >= from && t.date <= to) out[t.kind] += t.amount;
  return out;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
