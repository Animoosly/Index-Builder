(function () {
  'use strict';
  const Core = PDFIndexer, $ = id => document.getElementById(id);
  let records = [], exampleMode = false, editingId = null, busy = false;
  const escape = s => String(s).replace(/[&<>"']/g, x => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[x]));
  function message(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
  function render() {
    const q = $('search').value.trim().toLowerCase(), filter = $('filter').value;
    const filtered = Core.sorted(records).filter(r => (!q || [r.name, r.project, r.description, r.folder, Core.period(r)].join(' ').toLowerCase().includes(q)) && (filter === 'all' || filter === 'review' && (Core.rowIssues(r) || r.classification === 'Needs review') || filter === 'misc' && !r.start));
    // Limit the DOM to 500 rows. Export and session saves always use the full index.
    $('rows').innerHTML = filtered.slice(0, 500).map(r => { const note = Core.rowIssues(r); const needsReview = !!note || r.classification === 'Needs review'; return `<tr><td class="period">${escape(Core.period(r))}</td><td><div class="project">${escape(r.project || 'Unnamed project')}</div><div class="filename">${escape(r.name)}</div>${r.folder ? `<div class="filename">${escape(r.folder)}</div>` : ''}</td><td class="desc">${escape(r.description || '—')}</td><td>${needsReview ? `<span class="review">Needs review</span><div class="note">${escape(note || 'Marked for review')}</div>` : r.classification === 'Miscellaneous' ? '<span class="review misc">Miscellaneous</span>' : '<span class="ready">Indexed</span>'}</td><td>${(r.size / 1024).toLocaleString(undefined, {maximumFractionDigits: 1})}</td><td class="row-actions"><button data-edit="${escape(r.id)}" aria-label="Edit ${escape(r.name)}">Edit</button><button class="remove" data-remove="${escape(r.id)}" aria-label="Remove ${escape(r.name)}">Remove</button></td></tr>`; }).join('');
    $('index-table').hidden = !filtered.length; $('empty').hidden = !!filtered.length;
    $('empty').innerHTML = records.length ? '<h3>No matching documents</h3><p>Change the search or filter to see other files.</p>' : '<h3>Your archive starts here</h3><p>Drop PDFs above to build your master index.<br>Original filenames are kept in the workbook.</p>';
    $('total').textContent = records.length.toLocaleString(); $('dated').textContent = records.filter(r => r.start).length.toLocaleString(); $('review').textContent = records.filter(r => Core.rowIssues(r) || r.classification === 'Needs review').length.toLocaleString();
    $('shown').textContent = `${Math.min(filtered.length, 500).toLocaleString()} of ${filtered.length.toLocaleString()} matching documents shown${filtered.length > 500 ? ' (preview limit 500; all rows export)' : ''}${exampleMode ? ' · EXAMPLE DATA' : ''}`;
    for (const id of ['export', 'save-session', 'clear']) $(id).disabled = !records.length || busy;
    for (const id of ['choose', 'choose-folder', 'load-session', 'sample']) $(id).disabled = busy;
    $('sample').disabled = busy || !!records.length;
  }
  function download(bytes, name, mime) {
    const url = URL.createObjectURL(new Blob([bytes], {type: mime})), link = document.createElement('a');
    link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function addFiles(items, preSkipped = 0) {
    if (busy) return;
    if (exampleMode) { message('Clear the example data before adding your own PDFs.', true); return; }
    busy = true; render();
    try {
      message('Organizing PDF filenames…');
      const keys = new Set(records.map(Core.key)), paths = new Map(records.map(r => [r.path, r]));
      let added = 0, duplicates = 0, skipped = preSkipped;
      for (const item of items) {
        const file = item.file || item;
        if (!/\.pdf$/i.test(file.name)) { skipped++; continue; }
        const r = Core.fromFile(file, item.path);
        if (keys.has(Core.key(r))) { duplicates++; continue; }
        if (records.length >= 50000) throw new Error('The index has reached its 50,000-file limit. Save this session and start another index.');
        if (paths.has(r.path)) {
          r.note = [r.note, 'Same relative path as another file; verify these are separate documents'].filter(Boolean).join('; ');
          const prior = paths.get(r.path);
          if (!prior.note.includes('Same relative path')) prior.note = [prior.note, 'Same relative path as another file; verify these are separate documents'].filter(Boolean).join('; ');
        }
        records.push(r); keys.add(Core.key(r)); paths.set(r.path, r); added++;
        if (added % 500 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
      message(`Added ${added} PDF${added === 1 ? '' : 's'}.${duplicates ? ` Skipped ${duplicates} repeated selection${duplicates === 1 ? '' : 's'}.` : ''}${skipped ? ` Ignored ${skipped} non-PDF file${skipped === 1 ? '' : 's'}.` : ''} Review the preview, then download your Excel workbook.`);
    } catch (error) { message(error.message, true); }
    finally { busy = false; render(); }
  }
  async function readEntry(entry, parent = '') {
    if (entry.isFile) { const file = await new Promise((resolve, reject) => entry.file(resolve, reject)); return [{file, path: parent + file.name}]; }
    if (entry.isDirectory) {
      const reader = entry.createReader(), result = []; let entries;
      // Directory readers may return only 100 entries per batch. Drain every batch.
      do { entries = await new Promise((resolve, reject) => reader.readEntries(resolve, reject)); for (const child of entries) result.push(...await readEntry(child, parent + entry.name + '/')); } while (entries.length);
      return result;
    }
    return [];
  }
  $('choose').onclick = () => $('file-input').click(); $('choose-folder').onclick = () => $('folder-input').click();
  for (const id of ['file-input', 'folder-input']) $(id).onchange = async event => { const files = Array.from(event.target.files); event.target.value = ''; await addFiles(files); };
  let dragDepth = 0;
  // Prevent accidental navigation if a file is dropped outside the drop zone.
  document.addEventListener('dragover', event => { event.preventDefault(); });
  document.addEventListener('drop', event => { event.preventDefault(); });
  $('drop').addEventListener('dragenter', event => { event.preventDefault(); dragDepth++; $('drop').classList.add('over'); });
  $('drop').addEventListener('dragleave', () => { dragDepth--; if (dragDepth <= 0) $('drop').classList.remove('over'); });
  $('drop').addEventListener('drop', async event => {
    event.preventDefault(); dragDepth = 0; $('drop').classList.remove('over');
    if (busy || exampleMode) { message(busy ? 'Please wait for the current import to finish.' : 'Clear the example data before adding your own PDFs.', true); return; }
    // Capture entries synchronously; the drag data store is protected after this event.
    const entries = Array.from(event.dataTransfer.items || []).filter(i => i.kind === 'file').map(i => i.webkitGetAsEntry ? i.webkitGetAsEntry() : null);
    const fallback = Array.from(event.dataTransfer.files);
    if (entries.length && entries.every(Boolean)) {
      busy = true; render(); message('Reading dropped folders…');
      const files = [];
      try { for (const entry of entries) files.push(...await readEntry(entry)); }
      catch (error) { busy = false; render(); message('Could not read the entire drop: ' + error.message + '. Try Choose folder instead.', true); return; }
      busy = false; await addFiles(files);
    } else await addFiles(fallback);
  });
  $('rows').onclick = event => {
    const button = event.target.closest('button'); if (!button || busy) return;
    if (button.dataset.remove) { records = records.filter(r => r.id !== button.dataset.remove); if (!records.length) exampleMode = false; message('Document removed from the index.'); render(); }
    if (button.dataset.edit) {
      const record = records.find(r => r.id === button.dataset.edit); if (!record) return;
      editingId = record.id; $('edit-name').textContent = record.name;
      for (const field of ['start', 'end', 'project', 'description', 'classification', 'note']) $('edit-' + field).value = record[field] ?? '';
      $('edit-error').textContent = ''; $('editor').showModal();
    }
  };
  $('cancel-edit').onclick = () => $('editor').close();
  $('edit-form').onsubmit = event => {
    event.preventDefault(); const record = records.find(r => r.id === editingId); if (!record) return;
    const start = $('edit-start').value ? Number($('edit-start').value) : null;
    const end = $('edit-end').value ? Number($('edit-end').value) : start;
    const updated = {...record, start, end, project: $('edit-project').value.trim(), description: $('edit-description').value.trim(), classification: $('edit-classification').value, note: $('edit-note').value.trim()};
    if (start === null && end !== null || start !== null && (start < 1000 || start > 9999 || end < start || end > 9999 || !Number.isInteger(start) || !Number.isInteger(end))) { $('edit-error').textContent = 'Enter a valid four-digit start year and an end year that is the same or later.'; return; }
    if (!updated.project) { $('edit-error').textContent = 'Enter a project / location.'; return; }
    if (updated.classification === 'Dated' && !start) { $('edit-error').textContent = 'Add a year, or use Miscellaneous / Needs review for an undated document.'; return; }
    if (start !== record.start || end !== record.end) updated.date = '';
    Object.assign(record, updated); $('editor').close(); render(); message('Changes saved. The workbook will use your corrections.');
  };
  for (const id of ['search', 'filter']) $(id).addEventListener('input', render);
  $('clear').onclick = () => { if (confirm('Clear all indexed documents and edits? Save a session first if you want to keep them.')) { records = []; exampleMode = false; $('search').value = ''; $('filter').value = 'all'; message('Index cleared. Add your PDFs to begin.'); render(); } };
  $('export').onclick = async () => {
    if (busy || !records.length) return;
    busy = true; render(); message('Building the Excel workbook…');
    await new Promise(resolve => setTimeout(resolve, 30));
    try {
      const bytes = Core.createXlsx(records, {byYear: $('year-tabs').checked});
      let name = $('output-name').value.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/[. ]+$/, '') || 'PDF Master Index';
      if (!/\.xlsx$/i.test(name)) name += '.xlsx';
      if (exampleMode) name = 'EXAMPLE - ' + name;
      download(bytes, name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      message(`Excel download started: ${records.length} PDF records in the Master Index.${exampleMode ? ' This workbook contains example data only.' : ''}`);
    } catch (error) { message('Export failed: ' + error.message, true); }
    finally { busy = false; render(); }
  };
  $('save-session').onclick = () => { download(JSON.stringify({version: Core.VERSION, exampleMode, outputName: $('output-name').value, byYear: $('year-tabs').checked, records}, null, 2), exampleMode ? 'EXAMPLE - PDF Indexer session.json' : 'PDF Indexer session.json', 'application/json'); message('Session download started. Keep this JSON file to restore your index and edits later.'); };
  $('load-session').onclick = () => $('session-input').click();
  $('session-input').onchange = async event => {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    if (records.length && !confirm('Replace the current index with the saved session? Save the current session first if you want to keep it.')) return;
    busy = true; render();
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('Session file is larger than 100 MB.');
      const value = JSON.parse(await file.text()), restored = Core.validateSession(value);
      records = restored; exampleMode = value.exampleMode === true;
      $('output-name').value = typeof value.outputName === 'string' ? value.outputName.slice(0, 140) : 'PDF Master Index.xlsx'; $('year-tabs').checked = value.byYear === true;
      $('search').value = ''; $('filter').value = 'all'; message(`Restored ${records.length} PDF records and your corrections.${exampleMode ? ' This session contains example data.' : ''}`);
    } catch (error) { message('Session could not be loaded: ' + error.message, true); }
    finally { busy = false; render(); }
  };
  $('sample').onclick = () => {
    if (records.length) return;
    const names = ['1887-San Antonio Heights-Historic Parcel.pdf', '1945-Beryl Avenue Conduit-Profile.pdf', '1947-Alta Loma System-Vicinity Map.pdf', '1949-1952-Alta Loma Storm Drain-History.pdf', '!Misc-Alta Loma Storm Drain-East Alta Loma.pdf', 'Undated Drawing.pdf'];
    records = names.map((name, i) => Core.fromFile({name, size: (141 + i * 86) * 1024, lastModified: 0}, 'Example archive/' + name));
    exampleMode = true; render(); message('EXAMPLE DATA: These are demonstration filenames with made-up file sizes. Clear all before importing your real PDFs.');
  };
  window.addEventListener('beforeunload', event => { if (records.length) { event.preventDefault(); event.returnValue = ''; } });
  render();
})();
