import type { WeightEntry } from '../types';

export interface PeriodChange {
  /** percentage change over the period; positive = gained weight, negative = lost weight */
  percent: number;
  /** absolute weight difference in kg, latest minus baseline */
  deltaKg: number;
  /** whether a baseline entry within the period was actually found */
  hasData: boolean;
}

/**
 * Finds the entry closest to (on or before) a target date, used as the baseline
 * for a "change over the last N days" calculation.
 * @param entries - date-sorted (ascending) weight entries
 * @param targetDate - date to search backward from (YYYY-MM-DD)
 * @returns the closest entry on or before targetDate, or undefined if none exists
 */
function findClosestOnOrBefore(entries: WeightEntry[], targetDate: string): WeightEntry | undefined {
  let candidate: WeightEntry | undefined;
  for (const entry of entries) {
    if (entry.date <= targetDate) {
      candidate = entry;
    } else {
      break;
    }
  }
  return candidate;
}

/**
 * Computes the weight change between the latest entry and the entry closest to
 * `daysAgo` days before it.
 * @param entries - date-sorted (ascending) weight entries
 * @param daysAgo - length of the look-back window in days
 * @returns percent/absolute change, or hasData: false if there isn't enough history
 */
export function computePeriodChange(entries: WeightEntry[], daysAgo: number): PeriodChange {
  if (entries.length === 0) return { percent: 0, deltaKg: 0, hasData: false };

  const latest = entries[entries.length - 1];
  const latestDate = new Date(latest.date);
  const baselineDate = new Date(latestDate);
  baselineDate.setDate(baselineDate.getDate() - daysAgo);
  const baselineDateStr = baselineDate.toISOString().slice(0, 10);

  const baseline = findClosestOnOrBefore(entries, baselineDateStr);
  if (!baseline || baseline.date === latest.date) {
    return { percent: 0, deltaKg: 0, hasData: false };
  }

  const deltaKg = latest.weightKg - baseline.weightKg;
  const percent = (deltaKg / baseline.weightKg) * 100;
  return { percent, deltaKg, hasData: true };
}

/**
 * Computes progress toward the goal weight as a 0-100 percentage of the distance
 * already covered from the starting weight, clamped so overshooting or not-yet-started
 * cases don't produce an out-of-range bar.
 * @param currentWeightKg - most recent logged weight
 * @param startWeightKg - weight at the start of tracking, from the profile
 * @param goalWeightKg - target weight, from the profile
 * @returns percentage (0-100), or 0 if start and goal weight are equal
 */
export function goalProgressPercent(currentWeightKg: number, startWeightKg: number, goalWeightKg: number): number {
  const goalDelta = goalWeightKg - startWeightKg;
  if (goalDelta === 0) return 0;
  const totalDelta = currentWeightKg - startWeightKg;
  return Math.min(100, Math.max(0, (totalDelta / goalDelta) * 100));
}

/**
 * Finds the entry with the lowest logged weight.
 * @param entries - weight entries (any order)
 * @returns the lightest entry, or undefined if the list is empty
 */
export function lowestEntry(entries: WeightEntry[]): WeightEntry | undefined {
  return entries.reduce<WeightEntry | undefined>(
    (min, e) => (!min || e.weightKg < min.weightKg ? e : min),
    undefined,
  );
}

/**
 * Finds the entry with the highest logged weight.
 * @param entries - weight entries (any order)
 * @returns the heaviest entry, or undefined if the list is empty
 */
export function highestEntry(entries: WeightEntry[]): WeightEntry | undefined {
  return entries.reduce<WeightEntry | undefined>(
    (max, e) => (!max || e.weightKg > max.weightKg ? e : max),
    undefined,
  );
}

/**
 * Computes the average number of weigh-ins per week across the full logged history.
 * @param entries - date-sorted (ascending) weight entries
 * @returns average weigh-ins per week, or 0 if there's under a day of history
 */
export function averageWeighInsPerWeek(entries: WeightEntry[]): number {
  if (entries.length < 2) return 0;
  const first = new Date(entries[0].date);
  const last = new Date(entries[entries.length - 1].date);
  const days = Math.max(1, (last.getTime() - first.getTime()) / 86_400_000);
  return (entries.length / days) * 7;
}

/**
 * Estimates the number of weeks until the goal weight is reached, based on the
 * recent (last 30 days, or full history if shorter) rate of weight change.
 * @param entries - date-sorted (ascending) weight entries
 * @param goalWeightKg - target weight from the user's profile
 * @returns estimated weeks to goal, or null if there's not enough data or the
 *   recent trend isn't moving toward the goal
 */
export function estimateWeeksToGoal(entries: WeightEntry[], goalWeightKg: number): number | null {
  if (entries.length < 2) return null;

  const latest = entries[entries.length - 1];
  const latestDate = new Date(latest.date);
  const windowStart = new Date(latestDate);
  windowStart.setDate(windowStart.getDate() - 30);
  const windowStartStr = windowStart.toISOString().slice(0, 10);

  const baseline = entries.find((e) => e.date >= windowStartStr) ?? entries[0];
  if (baseline.date === latest.date) return null;

  const days = (latestDate.getTime() - new Date(baseline.date).getTime()) / 86_400_000;
  if (days <= 0) return null;

  const dailyRate = (latest.weightKg - baseline.weightKg) / days;
  const remaining = goalWeightKg - latest.weightKg;

  // No ETA if already at goal, or the recent trend isn't heading toward it.
  if (Math.abs(remaining) < 0.05) return null;
  if (dailyRate === 0 || Math.sign(dailyRate) !== Math.sign(remaining)) return null;

  return Math.abs(remaining / (dailyRate * 7));
}
