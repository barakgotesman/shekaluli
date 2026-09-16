import type { Profile, WeightEntry } from '../types';
import { isQuotaExceededError } from './storageQuota';

const PROFILE_KEY = 'shekaluli:profile';
const ENTRIES_KEY = 'shekaluli:entries';

/**
 * Runs a localStorage write, rethrowing quota-exceeded failures as a plain Error with
 * a Hebrew message the UI can show directly, instead of a browser-specific DOMException.
 * @param write - the localStorage.setItem call to attempt
 */
function writeOrThrowFriendlyError(write: () => void): void {
  try {
    write();
  } catch (error) {
    if (isQuotaExceededError(error)) {
      throw new Error('אין מספיק מקום אחסון בדפדפן. יש לפנות מקום (למשל בגיבוי ומחיקת נתונים ישנים) ולנסות שוב.');
    }
    throw error;
  }
}

/**
 * Reads the user's profile from localStorage.
 * @returns the saved profile, or null if onboarding hasn't been completed yet
 */
export function loadProfile(): Profile | null {
  const raw = localStorage.getItem(PROFILE_KEY);
  return raw ? (JSON.parse(raw) as Profile) : null;
}

/**
 * Persists the user's profile to localStorage, overwriting any existing one.
 * @param profile - profile to save
 */
export function saveProfile(profile: Profile): void {
  writeOrThrowFriendlyError(() => localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)));
}

/**
 * Reads all weight entries from localStorage, sorted ascending by date.
 * @returns list of weight entries (empty if none saved yet)
 */
export function loadEntries(): WeightEntry[] {
  const raw = localStorage.getItem(ENTRIES_KEY);
  const entries = raw ? (JSON.parse(raw) as WeightEntry[]) : [];
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Overwrites the full list of weight entries in localStorage.
 * @param entries - complete list of entries to save
 */
export function saveEntries(entries: WeightEntry[]): void {
  writeOrThrowFriendlyError(() => localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries)));
}

/**
 * Adds or replaces the entry for a given date (one entry per day) and persists the result.
 * @param entry - entry to insert or update
 * @returns the full, updated, date-sorted list of entries
 */
export function upsertEntry(entry: WeightEntry): WeightEntry[] {
  const entries = loadEntries().filter((e) => e.date !== entry.date);
  entries.push(entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  saveEntries(entries);
  return entries;
}

/**
 * Merges imported entries into the existing saved list (upsert by date, so an imported
 * entry overwrites any existing entry for the same day) and persists the result.
 * @param imported - entries parsed from an imported file
 * @returns the full, updated, date-sorted list of entries
 */
export function importEntries(imported: WeightEntry[]): WeightEntry[] {
  const byDate = new Map(loadEntries().map((e) => [e.date, e]));
  for (const entry of imported) {
    byDate.set(entry.date, entry);
  }
  const entries = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  saveEntries(entries);
  return entries;
}

/**
 * Removes the entry for a given date and persists the result.
 * @param date - date (YYYY-MM-DD) of the entry to remove
 * @returns the full, updated list of entries
 */
export function deleteEntry(date: string): WeightEntry[] {
  const entries = loadEntries().filter((e) => e.date !== date);
  saveEntries(entries);
  return entries;
}
