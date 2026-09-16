export interface StorageUsage {
  usedBytes: number;
  limitBytes: number;
  percent: number;
}

/**
 * Assumed per-origin localStorage quota. Browsers don't expose a real API for this
 * (navigator.storage.estimate only covers IndexedDB/Cache Storage, not localStorage),
 * but 5MB is the de-facto limit shared by Chrome, Firefox, Safari, and Edge.
 */
const ASSUMED_LIMIT_BYTES = 5 * 1024 * 1024;

/** Usage percentage at or above which the UI should warn the user they're near the limit. */
export const STORAGE_WARNING_THRESHOLD_PERCENT = 80;

/**
 * Estimates how much of the assumed localStorage quota this origin has used, by
 * summing the byte size (UTF-8, via Blob) of every key and value currently stored.
 * @returns bytes used, the assumed limit, and the usage percentage (0-100)
 */
export function getStorageUsage(): StorageUsage {
  let usedBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const value = localStorage.getItem(key) ?? '';
    usedBytes += new Blob([key + value]).size;
  }
  return {
    usedBytes,
    limitBytes: ASSUMED_LIMIT_BYTES,
    percent: Math.min(100, (usedBytes / ASSUMED_LIMIT_BYTES) * 100),
  };
}

/**
 * Detects whether a caught error is a localStorage quota-exceeded failure, across
 * browsers' differing DOMException names/codes for this condition.
 * @param error - value caught from a localStorage.setItem call
 */
export function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22)
  );
}
