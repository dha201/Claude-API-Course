'use strict';
// Confirms no source content was dropped: every source line's alphanumeric
// payload must appear, in order, inside the document's concatenated text.
const fs = require('fs');
const zlib = require('zlib');

function readEntry(file, want) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const nlen = buf.readUInt16LE(off + 28);
    const elen = buf.readUInt16LE(off + 30);
    const clen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nlen);
    if (name === want) {
      const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
      const raw = buf.slice(start, start + csize);
      return (method === 8 ? zlib.inflateRawSync(raw) : raw).toString('utf8');
    }
    off += 46 + nlen + elen + clen;
  }
  throw new Error('missing ' + want);
}

const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const [, , docxPath, mdPath] = process.argv;
const doc = readEntry(docxPath, 'word/document.xml');
const docText = norm(unesc((doc.match(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g) || [])
  .map(s => s.replace(/^<w:t(?: [^>]*)?>/, '').replace(/<\/w:t>$/, '')).join('')));

const md = fs.readFileSync(mdPath, 'utf8').replace(/\r/g, '');
const lines = md.split('\n');

let checked = 0, misses = [];
let inFence = false;
for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  if (/^\s*(```|~~~)/.test(raw)) { inFence = !inFence; continue; }
  const t = raw.trim();
  if (!t) continue;
  if (/^\|?\s*:?-{3,}/.test(t)) continue;            // table delimiter row
  const pieces = (!inFence && t.includes('|')) ? t.split('|') : [t];
  for (const p0 of pieces) {
    // Word renders list markers itself, so strip them before comparing.
    const p = p0.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*>\s?/, '')
      .replace(/^\s*([-*+]|\d{1,9}[.)])\s+/, '');
    const key = norm(p.replace(/\]\([^)]*\)/g, ']'));   // drop URLs, they are attributes now
    if (key.length < 20) continue;
    checked++;
    if (!docText.includes(key)) misses.push({ line: i + 1, text: p.trim().slice(0, 110) });
  }
}
console.log(`checked ${checked} source fragments, ${misses.length} not found in the .docx`);
misses.slice(0, 25).forEach(m => console.log(`  L${m.line}: ${m.text}`));
