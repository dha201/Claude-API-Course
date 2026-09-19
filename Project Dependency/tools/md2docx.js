// Standalone Markdown -> .docx (OOXML) converter. No dependencies.
'use strict';
const fs = require('fs');
const zlib = require('zlib');

/* ------------------------------------------------------------------ ZIP */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
class Zip {
  constructor() { this.parts = []; this.entries = []; this.offset = 0; }
  add(name, data) {
    const content = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const comp = zlib.deflateRawSync(content, { level: 9 });
    const crc = crc32(content);
    const nameBuf = Buffer.from(name, 'utf8');
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0, 6);
    h.writeUInt16LE(8, 8); h.writeUInt16LE(0, 10); h.writeUInt16LE(0x21, 12);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18);
    h.writeUInt32LE(content.length, 22); h.writeUInt16LE(nameBuf.length, 26);
    h.writeUInt16LE(0, 28);
    this.entries.push({ nameBuf, crc, csize: comp.length, usize: content.length, offset: this.offset });
    this.parts.push(h, nameBuf, comp);
    this.offset += 30 + nameBuf.length + comp.length;
  }
  toBuffer() {
    const cd = [];
    let cdSize = 0;
    for (const e of this.entries) {
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6);
      c.writeUInt16LE(0, 8); c.writeUInt16LE(8, 10); c.writeUInt16LE(0, 12);
      c.writeUInt16LE(0x21, 14); c.writeUInt32LE(e.crc, 16); c.writeUInt32LE(e.csize, 20);
      c.writeUInt32LE(e.usize, 24); c.writeUInt16LE(e.nameBuf.length, 28);
      c.writeUInt16LE(0, 30); c.writeUInt16LE(0, 32); c.writeUInt16LE(0, 34);
      c.writeUInt16LE(0, 36); c.writeUInt32LE(0, 38); c.writeUInt32LE(e.offset, 42);
      cd.push(c, e.nameBuf);
      cdSize += 46 + e.nameBuf.length;
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
    end.writeUInt16LE(this.entries.length, 8); end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(this.offset, 16); end.writeUInt16LE(0, 20);
    return Buffer.concat([...this.parts, ...cd, end]);
  }
}

/* -------------------------------------------------------------- helpers */
function esc(s) {
  return String(s)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
const indentOf = (l) => (l.match(/^[ \t]*/)[0].replace(/\t/g, '    ')).length;
const isBlank = (l) => /^\s*$/.test(l);

// Fold a paragraph's source lines into one string. Two trailing spaces mean a hard break.
function foldLines(src) {
  const parts = src.map(l => ({ text: l.trim(), br: /\S\s\s+$/.test(l) }));
  let out = '';
  parts.forEach((p, k) => {
    if (k) out += parts[k - 1].br ? '\n' : ' ';
    out += p.text;
  });
  return out;
}

const RE_FENCE =/^(\s*)(`{3,}|~{3,})[ \t]*([^\s`]*)[ \t]*$/;
const RE_HR = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
const RE_HEAD = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
const RE_QUOTE = /^ {0,3}>[ \t]?(.*)$/;
const RE_ITEM = /^([ \t]*)([-*+]|\d{1,9}[.)])([ \t]+)(.*)$/;

