import type { WeightEntry } from '../types';
import { nowMinutes, today } from './dates';
import { writeOrThrowFriendlyError } from './storage';

const REMINDER_KEY = 'shekaluli:reminder';
const LAST_NOTIFIED_KEY = 'shekaluli:reminder-last-notified';

/** User's daily weigh-in reminder preferences. `time` is local 24h "HH:MM". */
export interface ReminderSettings {
  enabled: boolean;
  time: string;
}

/** Off by default so nobody gets a notification prompt or banner they didn't ask for. */
export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, time: '07:30' };

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Reads the reminder settings from localStorage, tolerating missing or corrupt data.
 * @returns the saved settings, or the defaults if none/invalid
 */
export function loadReminder(): ReminderSettings {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    if (!raw) return DEFAULT_REMINDER;
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    return {
      enabled: parsed.enabled === true,
      time: typeof parsed.time === 'string' && TIME_PATTERN.test(parsed.time) ? parsed.time : DEFAULT_REMINDER.time,
    };
  } catch {
    return DEFAULT_REMINDER;
  }
}

/**
 * Persists the reminder settings.
 * @param settings - settings to save
 */
export function saveReminder(settings: ReminderSettings): void {
  writeOrThrowFriendlyError(() => localStorage.setItem(REMINDER_KEY, JSON.stringify(settings)));
}

/**
 * Converts an "HH:MM" string to minutes since midnight.
 * @param time - local time, HH:MM
 * @returns minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Decides whether the reminder should currently be showing: it is enabled, the chosen
 * time of day has been reached, and nothing has been logged for today yet.
 * @param settings - reminder preferences
 * @param entries - all weight entries
 * @param nowMin - minutes since local midnight (defaults to the current time)
 * @param todayIso - today's local date, YYYY-MM-DD (defaults to the current date)
 * @returns true if the user should be reminded right now
 */
export function isReminderDue(
  settings: ReminderSettings,
  entries: WeightEntry[],
  nowMin: number = nowMinutes(),
  todayIso: string = today(),
): boolean {
  if (!settings.enabled) return false;
  if (nowMin < timeToMinutes(settings.time)) return false;
  return !entries.some((e) => e.date === todayIso);
}

/**
 * Whether a system notification was already shown today (so we notify at most once a day).
 * @returns true if today's notification was already sent
 */
export function wasNotifiedToday(): boolean {
  try {
    return localStorage.getItem(LAST_NOTIFIED_KEY) === today();
  } catch {
    return false;
  }
}

/** Records that today's notification has been shown. Failures are ignored (best effort). */
function markNotifiedToday(): void {
  try {
    localStorage.setItem(LAST_NOTIFIED_KEY, today());
  } catch {
    // Worst case the user gets a second notification; not worth surfacing an error.
  }
}

/**
 * Shows the "time to weigh in" system notification if the user granted permission.
 * Prefers the service worker registration (required for notifications on Android PWAs),
 * falling back to the page-level Notification constructor.
 */
export async function showReminderNotification(): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const title = 'שקלולי';
  const options: NotificationOptions = {
    body: 'הגיע הזמן להתשקל ולתעד את המשקל של היום',
    icon: '/pwa-192.png',
    tag: 'daily-weigh-in',
  };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
    markNotifiedToday();
  } catch {
    // Notification APIs can throw on unsupported platforms; the in-app banner still works.
  }
}

/**
 * Asks the browser for notification permission, if it hasn't been decided yet.
 * @returns the resulting permission, or 'unsupported' where the API doesn't exist
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Reads the current notification permission without prompting.
 * @returns the permission state, or 'unsupported' where the API doesn't exist
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}
