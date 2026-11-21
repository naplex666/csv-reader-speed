// Fast drop-in for csv-reader 1.0.0 (make.fun's own reference program).
// Same answers as csv-reader 1.0.0 for every {text, header} -> {columns, rows, errors},
// same error codes (stray_cr, quote_junk, unterminated_quote, short_row, long_row),
// but slice/indexOf-driven instead of one character at a time.
//
// Semantics (from the reference): BOM dropped; record ends at LF or CRLF; a line
// with no characters is no record; outside quotes a CR not followed by LF is dropped
// (stray_cr); a field opening with a quote runs to the next non-doubled quote, "" -> ",
// CRLF/lone CR inside quotes -> LF; junk after the closing quote is appended as-is
// (quote_junk when the field ends); a quote that never closes is literal and the rest
// is re-read as unquoted (unterminated_quote); a quote inside an unquoted field is
// literal; fields stay strings; columns = first record iff header; rows padded with ""
// (short_row, fields: count) or cut (long_row, extra: cut fields) to the first
// record's width; errors {code, line, row} in order met, line = 1-based line the
// record starts on, row = record index in rows (null for the header).

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  const n = text.length;
  let pos = 0;
  let line = 1;
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  let recordLine = 1;
  let recordRow = null;

  // ended: 0 = comma, 1 = line break, 2 = end of text. Field results go in
  // fVal/fEnd/fAdded (no per-field array allocation).
  let fVal = '';
  let fEnd = 2;
  let fAdded = 0;
  // Reads an unquoted field starting at pos, with `init` already in the value
  // ("" normally; '"' for an unterminated quote re-read; the quoted value for junk).
  // `added` counts characters kept by this call.
  function readUnquoted(init) {
    let value = init;
    let added = 0;
    for (;;) {
      const iC = text.indexOf(',', pos);
      const iN = text.indexOf('\n', pos);
      let e = n;
      if (iC !== -1 && iC < e) e = iC;
      if (iN !== -1 && iN < e) e = iN;
      const seg = text.slice(pos, e);
      const r = seg.indexOf('\r');
      if (r === -1) {
        if (seg !== '') { value += seg; added += seg.length; }
        if (e >= n) { pos = n; fVal = value; fEnd = 2; fAdded = added; return; }
        if (e === iC) { pos = e + 1; fVal = value; fEnd = 0; fAdded = added; return; }
        // e === iN: LF line break.
        pos = e + 1; line += 1; fVal = value; fEnd = 1; fAdded = added; return;
      }
      // Rare: a stray CR inside this segment (or a CRLF at its end).
      // Walk the segment; a CR followed by LF (only possible at its very end,
      // when e is the LF) ends the field as a line break, any other CR is dropped.
      let cur = 0;
      let out = value;
      for (;;) {
        const j = seg.indexOf('\r', cur);
        if (j === -1) {
          if (cur < seg.length) { out += seg.slice(cur); added += seg.length - cur; }
          value = out;
          if (e >= n) { pos = n; fVal = value; fEnd = 2; fAdded = added; return; }
          if (e === iC) { pos = e + 1; fVal = value; fEnd = 0; fAdded = added; return; }
          pos = e + 1; line += 1; fVal = value; fEnd = 1; fAdded = added; return;
        }
        if (j > cur) { out += seg.slice(cur, j); added += j - cur; }
        if (j === seg.length - 1 && e === iN) {
          // CRLF: the CR belongs to the line break.
          value = out;
          pos = e + 1; line += 1; fVal = value; fEnd = 1; fAdded = added; return;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        cur = j + 1;
      }
    }
  }

  // Reads a quoted field whose opening quote is at pos. Result in fVal/fEnd.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    let p = pos + 1;
    for (;;) {
      const q = text.indexOf('"', p);
      if (q === -1) {
        // Never closes: literal quote, re-read the rest as unquoted.
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        readUnquoted('"');
        return;
      }
      const seg = text.slice(p, q);
      if (seg.indexOf('\r') === -1 && seg.indexOf('\n') === -1) {
        if (seg !== '') value += seg;
      } else {
        // Newlines inside quotes: CRLF and lone CR each become one LF.
        let breaks = 0;
        value += seg.replace(/\r\n|\r|\n/g, () => { breaks += 1; return '\n'; });
        line += breaks;
      }
      if (q + 1 < n && text.charCodeAt(q + 1) === 34) {
        value += '"';
        p = q + 2;
        continue;
      }
      // Closed at q.
      pos = q + 1;
      if (pos >= n) { fVal = value; fEnd = 2; return; }
      const c = text.charCodeAt(pos);
      if (c === 44) { pos += 1; fVal = value; fEnd = 0; return; }
      if (c === 10) { pos += 1; line += 1; fVal = value; fEnd = 1; return; }
      if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2; line += 1; fVal = value; fEnd = 1; return;
      }
      // Junk after the closing quote, appended as it stands.
      readUnquoted(value);
      if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      return;
    }
  }

  // Finishes one record: header / width / short_row / long_row bookkeeping.
  function endRecord(fields, quoted) {
    if (fields.length === 1 && fields[0] === '' && !quoted) return;
    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; return; }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  while (pos < n) {
    // Fast path: this record's line holds no quote and no stray CR, so it is
    // one plain line; split it at commas in C instead of scanning per field.
    const le = text.indexOf('\n', pos);
    const hasNL = le !== -1;
    const le2 = hasNL ? le : n;
    let lineEnd = le2;
    // Only a CR immediately before an LF is a CRLF line break; a CR at the
    // very end of the text (no LF after it) is a stray CR, handled slowly.
    if (hasNL && lineEnd > pos && text.charCodeAt(lineEnd - 1) === 13) lineEnd -= 1;
    if (lineEnd === pos) {
      // Empty line (LF or CRLF): no record. At EOF with no newline, done.
      if (!hasNL) break;
      pos = le + 1; line += 1;
      continue;
    }
    const lineStr = text.slice(pos, lineEnd);
    if (lineStr.indexOf('"') === -1 && lineStr.indexOf('\r') === -1) {
      recordLine = line;
      recordRow = header && columns === null ? null : rows.length;
      const fields = lineStr.split(',');
      pos = hasNL ? le + 1 : n;
      if (hasNL) line += 1;
      endRecord(fields, false);
      continue;
    }

    // Slow path: skip empty lines, then parse the record field by field.
    while (pos < n) {
      if (text.charCodeAt(pos) === 10) { pos += 1; line += 1; }
      else if (text.charCodeAt(pos) === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; }
      else break;
    }
    if (pos >= n) break;
    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    let ended;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted(); else readUnquoted('');
      fields.push(fVal);
      ended = fEnd;
    } while (ended === 0);
    endRecord(fields, quoted);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