function isTableDelim(l) {
  return l != null && /\|/.test(l) &&
    /^[ \t]*\|?[ \t]*:?-{1,}:?[ \t]*(\|[ \t]*:?-{1,}:?[ \t]*)*\|?[ \t]*$/.test(l);
}
function isBlockStart(l) {
  if (l == null || isBlank(l)) return true;
  return RE_FENCE.test(l) || RE_HR.test(l) || RE_HEAD.test(l) || RE_QUOTE.test(l) ||
    (RE_ITEM.test(l) && !RE_HR.test(l));
}
function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = []; let cur = ''; let tick = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '`') {
      let n = 0; while (s[i + n] === '`') n++;
      if (tick === 0) tick = n; else if (tick === n) tick = 0;
      cur += '`'.repeat(n); i += n - 1; continue;
    }
    if (c === '|' && tick === 0) { cells.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

/* -------------------------------------------------------- block parsing */
function parseBlocks(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { i++; continue; }

    let m;
    // fenced code
    if ((m = RE_FENCE.exec(line))) {
      const pad = m[1].length, marker = m[2][0], len = m[2].length, lang = m[3] || '';
      const body = [];
      i++;
      while (i < lines.length) {
        const c = RE_FENCE.exec(lines[i]);
        if (c && c[2][0] === marker && c[2].length >= len && c[3] === '') { i++; break; }
        body.push(lines[i].slice(0, pad).trim() === '' ? lines[i].slice(pad) : lines[i].replace(/^\s+/, ''));
        i++;
      }
      while (body.length && isBlank(body[body.length - 1])) body.pop();
      out.push({ t: 'code', lang, lines: body });
      continue;
    }
    // horizontal rule (before list, so "---" is not an item)
    if (RE_HR.test(line)) { out.push({ t: 'hr' }); i++; continue; }
    // heading
    if ((m = RE_HEAD.exec(line))) {
      out.push({ t: 'heading', level: m[1].length, text: m[2] }); i++; continue;
    }
    // blockquote
    if (RE_QUOTE.test(line)) {
      const inner = [];
      while (i < lines.length) {
        const q = RE_QUOTE.exec(lines[i]);
        if (q) { inner.push(q[1]); i++; continue; }
        if (!isBlockStart(lines[i])) { inner.push(lines[i].replace(/^\s+/, '')); i++; continue; }
        break;
      }
      out.push({ t: 'quote', blocks: parseBlocks(inner) });
      continue;
    }
    // table
    if (/\|/.test(line) && isTableDelim(lines[i + 1])) {
      const header = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map(c => {
        const l = c.startsWith(':'), r = c.endsWith(':');
        return l && r ? 'center' : r ? 'right' : 'left';
      });
      i += 2;
      const rows = [];
      while (i < lines.length && !isBlank(lines[i]) && /\|/.test(lines[i]) &&
             !RE_HEAD.test(lines[i]) && !RE_FENCE.test(lines[i])) {
        const cells = splitRow(lines[i]);
        while (cells.length < header.length) cells.push('');
        rows.push(cells.slice(0, Math.max(header.length, cells.length)));
        i++;
      }
      out.push({ t: 'table', header, aligns, rows });
      continue;
    }
    // list
    if ((m = RE_ITEM.exec(line))) {
      const listIndent = indentOf(line);
      const ordered = /\d/.test(m[2][0]);
      const start = ordered ? parseInt(m[2], 10) : 1;
      const items = [];
      while (i < lines.length) {
        const im = RE_ITEM.exec(lines[i]);
        if (!im || RE_HR.test(lines[i])) break;
        const ind = indentOf(lines[i]);
        if (ind > listIndent + 1 || ind < listIndent) break;
        const isOrd = /\d/.test(im[2][0]);
        if (isOrd !== ordered) break;
        const contentIndent = ind + im[2].length + im[3].length;
        const buf = [im[4]];
        i++;
        while (i < lines.length) {
          const cur = lines[i];
          if (isBlank(cur)) {
            // keep blank only if the item continues afterwards
            let j = i;
            while (j < lines.length && isBlank(lines[j])) j++;
            if (j < lines.length && indentOf(lines[j]) >= contentIndent) {
              for (let k = i; k < j; k++) buf.push('');
              i = j; continue;
            }
            break;
          }
          const ci = indentOf(cur);
          if (ci >= contentIndent) { buf.push(cur.slice(contentIndent)); i++; continue; }
          if (RE_ITEM.test(cur) || isBlockStart(cur)) break;
          buf.push(cur.replace(/^\s+/, '')); i++; // lazy continuation
        }
        items.push(parseBlocks(buf));
      }
      out.push({ t: 'list', ordered, start, items });
      continue;
    }
    // paragraph
    const buf = [];
    while (i < lines.length && !isBlank(lines[i])) {
      if (buf.length && (RE_HEAD.test(lines[i]) || RE_FENCE.test(lines[i]) || RE_HR.test(lines[i]) ||
        RE_QUOTE.test(lines[i]) || RE_ITEM.test(lines[i]) ||
        (/\|/.test(lines[i]) && isTableDelim(lines[i + 1])))) break;
      buf.push(lines[i]); i++;
    }
    out.push({ t: 'para', lines: buf });
  }
  return out;
}

