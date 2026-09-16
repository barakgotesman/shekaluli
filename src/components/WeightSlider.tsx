import { useRef, useState } from 'react';
import Icon from './Icon';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

/** Pixels of ruler track per whole kilogram; also defines tick spacing. */
const PX_PER_KG = 90;
/** How many whole-kg tick labels to render on each side of the center value. */
const VISIBLE_KG_RADIUS = 6;

/**
 * Clamps a value between min and max, then rounds to one decimal place —
 * keeps dragged/typed weight values consistent with 0.1 kg entry precision.
 */
function clampAndRound(value: number, min: number, max: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  return Math.round(clamped * 10) / 10;
}

/**
 * A horizontal drag-to-select ruler for choosing weight, styled after the
 * scale/meter widgets in real weight-tracking apps: a fixed center indicator
 * with a scrolling tick strip behind it, plus +/- 0.1 kg nudge buttons.
 * @param value - currently selected weight (kg)
 * @param onChange - called with the new weight whenever it changes (drag or nudge)
 * @param min - lowest selectable weight, defaults to 30
 * @param max - highest selectable weight, defaults to 250
 */
export default function WeightSlider({ value, onChange, min = 30, max = 250 }: Props) {
  const dragState = useRef<{ startX: number; startValue: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startValue: value };
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current) return;
    // Dragging left reveals higher numbers (like scrolling a filmstrip toward later frames).
    const deltaPx = dragState.current.startX - e.clientX;
    const deltaKg = deltaPx / PX_PER_KG;
    onChange(clampAndRound(dragState.current.startValue + deltaKg, min, max));
  }

  function handlePointerUp() {
    dragState.current = null;
    setDragging(false);
  }

  function nudge(deltaKg: number) {
    onChange(clampAndRound(value + deltaKg, min, max));
  }

  const centerKg = Math.round(value);
  const kgLabels = [];
  for (let kg = centerKg - VISIBLE_KG_RADIUS; kg <= centerKg + VISIBLE_KG_RADIUS; kg++) {
    if (kg < min || kg > max) continue;
    kgLabels.push(kg);
  }

  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low/80 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-on-surface-variant">סרגל כיול שקילה</span>
        <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[11px] font-semibold text-primary">
          רגישות 100 גרם
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => nudge(-0.1)}
          aria-label="הפחתת 0.1 ק״ג"
          className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/60 bg-surface-container-lowest text-primary shadow-sm transition-all hover:bg-primary-fixed active:scale-90"
        >
          <span className="font-mono text-xs font-bold transition-transform group-hover:scale-110">− 0.1</span>
        </button>

        <div
          className={`relative h-20 flex-1 touch-none overflow-hidden rounded-xl border border-primary-fixed/60 bg-primary-fixed/20 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Vignette gradients so ticks fade out near the edges. */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-surface-container-low to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-surface-container-low to-transparent" />

          {/* Scrolling tick strip: minor ticks every 0.1kg, taller major ticks every whole kg. */}
          <div
            className="absolute inset-y-0"
            style={{
              left: '50%',
              width: `${(max - min) * PX_PER_KG}px`,
              transform: `translateX(${-((value - min) * PX_PER_KG)}px)`,
              backgroundImage:
                'repeating-linear-gradient(to left, var(--color-outline) 0 1.5px, transparent 1.5px 9px), repeating-linear-gradient(to left, var(--color-outline-variant) 0 1px, transparent 1px ' +
                `${PX_PER_KG / 10}px)`,
              backgroundSize: `${PX_PER_KG}px 55%, ${PX_PER_KG / 10}px 32%`,
              backgroundPosition: 'left bottom, left bottom',
              backgroundRepeat: 'repeat-x, repeat-x',
            }}
          >
            {kgLabels.map((kg) => (
              <span
                key={kg}
                className="absolute top-1.5 -translate-x-1/2 text-[10px] font-semibold text-on-surface-variant"
                style={{ left: `${(kg - min) * PX_PER_KG}px` }}
              >
                {kg}
              </span>
            ))}
          </div>

          {/* Fixed center indicator marking the currently selected value. */}
          <div className="pointer-events-none absolute top-0 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center">
            <div className="h-0 w-0 border-t-[8px] border-r-[6px] border-l-[6px] border-t-primary border-r-transparent border-l-transparent" />
            <div className="h-9 w-[2.5px] rounded-full bg-primary shadow-[0_0_8px_rgba(79,70,229,0.5)]" />
          </div>
        </div>

        <button
          onClick={() => nudge(0.1)}
          aria-label="הוספת 0.1 ק״ג"
          className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/60 bg-surface-container-lowest text-primary shadow-sm transition-all hover:bg-primary-fixed active:scale-90"
        >
          <span className="font-mono text-xs font-bold transition-transform group-hover:scale-110">+ 0.1</span>
        </button>
      </div>
      <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-on-surface-variant">
        <Icon name="drag_indicator" className="text-[14px]" />
        <span>גררו את הסרגל או השתמשו בכפתורים לכיוונון עדין</span>
      </div>
    </div>
  );
}
