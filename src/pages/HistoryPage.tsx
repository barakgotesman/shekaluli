import { useMemo, useState } from 'react';
import type { Profile, WeightEntry } from '../types';
import { bmiCategory, getEntryBmi } from '../logic/bmi';
import { formatDateIL, formatDayIL } from '../logic/dates';
import type { ExportFormat } from '../hooks/useAppData';
import Icon from '../components/Icon';

interface Props {
  entries: WeightEntry[];
  profile: Profile;
  onDelete: (date: string) => void;
  onEdit: (entry: WeightEntry) => void;
  onExport: (format: ExportFormat) => void;
}

const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

interface MonthGroup {
  key: string;
  label: string;
  entries: WeightEntry[];
  changeKg: number;
}

interface YearGroup {
  year: string;
  months: MonthGroup[];
  total: number;
}

/**
 * Groups entries by year, then by month within each year, newest first, computing
 * each month's net weight change, to power the collapsible history list.
 * @param entries - all weight entries, any order
 * @returns years (newest first), each containing months (newest first) with their entries (newest first)
 */
function groupByYearAndMonth(entries: WeightEntry[]): YearGroup[] {
  const byYear = new Map<string, Map<string, WeightEntry[]>>();
  for (const entry of entries) {
    const year = entry.date.slice(0, 4);
    const monthKey = entry.date.slice(0, 7);
    if (!byYear.has(year)) byYear.set(year, new Map());
    const months = byYear.get(year)!;
    if (!months.has(monthKey)) months.set(monthKey, []);
    months.get(monthKey)!.push(entry);
  }

  return Array.from(byYear.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, months]) => {
      const monthGroups = Array.from(months.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([key, monthEntries]) => {
          const sorted = [...monthEntries].sort((a, b) => a.date.localeCompare(b.date));
          const changeKg = sorted.length > 1 ? sorted[sorted.length - 1].weightKg - sorted[0].weightKg : 0;
          return {
            key,
            label: MONTHS_HE[Number(key.slice(5, 7)) - 1],
            entries: [...sorted].reverse(),
            changeKg,
          };
        });
      return { year, months: monthGroups, total: monthGroups.reduce((sum, m) => sum + m.entries.length, 0) };
    });
}

/**
 * Checks whether an entry matches a free-text search query, against its date (either
 * ISO or dd/mm/yyyy display form, so both "2026-09" and "14/09" work) or its weight.
 * @param entry - entry to test
 * @param query - raw search text as typed by the user
 * @returns true if the entry matches, or if the query is empty (no filter applied)
 */
function matchesSearch(entry: WeightEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    entry.date.includes(q) ||
    formatDateIL(entry.date).includes(q) ||
    entry.weightKg.toFixed(1).includes(q)
  );
}

/** Advanced filter values from the "tune" panel; empty string means "no bound". */
interface AdvancedFilters {
  dateFrom: string;
  dateTo: string;
  weightMin: string;
  weightMax: string;
}

const EMPTY_FILTERS: AdvancedFilters = { dateFrom: '', dateTo: '', weightMin: '', weightMax: '' };

/**
 * Checks whether an entry falls within the given date/weight range filters.
 * @param entry - entry to test
 * @param filters - advanced filter bounds; any blank field is treated as unbounded
 * @returns true if the entry satisfies every set bound
 */
function matchesFilters(entry: WeightEntry, filters: AdvancedFilters): boolean {
  if (filters.dateFrom && entry.date < filters.dateFrom) return false;
  if (filters.dateTo && entry.date > filters.dateTo) return false;
  if (filters.weightMin && entry.weightKg < Number(filters.weightMin)) return false;
  if (filters.weightMax && entry.weightKg > Number(filters.weightMax)) return false;
  return true;
}

/**
 * Full history list of logged weights, grouped by year and month (accordion-style),
 * each row showing weight, BMI, and category with edit and delete actions, filterable
 * by a date/weight search box. Also renders an export dialog (CSV / Excel).
 * @param entries - all weight entries, any order
 * @param profile - user profile, used to compute BMI per entry
 * @param onDelete - called with a date (YYYY-MM-DD) when its row's delete button is clicked
 * @param onEdit - called with the entry when its row's edit button is clicked
 * @param onExport - called with the chosen format when an export option is picked
 */
