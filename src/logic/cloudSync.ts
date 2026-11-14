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
let pushTimer: ReturnType<typeof setTimeout> | undefined;

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
  onStatus('pending');
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushNow(uid).then(
      () => onStatus('synced'),
      () => onStatus('error'),
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
