import { useEffect, useMemo, useState } from 'react';
import type { Profile, WeightEntry } from '../types';
import {
  SHARE_PERIODS,
  SHARE_STYLES,
  generateShareCardBlob,
  getShareStats,
  loadShareStyle,
  saveShareStyle,
  shareCardBlob,
} from '../logic/shareCard';
import type { SharePeriod, ShareStats, ShareStyleId } from '../logic/shareCard';
import Icon from './Icon';

interface Props {
  entries: WeightEntry[];
  profile: Profile;
  onClose: () => void;
}

/**
 * Modal that previews the shareable progress card for a chosen period and shares it
 * (system share sheet on mobile, PNG download elsewhere). The image is generated as
 * soon as the period changes, so the Share click can call the Web Share API
 * immediately, while the browser still treats it as a user gesture.
 * @param entries - all weight entries
 * @param profile - user profile (start/goal weight)
 * @param onClose - called when the user dismisses the modal
 */
export default function ShareCardModal({ entries, profile, onClose }: Props) {
  const [period, setPeriod] = useState<SharePeriod>(30);
  // Result is tagged with the stats it was rendered for, so a stale render (from a
  // previous period) is ignored without needing to reset state inside the effect.
  const [style, setStyle] = useState<ShareStyleId>(loadShareStyle);
  const [result, setResult] = useState<{
    for: ShareStats;
    style: ShareStyleId;
    blob?: Blob;
    url?: string;
    error?: string;
  } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const stats = useMemo(() => getShareStats(entries, profile, period), [entries, profile, period]);
  const current = result && result.for === stats && result.style === style ? result : null;

  useEffect(() => {
    if (!stats) return;
    let cancelled = false;
    let url: string | null = null;

    generateShareCardBlob(stats, style)
      .then((b) => {
        if (cancelled) return;
        url = URL.createObjectURL(b);
        setResult({ for: stats, style, blob: b, url });
      })
      .catch((e) => {
        if (!cancelled) setResult({ for: stats, style, error: e instanceof Error ? e.message : 'יצירת התמונה נכשלה.' });
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [stats, style]);

  /**
   * Switches the period and clears the previous share/download confirmation.
   * @param next - the newly selected period
   */
  function selectPeriod(next: SharePeriod) {
    setPeriod(next);
    setStatus(null);
  }

  /**
   * Switches the card's background style, remembers it, and clears the share confirmation.
   * @param next - the newly selected style
   */
  function selectStyle(next: ShareStyleId) {
    setStyle(next);
    saveShareStyle(next);
    setStatus(null);
  }

  /** Shares (or downloads) the already-rendered card. */
  async function handleShare() {
    const blob = current?.blob;
    if (!blob || !stats) return;
    const outcome = await shareCardBlob(blob, stats);
    if (outcome === 'downloaded') setStatus('התמונה נשמרה במכשיר');
    else if (outcome === 'shared') setStatus('שותף בהצלחה');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-inverse-surface/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto flex w-full max-w-md max-h-[calc(100vh-2rem)] flex-col gap-4 overflow-y-auto rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-on-surface">שיתוף כרטיס התקדמות</h2>
            <p className="text-xs text-on-surface-variant">הכרטיס מציג רק שינויים, בלי משקל מוחלט או BMI</p>
          </div>
          <button
            onClick={onClose}
            aria-label="סגור"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="flex rounded-xl bg-surface-container-low p-1 text-xs font-medium">
          {SHARE_PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => selectPeriod(p.value)}
              className={`flex-1 rounded-lg px-2 py-1.5 transition-all ${
                period === p.value
                  ? 'bg-surface-container-lowest font-bold text-primary shadow-sm'
                  : 'text-on-surface-variant'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2" role="radiogroup" aria-label="סגנון רקע">
          <span className="text-xs font-medium text-on-surface-variant">רקע</span>
          <div className="flex gap-3">
            {SHARE_STYLES.map((st) => (
              <button
                key={st.id}
                onClick={() => selectStyle(st.id)}
                role="radio"
                aria-checked={style === st.id}
                aria-label={st.label}
                title={st.label}
                className={`h-9 w-9 rounded-full border border-outline-variant transition-all ${
                  style === st.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-lowest' : ''
                }`}
                style={{ background: st.bg }}
              />
            ))}
          </div>
        </div>

        <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-2xl bg-surface-container-low">
          {!stats ? (
            <p className="p-6 text-center text-sm text-on-surface-variant">אין מספיק נתונים בתקופה הזו. נסו תקופה ארוכה יותר.</p>
          ) : current?.error ? (
            <p className="p-6 text-center text-sm text-error">{current.error}</p>
          ) : current?.url ? (
            <img src={current.url} alt="תצוגה מקדימה של כרטיס ההתקדמות" className="w-full" />
          ) : (
            <p className="p-6 text-center text-sm text-on-surface-variant">מכין את הכרטיס...</p>
          )}
        </div>

        <button
          onClick={handleShare}
          disabled={!current?.blob}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container py-3 text-sm font-semibold text-on-primary transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <Icon name="share" className="text-[18px]" />
          <span>שתף</span>
        </button>
        {status && <p className="text-center text-xs text-on-surface-variant">{status}</p>}
      </div>
    </div>
  );
}
