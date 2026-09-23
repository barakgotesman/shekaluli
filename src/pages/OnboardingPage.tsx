import { useRef, useState } from 'react';
import type { Profile } from '../types';
import { bmiCategory, weightToBmi } from '../logic/bmi';
import { fileToResizedBase64 } from '../logic/image';
import { today } from '../logic/dates';
import Icon from '../components/Icon';

interface Props {
  initial: Profile | null;
  onSave: (profile: Profile) => void;
  onCancel?: () => void;
}

/**
 * Onboarding / profile-editing form: captures name, gender, birth date, height, starting
 * weight, and goal weight, with a live BMI preview computed from the current inputs.
 * Pre-fills from `initial` when editing an existing profile.
 * @param initial - existing profile to edit, or null for first-time onboarding
 * @param onSave - called with the validated profile when the form is submitted
 * @param onCancel - called when the user cancels editing (omitted during first-time onboarding, since there's nothing to cancel back to)
 */
export default function OnboardingPage({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [gender, setGender] = useState<'male' | 'female'>(initial?.gender ?? 'male');
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '');
  const [heightCm, setHeightCm] = useState(initial?.heightCm ?? '');
  const [startWeightKg, setStartWeightKg] = useState(initial?.startWeightKg ?? '');
  const [goalWeightKg, setGoalWeightKg] = useState(initial?.goalWeightKg ?? '');
  const [photoBase64, setPhotoBase64] = useState(initial?.photoBase64);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Reads the selected file, downscales it, and stores it as the profile photo. */
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhotoBase64(await fileToResizedBase64(file));
      setPhotoError(null);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : String(error));
    }
  }

  // Listed by field so the disabled Save button can explain what's missing, rather than
  // just sitting grayed out — this matters most for profiles saved before name/birthDate
  // existed, where those fields are silently empty when the user opens this form to edit.
  const missingFields = [
    name.trim().length === 0 && 'שם',
    birthDate.length === 0 && 'תאריך לידה',
    !(Number(heightCm) > 0) && 'גובה',
    !(Number(startWeightKg) > 0) && 'משקל התחלתי',
    !(Number(goalWeightKg) > 0) && 'משקל יעד',
  ].filter((f): f is string => f !== false);
  const canSubmit = missingFields.length === 0;

  const heightNum = Number(heightCm);
  const startNum = Number(startWeightKg);
  const goalNum = Number(goalWeightKg);
  const previewBmi = heightNum > 50 && startNum > 10 ? weightToBmi(startNum, heightNum) : null;
  const previewDelta = startNum > 0 && goalNum > 0 ? goalNum - startNum : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSave({
      name: name.trim(),
      gender,
      birthDate,
      heightCm: Number(heightCm),
      startWeightKg: Number(startWeightKg),
      goalWeightKg: Number(goalWeightKg),
      photoBase64,
    });
    // Editing an existing profile keeps this form open (see App.tsx), so show a
    // transient confirmation instead of the implicit "form closed" feedback onboarding gets.
    if (initial) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    }
  }

  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-surface-container-lowest p-6 shadow-xl">
      <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-primary-fixed opacity-60 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 -left-20 h-44 w-44 rounded-full bg-secondary-fixed opacity-40 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="relative mb-4 flex items-center justify-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="העלאת תמונת פרופיל"
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-surface-container shadow-sm transition-opacity hover:opacity-90"
          >
            {photoBase64 ? (
              <img src={photoBase64} alt="תמונת פרופיל" className="h-full w-full object-cover" />
            ) : (
              <Icon name="monitor_weight" className="text-primary text-[36px]" />
            )}
          </button>
          {photoBase64 ? (
            <button
              type="button"
              onClick={() => setPhotoBase64(undefined)}
              aria-label="הסרת תמונה"
              className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-error-container text-error shadow-sm"
            >
              <Icon name="close" className="text-[14px]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="העלאת תמונת פרופיל"
              className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-secondary-container shadow-sm"
            >
              <Icon name="add_a_photo" className="text-on-secondary-container text-[13px]" filled />
            </button>
          )}
        </div>
        {photoError && <p className="mb-2 text-xs text-error">{photoError}</p>}

        <div className="mb-6 space-y-1">
          <span className="inline-flex items-center rounded-full bg-primary-fixed px-3 py-0.5 text-xs font-semibold tracking-wide text-primary">
            שקלולי • {initial ? 'עדכון פרטים' : 'צעד ראשון'}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">
            {initial ? 'עדכון הפרופיל שלך' : 'ברוכים הבאים לשקלולי'}
          </h1>
          <p className="mx-auto max-w-xs text-sm text-on-surface-variant">הגדרת נתוני פתיחה למעקב מותאם אישית ובריא</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-2.5 text-right">
          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-sm font-medium text-on-surface">
              <Icon name="badge" className="text-[18px] text-primary" />
              <span>שם</span>
            </span>
            <div className="relative flex items-center rounded-xl bg-surface-container-low transition-all focus-within:bg-surface-container-lowest focus-within:shadow-md">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-[52px] w-full rounded-xl bg-transparent px-4 text-lg font-semibold text-on-surface placeholder-outline focus:outline-none"
                required
              />
            </div>
          </label>

          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-sm font-medium text-on-surface">
              <Icon name="wc" className="text-[18px] text-primary" />
              <span>מגדר</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`flex h-[52px] items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-all ${
                  gender === 'male'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                <GenderSymbol gender="male" className="h-5 w-5" />
                <span>זכר</span>
              </button>
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`flex h-[52px] items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-all ${
                  gender === 'female'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                <GenderSymbol gender="female" className="h-5 w-5" />
                <span>נקבה</span>
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-sm font-medium text-on-surface">
              <Icon name="calendar_today" className="text-[18px] text-primary" />
              <span>תאריך לידה</span>
            </span>
            <div className="relative flex items-center rounded-xl bg-surface-container-low transition-all focus-within:bg-surface-container-lowest focus-within:shadow-md">
              <input
                type="date"
                value={birthDate}
                max={today()}
                onChange={(e) => setBirthDate(e.target.value)}
                className="h-[52px] w-full rounded-xl bg-transparent px-4 text-lg font-semibold text-on-surface placeholder-outline focus:outline-none"
                required
              />
            </div>
          </label>

          <Field label="גובה" icon="height" value={heightCm} onChange={setHeightCm} unit="ס״מ" />

          <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
            <Field label="משקל התחלתי" icon="monitor_weight" value={startWeightKg} onChange={setStartWeightKg} unit="ק״ג" step="0.1" />
            <Field label="משקל יעד" icon="flag" iconClass="text-secondary" value={goalWeightKg} onChange={setGoalWeightKg} unit="ק״ג" step="0.1" />
          </div>

          {(previewBmi !== null || previewDelta !== null) && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-surface-container p-2.5">
              <div className="flex items-center gap-2">
                <Icon name="check_circle" className="text-secondary text-[20px]" filled />
                <div className="text-right">
                  <span className="block text-xs text-on-surface-variant">BMI התחלתי משוער</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-bold text-on-surface">
                      {previewBmi !== null ? previewBmi.toFixed(1) : '--'}
                    </span>
                    {previewBmi !== null && (
                      <span className="text-xs font-medium text-secondary">({bmiCategory(previewBmi)})</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-surface-container-lowest px-3 py-1.5 text-left">
                <span className="block text-xs text-on-surface-variant">יעד לשינוי</span>
                <span className="text-sm font-bold text-primary">
                  {previewDelta !== null
                    ? `${previewDelta > 0 ? '+' : ''}${previewDelta.toFixed(1)} ק״ג`
                    : '—'}
                </span>
              </div>
            </div>
          )}

          {missingFields.length > 0 && (
            <p className="text-xs text-on-surface-variant">
              יש למלא כדי לשמור: <span className="font-semibold text-error">{missingFields.join(', ')}</span>
            </p>
          )}

          <div className="flex gap-2 pt-3">
            <button
              type="submit"
              disabled={!canSubmit}
              // On save, the button itself morphs to a green checkmark state for ~2s
              // (see justSaved in handleSubmit) instead of a separate confirmation line,
              // so the feedback lands exactly where the user's eyes already are.
              className={`flex h-[50px] flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold shadow-md transition-all duration-300 active:scale-[0.98] disabled:opacity-40 ${
                justSaved ? 'scale-[1.02] bg-secondary text-on-secondary' : 'bg-primary text-on-primary'
              }`}
            >
              {justSaved ? (
                <>
                  <Icon name="check" className="text-[20px] animate-[save-pop_0.4s_ease-out]" />
                  <span>הפרטים נשמרו</span>
                </>
              ) : (
                <>
                  <span>{initial ? 'שמירת שינויים' : 'שמור והתחל מעקב'}</span>
                  <Icon name="arrow_back" className="text-[20px]" />
                </>
              )}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-outline-variant px-4 text-sm text-on-surface-variant"
              >
                ביטול
              </button>
            )}
          </div>
        </form>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-on-surface-variant">
          <Icon name="verified_user" className="text-outline text-[16px]" />
          <span className="text-xs">הנתונים נשמרים מקומית במכשירך בלבד</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Male (♂) or female (♀) gender symbol as a plain inline SVG — drawn directly rather than
 * pulled from the Material Symbols icon font, so it always renders even if that font fails
 * to load, and so its stroke color follows `currentColor` in both selected/unselected states.
 * @param gender - which symbol to draw
 * @param className - sizing classes (e.g. "h-5 w-5")
 */
