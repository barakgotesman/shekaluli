import type { Profile, WeightEntry } from '../types';
import { computePeriodChange, goalProgressPercent } from './stats';
import { today } from './dates';
import { esc, renderHtmlToCanvas } from './htmlToCanvas';

/** Public address printed on the card and included in the share text. */
export const SHARE_URL = 'https://shekaluli.vercel.app';

/** Look-back window for the card: a number of days, or the whole history. */
export type SharePeriod = 15 | 30 | 90 | 'all';

/** Period choices offered in the share modal, in display order. */
export const SHARE_PERIODS: { value: SharePeriod; label: string }[] = [
  { value: 15, label: '15 ימים' },
  { value: 30, label: 'חודש' },
  { value: 90, label: '3 חודשים' },
  { value: 'all', label: 'הכול' },
];

/** Identifier of a card background style. */
export type ShareStyleId = 'sunset' | 'ocean' | 'mint' | 'night' | 'light';

/** Colors that make up one card style. All values are hard-coded so cards ignore the app theme. */
interface ShareStyle {
  id: ShareStyleId;
  label: string;
  /** CSS background for the whole card (also used for the picker swatch) */
  bg: string;
  /** solid color behind the gradient, used as the canvas fill */
  canvasBg: string;
  /** brand name and footer text, drawn directly on the background */
  onBg: string;
  panel: string;
  panelShadow: string;
  eyebrow: string;
  num: string;
  text: string;
  chipBg: string;
  chipText: string;
  track: string;
  fill: string;
}

/** Card background styles offered in the share modal, in display order. */
export const SHARE_STYLES: ShareStyle[] = [
  {
    id: 'sunset', label: 'שקיעה',
    bg: 'linear-gradient(160deg, #ff5a1f 0%, #ff8a3d 55%, #fea619 100%)', canvasBg: '#ff5a1f', onBg: '#ffffff',
    panel: '#fff8f5', panelShadow: 'rgba(120, 40, 0, 0.25)', eyebrow: '#855300', num: '#ae3200', text: '#5b4038',
    chipBg: '#d7f0e2', chipText: '#006c49', track: '#efe0d9', fill: 'linear-gradient(90deg, #fea619, #ff5a1f)',
  },
  {
    id: 'ocean', label: 'ים',
    bg: 'linear-gradient(160deg, #0b6fa4 0%, #1aa3c8 55%, #5ad1c9 100%)', canvasBg: '#0b6fa4', onBg: '#ffffff',
    panel: '#f2fbfd', panelShadow: 'rgba(0, 50, 80, 0.3)', eyebrow: '#0b5d7a', num: '#0a5a86', text: '#33505c',
    chipBg: '#d3f4ec', chipText: '#00695c', track: '#d9eaf0', fill: 'linear-gradient(90deg, #5ad1c9, #0b6fa4)',
  },
  {
    id: 'mint', label: 'נענע',
    bg: 'linear-gradient(160deg, #00a673 0%, #3cc48e 55%, #a6e36b 100%)', canvasBg: '#00a673', onBg: '#ffffff',
    panel: '#f4fdf8', panelShadow: 'rgba(0, 70, 40, 0.28)', eyebrow: '#4a6b12', num: '#006c49', text: '#3b5148',
    chipBg: '#fff0c9', chipText: '#855300', track: '#dcefe4', fill: 'linear-gradient(90deg, #a6e36b, #00a673)',
  },
  {
    id: 'night', label: 'לילה',
    bg: 'linear-gradient(160deg, #1b1340 0%, #3a1f7a 55%, #863bff 100%)', canvasBg: '#1b1340', onBg: '#ffffff',
    panel: '#241a4d', panelShadow: 'rgba(0, 0, 0, 0.4)', eyebrow: '#ffc47a', num: '#ffffff', text: '#cfc6f0',
    chipBg: '#3a2b73', chipText: '#9ef0c9', track: '#3a2f6b', fill: 'linear-gradient(90deg, #47bfff, #863bff)',
  },
  {
    id: 'light', label: 'בהיר',
    bg: '#fff8f5', canvasBg: '#fff8f5', onBg: '#5b4038',
    panel: '#ffffff', panelShadow: 'rgba(120, 40, 0, 0.12)', eyebrow: '#855300', num: '#ae3200', text: '#5b4038',
    chipBg: '#d7f0e2', chipText: '#006c49', track: '#efe0d9', fill: 'linear-gradient(90deg, #fea619, #ff5a1f)',
  },
];

const STYLE_KEY = 'shekaluli:share-style';

/**
 * Looks up a style by id, falling back to the first one.
 * @param id - style identifier
 * @returns the matching style definition
 */
function getShareStyle(id: ShareStyleId): ShareStyle {
  return SHARE_STYLES.find((st) => st.id === id) ?? SHARE_STYLES[0];
}

