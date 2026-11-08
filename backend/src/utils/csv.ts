/**
 * 📊 CSV EXPORT SAFETY
 *
 * Every CSV the admin downloads (match roster, device groups, daily settlement)
 * is opened in Excel / Google Sheets / LibreOffice. Those programs treat a cell
 * beginning with `=`, `+`, `-`, `@`, TAB or CR as a **formula**, and both Excel
 * and LibreOffice additionally honour DDE payloads such as:
 *
 *     =cmd|'/c calc'!A0
 *     =HYPERLINK("http://evil.example","Click me")
 *
 * A player controls their own In-Game Name and Free Fire UID, so a malicious
 * registrant could plant that string and have it execute on the *organiser's*
 * machine the moment the roster is exported. Quoting the cell does **not** help:
 * Excel still evaluates formulas inside quoted cells.
 *
 * The OWASP-recommended mitigation is used here: prefix a single apostrophe,
 * which makes the spreadsheet treat the whole cell as literal text.
 *
 * Both `csvEscape` and `csvRow` live here so all three exporters share exactly
 * one implementation — a fix in one place cannot miss another export.
 */

/** Characters that make a spreadsheet treat the cell as a formula / DDE payload. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Escape one value for a CSV cell, and defuse spreadsheet formula injection.
 *
 * @param value anything — `null`/`undefined` become an empty cell.
 * @returns a cell safe to embed between commas.
 */
export function csvEscape(value: string | number | null | undefined | unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);

  // 1) Defuse formula / DDE injection before any quoting.
  const defused = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;

  // 2) RFC 4180 quoting: wrap when the value contains a delimiter, quote or newline.
  return /[",\n\r]/.test(defused) ? `"${defused.replace(/"/g, '""')}"` : defused;
}

/**
 * Build one CSV line from several values.
 *
 * @param values the cells of the row, in order.
 * @returns the joined row **without** a trailing newline (caller joins rows).
 */
export function csvRow(...values: Array<string | number | null | undefined | unknown>): string {
  return values.map(csvEscape).join(',');
}
