'use strict';
/*
 * Deobfuscator for the obfuscator.io-style bundles in this tool.
 *
 * These files keep their decoder helpers at the top and the string-array
 * provider at the BOTTOM, and rotate the array from an IIFE in between.
 * So we lift every TOP-LEVEL `a0_0x*` function declaration, every top-level
 * decoder alias binding and every top-level rotation IIFE into one synthetic
 * script, run that in a bare vm context, then call the decoders to rewrite
 * the call sites.
 *
 * Nothing from the obfuscated body is ever executed.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ------------------------------------------------------------------ scanner

const OBF_RE = /^(?:a0_0x[0-9a-fA-F]+|_0x[0-9a-fA-F]+)$/;

function isRegexStart(src, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(src[j])) j--;
  if (j < 0) return true;
  const c = src[j];
  if ('(,=:[!&|?{};+-*%~^<>'.includes(c)) return true;
  const tail = src.slice(Math.max(0, j - 9), j + 1);
  return /(?:^|[^\w$])(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)\s*$/.test(tail);
}

function skipRegex(src, i) {
  i++;
  let inClass = false;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '[') { inClass = true; i++; continue; }
    if (c === ']') { inClass = false; i++; continue; }
    if (c === '/' && !inClass) { i++; break; }
    if (c === '\n') break;
    i++;
  }
  while (i < src.length && /[a-z]/.test(src[i])) i++;
  return i;
}

function skipString(src, i) {
  const q = src[i];
  i++;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === q) return i + 1;
    i++;
  }
  return src.length;
}

function step(src, i) {
  const c = src[i];
  if (c === '/' && src[i + 1] === '/') { const n = src.indexOf('\n', i); return n < 0 ? src.length : n; }
  if (c === '/' && src[i + 1] === '*') { const n = src.indexOf('*/', i + 2); return n < 0 ? src.length : n + 2; }
  if (c === "'" || c === '"' || c === '`') return skipString(src, i);
  if (c === '/' && isRegexStart(src, i)) return skipRegex(src, i);
  return i + 1;
}

function matchBrace(src, open) {
  let depth = 0;
  let i = open;
  while (i < src.length) {
    const n = step(src, i);
    if (n > i + 1) { i = n; continue; }
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i + 1; }
    i++;
  }
  return src.length;
}

function matchParen(src, open) {
  let depth = 0;
  let i = open;
  while (i < src.length) {
    const n = step(src, i);
    if (n > i + 1) { i = n; continue; }
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return i + 1; }
    i++;
  }
  return src.length;
}

function depthMap(src) {
  const depth = new Int32Array(src.length + 1);
  let d = 0;
  let i = 0;
  while (i < src.length) {
    const n = step(src, i);
    if (n > i + 1) { for (let k = i; k < Math.min(n, src.length); k++) depth[k] = d; i = n; continue; }
    depth[i] = d;
    const c = src[i];
    if (c === '{' || c === '(' || c === '[') d++;
    else if (c === '}' || c === ')' || c === ']') { d--; depth[i] = d; }
    i++;
  }
  depth[src.length] = d;
  return depth;
}

