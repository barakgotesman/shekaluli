import { useMemo, useRef, useState } from 'react';
import type { Theme } from '../logic/theme';
import type { Profile, WeightEntry } from '../types';
import { getStorageUsage, STORAGE_WARNING_THRESHOLD_PERCENT } from '../logic/storageQuota';
import { calculateAge } from '../logic/dates';
import type { ExportFormat } from '../hooks/useAppData';
import Icon from '../components/Icon';

interface Props {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onEditProfile: () => void;
  profile: Profile;
  entries: WeightEntry[];
  onImportFile: (file: File) => Promise<void>;
  onExport: (format: ExportFormat) => void;
}

/**
 * Settings screen: real theme (light/dark) picker, profile summary/edit shortcut, real
 * CSV/Excel export and CSV import, and a localStorage usage indicator that warns as the
 * browser's storage quota is approached. The preferences toggles (reminder, unit, sound)
 * are inert — they update their own visual state only, since that functionality doesn't
 * exist yet.
 * @param theme - currently active theme
 * @param onThemeChange - called with the new theme when the user switches it
 * @param onEditProfile - called when the user chooses to edit their personal details
 * @param profile - user profile, shown in the personal-details summary card
 * @param entries - all weight entries, used for export and the storage usage estimate
 * @param onImportFile - called with a selected file to import (CSV parsing happens upstream)
 * @param onExport - called with the chosen format when an export option is picked
 */
