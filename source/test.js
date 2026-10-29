'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('./core.js');
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
test('reference year and project', () => {
  assert.deepEqual(C.parseFilename('1945-Beryl Avenue Conduit-Profile.pdf'), {start: 1945, end: 1945, date: '', project: 'Beryl Avenue Conduit', description: 'Profile', classification: 'Dated', note: ''});
});
test('range preserves both years', () => {
  const r = C.parseFilename('1949-1952-Alta Loma Storm Drain-History.pdf');
  assert.equal(r.start, 1949); assert.equal(r.end, 1952); assert.equal(C.period(r), '1949–1952'); assert.equal(r.project, 'Alta Loma Storm Drain');
});
test('historical year is not a file-modified date', () => {
  const r = C.fromFile({name: '1887-San Antonio Heights-Historic Parcel.pdf', size: 1234, lastModified: Date.now()});
  assert.equal(r.start, 1887); assert.equal(r.date, '');
});
test('misc prefix and undated remain undated', () => {
  const r = C.parseFilename('!Misc-Alta Loma Storm Drain-East Alta Loma.PDF');
  assert.equal(r.start, null); assert.equal(r.end, null); assert.equal(r.classification, 'Miscellaneous'); assert.equal(r.project, 'Alta Loma Storm Drain'); assert.equal(r.description, 'East Alta Loma'); assert.equal(C.rowIssues(r), '');
});
test('invalid and reversed ranges need review', () => {
  for (const name of ['1952-1949-Project-Map.pdf', '0000-Project-Map.pdf', '2026-02-30-Project-Map.pdf']) { const r = C.parseFilename(name); assert.equal(r.start, null); assert.ok(r.note); }
});
test('full dates and leap dates are validated', () => {
  assert.equal(C.parseFilename('2024-02-29-Project-Report.pdf').date, '2024-02-29');
  assert.equal(C.parseFilename('2023-02-29-Project-Report.pdf').classification, 'Needs review');
  assert.equal(C.parseFilename('1887-10-21-Project-Map.pdf').date, '1887-10-21');
  assert.equal(C.excelDate('1900-01-01'), 1); assert.equal(C.excelDate('1900-02-28'), 59); assert.equal(C.excelDate('1900-03-01'), 61); assert.equal(C.excelDate('1970-01-01'), 25569);
});
test('missing year is exposed', () => { const r = C.parseFilename('Map without date.pdf'); assert.equal(r.start, null); assert.ok(C.rowIssues(r)); });
test('preserves all remaining description segments', () => { assert.equal(C.parseFilename('1932-Cucamonga Basin No 3-East Third-Plan-Profile.pdf').description, 'East Third - Plan - Profile'); });
test('different delimiters and casing', () => {
  for (const name of ['1945 – Beryl Avenue Conduit – Profile.PDF', '1945-Beryl Avenue Conduit-Profile.pdf']) assert.equal(C.parseFilename(name).project, 'Beryl Avenue Conduit');
});
const names = ['1949-1952-Alta Loma Storm Drain-History.pdf', '!Misc-Alta Loma Storm Drain-East Alta Loma.pdf', '1887-San Antonio Heights-Historic Parcel.pdf', '1945-Beryl Avenue Conduit-Profile.pdf', '2026-10-21-Project-Report.pdf', 'Undated Drawing.pdf', '1946-=1+1-<Map & "Profile">.pdf', '1887-10-21-Project-Historic date.pdf'];
const records = names.map((name, i) => C.fromFile({name, size: (i + 1) * 1024, lastModified: i}, 'Drawings/' + name));
test('stable chronological order and undated at end', () => { const s = C.sorted(records); assert.equal(s[0].start, 1887); assert.equal(s.at(-1).start, null); assert.equal(s.filter(r => r.start === null).length, 2); });
test('year grouping does not duplicate ranges', () => { const g = C.groups(records, true); assert.equal(g[0].name, 'Master Index'); assert.equal(g.slice(1).reduce((n, x) => n + x.records.length, 0), records.length); assert.equal(g.find(x => x.name === '1949').records.length, 1); assert.ok(!g.some(x => x.name === '1952')); });
test('duplicate selections use path size and timestamp', () => { assert.equal(C.key(records[0]), C.key({...records[0], id: 'other'})); assert.notEqual(C.key(records[0]), C.key({...records[0], size: 99})); });
test('session round trip and malformed data rejection', () => {
  const result = C.validateSession(JSON.parse(JSON.stringify({version: 1, records})));
  assert.deepEqual(result, records);
  for (const value of [{version: 2, records}, {version: 1, records: [{}]}, {version: 1, records: [records[0], records[0]]}, {version: 1, records: [{...records[0], start: null}]}]) assert.throws(() => C.validateSession(value));
});
test('empty export is blocked', () => { assert.throws(() => C.createXlsx([])); });
test('exports a real ZIP workbook', () => {
  const bytes = C.createXlsx(records, {byYear: true});
  assert.equal(new DataView(bytes.buffer).getUint32(0, true), 0x04034b50);
  fs.writeFileSync(path.join(__dirname, 'test-export.xlsx'), bytes);
  fs.writeFileSync(path.join(__dirname, 'test-records.json'), JSON.stringify(records));
});
console.log(`${count} tests passed.`);