/**
 * Reads the user's last chosen card style from localStorage.
 * @returns the saved style id, or 'sunset' if none/invalid
 */
export function loadShareStyle(): ShareStyleId {
  try {
    const raw = localStorage.getItem(STYLE_KEY);
    return SHARE_STYLES.some((st) => st.id === raw) ? (raw as ShareStyleId) : 'sunset';
  } catch {
    return 'sunset';
  }
}

/**
 * Remembers the chosen card style for next time (best effort; failures are ignored).
 * @param id - style to remember
 */
export function saveShareStyle(id: ShareStyleId): void {
  try {
    localStorage.setItem(STYLE_KEY, id);
  } catch {
    // Not remembering the preference isn't worth surfacing an error.
  }
}

/**
 * Relative-only numbers shown on the card. Deliberately contains no absolute weight or
 * BMI, so sharing it never exposes anything sensitive.
 */
export interface ShareStats {
  /** signed change in kg over the period; negative = weight lost */
  deltaKg: number;
  /** signed change as a percentage of the baseline weight */
  percent: number;
  /** length of the period in days */
  days: number;
  /** number of weigh-ins inside the period */
  weighIns: number;
  /** 0-100 progress from the starting weight toward the goal */
  goalPercent: number;
}

/**
 * Whole days between two ISO dates.
 * @param from - earlier date, YYYY-MM-DD
 * @param to - later date, YYYY-MM-DD
 * @returns number of days from `from` to `to`
 */
function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
}

/**
 * Computes the numbers for a share card.
 * @param entries - all weight entries, any order
 * @param profile - user profile (start and goal weight)
 * @param period - look-back window
 * @returns the card's stats, or null when there isn't enough history to say anything
 */
export function getShareStats(entries: WeightEntry[], profile: Profile, period: SharePeriod): ShareStats | null {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;
  const latest = sorted[sorted.length - 1];
  const goalPercent = goalProgressPercent(latest.weightKg, profile.startWeightKg, profile.goalWeightKg);

  if (period === 'all') {
    // Same convention as the coach report: change measured from the profile's start weight.
    const deltaKg = latest.weightKg - profile.startWeightKg;
    const days = daysBetween(sorted[0].date, latest.date);
    if (days <= 0) return null;
    return {
      deltaKg,
      percent: (deltaKg / profile.startWeightKg) * 100,
      days,
      weighIns: sorted.length,
      goalPercent,
    };
  }

  const change = computePeriodChange(sorted, period);
  if (!change.hasData) return null;
  const windowStart = new Date(latest.date);
  windowStart.setDate(windowStart.getDate() - period);
  const startIso = windowStart.toISOString().slice(0, 10);
  return {
    deltaKg: change.deltaKg,
    percent: change.percent,
    days: period,
    weighIns: sorted.filter((e) => e.date >= startIso).length,
    goalPercent,
  };
}

/**
 * Builds the card's markup: a 540x675 (4:5) RTL fragment with hard-coded brand colors so
 * it looks the same regardless of the app's light/dark theme.
 * @param stats - numbers to show
 * @param logoSrc - image URL for the logo (a PNG data URL, see loadLogoPng)
 * @param style - background/color style
 * @returns HTML string to render off-screen and rasterize
 */
