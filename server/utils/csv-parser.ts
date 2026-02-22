// ─── CSV Parser ────────────────────────────────────────────────────────────────
// Parses CSV import files for expenses/incomes.
// Supports DD/MM/YYYY date format (UK locale).

export interface CsvRow {
  [key: string]: string;
}

/**
 * Parse a CSV string into an array of row objects.
 * Handles quoted fields and comma-within-quotes.
 */
export function parseCsv(text: string): CsvRow[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  const headers = parseLine(lines[0]);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseLine(line);
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? '').trim();
    });
    rows.push(row);
  }

  return rows;
}

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Parse a UK date string (DD/MM/YYYY) to ISO format (YYYY-MM-DD).
 * Returns null if unparseable.
 */
export function parseUkDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return null;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Convert a pounds string to pence integer.
 * e.g. "12.50" → 1250, "£12.50" → 1250
 */
export function poundsStrToPence(str: string): number {
  const cleaned = str.replace(/[£,\s]/g, '');
  const val = parseFloat(cleaned);
  if (isNaN(val)) return 0;
  return Math.round(val * 100);
}
