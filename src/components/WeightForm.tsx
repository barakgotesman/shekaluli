import { useState } from 'react';
import { today } from '../logic/dates';
import WeightSlider from './WeightSlider';
import Icon from './Icon';

interface Props {
  onSubmit: (date: string, weightKg: number, note: string) => void;
  defaultWeight?: number;
  defaultDate?: string;
  defaultNote?: string;
}

/**
 * Form for logging a weight entry on a chosen date (defaults to today), using
 * a draggable ruler (WeightSlider) rather than a plain number field so picking
 * a weight feels like a real scale/meter widget.
 * @param onSubmit - called with the chosen date, weight, and note once submitted
 * @param defaultWeight - initial slider value; typically the user's last logged weight
 * @param defaultDate - initial date value; defaults to today, used to pre-fill when editing an existing entry
 * @param defaultNote - initial note value, used to pre-fill when editing an existing entry
 */
export default function WeightForm({ onSubmit, defaultWeight = 70, defaultDate, defaultNote }: Props) {
  const [date, setDate] = useState(defaultDate ?? today());
  const [weight, setWeight] = useState(defaultWeight);
  const [note, setNote] = useState(defaultNote ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !(weight > 0)) return;
    onSubmit(date, weight, note.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1 rounded-2xl bg-gradient-to-br from-primary-fixed via-primary-fixed/60 to-surface-container-low p-5 text-center shadow-inner">
        <span className="text-xs font-medium tracking-wider text-on-surface-variant uppercase">משקל נבחר</span>
        <div className="my-1 flex items-baseline justify-center gap-2" dir="ltr">
          <span className="text-5xl font-extrabold tracking-tight text-primary drop-shadow-sm">
            {weight.toFixed(1)}
          </span>
          <span className="text-xl font-bold text-primary/70">ק״ג</span>
        </div>
      </div>

      <WeightSlider value={weight} onChange={setWeight} />

      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-on-surface-variant">תאריך שקילה</label>
          <div className="flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 transition-colors focus-within:border-primary">
            <Icon name="calendar_today" className="text-primary text-[18px]" />
            <input
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent text-xs font-medium text-on-surface focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setDate(today())}
              className="shrink-0 text-xs font-semibold text-primary hover:underline"
            >
              היום
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-on-surface-variant">הערות נוספות (אופציונלי)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-xs text-on-surface placeholder-outline focus:border-primary focus:outline-none"
            placeholder="הוסף הערה..."
            type="text"
          />
        </div>
      </div>

      <button
        type="submit"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-on-primary shadow-[0_8px_18px_-2px_rgba(79,70,229,0.35)] transition-all active:scale-[0.98] hover:bg-primary-container"
      >
        <Icon name="check" className="text-[20px]" />
        <span>שמור שקילה ({weight.toFixed(1)} ק״ג)</span>
      </button>
    </form>
  );
}