/* ------------------------------------------------------- inline parsing */
function matchLink(text, i) {
  let depth = 0, j = i;
  for (; j < text.length; j++) {
    const c = text[j];
    if (c === '\\') { j++; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) break; }
  }
  if (j >= text.length || text[j + 1] !== '(') return null;
  let k = j + 2, pd = 1, url = '';
  for (; k < text.length; k++) {
    const c = text[k];
    if (c === '\\') { url += text[++k] || ''; continue; }
    if (c === '(') pd++;
    else if (c === ')') { pd--; if (pd === 0) break; }
    url += c;
  }
  if (k >= text.length) return null;
  let href = url.trim();
  const tm = /^(\S+)\s+["'(].*$/.exec(href);
  if (tm) href = tm[1];
  return { label: text.slice(i + 1, j), href, end: k + 1 };
}
const wordChar = (c) => c != null && /[A-Za-z0-9]/.test(c);

function inlineRuns(text, style) {
  style = style || {};
  const out = [];
  let buf = '';
  const flush = () => { if (buf) { out.push(Object.assign({ t: 'text', v: buf }, style)); buf = ''; } };
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length && /[\\`*_{}\[\]()#+\-.!|>~"]/.test(text[i + 1])) {
      buf += text[i + 1]; i += 2; continue;
    }
    if (ch === '`') {
      let n = 0; while (text[i + n] === '`') n++;
      const fence = '`'.repeat(n);
      const end = text.indexOf(fence, i + n);
      if (end >= 0) {
        flush();
        let code = text.slice(i + n, end);
        if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ')) code = code.slice(1, -1);
        out.push(Object.assign({ t: 'code', v: code }, style));
        i = end + n; continue;
      }
      buf += fence; i += n; continue;
    }
    if (ch === '<') {
      const m = /^<((?:https?|mailto):[^>\s]+)>/.exec(text.slice(i));
      if (m) {
        flush();
        out.push({ t: 'link', href: m[1], runs: [Object.assign({ t: 'text', v: m[1] }, style)] });
        i += m[0].length; continue;
      }
    }
    if (ch === '[') {
      const m = matchLink(text, i);
      if (m) {
        flush();
        out.push({ t: 'link', href: m.href, runs: inlineRuns(m.label, style) });
        i = m.end; continue;
      }
      buf += ch; i++; continue;
    }
    if (ch === '*' || ch === '_') {
      const two = text.substr(i, 2);
      const prev = i > 0 ? text[i - 1] : null;
      const strong = (two === '**' || two === '__');
      const intrawordOk = ch === '*' || !wordChar(prev);
      if (strong && intrawordOk) {
        const close = findClose(text, i + 2, two, ch);
        if (close >= 0) {
          flush();
          out.push.apply(out, inlineRuns(text.slice(i + 2, close), Object.assign({}, style, { bold: true })));
          i = close + 2; continue;
        }
      }
      if (intrawordOk && text[i + 1] && !/\s/.test(text[i + 1])) {
        const close = findClose(text, i + 1, ch, ch);
        if (close >= 0) {
          flush();
          out.push.apply(out, inlineRuns(text.slice(i + 1, close), Object.assign({}, style, { italic: true })));
          i = close + 1; continue;
        }
      }
      buf += ch; i++; continue;
    }
    buf += ch; i++;
  }
  flush();
  return out;
}
function findClose(text, from, marker, ch) {
  const n = marker.length;
  let i = from;
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue; }
    if (text[i] === '`') {
      let k = 0; while (text[i + k] === '`') k++;
      const end = text.indexOf('`'.repeat(k), i + k);
      if (end >= 0) { i = end + k; continue; }
      i += k; continue;
    }
    if (text.substr(i, n) === marker) {
      const prev = text[i - 1];
      const next = text[i + n];
      if (prev && /\s/.test(prev)) { i += 1; continue; }
      if (ch === '_' && wordChar(next)) { i += 1; continue; }
      return i;
    }
    i++;
  }
  return -1;
}
function stripInline(s) {
  return s.replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
}
function slugify(s) {
  return stripInline(s).toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
}

/* --------------------------------------------------------------- render */
const PAGE_W = 10080;          // usable width in twips (7")
const HEAD_STYLE = ['Heading1', 'Heading2', 'Heading3', 'Heading4', 'Heading5', 'Heading6'];

