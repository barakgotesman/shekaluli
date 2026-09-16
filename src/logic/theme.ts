export type Theme = 'light' | 'dark';

const THEME_KEY = 'shekaluli:theme';

/**
 * Reads the saved theme preference, defaulting to light on first run.
 * @returns 'light' or 'dark'
 */
export function loadTheme(): Theme {
  const raw = localStorage.getItem(THEME_KEY);
  if (raw === 'light' || raw === 'dark') return raw;
  return 'light';
}

/**
 * Persists the theme preference and applies it to the document root so
 * Tailwind's class-based dark variant takes effect.
 * @param theme - theme to apply
 */
export function applyTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
}
