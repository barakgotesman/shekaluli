const MAX_DIMENSION_PX = 320;
const JPEG_QUALITY = 0.8;

/**
 * Reads an image file, downscales it (capped at 320px on the longer side) and
 * re-encodes it as a JPEG data URL, so a profile photo doesn't bloat the
 * localStorage quota shared with weight history.
 * @param file - image file selected by the user
 * @returns a base64 `data:image/jpeg;base64,...` string
 */
export function fileToResizedBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('קובץ התמונה לא תקין'));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('לא ניתן לעבד את התמונה'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