class Doc {
  constructor() {
    this.body = [];
    this.rels = [];
    this.relSeq = 10;
    this.relByUrl = new Map();
    this.nums = [];
    this.bookmarks = new Map();
    this.bmSeq = 0;
  }
  relFor(url) {
    if (this.relByUrl.has(url)) return this.relByUrl.get(url);
    const id = 'rId' + (++this.relSeq);
    this.relByUrl.set(url, id);
    this.rels.push({ id, url });
    return id;
  }
  newNum(ordered, start, ilvl) {
    const numId = 100 + this.nums.length;
    this.nums.push({ numId, abstract: ordered ? 1 : 0, start: start || 1, ilvl });
    return numId;
  }
  push(x) { this.body.push(x); }
}

function runsXml(doc, runs) {
  let s = '';
  for (const r of runs) {
    if (r.t === 'link') {
      const inner = r.runs.map(x => Object.assign({}, x, { link: true }));
      if (r.href && r.href.startsWith('#')) {
        const bm = doc.bookmarks.get(r.href.slice(1));
        if (bm) { s += `<w:hyperlink w:anchor="${esc(bm)}">${runsXml(doc, inner)}</w:hyperlink>`; continue; }
        s += runsXml(doc, inner); continue;
      }
      if (!r.href) { s += runsXml(doc, inner); continue; }
      const id = doc.relFor(r.href);
      s += `<w:hyperlink r:id="${id}">${runsXml(doc, inner)}</w:hyperlink>`;
      continue;
    }
    const props = [];
    if (r.link) props.push('<w:rStyle w:val="Hyperlink"/>');
    else if (r.t === 'code') props.push('<w:rStyle w:val="CodeChar"/>');
    if (r.bold) props.push('<w:b/>');
    if (r.italic) props.push('<w:i/>');
    const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
    const parts = String(r.v).split('\n');
    let t = '';
    parts.forEach((p, idx) => {
      if (idx) t += '<w:br/>';
      t += `<w:t xml:space="preserve">${esc(p)}</w:t>`;
    });
    s += `<w:r>${rPr}${t}</w:r>`;
  }
  return s;
}

// Emits w:pPr children in the order CT_PPrBase requires; Word rejects any other order.
function pPrXml(o) {
  const p = [];
  if (o.style) p.push(`<w:pStyle w:val="${o.style}"/>`);
  if (o.keepNext) p.push('<w:keepNext/>');
  if (o.numId != null) p.push(`<w:numPr><w:ilvl w:val="${o.ilvl}"/><w:numId w:val="${o.numId}"/></w:numPr>`);
  if (o.quote) p.push('<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="9DB7E0"/></w:pBdr>');
  if (o.spacing) p.push(o.spacing);
  if (o.indent) p.push(`<w:ind w:left="${o.indent}"${o.hanging ? ` w:hanging="${o.hanging}"` : ''}/>`);
  if (o.jc) p.push(`<w:jc w:val="${o.jc}"/>`);
  return p.length ? `<w:pPr>${p.join('')}</w:pPr>` : '';
}

