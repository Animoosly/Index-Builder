/* PDF Indexer 1.0.0 | Offline filename indexing. No PDF content is read. */
(function (scope) {
  'use strict';
  const VERSION = 1;
  const HEADERS = ['Period', 'Project / location', 'Description', 'Original filename', 'Start year', 'End year', 'Document date', 'Relative folder', 'Size (KB)', 'Classification', 'Review notes'];
  const enc = new TextEncoder();
  function validDate(y, m, d) {
    const date = new Date(Date.UTC(y, m - 1, d));
    return y >= 1000 && y <= 9999 && date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }
  function parseFilename(filename) {
    let text = filename.replace(/\.pdf$/i, '').trim();
    let start = null, end = null, date = '', classification = 'Dated', note = '', match;
    const delimiter = /^\s*[-–—_]\s*/;
    if ((match = text.match(/^!?(?:misc|miscellaneous)(?=\s*[-–—_]|$)/i))) {
      classification = 'Miscellaneous'; text = text.slice(match[0].length).replace(delimiter, '');
    } else if ((match = text.match(/^(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})(?=\s*[-–—_ ]|$)/))) {
      const [y, m, d] = match.slice(1).map(Number);
      if (validDate(y, m, d)) { start = end = y; date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
      else { classification = 'Needs review'; note = 'Invalid calendar date in filename'; }
      text = text.slice(match[0].length).replace(delimiter, '');
    } else if ((match = text.match(/^(\d{4})\s*[-–—_]\s*(\d{4})(?=\s*[-–—_ ]|$)/))) {
      start = Number(match[1]); end = Number(match[2]);
      if (start < 1000 || end < start) { start = end = null; classification = 'Needs review'; note = 'Invalid or reversed year range'; }
      text = text.slice(match[0].length).replace(delimiter, '');
    } else if ((match = text.match(/^(\d{4})(?=\s*[-–—_ ]|$)/))) {
      start = end = Number(match[1]);
      if (start < 1000) { start = end = null; classification = 'Needs review'; note = 'Invalid year'; }
      text = text.slice(match[0].length).replace(delimiter, '');
    } else { classification = 'Needs review'; note = 'No recognized leading year, year range, ISO date, or !Misc prefix'; }
    // A hyphen is the separator visible in the reference filenames. Remaining
    // segments form the description, so no text is silently discarded.
    const pieces = text.split(/\s*[-–—]\s*/);
    const project = (pieces.shift() || '').trim();
    const description = pieces.join(' - ').trim();
    if (!project) note = [note, 'Missing project / location'].filter(Boolean).join('; ');
    return {start, end, date, project, description, classification, note};
  }
  function period(record) { return record.start ? (record.end && record.end !== record.start ? `${record.start}–${record.end}` : String(record.start)) : 'Undated'; }
  function rowIssues(record) {
    const notes = [record.note || ''];
    if (record.start !== null && (!Number.isInteger(record.start) || record.start < 1000 || record.start > 9999)) notes.push('Start year must have four digits');
    if (record.end !== null && (!Number.isInteger(record.end) || record.end < 1000 || record.end > 9999)) notes.push('End year must have four digits');
    if ((record.start === null) !== (record.end === null)) notes.push('Both start and end year are required');
    if (record.start !== null && record.end < record.start) notes.push('End year precedes start year');
    if (!record.project.trim()) notes.push('Missing project / location');
    if (!record.start && record.classification !== 'Miscellaneous') notes.push('Document year is unknown');
    return [...new Set(notes.filter(Boolean))].join('; ');
  }
  function sorted(records) { return [...records].sort((a, b) => (a.start ?? 10000) - (b.start ?? 10000) || (a.end ?? 10000) - (b.end ?? 10000) || a.project.localeCompare(b.project, undefined, {numeric: true, sensitivity: 'base'}) || a.name.localeCompare(b.name, undefined, {numeric: true})); }
  function fromFile(file, path) {
    const relativePath = (path || file.webkitRelativePath || file.name).replace(/\\/g, '/');
    return {id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, path: relativePath, folder: relativePath.includes('/') ? relativePath.slice(0, relativePath.lastIndexOf('/')) : '', size: file.size, modified: file.lastModified, ...parseFilename(file.name)};
  }
  function key(record) { return JSON.stringify([record.path, record.size, record.modified]); }
  function validateSession(value) {
    if (!value || value.version !== VERSION || !Array.isArray(value.records) || value.records.length > 50000) throw new Error('This is not a supported PDF Indexer session (maximum 50,000 records).');
    const ids = new Set();
    return value.records.map(r => {
      if (!r || !['id', 'name', 'path', 'folder', 'project', 'description', 'classification', 'note', 'date'].every(k => typeof r[k] === 'string') || !/\.pdf$/i.test(r.name) || !Number.isFinite(r.size) || r.size < 0 || !Number.isFinite(r.modified) || !['Dated', 'Miscellaneous', 'Needs review'].includes(r.classification) || ![r.start, r.end].every(x => x === null || Number.isInteger(x) && x >= 1000 && x <= 9999) || r.start === null !== (r.end === null) || r.start !== null && r.end < r.start || r.date && (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !validDate(...r.date.split('-').map(Number)) || Number(r.date.slice(0, 4)) !== r.start || r.start !== r.end)) throw new Error('The session contains an invalid document record.');
      if (ids.has(r.id)) throw new Error('The session contains duplicate record IDs.');
      ids.add(r.id);
      return Object.fromEntries(['id', 'name', 'path', 'folder', 'project', 'description', 'classification', 'note', 'date', 'size', 'modified', 'start', 'end'].map(k => [k, r[k]]));
    });
  }
  function xml(value) { return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
  const crcTable = Array.from({length: 256}, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1; return n >>> 0; });
  function crc32(data) { let crc = 0xffffffff; for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8; return (crc ^ 0xffffffff) >>> 0; }
  function concat(chunks) { const out = new Uint8Array(chunks.reduce((n, b) => n + b.length, 0)); let offset = 0; for (const b of chunks) { out.set(b, offset); offset += b.length; } return out; }
  function zip(files) {
    const local = [], central = []; let offset = 0;
    for (const [name, content] of Object.entries(files)) {
      const nameBytes = enc.encode(name), data = typeof content === 'string' ? enc.encode(content) : content;
      const checksum = crc32(data), head = new Uint8Array(30), h = new DataView(head.buffer);
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(12, 33, true);
      h.setUint32(14, checksum, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nameBytes.length, true);
      local.push(head, nameBytes, data);
      const entry = new Uint8Array(46), c = new DataView(entry.buffer);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(14, 33, true);
      c.setUint32(16, checksum, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nameBytes.length, true); c.setUint32(42, offset, true);
      central.push(entry, nameBytes); offset += head.length + nameBytes.length + data.length;
    }
    const directory = concat(central), end = new Uint8Array(22), e = new DataView(end.buffer), count = Object.keys(files).length;
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, count, true); e.setUint16(10, count, true); e.setUint32(12, directory.length, true); e.setUint32(16, offset, true);
    return concat([...local, directory, end]);
  }
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  function excelDate(iso) { const n = Date.parse(iso + 'T00:00:00Z') / 86400000 - Date.UTC(1899, 11, 31) / 86400000; return n + (iso >= '1900-03-01' ? 1 : 0); }
  function cell(ref, value, style = 0) {
    if (value === null || value === undefined || value === '') return `<c r="${ref}" s="${style}"/>`;
    if (typeof value === 'number') return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
    // All filenames and descriptions are explicitly literal strings, including =,+,-,@ prefixes.
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(String(value).slice(0, 32767))}</t></is></c>`;
  }
  function groups(records, byYear) {
    const all = sorted(records), result = [{name: 'Master Index', records: all}];
    if (byYear) {
      const names = new Map();
      for (const record of all) {
        // A range belongs to its starting year once; it is never counted once per year.
        const name = record.start ? String(record.start) : 'Undated';
        if (!names.has(name)) names.set(name, []);
        names.get(name).push(record);
      }
      for (const [name, rows] of names) result.push({name, records: rows});
    }
    return result;
  }
  function createXlsx(records, options = {}) {
    if (!records.length) throw new Error('Add at least one PDF first.');
    if (records.length > 50000) throw new Error('Export up to 50,000 PDFs at a time.');
    const sheets = groups(records, !!options.byYear), files = {};
    const overrides = [], rels = [], sheetTags = [];
    sheets.forEach((group, index) => {
      const n = index + 1, last = group.records.length + 5;
      overrides.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`, `<Override PartName="/xl/tables/table${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`);
      rels.push(`<Relationship Id="rId${n}" Type="${REL}/worksheet" Target="worksheets/sheet${n}.xml"/>`);
      sheetTags.push(`<sheet name="${xml(group.name)}" sheetId="${n}" r:id="rId${n}"/>`);
      const widths = [18, 42, 60, 76, 12, 12, 18, 42, 14, 22, 70];
      const rows = [`<row r="2" ht="26" customHeight="1">${cell('A2', group.name, 1)}</row>`, `<row r="3" ht="22" customHeight="1">${cell('A3', `${group.records.length} PDF files. Filename metadata only. Year ranges stay intact.`, 4)}</row>`, `<row r="5" ht="28" customHeight="1">${HEADERS.map((h, i) => cell(String.fromCharCode(65 + i) + '5', h, 2)).join('')}</row>`];
      group.records.forEach((r, i) => {
        const issues = rowIssues(r), before1900 = r.date && r.date < '1900-01-01';
        const values = [period(r), r.project, r.description, r.name, r.start, r.end, r.date ? (before1900 ? r.date : excelDate(r.date)) : null, r.folder, r.size / 1024, r.classification, [issues, before1900 ? 'Date before 1900 stored as ISO text for Excel compatibility' : ''].filter(Boolean).join('; ')];
        const wrapColumns = [1, 2, 3, 7, 10];
        const lines = Math.max(1, ...wrapColumns.map(j => String(values[j] ?? '').split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / (widths[j] * 0.85))), 0)));
        const height = Math.min(409, Math.max(24, lines * 16 + 8));
        rows.push(`<row r="${i + 6}" ht="${height}" customHeight="1">${values.map((v, j) => cell(String.fromCharCode(65 + j) + (i + 6), v, j === 6 && r.date && !before1900 ? 3 : j === 8 ? 5 : wrapColumns.includes(j) ? 6 : j === 0 ? 7 : 0)).join('')}</row>`);
      });
      files[`xl/worksheets/sheet${n}.xml`] = XML_HEAD + `<worksheet xmlns="${NS}" xmlns:r="${REL}"><dimension ref="A1:K${last}"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A6" sqref="A6"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData><conditionalFormatting sqref="K6:K${last}"><cfRule type="expression" dxfId="0" priority="1"><formula>LEN(K6)&gt;0</formula></cfRule></conditionalFormatting><tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>`;
      files[`xl/worksheets/_rels/sheet${n}.xml.rels`] = XML_HEAD + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/table" Target="../tables/table${n}.xml"/></Relationships>`;
      files[`xl/tables/table${n}.xml`] = XML_HEAD + `<table xmlns="${NS}" id="${n}" name="PDFIndex${n}" displayName="PDFIndex${n}" ref="A5:K${last}" totalsRowShown="0"><autoFilter ref="A5:K${last}"/><tableColumns count="11">${HEADERS.map((h, i) => `<tableColumn id="${i + 1}" name="${xml(h)}"/>`).join('')}</tableColumns><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`;
    });
    files['[Content_Types].xml'] = XML_HEAD + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides.join('')}</Types>`;
    files['_rels/.rels'] = XML_HEAD + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    files['xl/workbook.xml'] = XML_HEAD + `<workbook xmlns="${NS}" xmlns:r="${REL}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheetTags.join('')}</sheets></workbook>`;
    files['xl/_rels/workbook.xml.rels'] = XML_HEAD + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}<Relationship Id="rId${sheets.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`;
    files['xl/styles.xml'] = XML_HEAD + `<styleSheet xmlns="${NS}"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="#,##0.0"/></numFmts><fonts count="4"><font><sz val="11"/><color rgb="FF233247"/><name val="Arial"/></font><font><b/><sz val="16"/><color rgb="FF233247"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><i/><sz val="11"/><color rgb="FF59697E"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF263E5D"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="1"><dxf><font><color rgb="FF8D4808"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFFFEACC"/><bgColor indexed="64"/></patternFill></fill></dxf></dxfs><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`;
    // Extra text styles keep long names visible and periods consistently aligned.
    const textStyle = wrap => `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"${wrap ? ' wrapText="1"' : ''}/></xf>`;
    files['xl/styles.xml'] = files['xl/styles.xml'].replace('<cellXfs count="6">', '<cellXfs count="8">').replace('</cellXfs>', textStyle(true) + textStyle(false) + '</cellXfs>');
    return zip(files);
  }
  const api = {VERSION, HEADERS, parseFilename, period, rowIssues, sorted, fromFile, key, validateSession, groups, createXlsx, excelDate};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  scope.PDFIndexer = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
