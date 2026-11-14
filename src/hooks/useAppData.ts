import { useEffect, useRef, useState } from 'react';
import type { Profile, WeightEntry } from '../types';
import {
  clearLocalData,
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
import { cancelPendingPush, getOwner, isDirty, pushNow, schedulePush, setOwner, subscribeCloudDoc } from '../logic/cloudSync';
import type { CloudDoc, SyncStatus } from '../logic/cloudSync';
import { exportEntriesAsCsv, parseCsvToEntries, readFileAsText } from '../logic/dataTransfer';

/** What a guest who signs in must choose between when their profile differs from the account's. */
export interface SyncConflict {
  device: { profile: Profile; entryCount: number };
  account: { profile: Profile; entryCount: number };
}

/**
 * Whether two profiles describe the same person/goals (the photo is ignored: it is large and
 * re-encoded on every upload, so comparing it would flag false conflicts).
 * @param a - first profile
 * @param b - second profile
 * @returns true if all identifying and goal fields match
 */
function sameProfile(a: Profile, b: Profile): boolean {
  return (
    a.name === b.name &&
    a.gender === b.gender &&
    a.birthDate === b.birthDate &&
    a.heightCm === b.heightCm &&
    a.startWeightKg === b.startWeightKg &&
    a.goalWeightKg === b.goalWeightKg
  );
}

/**
 * Owns the app's persisted state (profile, weight entries, theme) and every operation
 * that reads or writes it, so pages never talk to `logic/storage.ts` or
 * `logic/dataTransfer.ts` directly — they only call the functions this hook returns.
 * Loads persisted state once on mount (localStorage reads are synchronous, so no
 * loading state is needed) and keeps React state in sync with each mutation.
 * When `uid` is set (user signed in), localStorage is mirrored to Firestore: local edits are
 * pushed (debounced) and remote changes are applied to localStorage + state. On the first
 * snapshot after sign-in, entries from this device are merged with the cloud's so a guest who
 * signs in never loses local weigh-ins; a brand-new cloud account is seeded from local data.
 * If a guest's profile differs from the account's, `conflict` is set and sync waits until the
 * user picks a side via `resolveConflict`. Signed out, it is purely local (guest mode).
 * @param uid - the signed-in user's id, or null in guest mode
 */
export function useAppData(uid: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [theme, setTheme] = useState<Theme>('light');
  const [reminder, setReminder] = useState<ReminderSettings>(DEFAULT_REMINDER);
  const [reminderDue, setReminderDue] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => (isDirty() ? 'pending' : 'synced'));
  // True once the first cloud snapshot arrived for the current sign-in; lets App avoid flashing onboarding to a returning user on a fresh device.
  const [cloudLoaded, setCloudLoaded] = useState(false);
  // The first snapshot of a sign-in merges local + cloud; later ones (other devices' edits) replace local so remote deletions propagate.
  const firstSnapshot = useRef(true);
  // Guest data (no account owner) meeting an existing account may need the user to choose which profile to keep.
  const wasGuest = useRef(false);
  const pendingCloud = useRef<CloudDoc | null>(null);
  const [conflict, setConflict] = useState<SyncConflict | null>(null);

  useEffect(() => {
    setProfile(loadProfile());
    setEntries(loadEntries());
    const t = loadTheme();
    setTheme(t);
    applyTheme(t);
    setReminder(loadReminder());
  }, []);

  // Cloud sync lifecycle: subscribe while signed in. Signing out only stops syncing — the
  // local data stays so the user continues as a guest without redoing onboarding.
  useEffect(() => {
    if (!uid) {
      cancelPendingPush();
      setCloudLoaded(false);
      pendingCloud.current = null;
      setConflict(null);
      return;
    }
    // Local data left by a *different* account must never be merged into this one: start clean
    // and let the cloud (or onboarding) provide this account's profile. Guest data (no owner)
    // and this account's own data are kept and synced.
    const owner = getOwner();
    if (owner && owner !== uid) {
      clearLocalData();
      setProfile(null);
      setEntries([]);
      setReminder(DEFAULT_REMINDER);
    }
    wasGuest.current = !owner;
    pendingCloud.current = null;
    setOwner(uid);
    firstSnapshot.current = true;
    return subscribeCloudDoc(
      uid,
      (cloud) => {
        setCloudLoaded(true);
        // Unsaved local edits are newer than anything the cloud has: keep them and push, never overwrite them.
        if (isDirty()) {
          if (firstSnapshot.current) schedulePush(uid, setSyncStatus);
          firstSnapshot.current = false;
          return;
        }
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
        // Waiting for the user's choice: just remember the latest cloud copy.
        if (pendingCloud.current) {
          pendingCloud.current = cloud;
          return;
        }
        // A guest signing into an account with a *different* profile must choose which to keep.
        const localProfile = loadProfile();
        if (firstSnapshot.current && wasGuest.current && cloud.profile && localProfile && !sameProfile(localProfile, cloud.profile)) {
          pendingCloud.current = cloud;
          setConflict({
            device: { profile: localProfile, entryCount: loadEntries().length },
            account: { profile: cloud.profile, entryCount: (cloud.entries ?? []).length },
          });
          return;
        }
        applyCloud(uid, cloud, 'account');
      },
      (error) => {
        console.error('[sync] cloud listener failed', error);
        setSyncStatus('error');
        setCloudLoaded(true);
      },
    );
  }, [uid]);

  /**
   * Applies a cloud snapshot to localStorage + state. On the first snapshot after sign-in the
   * entries are merged by date (so nothing a guest logged is lost); `winner` decides who keeps
   * the profile/reminder and who wins a same-date clash. Later snapshots replace local data.
   * @param cloudUid - the signed-in user's id (used to push the merged result back)
   * @param cloud - the cloud document to apply
   * @param winner - 'account' = the cloud's values win, 'device' = this device's values win
   */
  function applyCloud(cloudUid: string, cloud: CloudDoc, winner: 'account' | 'device') {
    const cloudEntries = cloud.entries ?? [];
    let needsPush = false;
    try {
      let merged = cloudEntries;
      if (firstSnapshot.current) {
        const byDate = new Map(loadEntries().map((e) => [e.date, e]));
        for (const e of cloudEntries) {
          if (winner === 'account' || !byDate.has(e.date)) byDate.set(e.date, e);
        }
        merged = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
        needsPush = winner === 'device' || merged.length > cloudEntries.length || (!cloud.profile && !!loadProfile());
      }
      if (winner === 'account') {
        if (cloud.profile) saveProfileToStorage(cloud.profile);
        if (cloud.reminder) saveReminder(cloud.reminder);
      }
      saveEntries(merged);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
    firstSnapshot.current = false;
    if (needsPush) schedulePush(cloudUid, setSyncStatus);
    else setSyncStatus('synced');
    setProfile(loadProfile());
    setEntries(loadEntries());
    setReminder(loadReminder());
  }

  /**
   * Resolves the guest-vs-account profile conflict and continues the first sync.
   * @param choice - 'device' keeps this device's profile (and uploads it), 'account' uses the account's
   */
  function resolveConflict(choice: 'device' | 'account') {
    const cloud = pendingCloud.current;
    if (!uid || !cloud) return;
    pendingCloud.current = null;
    setConflict(null);
    applyCloud(uid, cloud, choice);
  }

  /** Queues an upload of the current local data to the cloud (no-op while signed out). */
  function sync() {
    if (uid) schedulePush(uid, setSyncStatus);
  }

  /** Retries uploading unsaved changes right away (shown as a button when a sync failed). */
  function retrySync() {
    sync();
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
    retrySync,
    conflict,
    resolveConflict,
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