function renderBlocks(doc, blocks, ctx) {
  ctx = ctx || { indent: 0, ilvl: -1, quote: false };
  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];
    const first = bi === 0;
    switch (b.t) {
      case 'heading': {
        const lvl = Math.min(b.level, 6);
        const bm = doc.bookmarks.get(slugify(b.text));
        const id = ++doc.bmSeq;
        const runs = inlineRuns(b.text);
        const bmS = bm ? `<w:bookmarkStart w:id="${id}" w:name="${esc(bm)}"/>` : '';
        const bmE = bm ? `<w:bookmarkEnd w:id="${id}"/>` : '';
        doc.push(`<w:p>${pPrXml({ style: HEAD_STYLE[lvl - 1] })}${bmS}${runsXml(doc, runs)}${bmE}</w:p>`);
        break;
      }
      case 'para': {
        const joined = foldLines(b.lines);
        /* superseded by foldLines
        const textUNUSED = [].concat(b.lines).map(l => l.replace(/\s+$/, '')).join('\n')
          .replace(/  \n/g, ' BR \n');
        const joined = text.split('\n').join(' ').replace(/ BR \s?/g, '\n');
        */
        const opts = {
          numId: first && ctx.numId != null ? ctx.numId : undefined,
          ilvl: ctx.ilvl,
          indent: (ctx.numId != null && !first) || ctx.numId == null ? (ctx.indent || undefined) : undefined,
          quote: ctx.quote,
          style: ctx.numId != null && first ? 'ListParagraph' : undefined,
        };
        doc.push(`<w:p>${pPrXml(opts)}${runsXml(doc, inlineRuns(joined))}</w:p>`);
        break;
      }
      case 'code': {
        const opts = {
          style: 'SourceCode', indent: ctx.indent || undefined, quote: ctx.quote,
          numId: first && ctx.numId != null ? ctx.numId : undefined, ilvl: ctx.ilvl,
        };
        if (opts.numId != null) opts.indent = undefined;
        let t = '';
        const lines = b.lines.length ? b.lines : [''];
        lines.forEach((l, idx) => {
          if (idx) t += '<w:br/>';
          t += `<w:t xml:space="preserve">${esc(l)}</w:t>`;
        });
        doc.push(`<w:p>${pPrXml(opts)}<w:r>${t}</w:r></w:p>`);
        break;
      }
      case 'hr': {
        const next = blocks[bi + 1];
        if (next && next.t === 'heading' && next.level <= 2) break; // page break handles it
        doc.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="C7CDD4"/></w:pBdr>' +
          '<w:spacing w:before="120" w:after="120"/></w:pPr></w:p>');
        break;
      }
      case 'quote': {
        renderBlocks(doc, b.blocks, {
          indent: (ctx.indent || 0) + 240, ilvl: ctx.ilvl, quote: true,
        });
        break;
      }
      case 'list': {
        const ilvl = Math.min((ctx.ilvl < 0 ? -1 : ctx.ilvl) + 1, 5);
        const numId = doc.newNum(b.ordered, b.start, ilvl);
        for (const item of b.items) {
          renderBlocks(doc, item, {
            indent: 480 * (ilvl + 1) + (ctx.quote ? 240 : 0),
            ilvl, numId, quote: ctx.quote, listMode: true,
          });
        }
        break;
      }
      case 'table': {
        renderTable(doc, b, ctx);
        break;
      }
    }
    // a list item's first block consumes the numbering marker
    if (ctx.numId != null && first) ctx = Object.assign({}, ctx, { numId: undefined });
  }
}

function renderTable(doc, tbl, ctx) {
  const ncol = Math.max(tbl.header.length, ...tbl.rows.map(r => r.length), 1);
  const avail = PAGE_W - (ctx.indent || 0);
  const weights = [];
  for (let c = 0; c < ncol; c++) {
    const lens = [stripInline(tbl.header[c] || '').length];
    for (const r of tbl.rows) lens.push(stripInline(r[c] || '').length);
    lens.sort((a, b) => a - b);
    const p90 = lens[Math.min(lens.length - 1, Math.floor(lens.length * 0.9))];
    weights.push(Math.max(6, Math.min(70, Math.max(p90, (tbl.header[c] || '').length))));
  }
  const total = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map(w => Math.max(500, Math.round(avail * w / total)));

  const cell = (text, opts) => {
    const runs = inlineRuns(text || '');
    const pOpts = {
      style: 'TableText',
      jc: opts.align && opts.align !== 'left' ? opts.align : undefined,
    };
    const styled = opts.head ? runs.map(r => markBold(r)) : runs;
    const shd = opts.head ? '<w:shd w:val="clear" w:color="auto" w:fill="DCE6F2"/>' : '';
    return `<w:tc><w:tcPr><w:tcW w:w="${opts.w}" w:type="dxa"/>${shd}<w:vAlign w:val="top"/></w:tcPr>` +
      `<w:p>${pPrXml(pOpts)}${runsXml(doc, styled)}</w:p></w:tc>`;
  };
  const markBold = (r) => (r.t === 'link'
    ? Object.assign({}, r, { runs: r.runs.map(markBold) })
    : Object.assign({}, r, { bold: true }));

  let xml = '<w:tbl><w:tblPr><w:tblStyle w:val="MdTable"/>' +
    `<w:tblW w:w="${avail}" w:type="dxa"/>` +
    (ctx.indent ? `<w:tblInd w:w="${ctx.indent}" w:type="dxa"/>` : '') +
    '<w:tblLayout w:type="fixed"/>' +
    '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>' +
    '</w:tblPr><w:tblGrid>' + widths.map(w => `<w:gridCol w:w="${w}"/>`).join('') + '</w:tblGrid>';

  xml += '<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>';
  for (let c = 0; c < ncol; c++) xml += cell(tbl.header[c], { head: true, w: widths[c], align: tbl.aligns[c] });
  xml += '</w:tr>';
  for (const row of tbl.rows) {
    xml += '<w:tr>';
    for (let c = 0; c < ncol; c++) xml += cell(row[c], { w: widths[c], align: tbl.aligns[c] });
    xml += '</w:tr>';
  }
  xml += '</w:tbl>';
  doc.push(xml);
  doc.push('<w:p><w:pPr><w:spacing w:before="0" w:after="60" w:line="120" w:lineRule="exact"/></w:pPr></w:p>');
}