export default function SettingsPage({
  theme,
  onThemeChange,
  onEditProfile,
  profile,
  entries,
  onImportFile,
  onExport,
}: Props) {
  const [reminderOn, setReminderOn] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recomputed on every render so the bar reflects the latest write; localStorage reads
  // are cheap and this view isn't in a hot render path.
  const usage = useMemo(() => getStorageUsage(), [entries, profile]);
  const isNearLimit = usage.percent >= STORAGE_WARNING_THRESHOLD_PERCENT;

  /** Forwards the chosen file to the parent for import. */
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    await onImportFile(file);
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-on-surface">הגדרות והעדפות</h1>
        <p className="text-sm text-on-surface-variant">התאם את חוויית המעקב והנתונים האישיים שלך</p>
      </div>

      <section className="flex flex-col gap-3">
        <SectionTitle icon="palette" label="ערכת נושא ומראה" />
        <div className="grid grid-cols-2 gap-3">
          <ThemeCard
            active={theme === 'light'}
            icon="light_mode"
            iconWrap="bg-amber-50 text-amber-500"
            title="מצב בהיר"
            subtitle="סגנון נקי וקליל"
            onClick={() => onThemeChange('light')}
          />
          <ThemeCard
            active={theme === 'dark'}
            icon="dark_mode"
            iconWrap="bg-slate-900 text-indigo-300"
            title="מצב כהה"
            subtitle="צבעים רכים ללילה"
            onClick={() => onThemeChange('dark')}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionTitle icon="person" label="פרטים אישיים ויעדים" />
          <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium text-on-secondary-container">
            מעודכן
          </span>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
          <div className="grid grid-cols-3 gap-2">
            <ProfileStat icon="calendar_today" label="גיל" value={calculateAge(profile.birthDate)} unit="שנים" />
            <ProfileStat icon="height" label="גובה" value={profile.heightCm} unit="ס״מ" />
            <ProfileStat icon="flag" label="משקל יעד" value={profile.goalWeightKg} unit="ק״ג" tone="secondary" />
          </div>
          <button
            onClick={onEditProfile}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-container-high py-3 px-4 text-sm font-semibold text-primary transition-all hover:bg-surface-container-highest active:scale-[0.98]"
          >
            <Icon name="edit" className="text-[18px]" />
            <span>עריכת פרטים אישיים ויעדים</span>
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle icon="notifications_active" label="העדפות תצוגה והתראות" />
        <div className="flex flex-col gap-3.5 rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
          <PreferenceToggle
            icon="alarm"
            iconWrap="bg-primary-fixed text-primary"
            title="תזכורת שקילה יומית"
            subtitle="בבוקר בשעה 07:30"
            checked={reminderOn}
            onToggle={() => setReminderOn((v) => !v)}
          />

          <div className="flex items-center justify-between pt-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-tertiary-fixed text-tertiary">
                <Icon name="scale" className="text-[20px]" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-on-surface">יחידות מידה</span>
                <span className="text-xs text-on-surface-variant">קובע את חישוב המשקל וה-BMI</span>
              </div>
            </div>
            <div className="flex rounded-xl bg-surface-container-low p-1 text-xs font-medium">
              <button
                onClick={() => setUnit('kg')}
                className={`rounded-lg px-3 py-1.5 transition-all ${unit === 'kg' ? 'bg-surface-container-lowest font-bold text-primary shadow-sm' : 'text-on-surface-variant'}`}
              >
                ק״ג
              </button>
              <button
                onClick={() => setUnit('lbs')}
                className={`rounded-lg px-3 py-1.5 transition-all ${unit === 'lbs' ? 'bg-surface-container-lowest font-bold text-primary shadow-sm' : 'text-on-surface-variant'}`}
              >
                lbs
              </button>
            </div>
          </div>

          <PreferenceToggle
            icon="volume_up"
            iconWrap="bg-secondary-container text-secondary"
            title="צליל אישור בשמירת שקילה"
            subtitle="משוב קולי נעים עם סיום השמירה"
            checked={soundOn}
            onToggle={() => setSoundOn((v) => !v)}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle icon="lock_reset" label="גיבוי ופרטיות" />
        <div className="flex flex-col gap-2 rounded-2xl bg-surface-container-lowest p-3.5 shadow-sm">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              disabled={entries.length === 0}
              className="flex w-full items-center justify-between rounded-xl p-3 text-right text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:text-on-surface-variant disabled:hover:bg-transparent"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container text-primary">
                  <Icon name="file_download" className="text-[20px]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-on-surface">ייצוא כל הנתונים</span>
                  <span className="text-xs text-on-surface-variant">קובץ CSV או Excel (.xls)</span>
                </div>
              </div>
              <Icon
                name="expand_more"
                className={`text-on-surface-variant text-[20px] transition-transform duration-300 ${showExportMenu ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              className={`grid transition-all duration-300 ease-out ${
                showExportMenu ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="grid grid-cols-2 gap-2 px-3 pt-1 pb-2">
                  <button
                    onClick={() => {
                      onExport('xls');
                      setShowExportMenu(false);
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-surface-container-low py-2.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container"
                  >
                    <Icon name="table_view" className="text-secondary text-[16px]" />
                    Excel (.xls)
                  </button>
                  <button
                    onClick={() => {
                      onExport('csv');
                      setShowExportMenu(false);
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-surface-container-low py-2.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container"
                  >
                    <Icon name="description" className="text-primary text-[16px]" />
                    CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-between rounded-xl p-3 text-right text-on-surface transition-colors hover:bg-surface-container-low"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container text-primary">
                <Icon name="file_upload" className="text-[20px]" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-on-surface">ייבוא נתונים</span>
                <span className="text-xs text-on-surface-variant">מקובץ CSV (תאריך, משקל)</span>
              </div>
            </div>
            <Icon name="arrow_back_ios_new" className="text-[20px]" />
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileSelected} className="hidden" />

          <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-on-surface">שימוש באחסון מקומי</span>
              <span className={isNearLimit ? 'font-semibold text-error' : 'text-on-surface-variant'}>
                {(usage.usedBytes / 1024).toFixed(1)} KB מתוך {(usage.limitBytes / 1024 / 1024).toFixed(0)} MB (
                {usage.percent.toFixed(1)}%)
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className={`h-full rounded-full transition-all ${isNearLimit ? 'bg-error' : 'bg-primary'}`}
                style={{ width: `${Math.max(2, usage.percent)}%` }}
              />
            </div>
            {isNearLimit && (
              <div className="flex items-center gap-2 text-[11px] text-error">
                <Icon name="warning" className="text-[16px]" />
                <span>מתקרבים למגבלת האחסון של הדפדפן. מומלץ לייצא ולגבות את הנתונים.</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
            <Icon name="lock" className="text-secondary text-[20px]" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-on-surface">הנתונים מאובטחים מקומית במכשירך</span>
              <span className="text-[11px] text-on-surface-variant">השקילות אינן מועברות לשום שרת חיצוני</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="flex flex-col items-center justify-center gap-1.5 pt-2 pb-2 text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs text-on-surface-variant">
          <span>פותח באהבה על ידי</span>
          <span className="font-semibold text-on-surface">Barak Gotesman</span>
          <Icon name="favorite" className="text-error text-[16px]" filled />
        </div>
        <div className="text-[11px] text-outline">גרסה 1.0.0 • שקלולי — מעקב משקל ומדדי גוף מודרני</div>
      </footer>
    </div>
  );
}

/** Small section header with an icon and label, used above each settings group. */
function SectionTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-base font-semibold text-on-surface">
      <Icon name={icon} className="text-primary text-[20px]" />
      <h2>{label}</h2>
    </div>
  );
}

/** Selectable theme swatch card (light/dark), highlighted when active. */
function ThemeCard({
  active,
  icon,
  iconWrap,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: string;
  iconWrap: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col rounded-2xl bg-surface-container-lowest p-3.5 text-right shadow-sm transition-all duration-200 ${
        active ? 'ring-2 ring-primary-container' : ''
      }`}
    >
      <div className="mb-3 flex w-full items-center justify-between">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm ${iconWrap}`}>
          <Icon name={icon} className="text-[20px]" />
        </div>
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full ${
            active ? 'bg-primary-container text-on-primary' : 'bg-surface-container-highest text-transparent'
          }`}
        >
          <Icon name="check" className="text-[14px]" />
        </span>
      </div>
      <div className="text-sm font-semibold text-on-surface">{title}</div>
      <div className="mt-0.5 text-[11px] text-on-surface-variant">{subtitle}</div>
    </button>
  );
}

/** Small stat tile in the profile summary (age/height/goal weight). */
function ProfileStat({
  icon,
  label,
  value,
  unit,
  tone = 'primary',
}: {
  icon: string;
  label: string;
  value: number;
  unit: string;
  tone?: 'primary' | 'secondary';
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-surface-container-low p-3 text-center">
      <Icon name={icon} className={`mb-1 text-[20px] ${tone === 'secondary' ? 'text-secondary' : 'text-primary'}`} />
      <span className="text-xs text-on-surface-variant">{label}</span>
      <div className={`mt-0.5 text-base font-bold ${tone === 'secondary' ? 'text-secondary' : 'text-on-surface'}`}>
        {value} <span className="text-xs font-normal">{unit}</span>
      </div>
    </div>
  );
}

/** Row with an icon, title/subtitle, and an inert on/off switch. */
function PreferenceToggle({
  icon,
  iconWrap,
  title,
  subtitle,
  checked,
  onToggle,
}: {
  icon: string;
  iconWrap: string;
  title: string;
  subtitle: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconWrap}`}>
          <Icon name={icon} className="text-[20px]" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-on-surface">{title}</span>
          <span className="text-xs text-on-surface-variant">{subtitle}</span>
        </div>
      </div>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={checked}
        className={`relative flex h-7 w-12 items-center rounded-full p-0.5 transition-colors ${
          checked ? 'bg-primary-container' : 'bg-surface-container-highest'
        }`}
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full bg-white text-primary shadow-md transition-transform ${
            checked ? '-translate-x-5' : 'translate-x-0'
          }`}
        >
          {checked && <Icon name="check" className="text-[14px]" />}
        </span>
      </button>
    </div>
  );
}
