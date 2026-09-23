import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Profile, WeightEntry } from '../types';
import { bmiCategory, getEntryBmi } from './bmi';
import {
  averageWeighInsPerWeek,
  computePeriodChange,
  estimateWeeksToGoal,
  goalProgressPercent,
  highestEntry,
  lowestEntry,
} from './stats';
import { calculateAge, formatDateIL, today } from './dates';

const PERIODS = [
  { label: 'ב-15 הימים האחרונים', days: 15 },
  { label: 'בחודש האחרון', days: 30 },
  { label: 'ב-3 החודשים האחרונים', days: 90 },
];

const RECENT_ENTRIES_LIMIT = 20;

/** Escapes text before interpolating it into the report's HTML template. */
function esc(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Builds the printable report's markup as a self-contained HTML fragment (inline
 * styles + a scoped <style> block), independent of the app's Tailwind theme and
 * light/dark mode, so the exported PDF always renders as a clean, light document
 * regardless of what the user currently has selected in Settings.
 * @param profile - user profile
 * @param sorted - weight entries sorted ascending by date (must be non-empty)
 * @returns HTML string to render off-screen and rasterize
 */
function buildReportHtml(profile: Profile, sorted: WeightEntry[]): string {
  const latest = sorted[sorted.length - 1];
  const latestBmi = getEntryBmi(latest, profile);
  const low = lowestEntry(sorted)!;
  const high = highestEntry(sorted)!;
  const totalDelta = latest.weightKg - profile.startWeightKg;
  const progressPercent = goalProgressPercent(latest.weightKg, profile.startWeightKg, profile.goalWeightKg);
  const avgPerWeek = averageWeighInsPerWeek(sorted);
  const weeksToGoal = estimateWeeksToGoal(sorted, profile.goalWeightKg);

  const periodItems = PERIODS.map((p) => {
    const change = computePeriodChange(sorted, p.days);
    const valueContent = change.hasData
      ? `<div class="cr-delta">${change.deltaKg > 0 ? '+' : ''}${change.deltaKg.toFixed(1)} ק״ג</div>
         <span class="cr-badge ${change.deltaKg <= 0 ? 'cr-badge-down' : 'cr-badge-up'}">${change.percent > 0 ? '+' : ''}${change.percent.toFixed(1)}%</span>`
      : '<span class="cr-sub" style="margin:0;">אין מספיק נתונים</span>';
    return `
      <div class="cr-period-row">
        <div class="cr-period-value">${valueContent}</div>
        <div class="cr-period-label">${esc(p.label)}</div>
      </div>`;
  }).join('');

  const recentEntries = [...sorted].reverse().slice(0, RECENT_ENTRIES_LIMIT);
  const entryRows = recentEntries
    .map((e) => {
      const bmi = getEntryBmi(e, profile);
      return `<tr>
        <td class="cr-td">${esc(formatDateIL(e.date))}</td>
        <td class="cr-td cr-td-num">${esc(e.weightKg.toFixed(1))}</td>
        <td class="cr-td cr-td-num">${esc(bmi.toFixed(1))}</td>
        <td class="cr-td">${esc(bmiCategory(bmi))}</td>
      </tr>`;
    })
    .join('');

  return `
    <style>
      .cr { font-family: 'Rubik', 'Segoe UI', sans-serif; direction: rtl; color: #1e1b19; background: #ffffff; width: 720px; padding: 36px; }
      .cr h1 { font-size: 22px; margin: 0 0 2px; }
      .cr h2 { font-size: 15px; margin: 0 0 10px; color: #855300; }
      .cr .cr-sub { font-size: 12px; color: #5b4038; margin: 0 0 20px; }
      .cr-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #fea619; padding-bottom: 14px; margin-bottom: 20px; }
      .cr-brand { display: flex; align-items: center; gap: 10px; }
      .cr-brand-badge { width: 36px; height: 36px; border-radius: 999px; background: #ff5a1f; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; }
      .cr-section { margin-bottom: 22px; }
      .cr-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .cr-card { background: #faf2ee; border-radius: 12px; padding: 12px; text-align: center; }
      .cr-card-label { font-size: 10px; color: #5b4038; margin-bottom: 4px; }
      .cr-card-value { font-size: 18px; font-weight: 700; }
      table.cr-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      .cr-td { border-bottom: 1px solid #e4beb3; padding: 7px 4px; text-align: right; }
      .cr-td-num { text-align: left; direction: ltr; }
      .cr-table thead .cr-td { font-weight: 700; color: #5b4038; border-bottom: 2px solid #e4beb3; }
      .cr-footer { margin-top: 24px; font-size: 10px; color: #8f7067; text-align: center; }
      .cr-period-row { display: flex; align-items: center; justify-content: space-between; background: #faf2ee; border-radius: 12px; padding: 10px 14px; margin-bottom: 8px; }
      .cr-period-label { font-size: 12px; font-weight: 600; }
      .cr-period-value { text-align: left; direction: ltr; }
      .cr-delta { font-weight: 700; font-size: 15px; line-height: 1.3; }
      .cr-badge { display: inline-flex; align-items: center; justify-content: center; line-height: 1; margin-top: 4px; padding: 3px 7px 2px; border-radius: 999px; font-size: 10px; font-weight: 600; direction: ltr; }
      .cr-badge-down { background: #d7f0e2; color: #006c49; }
      .cr-badge-up { background: #ffdad6; color: #93000a; }
    </style>
    <div class="cr">
      <div class="cr-header">
        <div class="cr-brand">
          <div class="cr-brand-badge">ש</div>
          <div>
            <h1>דוח התקדמות - שקלולי</h1>
            <div class="cr-sub" style="margin:0;">הופק בתאריך ${esc(formatDateIL(today()))}</div>
          </div>
        </div>
      </div>

      <div class="cr-section">
        <h2>פרופיל</h2>
        <div class="cr-grid">
          <div class="cr-card"><div class="cr-card-label">גיל</div><div class="cr-card-value">${esc(calculateAge(profile.birthDate) ?? '—')}</div></div>
          <div class="cr-card"><div class="cr-card-label">גובה</div><div class="cr-card-value">${esc(profile.heightCm)} ס״מ</div></div>
          <div class="cr-card"><div class="cr-card-label">משקל נוכחי</div><div class="cr-card-value">${esc(latest.weightKg.toFixed(1))} ק״ג</div></div>
          <div class="cr-card"><div class="cr-card-label">BMI נוכחי</div><div class="cr-card-value">${esc(latestBmi.toFixed(1))}</div></div>
        </div>
      </div>

      <div class="cr-section">
        <h2>התקדמות כללית</h2>
        <div class="cr-grid">
          <div class="cr-card"><div class="cr-card-label">שינוי מנקודת פתיחה</div><div class="cr-card-value">${totalDelta > 0 ? '+' : ''}${esc(totalDelta.toFixed(1))} ק״ג</div></div>
          <div class="cr-card"><div class="cr-card-label">התקדמות ליעד</div><div class="cr-card-value">${Math.round(progressPercent)}%</div></div>
          <div class="cr-card"><div class="cr-card-label">ממוצע שקילות/שבוע</div><div class="cr-card-value">${esc(avgPerWeek.toFixed(1))}</div></div>
          <div class="cr-card"><div class="cr-card-label">זמן משוער ליעד</div><div class="cr-card-value">${weeksToGoal !== null ? `${Math.round(weeksToGoal)} שבועות` : '—'}</div></div>
        </div>
      </div>

      <div class="cr-section">
        <h2>שינוי תקופתי</h2>
        ${periodItems}
      </div>

      <div class="cr-section">
        <h2>שיאים</h2>
        <div class="cr-grid" style="grid-template-columns: repeat(2, 1fr);">
          <div class="cr-card"><div class="cr-card-label">משקל שיא נמוך</div><div class="cr-card-value">${esc(low.weightKg.toFixed(1))} ק״ג</div><div class="cr-sub" style="margin:4px 0 0;">${esc(formatDateIL(low.date))}</div></div>
          <div class="cr-card"><div class="cr-card-label">משקל שיא גבוה</div><div class="cr-card-value">${esc(high.weightKg.toFixed(1))} ק״ג</div><div class="cr-sub" style="margin:4px 0 0;">${esc(formatDateIL(high.date))}</div></div>
        </div>
      </div>

      <div class="cr-section">
        <h2>שקילות אחרונות</h2>
        <table class="cr-table">
          <thead><tr><td class="cr-td">תאריך</td><td class="cr-td cr-td-num">משקל בק״ג</td><td class="cr-td cr-td-num">BMI</td><td class="cr-td">קטגוריה</td></tr></thead>
          <tbody>${entryRows}</tbody>
        </table>
      </div>

      <div class="cr-footer">נוצר אוטומטית על ידי אפליקציית שקלולי לצורך שיתוף עם מאמן אישי.</div>
    </div>
  `;
}

/**
 * Generates a coach-facing progress report as a PDF and triggers its download.
 * Renders a plain-HTML report off-screen (independent of the app's theme) and
 * rasterizes it with html2canvas before placing it into a paginated jsPDF
 * document, since jsPDF's native text renderer has no built-in Hebrew/RTL
 * shaping — rendering through the browser's own text layout sidesteps that.
 * @param profile - user profile
 * @param entries - all weight entries, any order
 * @throws if there are no weight entries to report on
 */
export async function generateCoachReportPdf(profile: Profile, entries: WeightEntry[]): Promise<void> {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) {
    throw new Error('אין נתוני שקילה לייצוא. הוסיפו שקילה לפחות אחת כדי להפיק דוח.');
  }

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-9999px';
  container.style.zIndex = '-1';
  container.dir = 'rtl';
  container.innerHTML = buildReportHtml(profile, sorted);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff' });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`shekaluli-דוח-התקדמות-${today()}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
