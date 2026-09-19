'use strict';
const fs = require('fs');
const zlib = require('zlib');

function readZip(file) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('no EOCD');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('bad central dir at ' + off);
    const method = buf.readUInt16LE(off + 10);
    const crc = buf.readUInt32LE(off + 16);
    const csize = buf.readUInt32LE(off + 20);
    const usize = buf.readUInt32LE(off + 24);
    const nlen = buf.readUInt16LE(off + 28);
    const elen = buf.readUInt16LE(off + 30);
    const clen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nlen);
    const lnlen = buf.readUInt16LE(lho + 26);
    const lelen = buf.readUInt16LE(lho + 28);
    const start = lho + 30 + lnlen + lelen;
    const raw = buf.slice(start, start + csize);
    const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
    if (data.length !== usize) throw new Error('size mismatch in ' + name);
    out.push({ name, data, crc });
    off += 46 + nlen + elen + clen;
  }
  return out;
}

// Minimal well-formedness check: tags balance, attributes quoted, no raw & or <.
function checkXml(name, text) {
  const errs = [];
  const stack = [];
  const re = /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[\w.:-]+\s*=\s*"[^"]*")*)\s*(\/?)>|<\?[^>]*\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    const between = text.slice(last, m.index);
    if (between.includes('<')) errs.push(`raw '<' before offset ${m.index}`);
    const badAmp = between.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, '');
    if (badAmp.includes('&')) errs.push(`unescaped '&' near offset ${m.index}: ${JSON.stringify(between.slice(0, 60))}`);
    last = m.index + m[0].length;
    if (m[2] === undefined) continue;            // decl/comment/cdata
    if (m[1] === '/') {
      const top = stack.pop();
      if (top !== m[2]) errs.push(`close </${m[2]}> does not match <${top}> at offset ${m.index}`);
    } else if (!m[4]) {
      stack.push(m[2]);
    }
    if (errs.length > 8) break;
  }
  const tail = text.slice(last);
  if (tail.includes('<')) errs.push('raw < in trailing text');
  if (stack.length) errs.push('unclosed: ' + stack.slice(-5).join(','));
  return errs;
}

const file = process.argv[2];
const entries = readZip(file);
console.log('entries:');
for (const e of entries) console.log(`  ${e.name.padEnd(34)} ${String(e.data.length).padStart(9)} bytes`);

let bad = 0;
for (const e of entries) {
  if (!/\.(xml|rels)$/.test(e.name)) continue;
  const errs = checkXml(e.name, e.data.toString('utf8'));
  if (errs.length) { bad++; console.log(`\nXML PROBLEM in ${e.name}:`); errs.forEach(x => console.log('   ' + x)); }
}
console.log(bad ? `\n${bad} part(s) with XML problems` : '\nXML: all parts well-formed');

const doc = entries.find(e => e.name === 'word/document.xml').data.toString('utf8');
const rels = entries.find(e => e.name === 'word/_rels/document.xml.rels').data.toString('utf8');
const num = entries.find(e => e.name === 'word/numbering.xml').data.toString('utf8');
const cnt = (s, re) => (s.match(re) || []).length;

console.log('\ndocument.xml stats');
console.log('  paragraphs        ', cnt(doc, /<w:p[ >]/g));
console.log('  tables            ', cnt(doc, /<w:tbl>/g));
console.log('  table rows        ', cnt(doc, /<w:tr>/g));
console.log('  hyperlinks(ext)   ', cnt(doc, /<w:hyperlink r:id=/g));
console.log('  hyperlinks(anchor)', cnt(doc, /<w:hyperlink w:anchor=/g));
console.log('  bookmarks         ', cnt(doc, /<w:bookmarkStart/g));
console.log('  code paragraphs   ', cnt(doc, /w:val="SourceCode"/g));
console.log('  numPr refs        ', cnt(doc, /<w:numPr>/g));

// every r:id used in the document must exist in the rels part
const used = new Set((doc.match(/r:id="(rId\d+)"/g) || []).map(s => s.slice(7, -1)));
const have = new Set((rels.match(/Id="(rId\d+)"/g) || []).map(s => s.slice(4, -1)));
const missing = [...used].filter(id => !have.has(id));
console.log('  rels used/defined ', used.size, '/', have.size, missing.length ? 'MISSING: ' + missing : 'ok');

// every numId used must be defined in numbering.xml
const usedNum = new Set((doc.match(/<w:numId w:val="(\d+)"\/>/g) || []).map(s => s.match(/\d+/)[0]));
const haveNum = new Set((num.match(/<w:num w:numId="(\d+)">/g) || []).map(s => s.match(/\d+/)[0]));
const missNum = [...usedNum].filter(n => !haveNum.has(n));
console.log('  numIds used/def   ', usedNum.size, '/', haveNum.size, missNum.length ? 'MISSING: ' + missNum : 'ok');

// leftover markdown syntax that should have been consumed
const texts = (doc.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || []).map(s => s.replace(/<[^>]+>/g, ''));
const nonCode = texts.join('');
const leftovers = {
  'bold **': (nonCode.match(/\*\*/g) || []).length,
  'md links [x](y)': (nonCode.match(/\]\(http/g) || []).length,
  'pipe table rows': (nonCode.match(/^\s*\|.*\|\s*$/gm) || []).length,
  'heading hashes': (nonCode.match(/#{1,6} /g) || []).length,
};
console.log('\nleftover markdown in text runs:', JSON.stringify(leftovers));
