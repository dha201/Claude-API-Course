'use strict';
// ECMA-376 requires the children of the property elements to appear in a fixed
// order. Word reports "unreadable content" otherwise, so audit every occurrence.
const fs = require('fs');
const zlib = require('zlib');

function entries(file) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const nlen = buf.readUInt16LE(off + 28);
    const elen = buf.readUInt16LE(off + 30);
    const clen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nlen);
    const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const raw = buf.slice(start, start + csize);
    out.push({ name, text: (method === 8 ? zlib.inflateRawSync(raw) : raw).toString('utf8') });
    off += 46 + nlen + elen + clen;
  }
  return out;
}

const ORDER = {
  'w:pPr': ['w:pStyle', 'w:keepNext', 'w:keepLines', 'w:pageBreakBefore', 'w:framePr', 'w:widowControl',
    'w:numPr', 'w:suppressLineNumbers', 'w:pBdr', 'w:shd', 'w:tabs', 'w:suppressAutoHyphens', 'w:kinsoku',
    'w:wordWrap', 'w:overflowPunct', 'w:topLinePunct', 'w:autoSpaceDE', 'w:autoSpaceDN', 'w:bidi',
    'w:adjustRightInd', 'w:snapToGrid', 'w:spacing', 'w:ind', 'w:contextualSpacing', 'w:mirrorIndents',
    'w:suppressOverlap', 'w:jc', 'w:textDirection', 'w:textAlignment', 'w:textboxTightWrap',
    'w:outlineLvl', 'w:divId', 'w:cnfStyle', 'w:rPr', 'w:sectPr', 'w:pPrChange'],
  'w:rPr': ['w:rStyle', 'w:rFonts', 'w:b', 'w:bCs', 'w:i', 'w:iCs', 'w:caps', 'w:smallCaps', 'w:strike',
    'w:dstrike', 'w:outline', 'w:shadow', 'w:emboss', 'w:imprint', 'w:noProof', 'w:snapToGrid', 'w:vanish',
    'w:webHidden', 'w:color', 'w:spacing', 'w:w', 'w:kern', 'w:position', 'w:sz', 'w:szCs', 'w:highlight',
    'w:u', 'w:effect', 'w:bdr', 'w:shd', 'w:fitText', 'w:vertAlign', 'w:rtl', 'w:cs', 'w:em', 'w:lang',
    'w:eastAsianLayout', 'w:specVanish', 'w:oMath'],
  'w:tblPr': ['w:tblStyle', 'w:tblpPr', 'w:tblOverlap', 'w:bidiVisual', 'w:tblStyleRowBandSize',
    'w:tblStyleColBandSize', 'w:tblW', 'w:jc', 'w:tblCellSpacing', 'w:tblInd', 'w:tblBorders', 'w:shd',
    'w:tblLayout', 'w:tblCellMar', 'w:tblLook', 'w:tblCaption', 'w:tblDescription'],
  'w:trPr': ['w:cnfStyle', 'w:divId', 'w:gridBefore', 'w:gridAfter', 'w:wBefore', 'w:wAfter', 'w:cantSplit',
    'w:trHeight', 'w:tblHeader', 'w:tblCellSpacing', 'w:jc', 'w:hidden'],
  'w:tcPr': ['w:cnfStyle', 'w:tcW', 'w:gridSpan', 'w:hMerge', 'w:vMerge', 'w:tcBorders', 'w:shd',
    'w:noWrap', 'w:tcMar', 'w:textDirection', 'w:tcFitText', 'w:vAlign', 'w:hideMark'],
  'w:sectPr': ['w:headerReference', 'w:footerReference', 'w:footnotePr', 'w:endnotePr', 'w:type', 'w:pgSz',
    'w:pgMar', 'w:paperSrc', 'w:pgBorders', 'w:lnNumType', 'w:pgNumType', 'w:cols', 'w:formProt', 'w:vAlign',
    'w:noEndnote', 'w:titlePg', 'w:textDirection', 'w:bidi', 'w:rtlGutter', 'w:docGrid', 'w:printerSettings'],
  'w:style': ['w:name', 'w:aliases', 'w:basedOn', 'w:next', 'w:link', 'w:autoRedefine', 'w:hidden',
    'w:uiPriority', 'w:semiHidden', 'w:unhideWhenUsed', 'w:qFormat', 'w:locked', 'w:personal',
    'w:personalCompose', 'w:personalReply', 'w:rsid', 'w:pPr', 'w:rPr', 'w:tblPr', 'w:trPr', 'w:tcPr',
    'w:tblStylePr'],
  'w:lvl': ['w:start', 'w:numFmt', 'w:lvlRestart', 'w:pStyle', 'w:isLgl', 'w:suff', 'w:lvlText',
    'w:lvlPicBulletId', 'w:legacy', 'w:lvlJc', 'w:pPr', 'w:rPr'],
  'w:abstractNum': ['w:nsid', 'w:multiLevelType', 'w:tmpl', 'w:name', 'w:styleLink', 'w:numStyleLink', 'w:lvl'],
  'w:num': ['w:abstractNumId', 'w:lvlOverride'],
};

let problems = 0, audited = 0;
for (const e of entries(process.argv[2])) {
  if (!/\.xml$/.test(e.name)) continue;
  for (const parent of Object.keys(ORDER)) {
    const seq = ORDER[parent];
    const re = new RegExp(`<${parent}(?:\\s[^>]*)?>([\\s\\S]*?)</${parent}>`, 'g');
    let m;
    while ((m = re.exec(e.text))) {
      audited++;
      const kids = [];
      const kre = /<(w:[\w]+)(?:\s[^>]*?)?(\/?)>/g;
      let k, depth = 0;
      while ((k = kre.exec(m[1]))) {
        if (depth === 0) kids.push(k[1]);
        if (!k[2]) depth++;
        // crude: track closes
        const closeRe = new RegExp(`</${k[1]}>`);
        void closeRe;
      }
      // only direct children: re-scan honouring nesting
      const direct = [];
      let d = 0;
      const tre = /<(\/?)(w:[\w]+)(?:\s[^>]*?)?(\/?)>/g;
      let t;
      while ((t = tre.exec(m[1]))) {
        const closing = t[1] === '/', selfClose = t[3] === '/';
        if (closing) { d--; continue; }
        if (d === 0) direct.push(t[2]);
        if (!selfClose) d++;
      }
      let last = -1;
      for (const kid of direct) {
        const idx = seq.indexOf(kid);
        if (idx === -1) { console.log(`${e.name}: unknown child <${kid}> in <${parent}>`); problems++; break; }
        if (idx < last) {
          console.log(`${e.name}: <${parent}> child <${kid}> is out of order (after ${seq[last]})`);
          problems++; break;
        }
        last = idx;
      }
      void kids;
    }
  }
}
console.log(`audited ${audited} property elements; ${problems} ordering problem(s)`);
