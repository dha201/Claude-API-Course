'use strict';
const fs = require('fs');
const zlib = require('zlib');
function entry(file, want) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  const count = buf.readUInt16LE(eocd + 10); let off = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(off + 10), csize = buf.readUInt32LE(off + 20);
    const nlen = buf.readUInt16LE(off + 28), elen = buf.readUInt16LE(off + 30), clen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nlen);
    if (name === want) {
      const s = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
      const raw = buf.slice(s, s + csize);
      return (method === 8 ? zlib.inflateRawSync(raw) : raw).toString('utf8');
    }
    off += 46 + nlen + elen + clen;
  }
}
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const doc = entry(process.argv[2], 'word/document.xml');
const body = doc.slice(doc.indexOf('<w:body>') + 8);
const nodes = [];
const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
let m;
while ((m = re.exec(body))) nodes.push(m[0]);
const from = parseInt(process.argv[3] || '0', 10), to = parseInt(process.argv[4] || '60', 10);
nodes.slice(from, to).forEach((n, i) => {
  const idx = from + i;
  if (n.startsWith('<w:tbl')) {
    const rows = (n.match(/<w:tr>/g) || []).length;
    const cols = (n.match(/<w:gridCol/g) || []).length;
    const first = (n.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || []).slice(0, 4)
      .map(s => unesc(s.replace(/<[^>]+>/g, ''))).join(' | ');
    console.log(`${String(idx).padStart(4)}  [TABLE ${rows}x${cols}]  ${first}`);
    return;
  }
  const style = (/<w:pStyle w:val="([^"]+)"/.exec(n) || [, '-'])[1];
  const numId = (/<w:numId w:val="(\d+)"/.exec(n) || [, ''])[1];
  const ilvl = (/<w:ilvl w:val="(\d+)"/.exec(n) || [, ''])[1];
  const bold = /<w:b\/>/.test(n) ? 'B' : ' ';
  const link = /<w:hyperlink/.test(n) ? 'L' : ' ';
  const txt = unesc((n.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
    .map(s => s.replace(/<[^>]+>/g, '')).join('')).replace(/\s+/g, ' ').slice(0, 96);
  const tag = numId ? `list:${ilvl}` : style;
  console.log(`${String(idx).padStart(4)}  ${tag.padEnd(13)}${bold}${link}  ${txt}`);
});
console.log(`\n(total block-level nodes: ${nodes.length})`);
