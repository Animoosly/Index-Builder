'use strict';
const fs = require('node:fs');
const path = require('node:path');
const target = process.argv[2] || path.join(__dirname, 'PDF Indexer.html');
let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
for (const [marker, file] of [['CORE', 'core.js'], ['APP', 'app.js']]) {
  const code = fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/<\/script/gi, '<\\/script');
  html = html.replace(`<!-- ${marker} -->`, () => `<script>\n${code}\n</script>`);
}
fs.writeFileSync(target, html);
console.log('Built: ' + target);
