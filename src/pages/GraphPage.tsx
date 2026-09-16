import type { ReactNode } from 'react';
import type { Profile, WeightEntry } from '../types';
import { bmiCategory, getLatestBmi } from '../logic/bmi';
import { computePeriodChange, goalProgressPercent } from '../logic/stats';
import Icon from '../components/Icon';
import WeightChart from '../components/WeightChart';

interface Props {
  entries: WeightEntry[];
  profile: Profile;
}

/**
 * Main dashboard view: a trend insight banner, four metric cards (start/goal/current
 * weight and current BMI), the weight-over-time chart, and a progress-to-goal bar.
 * @param entries - all weight entries, date-sorted ascending
 * @param profile - user profile, used for goal/height context
 */
export default function GraphPage({ entries, profile }: Props) {
  const latest = entries[entries.length - 1];

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-container-lowest p-6 text-center text-on-surface-variant shadow-sm">
        הוסיפו משקל ראשון כדי לראות גרף
      </div>
    );
  }

  const currentBmi = getLatestBmi(entries, profile)!;
  const totalDelta = latest.weightKg - profile.startWeightKg;
  const remaining = Math.abs(latest.weightKg - profile.goalWeightKg);
  const progressPercent = goalProgressPercent(latest.weightKg, profile.startWeightKg, profile.goalWeightKg);

  const trend = computePeriodChange(entries, 14);

  return (
    <div className="flex flex-col gap-4 pb-6">
      {trend.hasData && <InsightBanner deltaKg={trend.deltaKg} />}

      <section className="grid grid-cols-2 gap-2">
        <MetricCard label="משקל התחלתי" icon="calendar_today">
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] font-bold tracking-tight text-on-surface">{profile.startWeightKg}</span>
            <span className="text-xs text-on-surface-variant">ק״ג</span>
          </div>
        </MetricCard>

        <MetricCard label="משקל יעד" icon="flag" iconClass="bg-primary-fixed text-primary">
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] font-bold tracking-tight text-primary">{profile.goalWeightKg}</span>
            <span className="text-xs text-on-surface-variant">ק״ג</span>
          </div>
          <span className="text-[11px] font-medium text-primary">
            {remaining > 0 ? `נותרו עוד ${remaining.toFixed(1)} ק״ג` : 'היעד הושג!'}
          </span>
        </MetricCard>

        <MetricCard label="משקל נוכחי" dot>
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] font-bold tracking-tight text-on-surface">{latest.weightKg}</span>
            <span className="text-xs text-on-surface-variant">ק״ג</span>
          </div>
          <ChangeBadge deltaKg={totalDelta} />
        </MetricCard>

        <MetricCard label="BMI נוכחי" suffix={`גובה: ${(profile.heightCm / 100).toFixed(2)} מ׳`}>
          <span className="text-[28px] font-bold tracking-tight text-on-surface">{currentBmi.toFixed(1)}</span>
          <span className="mt-1 inline-flex w-fit items-center rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface">
            {bmiCategory(currentBmi)}
          </span>
        </MetricCard>
      </section>

      <WeightChart entries={entries} profile={profile} />

      <section className="flex flex-col gap-2 rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-on-surface">התקדמות ליעד</span>
          <span className="text-sm font-bold text-primary">{Math.round(progressPercent)}% הושלמו</span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-container-high">
          <div
            className="h-full rounded-full bg-gradient-to-l from-primary to-primary-container transition-all duration-700"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
          <span>התחלה: {profile.startWeightKg} ק״ג</span>
          <span className="font-medium text-secondary">
            {totalDelta <= 0 ? 'ירדת' : 'עלית'} {Math.abs(totalDelta).toFixed(1)} ק״ג סה״כ
          </span>
          <span>יעד: {profile.goalWeightKg} ק״ג</span>
        </div>
      </section>
    </div>
  );
}

/** Motivational trend banner summarizing the last-14-day weight change. */
function InsightBanner({ deltaKg }: { deltaKg: number }) {
  const losing = deltaKg < 0;
  return (
    <section className="relative overflow-hidden rounded-2xl bg-surface-container-low p-4 shadow-sm">
      <div className="pointer-events-none absolute -top-6 -left-6 h-28 w-28 rounded-full bg-secondary-fixed/40 blur-2xl" />
      <div className="relative z-10 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-on-secondary shadow-sm">
          <Icon name={losing ? 'trending_down' : 'trending_up'} className="text-[20px]" filled />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-semibold text-on-surface">{losing ? 'מגמה מצוינת!' : 'שימו לב למגמה'}</span>
            <span className="inline-flex items-center rounded-full bg-secondary-container px-2 py-0.5 text-[11px] font-medium text-on-secondary-container">
              {losing ? 'קצב בריא ומאוזן' : 'עלייה קלה'}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-on-surface-variant">
            {losing
              ? `ירדת ${Math.abs(deltaKg).toFixed(1)} ק״ג בשבועיים האחרונים. שמירה על יציבות תזונתית מאפשרת ירידה בטוחה ומתמשכת.`
              : `עלית ${deltaKg.toFixed(1)} ק״ג בשבועיים האחרונים. ייתכן שכדאי לעקוב מקרוב יותר בימים הקרובים.`}
          </p>
        </div>
      </div>
    </section>
  );
}

/** Small badge showing the direction and magnitude of weight change since the start. */
function ChangeBadge({ deltaKg }: { deltaKg: number }) {
  const down = deltaKg <= 0;
  return (
    <div
      className={`mt-1 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        down ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container'
      }`}
    >
      <Icon name={down ? 'arrow_downward' : 'arrow_upward'} className="text-[12px]" />
      <span>{Math.abs(deltaKg).toFixed(1)} ק״ג</span>
    </div>
  );
}

/** Generic 2x2-grid metric card used on the dashboard. */
function MetricCard({
  label,
  icon,
  iconClass = 'bg-surface-container-high text-on-surface-variant',
  dot = false,
  suffix,
  children,
}: {
  label: string;
  icon?: string;
  iconClass?: string;
  dot?: boolean;
  suffix?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs text-on-surface-variant">{label}</span>
        {icon && (
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconClass}`}>
            <Icon name={icon} className="text-[16px]" filled={icon === 'flag'} />
          </div>
        )}
        {dot && <span className="h-2.5 w-2.5 rounded-full bg-secondary" />}
        {suffix && <span className="text-[11px] text-on-surface-variant">{suffix}</span>}
      </div>
      <div className="mt-2 flex flex-col">{children}</div>
    </div>
  );
}

