import { useEffect, useState } from 'react';
import type { Profile, WeightEntry } from '../types';
import {
  deleteEntry as deleteEntryFromStorage,
  importEntries as importEntriesToStorage,
  loadEntries,
  loadProfile,
  saveProfile as saveProfileToStorage,
  upsertEntry,
} from '../logic/storage';
import { applyTheme, loadTheme } from '../logic/theme';
import type { Theme } from '../logic/theme';
import { exportEntriesAsCsv, exportEntriesAsXls, parseCsvToEntries, readFileAsText } from '../logic/dataTransfer';

export type ExportFormat = 'csv' | 'xls';

/**
 * Owns the app's persisted state (profile, weight entries, theme) and every operation
 * that reads or writes it, so pages never talk to `logic/storage.ts` or
 * `logic/dataTransfer.ts` directly — they only call the functions this hook returns.
 * Loads persisted state once on mount (localStorage reads are synchronous, so no
 * loading state is needed) and keeps React state in sync with each mutation.
 */
export function useAppData() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setProfile(loadProfile());
    setEntries(loadEntries());
    const t = loadTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  /**
   * Persists the profile.
   * @returns true if the save succeeded, false if it failed (and was already alerted)
   */
  function saveProfile(p: Profile): boolean {
    try {
      saveProfileToStorage(p);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
      return false;
    }
    setProfile(p);
    return true;
  }

  /**
   * Adds or updates a weight entry for a given date and refreshes state from storage.
   * If this replaces an existing entry whose date changed (editing), pass its original
   * date as `previousDate` so it gets removed first and the edit doesn't leave a
   * duplicate entry behind.
   */
  function addWeight(date: string, weightKg: number, note: string, previousDate?: string) {
    if (previousDate && previousDate !== date) {
      deleteEntryFromStorage(previousDate);
    }
    try {
      setEntries(upsertEntry({ date, weightKg, note: note || undefined }));
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
  }

  /** Removes a weight entry by date and refreshes state from storage. */
  function deleteEntry(date: string) {
    setEntries(deleteEntryFromStorage(date));
  }

  /**
   * Reads a CSV file, merges its entries into storage (overwriting any existing entry
   * for the same date), and reports how many entries were imported.
   */
  async function importEntries(file: File) {
    const text = await readFileAsText(file);
    const parsed = parseCsvToEntries(text);
    if (parsed.length === 0) {
      alert('לא נמצאו רשומות תקינות בקובץ שנבחר.');
      return;
    }
    try {
      setEntries(importEntriesToStorage(parsed));
      alert(`יובאו ${parsed.length} רשומות בהצלחה.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
  }

  /** Downloads all weight entries in the given format. */
  function exportEntries(format: ExportFormat) {
    if (format === 'csv') exportEntriesAsCsv(entries);
    else exportEntriesAsXls(entries);
  }

  /** Switches the active theme, persisting it and updating the document root class. */
  function changeTheme(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }

  return { profile, entries, theme, saveProfile, addWeight, deleteEntry, importEntries, exportEntries, changeTheme };
}
