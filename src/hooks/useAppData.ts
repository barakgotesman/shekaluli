import { useEffect, useRef, useState } from 'react';
import type { Profile, WeightEntry } from '../types';
import {
  deleteEntry as deleteEntryFromStorage,
  importEntries as importEntriesToStorage,
  loadEntries,
  loadProfile,
  saveEntries,
  saveProfile as saveProfileToStorage,
  upsertEntry,
} from '../logic/storage';
import { applyTheme, loadTheme } from '../logic/theme';
import type { Theme } from '../logic/theme';
import {
  DEFAULT_REMINDER,
  getNotificationPermission,
  isReminderDue,
  loadReminder,
  requestNotificationPermission,
  saveReminder,
  showReminderNotification,
  wasNotifiedToday,
} from '../logic/reminder';
import type { ReminderSettings } from '../logic/reminder';
import { cancelPendingPush, pushNow, schedulePush, subscribeCloudDoc } from '../logic/cloudSync';
import type { SyncStatus } from '../logic/cloudSync';
import { exportEntriesAsCsv, parseCsvToEntries, readFileAsText } from '../logic/dataTransfer';

/**
 * Owns the app's persisted state (profile, weight entries, theme) and every operation
 * that reads or writes it, so pages never talk to `logic/storage.ts` or
 * `logic/dataTransfer.ts` directly — they only call the functions this hook returns.
 * Loads persisted state once on mount (localStorage reads are synchronous, so no
 * loading state is needed) and keeps React state in sync with each mutation.
 * When `uid` is set (user signed in), localStorage is mirrored to Firestore: local edits are
 * pushed (debounced) and remote changes are applied to localStorage + state. On the first
 * snapshot after sign-in, entries from this device are merged with the cloud's (cloud wins
 * on the same date) so a guest who signs in never loses local weigh-ins; a brand-new cloud
 * account is seeded from local data. Signed out, it is purely local (guest mode).
 * @param uid - the signed-in user's id, or null in guest mode
 */
export function useAppData(uid: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [theme, setTheme] = useState<Theme>('light');
  const [reminder, setReminder] = useState<ReminderSettings>(DEFAULT_REMINDER);
  const [reminderDue, setReminderDue] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  // True once the first cloud snapshot arrived for the current sign-in; lets App avoid flashing onboarding to a returning user on a fresh device.
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const prevUid = useRef<string | null>(null);
  // The first snapshot of a sign-in merges local + cloud; later ones (other devices' edits) replace local so remote deletions propagate.
  const firstSnapshot = useRef(true);

  useEffect(() => {
    setProfile(loadProfile());
    setEntries(loadEntries());
    const t = loadTheme();
    setTheme(t);
    applyTheme(t);
    setReminder(loadReminder());
  }, []);

  // Cloud sync lifecycle: subscribe while signed in; reset in-memory state on sign-out.
  useEffect(() => {
    if (!uid) {
      cancelPendingPush();
      setCloudLoaded(false);
      // Only reset on a real sign-out (uid -> null), not on the initial null while auth is still restoring the session.
      if (prevUid.current) {
        setProfile(null);
        setEntries([]);
        setReminder(DEFAULT_REMINDER);
      }
      prevUid.current = null;
      return;
    }
    prevUid.current = uid;
    firstSnapshot.current = true;
    return subscribeCloudDoc(
      uid,
      (cloud) => {
        setCloudLoaded(true);
        if (!cloud) {
          // New cloud account: upload whatever this device already has (may be nothing).
          if (loadProfile() || loadEntries().length > 0) {
            pushNow(uid).then(
              () => setSyncStatus('synced'),
              (error) => {
                console.error('[sync] initial push failed', error);
                setSyncStatus('error');
              },
            );
          }
          return;
        }
        const cloudEntries = cloud.entries ?? [];
        let needsPush = false;
        try {
          let merged = cloudEntries;
          if (firstSnapshot.current) {
            const byDate = new Map(loadEntries().map((e) => [e.date, e]));
            for (const e of cloudEntries) byDate.set(e.date, e);
            merged = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
            needsPush = merged.length > cloudEntries.length || (!cloud.profile && !!loadProfile());
          }
          if (cloud.profile) saveProfileToStorage(cloud.profile);
          saveEntries(merged);
          if (cloud.reminder) saveReminder(cloud.reminder);
        } catch (error) {
          alert(error instanceof Error ? error.message : String(error));
        }
        firstSnapshot.current = false;
        if (needsPush) schedulePush(uid, setSyncStatus);
        setProfile(cloud.profile ?? loadProfile());
        setEntries(loadEntries());
        setReminder(loadReminder());
        setSyncStatus('synced');
      },
      (error) => {
        console.error('[sync] cloud listener failed', error);
        setSyncStatus('error');
        setCloudLoaded(true);
      },
    );
  }, [uid]);

  /** Queues an upload of the current local data to the cloud (no-op while signed out). */
  function sync() {
    if (uid) schedulePush(uid, setSyncStatus);
  }

  // Re-evaluate on open, on returning to the app, and every minute while it stays open
  // (there's no background scheduler, so reminders only fire while the app is running).
  useEffect(() => {
    /** Recomputes whether the reminder is due and sends today's notification once. */
    function check() {
      const due = isReminderDue(reminder, entries);
      setReminderDue(due);
      if (due && !wasNotifiedToday()) void showReminderNotification();
    }
    check();
    const interval = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, [reminder, entries]);

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
    sync();
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
      sync();
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
  }

  /** Removes a weight entry by date and refreshes state from storage. */
  function deleteEntry(date: string) {
    setEntries(deleteEntryFromStorage(date));
    sync();
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
      sync();
      alert(`יובאו ${parsed.length} רשומות בהצלחה.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
  }

  /** Downloads all weight entries as a CSV file. */
  function exportEntries() {
    exportEntriesAsCsv(entries);
  }

  /** Switches the active theme, persisting it and updating the document root class. */
  function changeTheme(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }

  /**
   * Updates and persists the reminder settings. Turning the reminder on asks for
   * notification permission (once); a refusal still leaves the in-app banner working.
   */
  async function changeReminder(next: ReminderSettings) {
    setReminder(next);
    try {
      saveReminder(next);
      sync();
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
    if (next.enabled) setNotificationPermission(await requestNotificationPermission());
  }

  return {
    profile,
    entries,
    theme,
    reminder,
    reminderDue,
    notificationPermission,
    syncStatus,
    cloudLoaded,
    saveProfile,
    addWeight,
    deleteEntry,
    importEntries,
    exportEntries,
    changeTheme,
    changeReminder,
  };
}