/* ---------------------------------------------------------- docx assets */
function stylesXml() {
  // CT_PPrBase order: keepNext, keepLines, pageBreakBefore, pBdr, spacing, outlineLvl.
  const head = (id, name, sz, color, before, after, opt) =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/>` +
    `<w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/>` +
    ((opt && opt.pageBreak) ? '<w:pageBreakBefore/>' : '') +
    ((opt && opt.rule) ? '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" w:color="9DB7E0"/></w:pBdr>' : '') +
    `<w:spacing w:before="${before}" w:after="${after}"/><w:outlineLvl w:val="${id.slice(-1) - 1}"/></w:pPr>` +
    `<w:rPr><w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/><w:b/><w:color w:val="${color}"/>` +
    `<w:sz w:val="${sz}"/></w:rPr></w:style>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
${head('Heading1', 'heading 1', '40', '17375B', '0', '240')}
${head('Heading2', 'heading 2', '30', '1F4E79', '360', '160', { pageBreak: true, rule: true })}
${head('Heading3', 'heading 3', '25', '2E5F8A', '280', '120')}
${head('Heading4', 'heading 4', '23', '2E5F8A', '240', '100')}
${head('Heading5', 'heading 5', '21', '44546A', '200', '80')}
${head('Heading6', 'heading 6', '21', '44546A', '200', '80')}
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:contextualSpacing/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="SourceCode"><w:name w:val="Source Code"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="D6DBE1"/><w:left w:val="single" w:sz="4" w:space="6" w:color="D6DBE1"/><w:bottom w:val="single" w:sz="4" w:space="4" w:color="D6DBE1"/><w:right w:val="single" w:sz="4" w:space="6" w:color="D6DBE1"/></w:pBdr>
<w:shd w:val="clear" w:color="auto" w:fill="F5F7F9"/>
<w:spacing w:before="120" w:after="120" w:line="240" w:lineRule="auto"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr><w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="CodeChar"><w:name w:val="Code Char"/><w:qFormat/>
<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="19"/><w:szCs w:val="19"/><w:shd w:val="clear" w:color="auto" w:fill="EFF1F4"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/>
<w:rPr><w:color w:val="0F6CBD"/><w:u w:val="single"/></w:rPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="MdTable"><w:name w:val="Md Table"/><w:tblPr>
<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="B4BCC5"/><w:left w:val="single" w:sz="4" w:space="0" w:color="B4BCC5"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="B4BCC5"/><w:right w:val="single" w:sz="4" w:space="0" w:color="B4BCC5"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="B4BCC5"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="B4BCC5"/></w:tblBorders>
<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;
}

