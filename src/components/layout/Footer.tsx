import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../Icon';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface Props {
  onAdd: () => void;
}

const ITEMS: NavItem[] = [
  { path: '/graph', label: 'גרף', icon: 'show_chart' },
  { path: '/history', label: 'היסטוריה', icon: 'history' },
];

const ITEMS_AFTER: NavItem[] = [
  { path: '/stats', label: 'סטטיסטיקה', icon: 'bar_chart' },
  { path: '/settings', label: 'הגדרות', icon: 'settings' },
];

/**
 * Fixed bottom app navigation bar (mobile-first, also usable on wider screens).
 * Renders four route tabs plus a centered floating "+" button for adding today's weight.
 * Reads the active tab from the current route and navigates via react-router.
 * @param onAdd - called when the center "+" button is tapped
 */
export default function Footer({ onAdd }: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md bg-surface-container-lowest/90 shadow-[0_-2px_12px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <nav className="relative flex h-16 items-center justify-around px-1">
        {ITEMS.map((item) => (
          <NavButton
            key={item.path}
            item={item}
            active={location.pathname === item.path}
            onClick={() => navigate(item.path)}
          />
        ))}

        <div className="relative -top-5 flex flex-col items-center justify-center">
          <button
            onClick={onAdd}
            aria-label="הוספת שקילה"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-container text-on-primary shadow-[0_10px_20px_-3px_rgba(79,70,229,0.35),0_4px_6px_-2px_rgba(79,70,229,0.2)] transition-transform hover:scale-105 active:scale-95"
          >
            <Icon name="add" className="text-[30px]" />
          </button>
        </div>

        {ITEMS_AFTER.map((item) => (
          <NavButton
            key={item.path}
            item={item}
            active={location.pathname === item.path}
            onClick={() => navigate(item.path)}
          />
        ))}
      </nav>
    </footer>
  );
}

/** Single tab button in the bottom nav. */
function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 py-1 transition-colors ${
        active ? 'bg-primary-container font-semibold text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
      }`}
    >
      <Icon name={item.icon} className="text-[22px]" />
      <span className="font-label-sm text-xs">{item.label}</span>
    </button>
  );
}
