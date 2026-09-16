import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Profile, WeightEntry } from '../types';
import { BMI_NORMAL_MAX, BMI_OVERWEIGHT_MAX, BMI_UNDERWEIGHT, bmiToWeightKg } from '../logic/bmi';
import { formatDateIL } from '../logic/dates';
import { TIMEFRAMES, filterEntriesByTimeframe, type Timeframe } from '../logic/timeframe';

interface Props {
  entries: WeightEntry[];
  profile: Profile;
}

/**
 * Line chart of logged weight over time, with colored background bands marking
 * the WHO BMI weight zones (underweight / normal / overweight / obese, derived
 * from the user's height), labeled boundary lines between them, a reference line
 * for the goal weight, and timeframe tabs that filter the visible date range.
 * @param entries - weight entries to plot, assumed sorted by date
 * @param profile - user profile, used to convert BMI thresholds into weight values
 */
export default function WeightChart({ entries, profile }: Props) {
  const [timeframe, setTimeframe] = useState<Timeframe>('3m');

  const visibleEntries = useMemo(() => {
    const days = TIMEFRAMES.find((t) => t.key === timeframe)?.days ?? null;
    return filterEntriesByTimeframe(entries, days);
  }, [entries, timeframe]);

  const data = visibleEntries.map((e) => ({ date: e.date, weight: e.weightKg }));

  // BMI thresholds only make sense as absolute weight once height is known,
  // so convert them here rather than plotting BMI directly on the Y axis.
  const underweightMax = bmiToWeightKg(BMI_UNDERWEIGHT, profile.heightCm);
  const normalMax = bmiToWeightKg(BMI_NORMAL_MAX, profile.heightCm);
  const overweightMax = bmiToWeightKg(BMI_OVERWEIGHT_MAX, profile.heightCm);

  // Labels sit on the right, inside the plot, with extra right margin so
  // longer Hebrew text has room and never gets clipped by the SVG edge.
  const labelStyle = { fontSize: 11, position: 'insideRight' as const };

  return (
    <div className="flex flex-col rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
      {/* Timeframe filter tabs — actually filter the plotted data range. */}
      <div className="mb-4 flex items-center justify-between gap-1 rounded-xl bg-surface-container-low p-1">
        {TIMEFRAMES.map((t) => (
          <button
            key={t.key}
            onClick={() => setTimeframe(t.key)}
            className={`flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition-all ${
              timeframe === t.key
                ? 'bg-primary-container font-semibold text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-base font-semibold text-on-surface">מהלך שקילות וטווחי BMI</h2>
          <span className="text-xs text-on-surface-variant">מעקב מגמה ביחס לאזורים פיזיולוגיים</span>
        </div>
      </div>

      {data.length > 0 ? (
        <div className="h-[22rem] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 20, right: 12, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: 'var(--color-on-surface-variant)' }}
                tickFormatter={formatDateIL}
              />
              <YAxis
                domain={['dataMin - 3', 'dataMax + 3']}
                tick={{ fontSize: 12, fill: 'var(--color-on-surface-variant)' }}
                unit=" ק״ג"
                width={55}
              />
              <Tooltip labelFormatter={(label) => formatDateIL(String(label))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />

              {/* BMI zone bands, clipped automatically to the Y axis domain above. */}
              <ReferenceArea y1={0} y2={underweightMax} fill="#38bdf8" fillOpacity={0.12} />
              <ReferenceArea y1={underweightMax} y2={normalMax} fill="#10b981" fillOpacity={0.12} />
              <ReferenceArea y1={normalMax} y2={overweightMax} fill="#f59e0b" fillOpacity={0.12} />
              <ReferenceArea y1={overweightMax} y2={1000} fill="#f43f5e" fillOpacity={0.12} />

              {/* Boundary lines between zones, labeled with the zone that starts above each line. */}
              <ReferenceLine
                y={underweightMax}
                stroke="#0ea5e9"
                strokeDasharray="6 3"
                label={{ value: 'משקל תקין', ...labelStyle, fill: '#0369a1' }}
              />
              <ReferenceLine
                y={normalMax}
                stroke="#d97706"
                strokeDasharray="6 3"
                label={{ value: 'עודף משקל', ...labelStyle, fill: '#b45309' }}
              />
              <ReferenceLine
                y={overweightMax}
                stroke="#e11d48"
                strokeDasharray="6 3"
                label={{ value: 'השמנת יתר', ...labelStyle, fill: '#be123c' }}
              />

              <ReferenceLine
                y={profile.goalWeightKg}
                stroke="var(--color-primary)"
                strokeWidth={2}
                strokeDasharray="4 3"
                label={{ value: 'משקל יעד', ...labelStyle, fill: 'var(--color-primary)' }}
              />

              <Line
                type="monotone"
                dataKey="weight"
                name="משקל"
                stroke="var(--color-primary-container)"
                strokeWidth={3}
                dot={{ r: 3, fill: 'var(--color-primary-container)' }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center text-sm text-on-surface-variant">
          אין נתונים בטווח שנבחר
        </div>
      )}

      {/* BMI legend bar */}
      <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-container-low/60 p-2.5">
        <LegendDot color="bg-sky-400" label="תת-משקל" muted />
        <LegendDot color="bg-emerald-500" label="תקין (18.5-24.9)" />
        <LegendDot color="bg-amber-500" label="עודף (25-29.9)" muted />
        <LegendDot color="bg-rose-500" label="השמנה (30+)" muted />
      </div>
    </div>
  );
}

/** Single colored-dot legend entry for the BMI zone legend bar. */
function LegendDot({ color, label, muted = false }: { color: string; label: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className={`text-[11px] ${muted ? 'text-on-surface-variant' : 'font-medium text-on-surface'}`}>
        {label}
      </span>
    </div>
  );
}
