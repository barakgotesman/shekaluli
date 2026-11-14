import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Profile, WeightEntry } from '../types';
import { loadEntries, loadProfile } from './storage';
import { loadReminder } from './reminder';
import type { ReminderSettings } from './reminder';

/** Shape of the single Firestore document (`users/{uid}`) that mirrors a user's local data. */
export interface CloudDoc {
  profile: Profile | null;
  entries: WeightEntry[];
  reminder: ReminderSettings;
}

/** Whether the cloud copy matches local data: synced, a write is queued, or the last write failed. */
export type SyncStatus = 'synced' | 'pending' | 'error';

const PUSH_DELAY_MS = 1000;
const DIRTY_KEY = 'shekaluli:cloud-dirty';
const OWNER_KEY = 'shekaluli:cloud-owner';
let pushTimer: ReturnType<typeof setTimeout> | undefined;
// Bumped on every scheduled push so an older write finishing late can't mark newer edits as saved.
let pushVersion = 0;

/**
 * Whether this device has edits that were never confirmed saved to the cloud. Persisted in
 * localStorage so it survives a reload/crash: the Settings warning stays up and the edits are
 * pushed (instead of being overwritten by the cloud copy) on the next sign-in snapshot.
 * @returns true if there are unsaved local changes
 */
export function isDirty(): boolean {
  try {
    return localStorage.getItem(DIRTY_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Which account the local data belongs to (the uid of the last account that synced it), or
 * null for data created as a guest. Lets sign-in tell "my own data" from another account's.
 * @returns the owner uid, or null if the local data is guest data
 */
export function getOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

/**
 * Marks the local data as belonging to an account.
 * @param uid - the account that now owns the local data
 */
export function setOwner(uid: string): void {
  try {
    localStorage.setItem(OWNER_KEY, uid);
  } catch {
    // Without the marker a later account switch would merge instead of reset; rare enough to ignore.
  }
}

/** Records that local data has changes the cloud doesn't have yet. */
function markDirty(): void {
  try {
    localStorage.setItem(DIRTY_KEY, '1');
  } catch {
    // Quota/private-mode failure: the in-memory status still warns for this session.
  }
}

/** Records that the cloud copy now matches local data. */
function clearDirty(): void {
  try {
    localStorage.removeItem(DIRTY_KEY);
  } catch {
    // Nothing to do — a stale flag only causes one harmless extra push.
  }
}

/**
 * Builds the document to upload from whatever is currently in localStorage.
 * Round-trips through JSON because Firestore rejects `undefined` fields (e.g. an unset photo or note).
 * @returns the cloud document representing the current local state
 */
function buildCloudDoc(): CloudDoc {
  return JSON.parse(JSON.stringify({ profile: loadProfile(), entries: loadEntries(), reminder: loadReminder() }));
}

/**
 * Uploads local data to `users/{uid}` immediately (the Firestore cache queues it while offline).
 * @param uid - the signed-in user's id
 */
export async function pushNow(uid: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { ...buildCloudDoc(), updatedAt: Date.now() });
}

/**
 * Debounced upload: rapid edits (e.g. nudging the weight slider then saving) collapse into one write.
 * @param uid - the signed-in user's id
 * @param onStatus - receives 'pending' immediately, then 'synced' or 'error' when the write settles
 */
export function schedulePush(uid: string, onStatus: (s: SyncStatus) => void): void {
  markDirty();
  onStatus('pending');
  clearTimeout(pushTimer);
  const version = ++pushVersion;
  pushTimer = setTimeout(() => {
    pushNow(uid).then(
      () => {
        if (version === pushVersion) {
          clearDirty();
          onStatus('synced');
        }
      },
      (error) => {
        console.error('[sync] push failed', error);
        onStatus('error');
      },
    );
  }, PUSH_DELAY_MS);
}

/** Cancels a queued debounced upload (used on sign-out so nothing is written for the wrong user). */
export function cancelPendingPush(): void {
  clearTimeout(pushTimer);
}

/**
 * Subscribes to the user's cloud document. Snapshots caused by this device's own unconfirmed
 * writes are skipped so local edits are never overwritten by their own echo.
 * @param uid - the signed-in user's id
 * @param onDoc - called with the cloud document, or null if the user has no cloud data yet
 * @param onError - called if the listener fails (e.g. permission denied)
 * @returns an unsubscribe function
 */
export function subscribeCloudDoc(
  uid: string,
  onDoc: (data: CloudDoc | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      onDoc(snap.exists() ? (snap.data() as CloudDoc) : null);
    },
    onError,
  );
}
