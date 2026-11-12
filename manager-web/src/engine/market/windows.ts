// Transfer windows. Seasons follow the calendar year (January-December), so the windows
// are the summer one in January-February and the winter one in July-August.

export interface TransferWindow {
  from: string; // ISO yyyy-mm-dd, inclusive
  to: string;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function defaultWindows(season: number): TransferWindow[] {
  return [
    { from: `${season}-01-01`, to: `${season}-02-${isLeap(season) ? 29 : 28}` },
    { from: `${season}-07-01`, to: `${season}-08-31` },
  ];
}

/** ISO dates compare correctly as strings. */
export const isWindowOpen = (windows: readonly TransferWindow[], date: string) =>
  windows.some((w) => w.from <= date && date <= w.to);