function GenderSymbol({ gender, className = '' }: { gender: 'male' | 'female'; className?: string }) {
  if (gender === 'male') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
        <circle cx="10" cy="14" r="6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 9.5 20 4M14 4h6v6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <circle cx="12" cy="9" r="6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v7M8.5 19h7" />
    </svg>
  );
}

/** Labeled numeric input with a unit suffix, used for each onboarding field. */
function Field({
  label,
  icon,
  iconClass = 'text-primary',
  value,
  onChange,
  unit,
  step = '1',
}: {
  label: string;
  icon: string;
  iconClass?: string;
  value: number | string;
  onChange: (v: string) => void;
  unit: string;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-sm font-medium text-on-surface">
        <Icon name={icon} className={`text-[18px] ${iconClass}`} />
        <span>{label}</span>
      </span>
      <div className="relative flex items-center rounded-xl bg-surface-container-low transition-all focus-within:bg-surface-container-lowest focus-within:shadow-md">
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-[52px] w-full rounded-xl bg-transparent pe-4 ps-14 text-lg font-semibold text-on-surface placeholder-outline focus:outline-none"
          required
        />
        <span className="absolute left-3 rounded-lg bg-surface-container px-2.5 py-1 text-xs text-on-surface-variant select-none">
          {unit}
        </span>
      </div>
    </label>
  );
}