function numberingXml(nums) {
  const bulletLvl = (i) => {
    const chars = ['', 'o', '', '', 'o', '']; const charsOld = ['', 'o', '', '', 'o', ''];
    const fonts = ['Symbol', 'Courier New', 'Wingdings', 'Symbol', 'Courier New', 'Wingdings'];
    const DOT = String.fromCharCode(0xF0B7), SQ = String.fromCharCode(0xF0A7);
    const glyphs = [DOT, 'o', SQ, DOT, 'o', SQ];
    return `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${esc(glyphs[i])}"/>` +
      `<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${480 * (i + 1)}" w:hanging="300"/></w:pPr>` +
      `<w:rPr><w:rFonts w:ascii="${fonts[i]}" w:hAnsi="${fonts[i]}" w:hint="default"/></w:rPr></w:lvl>`;
  };
  const numLvl = (i) => {
    const fmt = ['decimal', 'lowerLetter', 'lowerRoman', 'decimal', 'lowerLetter', 'lowerRoman'];
    return `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt[i]}"/><w:lvlText w:val="%${i + 1}."/>` +
      `<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${480 * (i + 1)}" w:hanging="360"/></w:pPr></w:lvl>`;
  };
  let s = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${[0, 1, 2, 3, 4, 5].map(bulletLvl).join('')}</w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="multilevel"/>${[0, 1, 2, 3, 4, 5].map(numLvl).join('')}</w:abstractNum>`;
  for (const n of nums) {
    const overrides = [0, 1, 2, 3, 4, 5].map(i =>
      `<w:lvlOverride w:ilvl="${i}"><w:startOverride w:val="${i === n.ilvl ? n.start : 1}"/></w:lvlOverride>`).join('');
    s += `<w:num w:numId="${n.numId}"><w:abstractNumId w:val="${n.abstract}"/>${overrides}</w:num>`;
  }
  return s + '</w:numbering>';
}

/* ----------------------------------------------------------------- main */
function convert(mdPath, outPath, title) {
  let md = fs.readFileSync(mdPath, 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = md.split('\n');
  const blocks = parseBlocks(lines);

  const doc = new Doc();
  // pass 1: bookmarks for every heading
  (function walk(bs) {
    for (const b of bs) {
      if (b.t === 'heading') {
        const slug = slugify(b.text);
        if (slug && !doc.bookmarks.has(slug)) doc.bookmarks.set(slug, '_h' + (doc.bookmarks.size + 1));
      } else if (b.t === 'quote') walk(b.blocks);
      else if (b.t === 'list') b.items.forEach(walk);
    }
  })(blocks);

  renderBlocks(doc, blocks);

  const sectPr = '<w:sectPr><w:footerReference w:type="default" r:id="rId9"/>' +
    '<w:pgSz w:w="12240" w:h="15840"/>' +
    '<w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="576" w:gutter="0"/>' +
    '<w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>';

  const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<w:body>' + doc.body.join('') + sectPr + '</w:body></w:document>';

  const relItems = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>',
    '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>',
  ].concat(doc.rels.map(r =>
    `<Relationship Id="${r.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(r.url)}" TargetMode="External"/>`));

  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="center"/></w:pPr>
<w:r><w:rPr><w:color w:val="7A828C"/><w:sz w:val="17"/></w:rPr><w:t xml:space="preserve">Page </w:t></w:r>
<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:color w:val="7A828C"/><w:sz w:val="17"/></w:rPr><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
<w:r><w:rPr><w:color w:val="7A828C"/><w:sz w:val="17"/></w:rPr><w:t xml:space="preserve"> of </w:t></w:r>
<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:color w:val="7A828C"/><w:sz w:val="17"/></w:rPr><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
</w:p></w:ftr>`;

  const zip = new Zip();
  zip.add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
  zip.add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
  zip.add('word/document.xml', documentXml);
  zip.add('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relItems.join('')}</Relationships>`);
  zip.add('word/styles.xml', stylesXml());
  zip.add('word/numbering.xml', numberingXml(doc.nums));
  zip.add('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`);
  zip.add('word/footer1.xml', footerXml);
  zip.add('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${esc(title)}</dc:title><dc:creator>Converted from Markdown</dc:creator><cp:lastModifiedBy>Converted from Markdown</cp:lastModifiedBy></cp:coreProperties>`);
  zip.add('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>md2docx</Application></Properties>`);

  fs.writeFileSync(outPath, zip.toBuffer());

  const counts = { headings: 0, tables: 0, code: 0, lists: 0, paras: 0, quotes: 0 };
  (function count(bs) {
    for (const b of bs) {
      if (b.t === 'heading') counts.headings++;
      else if (b.t === 'table') counts.tables++;
      else if (b.t === 'code') counts.code++;
      else if (b.t === 'para') counts.paras++;
      else if (b.t === 'quote') { counts.quotes++; count(b.blocks); }
      else if (b.t === 'list') { counts.lists++; b.items.forEach(count); }
    }
  })(blocks);
  return { counts, links: doc.rels.length, bookmarks: doc.bookmarks.size, bytes: fs.statSync(outPath).size };
}

const [, , src, dst, title] = process.argv;
const res = convert(src, dst, title || 'Document');
console.log(JSON.stringify(res, null, 2));
