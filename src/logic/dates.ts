/**
 * Returns today's date as an ISO string (YYYY-MM-DD), in local time.
 * @returns today's date, YYYY-MM-DD
 */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Formats an ISO date string (YYYY-MM-DD) as the Israeli dd/mm/yyyy display format.
 * Storage and sorting keep using ISO format since it sorts lexicographically correctly.
 * @param isoDate - date in YYYY-MM-DD form
 * @returns date formatted as dd/mm/yyyy
 */
export function formatDateIL(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Computes a person's age in whole years from their birth date, as of today.
 * @param birthDate - date of birth, YYYY-MM-DD
 * @returns age in whole years
 */
export function calculateAge(birthDate: string): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - year;
  const hasHadBirthdayThisYear =
    now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

const WEEKDAYS_HE_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

/**
 * Formats an ISO date string as just its day-of-month plus a short Hebrew weekday
 * letter (e.g. "14 ה׳"), for use where the month and year are already shown by
 * surrounding context (e.g. a month-grouped history list).
 * @param isoDate - date in YYYY-MM-DD form
 * @returns day of month with a short weekday label
 */
export function formatDayIL(isoDate: string): string {
  const day = Number(isoDate.slice(8, 10));
  const weekday = WEEKDAYS_HE_SHORT[new Date(isoDate).getUTCDay()];
  return `יום ${weekday}׳, ${day}`;
}
