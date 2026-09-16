import type { WeightEntry } from '../types';

const CSV_HEADER = 'date,weightKg,note';

/**
 * Wraps a CSV field value in quotes and escapes embedded quotes, if it contains a comma,
 * quote, or newline that would otherwise break column parsing.
 * @param value - raw field value
 * @returns a CSV-safe field
 */
function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Converts weight entries into CSV text (date,weightKg,note), sorted ascending by date.
 * @param entries - entries to export
 * @returns CSV text including a header row
 */
export function entriesToCsv(entries: WeightEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const rows = sorted.map((e) => `${e.date},${e.weightKg},${csvField(e.note ?? '')}`);
  return [CSV_HEADER, ...rows].join('\n');
}

/**
 * Triggers a browser download of text content as a file, via a temporary object URL.
 * @param content - file contents
 * @param filename - suggested download filename
 * @param mimeType - MIME type for the generated blob
 */
export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Downloads all weight entries as a CSV file. */
export function exportEntriesAsCsv(entries: WeightEntry[]): void {
  downloadTextFile(entriesToCsv(entries), 'shekaluli-weights.csv', 'text/csv;charset=utf-8');
}

/**
 * Splits one CSV line into fields, honoring double-quoted fields (which may contain
 * commas, newlines already stripped by line-splitting, and "" as an escaped quote).
 * @param line - a single CSV line
 * @returns the line's unquoted field values, in order
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

/**
 * Parses CSV text (as produced by entriesToCsv, or a plain date,weightKg export from a
 * spreadsheet) back into weight entries. A header row is tolerated since it fails the
 * date-format check and is skipped like any other invalid line.
 * @param text - raw CSV file contents
 * @returns valid weight entries found in the file (may be empty if none parsed)
 */
export function parseCsvToEntries(text: string): WeightEntry[] {
  const entries: WeightEntry[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    const [dateRaw, weightRaw, noteRaw] = splitCsvLine(line).map((p) => p.trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) continue;
    const weightKg = Number(weightRaw);
    if (!Number.isFinite(weightKg) || weightKg <= 0) continue;
    entries.push({ date: dateRaw, weightKg, ...(noteRaw ? { note: noteRaw } : {}) });
  }
  return entries;
}

/**
 * Reads a File as text via FileReader, wrapped in a Promise for async/await use.
 * @param file - file selected by the user (e.g. from an <input type="file">)
 * @returns the file's text contents
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