function buildShareCardHtml(stats: ShareStats, logoSrc: string, style: ShareStyle): string {
  // Anything under 50g is treated as "no change": showing "lost 0.0 kg" would look broken.
  const lost = stats.deltaKg < -0.05;
  const kg = Math.abs(stats.deltaKg).toFixed(1);

  const hero = lost
    ? `<div class="sc-eyebrow">ירדתי</div>
       <div class="sc-big"><span class="sc-num">${esc(kg)}</span><span class="sc-unit">ק״ג</span></div>
       <div class="sc-sub">ב-${esc(stats.days)} ימים</div>
       <div class="sc-chip">${esc(Math.abs(stats.percent).toFixed(1))}% מהמשקל</div>`
    : // Gain or flat: lead with consistency instead, so the card is never discouraging.
      `<div class="sc-eyebrow">המסע שלי</div>
       <div class="sc-big"><span class="sc-num">${esc(stats.days)}</span><span class="sc-unit">ימים</span></div>
       <div class="sc-sub">של מעקב עקבי</div>
       <div class="sc-chip">${esc(stats.weighIns)} שקילות</div>`;

  const progress =
    stats.goalPercent > 0
      ? `<div class="sc-progress">
           <div class="sc-progress-head"><span>ההתקדמות ליעד</span><span class="sc-ltr">${Math.round(stats.goalPercent)}%</span></div>
           <div class="sc-track"><div class="sc-fill" style="width:${Math.max(4, stats.goalPercent)}%"></div></div>
         </div>`
      : '';

  return `
    <style>
      .sc { font-family: 'Rubik', 'Segoe UI', sans-serif; direction: rtl; width: 540px; height: 675px; box-sizing: border-box; padding: 36px; display: flex; flex-direction: column; justify-content: space-between; background: ${style.bg}; color: #1e1b19; }
      .sc-brand { display: flex; align-items: center; gap: 12px; color: ${style.onBg}; font-size: 26px; font-weight: 700; }
      .sc-logo { width: 52px; height: 52px; border-radius: 999px; background: #fff; padding: 4px; box-sizing: border-box; }
      .sc-panel { background: ${style.panel}; border-radius: 32px; padding: 36px 28px; text-align: center; box-shadow: 0 12px 32px ${style.panelShadow}; }
      .sc-eyebrow { font-size: 26px; font-weight: 600; color: ${style.eyebrow}; }
      .sc-big { display: flex; align-items: baseline; justify-content: center; gap: 10px; direction: ltr; margin: 4px 0 14px; }
      .sc-num { font-size: 104px; font-weight: 700; line-height: 1.05; color: ${style.num}; }
      .sc-unit { font-size: 30px; font-weight: 600; color: ${style.text}; }
      .sc-sub { font-size: 24px; font-weight: 500; line-height: 1.4; margin-top: 10px; color: ${style.text}; }
      .sc-chip { display: inline-block; margin-top: 18px; padding: 6px 22px 14px; line-height: 1.3; border-radius: 999px; background: ${style.chipBg}; color: ${style.chipText}; font-size: 20px; font-weight: 600; }
      .sc-progress { margin-top: 28px; text-align: right; }
      .sc-progress-head { display: flex; justify-content: space-between; font-size: 16px; font-weight: 600; color: ${style.text}; margin-bottom: 8px; }
      .sc-ltr { direction: ltr; }
      .sc-track { height: 16px; border-radius: 999px; background: ${style.track}; overflow: hidden; }
      .sc-fill { height: 100%; border-radius: 999px; background: ${style.fill}; }
      .sc-footer { text-align: center; color: ${style.onBg}; font-size: 16px; font-weight: 500; letter-spacing: 0.3px; }
      .sc-footer b { font-weight: 700; }
    </style>
    <div class="sc">
      <div class="sc-brand"><img class="sc-logo" src="${esc(logoSrc)}" alt="" /><span>שקלולי</span></div>
      <div class="sc-panel">
        ${hero}
        ${progress}
      </div>
      <div class="sc-footer"><b>${esc(SHARE_URL.replace(/^https?:\/\//, ''))}</b><br/>מעקב משקל פשוט וחכם</div>
    </div>
  `;
}

/**
 * Rasterizes the logo SVG to a PNG data URL. html2canvas can't reliably draw an <img>
 * pointing at an SVG, but a plain canvas can, so we convert it up front.
 * @returns a PNG data URL of the logo, or the SVG path itself if conversion fails
 */
async function loadLogoPng(): Promise<string> {
  try {
    const img = new Image();
    img.src = '/favicon.svg';
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    canvas.getContext('2d')!.drawImage(img, 0, 0, 256, 256);
    return canvas.toDataURL('image/png');
  } catch {
    return '/favicon.svg';
  }
}

/**
 * Renders the share card to a PNG image (1080x1350).
 * @param stats - numbers to show on the card
 * @param styleId - background style to use
 * @returns the PNG as a Blob
 * @throws if the browser can't encode the canvas
 */
export async function generateShareCardBlob(stats: ShareStats, styleId: ShareStyleId = 'sunset'): Promise<Blob> {
  const style = getShareStyle(styleId);
  const logoSrc = await loadLogoPng();
  const canvas = await renderHtmlToCanvas(buildShareCardHtml(stats, logoSrc, style), {
    scale: 2,
    backgroundColor: style.canvasBg,
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('יצירת התמונה נכשלה.'))), 'image/png');
  });
}

/**
 * Shares the card through the system share sheet where files are supported (mobile),
 * otherwise downloads it. Must be called directly from a click handler so the browser
 * still considers it user-initiated.
 * @param blob - PNG from generateShareCardBlob
 * @param stats - used to word the accompanying share text
 * @returns 'shared', 'downloaded', or 'cancelled' if the user closed the share sheet
 */
export async function shareCardBlob(blob: Blob, stats: ShareStats): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const fileName = `shekaluli-progress-${today()}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });
  const text =
    stats.deltaKg < -0.05
      ? `ירדתי ${Math.abs(stats.deltaKg).toFixed(1)} ק״ג ב-${stats.days} ימים עם שקלולי! ${SHARE_URL}`
      : `${stats.days} ימים של מעקב עם שקלולי! ${SHARE_URL}`;

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Any other failure: fall through to the download so the user still gets the image.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
