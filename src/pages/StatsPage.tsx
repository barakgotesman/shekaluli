import { useState } from 'react';
import type { Profile, WeightEntry } from '../types';
import {
  averageWeighInsPerWeek,
  computePeriodChange,
  estimateWeeksToGoal,
  goalProgressPercent,
  highestEntry,
  lowestEntry,
} from '../logic/stats';
import { formatDateIL } from '../logic/dates';
import { generateCoachReportPdf } from '../logic/pdfReport';
import Icon from '../components/Icon';

interface Props {
  entries: WeightEntry[];
  profile: Profile;
}

const PERIODS = [
  { label: 'ב-15 הימים האחרונים', days: 15 },
  { label: 'בחודש האחרון', days: 30 },
  { label: 'ב-3 החודשים האחרונים', days: 90 },
];

/**
 * Statistics view: all-time lowest/highest weight records, weight change over
 * the last 15 days / month / 3 months, and a goal-progress breakdown including
 * two real derived metrics (average weigh-ins/week, estimated weeks to goal).
 * @param entries - all weight entries, any order
 * @param profile - user profile, used for the goal-progress breakdown
 */
export default function StatsPage({ entries, profile }: Props) {
  const [generatingReport, setGeneratingReport] = useState(false);
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  /** Generates and downloads the coach progress-report PDF. */
  async function handleShareWithCoach() {
    setGeneratingReport(true);
    try {
      await generateCoachReportPdf(profile, entries);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setGeneratingReport(false);
    }
  }

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-container-lowest p-6 text-center text-on-surface-variant shadow-sm">
        עדיין אין נתונים לחישוב סטטיסטיקה. הוסיפו משקל כדי להתחיל.
      </div>
    );
  }

  const low = lowestEntry(sorted)!;
  const high = highestEntry(sorted)!;
  const latest = sorted[sorted.length - 1];

  const totalDelta = latest.weightKg - profile.startWeightKg;
  const goalDelta = profile.goalWeightKg - profile.startWeightKg;
  const progressPercent = goalProgressPercent(latest.weightKg, profile.startWeightKg, profile.goalWeightKg);

  const avgPerWeek = averageWeighInsPerWeek(sorted);
  const weeksToGoal = estimateWeeksToGoal(sorted, profile.goalWeightKg);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <section className="flex flex-col gap-1.5 pt-2">
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-surface-container px-3 py-1 text-xs text-primary shadow-sm">
          <Icon name="insights" className="text-[15px]" filled />
          <span>דוח ביצועים חכם</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-on-surface">ניתוח נתונים וסטטיסטיקה</h1>
        <p className="text-sm text-on-surface-variant">מבט מעמיק על התקדמות המשקל לאורך זמן וניתוח מגמות</p>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <RecordCard
          label="משקל שיא נמוך"
          weightKg={low.weightKg}
          date={low.date}
          icon="emoji_events"
          highlight
        />
        <RecordCard label="משקל שיא גבוה" weightKg={high.weightKg} date={high.date} icon="north" />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-semibold text-on-surface">שינוי תקופתי</h2>
          <span className="text-xs text-on-surface-variant">מחושב לשקילה האחרונה</span>
        </div>

        {PERIODS.map((p) => {
          const change = computePeriodChange(sorted, p.days);
          return (
            <div key={p.days} className="rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-container/50 text-secondary">
                    <Icon name="trending_down" className="text-[22px]" />
                  </div>
                  <span className="text-sm font-semibold text-on-surface">{p.label}</span>
                </div>
                {change.hasData ? (
                  <div className="flex flex-col items-end">
                    <div
                      className={`flex items-baseline gap-1 text-lg font-bold ${
                        change.deltaKg < 0 ? 'text-secondary' : change.deltaKg > 0 ? 'text-error' : 'text-on-surface'
                      }`}
                    >
                      <span dir="ltr">{change.deltaKg > 0 ? '+' : ''}{change.deltaKg.toFixed(1)}</span>
                      <span className="text-xs">ק״ג</span>
                    </div>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        change.deltaKg < 0
                          ? 'bg-secondary-container/70 text-on-secondary-container'
                          : 'bg-error-container/70 text-on-error-container'
                      }`}
                      dir="ltr"
                    >
                      {change.percent > 0 ? '+' : ''}
                      {change.percent.toFixed(1)}%
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-on-surface-variant">אין מספיק נתונים</span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-on-primary shadow-md">
              <Icon name="flag" className="text-[22px]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">התקדמות לעבר היעד</h3>
              <span className="text-xs text-on-surface-variant">מחושב מנקודת הפתיחה המקורית</span>
            </div>
          </div>
          <div className="rounded-full bg-secondary-container px-2.5 py-1 text-xs font-semibold text-on-secondary-container">
            {Math.round(progressPercent)}% הושלמו
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-on-surface">
              {totalDelta <= 0 ? 'ירידה' : 'עלייה'} של <span className="font-bold text-primary">{Math.abs(totalDelta).toFixed(1)} ק״ג</span>
            </span>
            <span className="text-on-surface-variant">
              יעד כולל: <span className="font-semibold text-on-surface">{Math.abs(goalDelta).toFixed(1)} ק״ג</span>
            </span>
          </div>
          <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-surface-container-high p-0.5">
            <div
              className="h-full rounded-full bg-primary-container shadow-sm transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between px-0.5 text-[11px] text-outline">
            <span>משקל פתיחה: {profile.startWeightKg} ק״ג</span>
            <span>יעד רצוי: {profile.goalWeightKg} ק״ג</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="flex flex-col gap-1 rounded-xl bg-surface-container p-3">
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <Icon name="event_available" className="text-primary text-[17px]" />
              <span className="text-[11px] font-medium">ממוצע שקילות שבועי</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold text-on-surface">{avgPerWeek.toFixed(1)}</span>
              <span className="text-xs text-on-surface-variant">פעמים / שבוע</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-surface-container p-3">
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <Icon name="pace" className="text-tertiary text-[17px]" />
              <span className="text-[11px] font-medium">זמן משוער ליעד</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold text-on-surface">
                {weeksToGoal !== null ? Math.round(weeksToGoal) : '—'}
              </span>
              <span className="text-xs text-on-surface-variant">{weeksToGoal !== null ? 'שבועות' : 'אין מגמה כרגע'}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-between rounded-2xl bg-surface-container-low p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-highest text-primary">
            <Icon name="share" className="text-[20px]" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-on-surface">שיתוף התקדמות עם מאמן</span>
            <span className="text-xs text-on-surface-variant">הפקת דוח מסכם בפורמט PDF</span>
          </div>
        </div>
        <button
          onClick={handleShareWithCoach}
          disabled={generatingReport}
          className="flex items-center gap-1 rounded-full bg-surface-container-lowest px-3.5 py-2 text-xs font-medium text-on-surface shadow-sm disabled:opacity-50"
        >
          <span>{generatingReport ? 'מפיק דוח...' : 'ייצוא'}</span>
          <Icon name="chevron_left" className="text-[16px]" />
        </button>
      </section>
    </div>
  );
}

/** Hero card for an all-time lowest/highest weight record. */
function RecordCard({
  label,
  weightKg,
  date,
  icon,
  highlight = false,
}: {
  label: string;
  weightKg: number;
  date: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 shadow-sm ${
        highlight
          ? 'bg-gradient-to-br from-secondary-container/40 via-surface-container-lowest to-surface-container-lowest'
          : 'bg-surface-container-lowest'
      }`}
    >
      {highlight && (
        <div
          aria-hidden
          className="animate-shine-sweep pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
        />
      )}
      <div className="relative mb-3 flex items-center justify-between">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-sm ${
            highlight ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface-variant'
          }`}
        >
          <Icon name={icon} className="text-[20px]" filled={highlight} />
        </div>
        {highlight && (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary-container/60 px-2 py-0.5 text-[11px] font-medium text-on-secondary-container">
            שיא חדש! 🏆
          </span>
        )}
      </div>
      <div className="relative flex flex-col">
        <span className="text-xs text-on-surface-variant">{label}</span>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="text-[28px] font-bold tracking-tight text-on-surface">{weightKg.toFixed(1)}</span>
          <span className="text-xs font-medium text-on-surface-variant">ק״ג</span>
        </div>
      </div>
      <div className="relative mt-3 flex items-center justify-between pt-2.5 text-on-surface-variant">
        <span className="text-[11px] text-outline">תאריך שקילה</span>
        <span className="rounded bg-surface-container-low px-2 py-0.5 text-xs font-medium text-on-surface">
          {formatDateIL(date)}
        </span>
      </div>
    </div>
  );
}
