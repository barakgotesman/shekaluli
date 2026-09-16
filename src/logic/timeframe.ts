import type { WeightEntry } from '../types';

export type Timeframe = 'week' | 'month' | '3m' | 'year' | 'all';

export const TIMEFRAMES: { key: Timeframe; label: string; days: number | null }[] = [
  { key: 'week', label: 'שבוע', days: 7 },
  { key: 'month', label: 'חודש', days: 30 },
  { key: '3m', label: '3 חודשים', days: 90 },
  { key: 'year', label: 'שנה', days: 365 },
  { key: 'all', label: 'הכל', days: null },
];

/**
 * Keeps only entries within `days` of the latest entry's date, or all entries when days is null.
 * @param entries - date-sorted (ascending) weight entries
 * @param days - length of the look-back window, or null to keep everything
 */
export function filterEntriesByTimeframe(entries: WeightEntry[], days: number | null): WeightEntry[] {
  if (days === null || entries.length === 0) return entries;
  const latestDate = new Date(entries[entries.length - 1].date);
  const cutoff = new Date(latestDate);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return entries.filter((e) => e.date >= cutoffStr);
}
