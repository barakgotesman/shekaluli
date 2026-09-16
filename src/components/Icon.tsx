interface Props {
  name: string;
  className?: string;
  filled?: boolean;
}

/**
 * Renders a single Material Symbols Outlined glyph by ligature name (e.g. "show_chart").
 * @param name - Material Symbols icon name
 * @param className - extra classes, typically a text size like "text-[20px]" and a color
 * @param filled - whether to render the filled variant instead of the default outline
 */
export default function Icon({ name, className = '', filled = false }: Props) {
  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}
