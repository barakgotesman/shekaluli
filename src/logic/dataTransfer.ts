import type { WeightEntry } from '../types';

const CSV_HEADER = 'date,weightKg';

/**
 * Converts weight entries into CSV text (date,weightKg), sorted ascending by date.
 * @param entries - entries to export
 * @returns CSV text including a header row
 */
export function entriesToCsv(entries: WeightEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const rows = sorted.map((e) => `${e.date},${e.weightKg}`);
  return [CSV_HEADER, ...rows].join('\n');
}

/**
 * Converts weight entries into a SpreadsheetML (Excel 2003 XML) document. Excel opens
 * this natively as a real spreadsheet, unlike the common "HTML table saved as .xls"
 * trick, which triggers a "file format doesn't match extension" warning on open.
 * @param entries - entries to export
 * @returns SpreadsheetML XML text
 */
export function entriesToXlsXml(entries: WeightEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const rows = sorted
    .map(
      (e) =>
        `<Row><Cell><Data ss:Type="String">${e.date}</Data></Cell><Cell><Data ss:Type="Number">${e.weightKg}</Data></Cell></Row>`,
    )
    .join('');
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="שקלולי">
    <Table>
      <Row><Cell><Data ss:Type="String">תאריך</Data></Cell><Cell><Data ss:Type="String">משקל (ק"ג)</Data></Cell></Row>
      ${rows}
    </Table>
  </Worksheet>
</Workbook>`;
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

/** Downloads all weight entries as an Excel-compatible .xls file. */
export function exportEntriesAsXls(entries: WeightEntry[]): void {
  downloadTextFile(entriesToXlsXml(entries), 'shekaluli-weights.xls', 'application/vnd.ms-excel');
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
    const [dateRaw, weightRaw] = line.split(',').map((p) => p.trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) continue;
    const weightKg = Number(weightRaw);
    if (!Number.isFinite(weightKg) || weightKg <= 0) continue;
    entries.push({ date: dateRaw, weightKg });
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
