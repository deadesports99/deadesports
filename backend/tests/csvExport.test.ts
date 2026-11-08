/**
 * CSV export safety — spreadsheet formula / DDE injection (go-live hardening 1.7).
 *
 * Every admin CSV (match roster, device groups, daily settlement) is opened in
 * Excel or Google Sheets. A cell starting with `=`, `+`, `-`, `@`, TAB or CR is
 * evaluated as a formula by those programs, and Excel/LibreOffice also honour
 * DDE payloads such as `=cmd|'/c calc'!A0`.
 *
 * A player types their own In-Game Name, so an attacker could plant one of these
 * strings and have it run on the organiser's machine when the roster is opened.
 * These tests lock the mitigation in place: the value must survive verbatim for
 * a human reader, but the spreadsheet must never see a leading formula trigger.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { csvEscape, csvRow } from '../src/utils/csv.js';

/** Every character that makes Excel / Sheets treat the cell as a formula. */
const DANGEROUS_LEADS = ['=', '+', '-', '@', '\t', '\r'];

describe('csvEscape — spreadsheet formula injection', () => {
  it('defuses a DDE command payload so Excel does not execute it', () => {
    const out = csvEscape("=cmd|'/c calc'!A0");
    assert.ok(out.startsWith("'"), 'cell must be prefixed with an apostrophe');
    // The original text stays readable — we disarm, we do not delete.
    assert.ok(out.includes("cmd|'/c calc'!A0"));
  });

  it('defuses a HYPERLINK exfiltration payload', () => {
    const out = csvEscape('=HYPERLINK("http://evil.example","Click me")');
    // This payload contains quotes/commas, so it is ALSO RFC-4180 quoted.
    // Unwrap the quoting before checking the first character.
    const inner = out.startsWith('"') ? out.slice(1, -1).replace(/""/g, '"') : out;
    assert.ok(inner.startsWith("'="), `expected a disarmed cell, got ${JSON.stringify(out)}`);
  });

  it('defuses every formula trigger character', () => {
    for (const lead of DANGEROUS_LEADS) {
      const out = csvEscape(`${lead}1+1`);
      const unquoted = out.startsWith('"') ? out.slice(1) : out;
      assert.ok(
        !DANGEROUS_LEADS.includes(unquoted[0] ?? ''),
        `lead ${JSON.stringify(lead)} leaked through as ${JSON.stringify(out)}`,
      );
    }
  });

  it('leaves ordinary player names untouched', () => {
    assert.equal(csvEscape('SpartanOP'), 'SpartanOP');
    assert.equal(csvEscape('iam_sniper_x'), 'iam_sniper_x');
    assert.equal(csvEscape('Rahul 99'), 'Rahul 99');
    // A minus inside the name is fine — only a LEADING trigger is dangerous.
    assert.equal(csvEscape('Sniper-X'), 'Sniper-X');
    assert.equal(csvEscape('APE-0211'), 'APE-0211');
  });

  it('still applies RFC 4180 quoting for delimiters, quotes and newlines', () => {
    assert.equal(csvEscape('a,b'), '"a,b"');
    assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
    assert.equal(csvEscape('line1\nline2'), '"line1\nline2"');
  });

  it('quotes a defused cell that also contains a comma', () => {
    // Both rules must apply: disarm the lead, then quote for the delimiter.
    assert.equal(csvEscape('=a,b'), '"\'=a,b"');
  });

  it('renders null and undefined as an empty cell', () => {
    assert.equal(csvEscape(null), '');
    assert.equal(csvEscape(undefined), '');
  });

  it('keeps numbers numeric', () => {
    assert.equal(csvEscape(0), '0');
    assert.equal(csvEscape(550.5), '550.5');
    assert.equal(csvEscape(-5), "'-5", 'a leading minus is disarmed too');
  });
});

describe('csvRow — building a line', () => {
  it('joins cells with commas and no trailing newline', () => {
    assert.equal(csvRow('S.No', 'Player', 'Amount'), 'S.No,Player,Amount');
    assert.equal(csvRow('S.No', 'Player', 'Amount').endsWith('\n'), false);
  });

  it('defuses a hostile cell in the middle of a row', () => {
    const row = csvRow(1, 'APE-0211', '=1+1', '550');
    assert.equal(row, "1,APE-0211,'=1+1,550");
  });
});
