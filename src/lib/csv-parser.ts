/**
 * RFC 4180 Compliant CSV Parser (BUG-016)
 * Handles quoted fields, embedded commas, escaped quotes (""), and multiline fields correctly.
 */

export function parseCsv(text: string): string[][] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let fieldIsQuoted = false;
  let i = 0;

  const pushCurrentField = () => {
    const val = fieldIsQuoted ? currentField : currentField.trim();
    currentRow.push(val);
    currentField = '';
    fieldIsQuoted = false;
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ("")
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        fieldIsQuoted = true;
        i++;
        continue;
      } else if (char === ',') {
        pushCurrentField();
        i++;
        continue;
      } else if (char === '\r') {
        // Handle CRLF
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i++;
        }
        pushCurrentField();
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else if (char === '\n') {
        pushCurrentField();
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Push final field and row if any
  pushCurrentField();
  if (currentRow.some((f) => f.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}