function buildPrologue(src) {
  const depth = depthMap(src);
  const items = [];
  let m;

  // `const a0_0xabc = a0_0xdef;` — top-level decoder aliases. Some array
  // providers call through these, so they must be materialised too.
  const aliasStmtRe = /(?:const|let|var)\s+([\w$]+)\s*=\s*([\w$]+)\s*;/g;
  while ((m = aliasStmtRe.exec(src))) {
    if (depth[m.index] !== 0) continue;
    if (!OBF_RE.test(m[1]) || !OBF_RE.test(m[2])) continue;
    items.push({ start: m.index, end: aliasStmtRe.lastIndex, kind: 'alias' });
  }

  const fnRe = /function\s+(a0_0x[0-9a-fA-F]+)\s*\(/g;
  while ((m = fnRe.exec(src))) {
    if (depth[m.index] !== 0) continue;
    const openParen = src.indexOf('(', m.index + m[0].length - 1);
    const closeParen = matchParen(src, openParen);
    const openBrace = src.indexOf('{', closeParen);
    if (openBrace < 0) continue;
    items.push({ start: m.index, end: matchBrace(src, openBrace), kind: 'fn', pid: m[1] });
  }

  // Rotation IIFE: end at its OWN argument list, never at an outer paren —
  // these files chain it into `(...(a0_0x..,0x..),require('dotenv').config())`.
  const iifeRe = /\(\s*function\s*\(\s*_0x[0-9a-fA-F]+\s*,\s*_0x[0-9a-fA-F]+\s*\)\s*\{/g;
  while ((m = iifeRe.exec(src))) {
    // Some bundles wrap the whole prologue in extra parens, e.g.
    // `((function(){...})(arr, 0x..), require('dotenv').config())`, so the
    // rotation can sit a couple of levels deep. The arg signature keeps the
    // match honest.
    if (depth[m.index] > 3) continue;
    const openBrace = src.indexOf('{', m.index + m[0].length - 1);
    const bodyEnd = matchBrace(src, openBrace);
    const argOpen = src.indexOf('(', bodyEnd);
    if (argOpen < 0) continue;
    if (!/^\(\s*a0_0x[0-9a-fA-F]+\s*,/.test(src.slice(argOpen, argOpen + 40))) continue;
    const argEnd = matchParen(src, argOpen);

    // The wrapper can be `(IIFE, otherExpr)`; we stop at the IIFE's own
    // argument list, so close whatever parens the wrapper opened for us.
    let text = src.slice(m.index, argEnd);
    let unclosed = 0;
    for (let k = 0; k < text.length;) {
      const n2 = step(text, k);
      if (n2 > k + 1) { k = n2; continue; }
      if (text[k] === '(') unclosed++;
      else if (text[k] === ')') unclosed--;
      k++;
    }
    while (unclosed-- > 0) text += ')';
    items.push({ start: m.index, end: argEnd, kind: 'iife', text });
  }

  const aliases = items.filter((x) => x.kind === 'alias').sort((a, b) => a.start - b.start);
  const fns = items.filter((x) => x.kind === 'fn').sort((a, b) => a.start - b.start);
  const iifes = items.filter((x) => x.kind === 'iife').sort((a, b) => a.start - b.start);

  const prologue =
    aliases.map((x) => src.slice(x.start, x.end)).join('\n') +
    '\n;\n' +
    fns.map((x) => src.slice(x.start, x.end)).join('\n;\n') +
    '\n;\n' +
    iifes.map((x) => (x.text || src.slice(x.start, x.end)) + ';').join('\n');

  return { prologue, fnIds: fns.map((x) => x.pid), iifeCount: iifes.length };
}

// ------------------------------------------------------------------- driver

function deobfuscate(file, outDir) {
  const src = fs.readFileSync(file, 'utf8');
  const { prologue, iifeCount } = buildPrologue(src);
  const base = path.basename(file);

  const sandbox = { console: { log() {}, error() {}, warn() {} } };
  vm.createContext(sandbox);
  try {
    vm.runInContext(prologue, sandbox, { filename: base, timeout: 15000 });
  } catch (e) {
    if (outDir) fs.writeFileSync(path.join(outDir, base + '.prologue.js'), prologue, 'utf8');
    return { file, ok: false, reason: 'prologue eval failed: ' + e.message };
  }

  const decoders = new Map();
  for (const key of Object.keys(sandbox)) {
    if (typeof sandbox[key] === 'function' && key.startsWith('a0_0x') && OBF_RE.test(key)) {
      decoders.set(key, sandbox[key]);
    }
  }
  if (!decoders.size) return { file, ok: false, reason: 'no decoder found' };

  // Alias graph: any `X = Y` where both look like obfuscator identifiers.
  const aliases = new Map();
  const aliasRe = /\b([\w$]*_0x[0-9a-fA-F]+)\s*=\s*([\w$]*_0x[0-9a-fA-F]+)\s*(?=[;,)'\]])/g;
  let am;
  while ((am = aliasRe.exec(src))) {
    if (am[1] !== am[2] && !aliases.has(am[1])) aliases.set(am[1], am[2]);
  }

  const resolve = (name) => {
    let n = name;
    for (let i = 0; i < 12; i++) {
      if (decoders.has(n)) return n;
      const next = aliases.get(n);
      if (!next || next === n) return null;
      n = next;
    }
    return null;
  };

  const names = [...new Set([...decoders.keys(), ...aliases.keys()])]
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/\$/g, '\\$'));

  const callRe = new RegExp(`(?<![\\w$.])(${names.join('|')})\\s*\\(\\s*(0x[0-9a-fA-F]+)\\s*\\)`, 'g');

  let replaced = 0;
  let failed = 0;
  const out = src.replace(callRe, (match, name, hex) => {
    const real = resolve(name);
    if (!real) return match;
    try {
      const val = decoders.get(real)(parseInt(hex, 16));
      if (typeof val !== 'string' && typeof val !== 'number') return match;
      replaced++;
      return typeof val === 'number'
        ? String(val)
        : "'" + val.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n') + "'";
    } catch (e) {
      failed++;
      return match;
    }
  });

  const leftover = [...new Set(
    [...out.matchAll(/([\w$]+_0x[0-9a-fA-F]+|a0_0x[0-9a-fA-F]+)\s*\(\s*0x[0-9a-fA-F]+\s*\)/g)].map((mm) => mm[0])
  )];

  return {
    file, ok: true, decoders: [...decoders.keys()], iifeCount,
    aliases: aliases.size, replaced, failed,
    leftoverCount: leftover.length, leftover: leftover.slice(0, 12), output: out,
  };
}

const inputDir = process.argv[2];
const outputDir = process.argv[3];
const targets = process.argv.slice(4);

fs.mkdirSync(outputDir, { recursive: true });

for (const rel of targets) {
  const file = path.join(inputDir, rel);
  if (!fs.existsSync(file)) { console.log(`MISS ${rel}`); continue; }
  const r = deobfuscate(file, outputDir);
  if (!r.ok) { console.log(`FAIL ${rel}: ${r.reason}`); continue; }
  const outName = rel.replace(/[\\/]/g, '__') + '.deob.js';
  fs.writeFileSync(path.join(outputDir, outName), r.output, 'utf8');
  console.log(
    `OK   ${rel}  dec=${r.decoders.length}[${r.decoders.map((d) => d.replace('a0_0x', '')).join(',')}]  ` +
    `iife=${r.iifeCount}  alias=${r.aliases}  sub=${r.replaced}  fail=${r.failed}  left=${r.leftoverCount}`
  );
  if (r.leftoverCount) console.log('     left: ' + r.leftover.join(' , '));
}
