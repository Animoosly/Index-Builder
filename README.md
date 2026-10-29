# PDF Indexer

Open **PDF Indexer.html** in Microsoft Edge or Google Chrome. No installation,
internet connection, server, account, or Excel installation is required to create
a workbook. Excel or another compatible spreadsheet app is needed to view it.

1. Drop PDFs or folders on the drop area, or use Choose PDF files / Choose folder.
2. Review the index. Click Edit to correct years, project/location, descriptions,
   classifications, and review notes. Filenames are retained exactly as selected.
3. Optionally enable a separate tab for each starting year.
4. Click Download Excel workbook and open the downloaded `.xlsx` file.
5. Use Save session before closing if you want to restore your index and edits.
   Load session restores the JSON file. Keep your PDFs separately.

## Filename convention

| Example | Result |
| --- | --- |
| `1945-Beryl Avenue Conduit-Profile.pdf` | Year 1945; project Beryl Avenue Conduit; description Profile |
| `1949-1952-Alta Loma Storm Drain-History.pdf` | Start 1949, end 1952; range kept intact |
| `!Misc-Alta Loma Storm Drain-East Alta Loma.pdf` | Undated; Miscellaneous |
| `2026-10-21-Project-Report.pdf` | Full document date 2026-10-21 |
| `Map without date.pdf` | Undated; Needs review |

Dates are read only from the start of the filename. The first segment after the
date is the project/location. Remaining hyphen-separated segments form the
description. When a project name contains a hyphen, correct the preview with Edit.
Single years do not receive a fabricated month/day. Full dates before 1900 are
stored as ISO text because Excel's usual date system cannot display them.
Year ranges appear once in the starting-year tab. Optional year tabs are snapshots
of the master index at export time; editing Excel rows does not refresh those tabs.

## Workbook

The first tab is **Master Index**, with a sortable/filterable Excel table and frozen
column headings. It includes period, project/location, description, original
filename, start/end years, full date when available, relative folder, file size in
KB (1024 bytes), classification, and review notes. Missing or invalid years remain
visible. Export includes all indexed records regardless of the preview filter.
Up to 50,000 files can be indexed per session. The preview displays the first 500
matches; search to find other records. Very large exports require more browser
memory, especially with year tabs enabled.

## Local operation and limits

- This app reads **filenames and file metadata**, not the contents of PDF pages.
  It does not extract drawing data, run OCR, copy, rename, store, or upload PDFs.
- Browser security hides absolute local paths. Relative folders are available
  through folder selection or folder drops. The workbook does not contain guessed
  local file hyperlinks or embedded PDFs.
- Same relative path, size, and modification time means a repeated selection and
  is skipped. Identical content under different names is retained. Individually
  selected files with the same name, size, and timestamp cannot be distinguished.
- Each export creates a new workbook. Existing Excel workbooks are not imported or
  updated. To extend an index, load its saved session, add more PDFs, and export.
- Sessions are saved only when you click Save session. Refreshing or closing the
  app loses unsaved metadata and edits. Session JSON includes filenames and folders.
- Example mode uses demonstration names and invented file sizes. It cannot be
  mixed with real imports, and its exports are prefixed `EXAMPLE`.
- Common four-digit historical years and ISO full dates are supported. Other
  naming conventions can be corrected manually or added in `core.js`.


Version 1.0.0.
