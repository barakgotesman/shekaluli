import html2canvas from 'html2canvas';

/**
 * Escapes text before interpolating it into an HTML template string.
 * @param value - text or number to escape
 * @returns the value with HTML-significant characters replaced by entities
 */
export function esc(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Waits until the web fonts and images inside a container are ready, so html2canvas
 * doesn't capture a fallback font or a half-loaded image.
 * @param container - off-screen element that was just filled with markup
 */
async function waitForAssets(container: HTMLElement): Promise<void> {
  try {
    await document.fonts.load("700 16px 'Rubik'");
    await document.fonts.ready;
  } catch {
    // Font loading is best-effort; the CSS falls back to a system font.
  }
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
    ),
  );
}

/**
 * Renders an HTML fragment off-screen (RTL, independent of the app's theme) and
 * rasterizes it with html2canvas. Rendering through the browser's own text layout is
 * how we get correct Hebrew/RTL text, which canvas/PDF text APIs can't shape on their own.
 * @param html - self-contained markup (inline styles or a scoped <style> block)
 * @param options - `scale` is the pixel density multiplier; `backgroundColor` fills transparent areas
 * @returns the rendered canvas
 */
export async function renderHtmlToCanvas(
  html: string,
  options: { scale?: number; backgroundColor?: string } = {},
): Promise<HTMLCanvasElement> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-9999px';
  container.style.zIndex = '-1';
  container.dir = 'rtl';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    await waitForAssets(container);
    return await html2canvas(container, {
      scale: options.scale ?? 2,
      backgroundColor: options.backgroundColor ?? '#ffffff',
    });
  } finally {
    document.body.removeChild(container);
  }
}