export default function HistoryPage({ entries, profile, onDelete, onEdit, onExport }: Props) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const filteredEntries = useMemo(
    () =>
      entries.filter((e) => (query.trim() ? matchesSearch(e, query) : true) && matchesFilters(e, filters)),
    [entries, query, filters],
  );
  const years = useMemo(() => groupByYearAndMonth(filteredEntries), [filteredEntries]);
  const [openMonth, setOpenMonth] = useState<string | null>(years[0]?.months[0]?.key ?? null);
  const [showExportModal, setShowExportModal] = useState(false);
  const isSearching = query.trim().length > 0;

  /** Updates a single advanced-filter field. */
  function setFilter(field: keyof AdvancedFilters, value: string) {
    setFilters((f) => ({ ...f, [field]: value }));
  }

  /** Exports all entries in the given format and closes the export dialog. */
  function handleExport(format: ExportFormat) {
    onExport(format);
    setShowExportModal(false);
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-container-lowest p-6 text-center text-on-surface-variant shadow-sm">
        עדיין אין נתונים. הוסיפו משקל כדי לראות היסטוריה.
      </div>
    );
  }

  const sortedTotal = entries.length;
  const totalDelta = entries[entries.length - 1].weightKg - entries[0].weightKg;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-lg font-semibold tracking-tight text-on-surface">יומן שקילות והיסטוריה</span>
          <span className="text-xs text-on-surface-variant">מעקב כרונולוגי רציף ומדויק</span>
        </div>
        <button
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-2 text-xs font-medium text-primary shadow-sm transition-all hover:bg-surface-container-highest active:scale-95"
        >
          <Icon name="ios_share" className="text-[18px]" />
          <span>ייצוא נתונים</span>
        </button>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-surface-container to-surface-container-low p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-on-primary shadow-md">
              <Icon name="calendar_month" className="text-[20px]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-on-surface-variant">רישום תקופתי</span>
              <span className="text-base font-bold text-on-surface">{sortedTotal} שקילות מתועדות</span>
            </div>
          </div>
          <div className="flex flex-col items-end text-left">
            <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-semibold text-secondary">
              {totalDelta.toFixed(1)} ק״ג בסה״כ
            </span>
          </div>
        </div>
      </div>

      {/* Search toolbar: filters the list below by date (ISO or dd/mm/yyyy) or weight. */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-outline">
            <Icon name="search" className="text-[18px]" />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-xl bg-surface-container-lowest pr-9 pl-9 text-xs text-on-surface shadow-sm placeholder:text-outline focus:outline-none"
            placeholder="חיפוש לפי תאריך (14/09) או משקל (72.5)..."
            type="text"
          />
          {isSearching && (
            <button
              onClick={() => setQuery('')}
              aria-label="ניקוי חיפוש"
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full p-1 text-outline hover:bg-surface-container hover:text-on-surface"
            >
              <Icon name="close" className="text-[16px]" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters((s) => !s)}
          title="סינון מתקדם"
          aria-expanded={showFilters}
          className={`relative flex h-11 items-center justify-center rounded-xl px-3 shadow-sm transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'bg-primary-container text-on-primary'
              : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          <Icon name="tune" className="text-[20px]" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-on-secondary">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-on-surface-variant">מתאריך</span>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilter('dateFrom', e.target.value)}
                className="h-10 rounded-lg bg-surface-container px-2.5 text-xs text-on-surface focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-on-surface-variant">עד תאריך</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilter('dateTo', e.target.value)}
                className="h-10 rounded-lg bg-surface-container px-2.5 text-xs text-on-surface focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-on-surface-variant">משקל מינימלי (ק״ג)</span>
              <input
                type="number"
                step="0.1"
                value={filters.weightMin}
                onChange={(e) => setFilter('weightMin', e.target.value)}
                className="h-10 rounded-lg bg-surface-container px-2.5 text-xs text-on-surface focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-on-surface-variant">משקל מקסימלי (ק״ג)</span>
              <input
                type="number"
                step="0.1"
                value={filters.weightMax}
                onChange={(e) => setFilter('weightMax', e.target.value)}
                className="h-10 rounded-lg bg-surface-container px-2.5 text-xs text-on-surface focus:outline-none"
              />
            </label>
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="self-start text-xs font-semibold text-primary hover:underline"
            >
              נקה סינון
            </button>
          )}
        </div>
      )}

      {filteredEntries.length === 0 && (
        <div className="rounded-2xl bg-surface-container-lowest p-6 text-center text-on-surface-variant shadow-sm">
          {isSearching ? (
            <>לא נמצאו שקילות התואמות ל&quot;{query.trim()}&quot;.</>
          ) : (
            <>לא נמצאו שקילות התואמות לסינון שנבחר.</>
          )}
        </div>
      )}

      {years.map((yearGroup) => (
        <div key={yearGroup.year} className="flex flex-col gap-3">
          <div className="flex items-center gap-2 pt-2">
            <span className="rounded-md bg-primary px-2.5 py-0.5 text-xs font-semibold tracking-wide text-on-primary">
              {yearGroup.year}
            </span>
            <div className="h-0.5 flex-1 rounded-full bg-surface-container-high" />
            <span className="text-xs text-on-surface-variant">{yearGroup.total} שקילות השנה</span>
          </div>

          {yearGroup.months.map((month) => {
            const isOpen = isSearching || openMonth === month.key;
            return (
              <div key={month.key} className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm">
                <button
                  onClick={() => setOpenMonth(isOpen ? null : month.key)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-right transition-colors hover:bg-surface-container-low/60"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`h-2.5 w-2.5 rounded-full ${isOpen ? 'bg-secondary' : 'bg-primary-container'}`} />
                    <div className="flex flex-col">
                      <span className="text-base font-semibold text-on-surface">{month.label}</span>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-on-surface-variant">
                        <span>{month.entries.length} שקילות</span>
                        {month.changeKg !== 0 && (
                          <>
                            <span className="text-outline-variant">•</span>
                            <span className={`font-medium ${month.changeKg < 0 ? 'text-secondary' : 'text-error'}`}>
                              שינוי חודשי: {month.changeKg.toFixed(1)} ק״ג
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Icon
                    name="expand_more"
                    className={`text-outline text-[22px] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isOpen && (
                  <div className="overflow-x-auto px-2 pb-3">
                    <table className="w-full select-none border-collapse text-right">
                      <thead>
                        <tr className="rounded-lg bg-surface-container-low/70 text-xs text-on-surface-variant">
                          <th className="rounded-r-lg px-2.5 py-2.5 font-medium">תאריך</th>
                          <th className="px-2 py-2.5 font-medium">משקל</th>
                          <th className="px-1.5 py-2.5 font-medium">BMI</th>
                          <th className="px-2 py-2.5 font-medium">סטטוס</th>
                          <th className="rounded-l-lg px-2 py-2.5 text-center font-medium">פעולות</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {month.entries.map((e) => {
                          const bmi = getEntryBmi(e, profile);
                          return (
                            <tr key={e.date} className="transition-colors hover:bg-surface-container-low/40">
                              <td className="whitespace-nowrap px-2.5 py-2.5 font-medium text-on-surface">
                                <span className="inline-flex items-center gap-1">
                                  {formatDayIL(e.date)}
                                  {e.note && (
                                    <span title={e.note}>
                                      <Icon name="sticky_note_2" className="text-primary text-[14px]" />
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-2 py-2.5 font-semibold tabular-nums text-on-surface">
                                {e.weightKg.toFixed(1)} <span className="text-xs font-normal text-on-surface-variant">ק״ג</span>
                              </td>
                              <td className="px-1.5 py-2.5 tabular-nums text-on-surface-variant">{bmi.toFixed(1)}</td>
                              <td className="px-2 py-2.5">
                                <span className="inline-flex items-center rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface">
                                  {bmiCategory(bmi)}
                                </span>
                              </td>
                              <td className="px-2 py-2.5 text-center">
                                <div className="inline-flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => onEdit(e)}
                                    title="עריכה"
                                    className="rounded-md p-1 text-outline transition-colors hover:bg-primary-fixed hover:text-primary"
                                  >
                                    <Icon name="edit" className="text-[17px]" />
                                  </button>
                                  <button
                                    onClick={() => onDelete(e.date)}
                                    title="מחיקה"
                                    className="rounded-md p-1 text-outline transition-colors hover:bg-error-container hover:text-error"
                                  >
                                    <Icon name="delete" className="text-[17px]" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {showExportModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-inverse-surface/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setShowExportModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-surface-container-lowest p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="file_download" className="text-primary text-[24px]" />
                <span className="text-base font-semibold text-on-surface">ייצוא נתוני שקילה</span>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                aria-label="סגירה"
                className="rounded-full p-1 text-outline hover:bg-surface-container-high"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
            <p className="text-xs text-on-surface-variant">
              בחר את הפורמט המועדף לייצוא כל {sortedTotal} השקילות השמורות במערכת שקלולי:
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleExport('xls')}
                className="flex flex-col items-center justify-center rounded-xl bg-surface-container-low p-3.5 transition-colors hover:bg-surface-container active:scale-95"
              >
                <Icon name="table_view" className="text-secondary text-[28px]" />
                <span className="mt-1 text-xs font-semibold text-on-surface">Microsoft Excel</span>
                <span className="text-[11px] text-on-surface-variant">קובץ .xls</span>
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="flex flex-col items-center justify-center rounded-xl bg-surface-container-low p-3.5 transition-colors hover:bg-surface-container active:scale-95"
              >
                <Icon name="description" className="text-primary text-[28px]" />
                <span className="mt-1 text-xs font-semibold text-on-surface">קובץ CSV</span>
                <span className="text-[11px] text-on-surface-variant">מופרד בפסיקים</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
