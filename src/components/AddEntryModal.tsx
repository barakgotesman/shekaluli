import WeightForm from './WeightForm';
import Icon from './Icon';
import { formatDateIL } from '../logic/dates';

interface Props {
  onSubmit: (date: string, weightKg: number, note: string) => void;
  onClose: () => void;
  defaultWeight?: number;
  editingEntry?: { date: string; weightKg: number; note?: string };
}

/**
 * Modal overlay wrapping WeightForm, opened from the bottom nav's "+" button to log a
 * new weight entry, or from a history row's edit action to revise an existing one.
 * @param onSubmit - forwarded to WeightForm; also closes the modal on success
 * @param onClose - called when the user dismisses the modal without saving
 * @param defaultWeight - initial slider value when adding a new entry (ignored when editing)
 * @param editingEntry - when set, the modal edits this entry instead of adding a new one, pre-filling its date and weight
 */
export default function AddEntryModal({ onSubmit, onClose, defaultWeight, editingEntry }: Props) {
  function handleSubmit(date: string, weightKg: number, note: string) {
    onSubmit(date, weightKg, note);
    onClose();
  }

  const isEditing = !!editingEntry;
  const dateLabel = formatDateIL(editingEntry?.date ?? new Date().toISOString().slice(0, 10));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-inverse-surface/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto flex w-full max-w-md max-h-[calc(100vh-2rem)] flex-col overflow-y-auto rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-xl font-bold text-on-surface">{isEditing ? 'עריכת שקילה' : 'הוספת שקילה חדשה'}</h2>
              <span className="inline-flex items-center gap-1 rounded-md bg-primary-fixed px-2 py-0.5 text-xs font-medium text-primary">
                <Icon name="calendar_month" className="text-[13px]" />
                {dateLabel}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              {isEditing ? 'עדכן את המשקל או התאריך עבור שקילה זו' : 'הזן את המשקל הנמדד שלך לעדכון המגמה'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="סגור"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <WeightForm
          onSubmit={handleSubmit}
          defaultWeight={editingEntry?.weightKg ?? defaultWeight}
          defaultDate={editingEntry?.date}
          defaultNote={editingEntry?.note}
        />
      </div>
    </div>
  );
}
