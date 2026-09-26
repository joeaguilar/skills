#!/usr/bin/env node
// assets/cover.mjs — changed-lines coverage gate for the crucible loop.
//
// Intersects the lines ADDED/MODIFIED by a git diff with a coverage report's
// per-file executable-line hit data and emits exactly SCHEMAS.md section 4's
// "coverage" object. Diff lines that are NOT executable lines in the report
// (blank lines, comments, braces) are excluded from both numerator and
// denominator — a file of pure comments cannot tank the ratio.
// Node >= 18, zero dependencies (hand-rolled cobertura XML parsing).
//
// Subcommand: changed. Takes --json for machine output. See --help.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const IS_WIN = process.platform === 'win32';
const COV_FORMATS = ['lcov', 'cobertura', 'coveragepy', 'go'];
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'; // git's canonical empty tree

// ---------------------------------------------------------------- plumbing

function die(msg, code = 2) {
  process.stderr.write(`cover: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv, flagsWithValue, boolFlags = ['json']) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      if (boolFlags.includes(name)) { opts[name] = true; continue; }
      if (flagsWithValue.includes(name)) {
        if (i + 1 >= argv.length) die(`--${name} requires a value`);
        opts[name] = argv[++i];
        continue;
      }
      die(`unknown option --${name} (see --help)`);
    } else {
      opts._.push(a);
    }
  }
  return opts;
}

const r3 = (x) => Math.round(x * 1000) / 1000;

// ---------------------------------------------------------------- paths

function posixPath(p) {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

function cmpNorm(p) {
  const q = posixPath(p);
  return IS_WIN ? q.toLowerCase() : q;
}

// does a end with b on a path-segment boundary (or equal)?
function segSuffix(a, b) {
  if (a === b) return true;
  return a.length > b.length && a.endsWith(b) && a[a.length - b.length - 1] === '/';
}

// ---------------------------------------------------------------- glob matcher (**, *, ?)

function globToRegExp(glob) {
  const g = posixPath(glob.trim());
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        i++;
        if (g[i + 1] === '/') { re += '(?:.*/)?'; i++; } // '**/' spans zero or more dirs
        else re += '.*';
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('\\^$.|+()[]{}'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`, IS_WIN ? 'i' : '');
}

function compileGlobs(spec) {
  const raw = spec.split(',').map((s) => s.trim()).filter((s) => s !== '');
  if (raw.length === 0) die('--globs given but no non-empty glob patterns found');
  return raw.map((g) => ({ raw: g, re: globToRegExp(g), bare: !g.includes('/') }));
}

function matchesGlobs(globs, path) {
  const p = posixPath(path);
  return globs.some((g) => g.re.test(p) || (g.bare && g.re.test(p.split('/').pop())));
}

// ---------------------------------------------------------------- git

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    if (allowFail) return null;
    const stderr = (e.stderr ?? '').toString().trim();
    die(`git ${args.join(' ')} failed: ${stderr !== '' ? stderr : e.message}`, 1);
  }
}

function resolveBase(explicit) {
  if (explicit !== undefined) return { base: explicit, note: `--base ${explicit}` };
  const dirty = git(['status', '--porcelain']).trim() !== '';
  if (dirty) return { base: 'HEAD', note: 'HEAD (uncommitted changes present)' };
  if (git(['rev-parse', '--verify', '--quiet', 'HEAD~1'], { allowFail: true }) !== null) {
    return { base: 'HEAD~1', note: 'HEAD~1 (working tree clean)' };
  }
  return { base: EMPTY_TREE, note: 'empty tree (single-commit repo, working tree clean)' };
}

// C-style unquoting for git's quoted paths ("a/path\303\251...")
function unquoteC(s) {
  const inner = s.slice(1, -1);
  const bytes = [];
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c !== '\\') {
      for (const b of Buffer.from(c, 'utf8')) bytes.push(b);
      continue;
    }
    const nxt = inner[++i];
    if (nxt === undefined) break;
    if (nxt === 'n') bytes.push(10);
    else if (nxt === 't') bytes.push(9);
    else if (nxt === 'r') bytes.push(13);
    else if (nxt === '\\' || nxt === '"') bytes.push(nxt.charCodeAt(0));
    else if (nxt >= '0' && nxt <= '7') {
      let oct = nxt;
      while (oct.length < 3 && inner[i + 1] >= '0' && inner[i + 1] <= '7') oct += inner[++i];
      bytes.push(parseInt(oct, 8) & 0xff);
    } else {
      bytes.push(nxt.charCodeAt(0));
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

// '+++ ' payload -> repo-relative path, or null for /dev/null
function parseDiffPath(raw) {
  let s = raw.replace(/\r$/, '').replace(/\t$/, '');
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) s = unquoteC(s);
  if (s === '/dev/null') return null;
  if (s.startsWith('b/')) s = s.slice(2);
  return s;
}

// Parse `git diff --unified=0` output into [{ path, cmp, added:Set<line> }].
// Handles renames (+++ b/newpath), /dev/null (deleted files), quoted paths,
// and paths with spaces. Deleted lines count for nothing.
function collectChangedFiles(base) {
  const out = git(['diff', '--unified=0', '--no-color', '--no-ext-diff', base]);
  const files = new Map();
  let current = null;
  let prev = '';
  for (const line of out.split('\n')) {
    if (line.startsWith('diff --git')) {
      current = null;
    } else if (line.startsWith('+++ ') && prev.startsWith('--- ')) {
      const target = parseDiffPath(line.slice(4));
      if (target === null) {
        current = null; // deleted file
      } else {
        const key = cmpNorm(target);
        if (!files.has(key)) files.set(key, { path: posixPath(target), cmp: key, added: new Set() });
        current = files.get(key);
      }
    } else if (line.startsWith('@@ ')) {
      const m = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (m !== null && current !== null) {
        const start = parseInt(m[1], 10);
        const count = m[2] !== undefined ? parseInt(m[2], 10) : 1;
        for (let l = start; l < start + count; l++) current.added.add(l);
      }
    }
    prev = line;
  }
  return [...files.values()].filter((f) => f.added.size > 0);
}

// ---------------------------------------------------------------- coverage parsers
// Each returns [{ path, cmp, lines: Map<lineNumber, hits> }] where the Map keys
// are the file's EXECUTABLE lines, or exits 1 — never an empty result for a
// format error.

function getEntry(files, rawPath) {
  const key = cmpNorm(rawPath);
  if (!files.has(key)) files.set(key, { path: posixPath(rawPath), cmp: key, lines: new Map() });
  return files.get(key);
}

function addHit(entry, line, hits) {
  entry.lines.set(line, Math.max(entry.lines.get(line) ?? 0, hits));
}

function parseLcov(text, label) {
  const files = new Map();
  let current = null;
  let sawSF = 0;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('SF:')) {
      sawSF++;
      const p = line.slice(3).trim();
      if (p === '') die(`${label}: empty SF: path at line ${i + 1}`, 1);
      current = getEntry(files, p);
    } else if (line.startsWith('DA:')) {
      if (current === null) die(`${label}: DA: record before any SF: record at line ${i + 1}`, 1);
      const m = line.slice(3).match(/^(\d+),(-?\d+)/);
      if (m === null) die(`${label}: malformed record "${line}" at line ${i + 1} — expected DA:<line>,<hits>`, 1);
      addHit(current, parseInt(m[1], 10), Math.max(0, parseInt(m[2], 10)));
    } else if (line === 'end_of_record') {
      current = null;
    }
  }
  if (sawSF === 0) die(`${label}: no SF: records found — not an lcov tracefile`, 1);
  return [...files.values()];
}

// -- minimal defensive XML parser (cobertura) --------------------------------

function unescapeXml(s) {
  if (!s.includes('&')) return s;
  return s.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, ent) => {
    if (ent[0] === '#') {
      const hex = ent[1] === 'x' || ent[1] === 'X';
      const code = hex ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return m;
      try { return String.fromCodePoint(code); } catch { return m; }
    }
    switch (ent) {
      case 'lt': return '<';
      case 'gt': return '>';
      case 'amp': return '&';
      case 'quot': return '"';
      case 'apos': return "'";
      default: return m;
    }
  });
}

function parseXmlDoc(text) {
  const n = text.length;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const lineAt = (p) => {
    let line = 1;
    for (let i = 0; i < p && i < n; i++) if (text.charCodeAt(i) === 10) line++;
    return line;
  };
  const fail = (msg, p) => {
    throw new Error(`${msg} at line ${lineAt(p)} (byte offset ${p})`);
  };
  const isSpace = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';

  const root = { tag: null, attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];

  while (pos < n) {
    const lt = text.indexOf('<', pos);
    if (lt === -1) {
      if (stack.length > 1) fail(`unclosed <${top().tag}>`, pos);
      if (text.slice(pos).trim() !== '') fail('stray text outside the root element', pos);
      break;
    }
    pos = lt;
    if (text.startsWith('<?', pos)) {
      const end = text.indexOf('?>', pos + 2);
      if (end === -1) fail('unterminated <? ... ?> declaration', pos);
      pos = end + 2;
      continue;
    }
    if (text.startsWith('<!--', pos)) {
      const end = text.indexOf('-->', pos + 4);
      if (end === -1) fail('unterminated comment', pos);
      pos = end + 3;
      continue;
    }
    if (text.startsWith('<![CDATA[', pos)) {
      const end = text.indexOf(']]>', pos + 9);
      if (end === -1) fail('unterminated CDATA section', pos);
      pos = end + 3;
      continue;
    }
    if (text.startsWith('<!', pos)) {
      let depth = 0;
      let i = pos + 2;
      for (; i < n; i++) {
        const c = text[i];
        if (c === '[') depth++;
        else if (c === ']') depth--;
        else if (c === '>' && depth <= 0) break;
      }
      if (i >= n) fail('unterminated <! ... > declaration', pos);
      pos = i + 1;
      continue;
    }
    if (text.startsWith('</', pos)) {
      const gt = text.indexOf('>', pos);
      if (gt === -1) fail('unterminated closing tag', pos);
      const name = text.slice(pos + 2, gt).trim();
      if (stack.length === 1) fail(`closing </${name}> with no open element`, pos);
      const open = stack.pop();
      if (open.tag !== name) fail(`mismatched closing tag </${name}>, expected </${open.tag}>`, pos);
      pos = gt + 1;
      continue;
    }
    let i = pos + 1;
    let nameEnd = i;
    while (nameEnd < n && !isSpace(text[nameEnd]) && text[nameEnd] !== '>' && text[nameEnd] !== '/') nameEnd++;
    const tag = text.slice(i, nameEnd);
    if (tag === '') fail('malformed tag: empty element name', pos);
    const el = { tag, attrs: {}, children: [] };
    i = nameEnd;
    let selfClose = false;
    for (;;) {
      while (i < n && isSpace(text[i])) i++;
      if (i >= n) fail(`unterminated <${tag} ...> tag`, pos);
      if (text[i] === '>') { i++; break; }
      if (text[i] === '/') {
        if (text[i + 1] !== '>') fail(`malformed tag <${tag}>: '/' not followed by '>'`, i);
        selfClose = true;
        i += 2;
        break;
      }
      let aEnd = i;
      while (aEnd < n && !isSpace(text[aEnd]) && text[aEnd] !== '=' && text[aEnd] !== '>' && text[aEnd] !== '/') aEnd++;
      const aName = text.slice(i, aEnd);
      if (aName === '') fail(`malformed attribute in <${tag}>`, i);
      i = aEnd;
      while (i < n && isSpace(text[i])) i++;
      if (text[i] !== '=') { el.attrs[aName] = ''; continue; }
      i++;
      while (i < n && isSpace(text[i])) i++;
      const q = text[i];
      if (q === '"' || q === "'") {
        const close = text.indexOf(q, i + 1);
        if (close === -1) fail(`unterminated quoted value for attribute ${aName} in <${tag}>`, i);
        el.attrs[aName] = unescapeXml(text.slice(i + 1, close));
        i = close + 1;
      } else {
        let vEnd = i;
        while (vEnd < n && !isSpace(text[vEnd]) && text[vEnd] !== '>' && text[vEnd] !== '/') vEnd++;
        if (vEnd === i) fail(`missing value for attribute ${aName} in <${tag}>`, i);
        el.attrs[aName] = unescapeXml(text.slice(i, vEnd));
        i = vEnd;
      }
    }
    top().children.push(el);
    if (!selfClose) stack.push(el);
    pos = i;
  }
  if (stack.length > 1) fail(`unclosed <${top().tag}> at end of input`, n - 1);
  return root;
}

function parseCobertura(text, label) {
  let root;
  try {
    root = parseXmlDoc(text);
  } catch (e) {
    die(`${label}: malformed XML — ${e.message}`, 1);
  }
  const covEl = root.children.find((el) => el.tag === 'coverage');
  if (covEl === undefined) {
    const first = root.children[0];
    die(`${label}: not a cobertura report — root element is <${first ? first.tag : 'none'}>, expected <coverage>`, 1);
  }
  const files = new Map();
  const walk = (el, currentFile) => {
    let file = currentFile;
    if (el.tag === 'class' && typeof el.attrs.filename === 'string' && el.attrs.filename !== '') {
      file = el.attrs.filename;
    }
    if (el.tag === 'line' && file !== null && el.attrs.number !== undefined) {
      const num = parseInt(el.attrs.number, 10);
      const hits = parseInt(el.attrs.hits ?? '0', 10);
      if (Number.isFinite(num)) {
        addHit(getEntry(files, file), num, Number.isFinite(hits) ? Math.max(0, hits) : 0);
      }
    }
    for (const ch of el.children) walk(ch, file);
  };
  walk(covEl, null);
  return [...files.values()];
}

function parseCoveragePy(text, label) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    die(`${label}: invalid JSON — ${e.message}`, 1);
  }
  if (doc === null || typeof doc !== 'object' || doc.files === null || typeof doc.files !== 'object' || Array.isArray(doc.files)) {
    die(`${label}: not a coverage.py JSON report — expected a top-level "files" object (coverage json)`, 1);
  }
  const files = new Map();
  for (const [p, info] of Object.entries(doc.files)) {
    if (info === null || typeof info !== 'object') die(`${label}: files["${p}"] is not an object`, 1);
    const executed = info.executed_lines ?? [];
    const missing = info.missing_lines ?? [];
    if (!Array.isArray(executed) || !Array.isArray(missing)) {
      die(`${label}: files["${p}"] missing executed_lines/missing_lines arrays`, 1);
    }
    const entry = getEntry(files, p);
    for (const l of executed) if (Number.isInteger(l)) addHit(entry, l, 1);
    for (const l of missing) if (Number.isInteger(l)) addHit(entry, l, 0);
  }
  return [...files.values()];
}

function parseGoProfile(text, label) {
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  const modeMatch = i < lines.length ? lines[i].match(/^mode:\s*(set|count|atomic)\s*$/) : null;
  if (modeMatch === null) {
    die(`${label}: not a go coverprofile — first line must be "mode: set|count|atomic"`, 1);
  }
  const files = new Map();
  let blocks = 0;
  for (i = i + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    const m = line.match(/^(.+):(\d+)\.(\d+),(\d+)\.(\d+)\s+(\d+)\s+(\d+)$/);
    if (m === null) {
      die(`${label}: malformed coverprofile line ${i + 1}: "${line}" — expected file:startLine.startCol,endLine.endCol numStmt count`, 1);
    }
    const [, p, sl, , el, , , count] = m;
    const start = parseInt(sl, 10);
    const end = parseInt(el, 10);
    if (end < start) die(`${label}: coverprofile line ${i + 1}: end line ${end} before start line ${start}`, 1);
    const entry = getEntry(files, p);
    const hits = parseInt(count, 10);
    for (let l = start; l <= end; l++) addHit(entry, l, hits);
    blocks++;
  }
  if (blocks === 0) die(`${label}: go coverprofile contains a mode line but no coverage blocks`, 1);
  return [...files.values()];
}

function sniffCoverage(text, label) {
  const trimmed = text.replace(/^\uFEFF/, '').trimStart();
  if (/^mode:\s*(set|count|atomic)\b/.test(trimmed)) return 'go';
  if (/^(TN:|SF:)/m.test(text) && /^end_of_record\s*$/m.test(text)) return 'lcov';
  if (trimmed.startsWith('<')) return 'cobertura';
  if (trimmed.startsWith('{')) {
    let doc = null;
    try { doc = JSON.parse(trimmed); } catch { /* fall through */ }
    if (doc !== null && typeof doc === 'object' && doc.files !== null && typeof doc.files === 'object') return 'coveragepy';
    die(`${label}: cannot auto-detect the coverage format of this JSON input — pass --format explicitly`, 1);
  }
  die(`${label}: cannot auto-detect coverage format — expected lcov, cobertura XML, coverage.py JSON, or a go coverprofile; pass --format`, 1);
}

function parseCoverage(text, format, label) {
  switch (format) {
    case 'lcov': return parseLcov(text, label);
    case 'cobertura': return parseCobertura(text, label);
    case 'coveragepy': return parseCoveragePy(text, label);
    case 'go': return parseGoProfile(text, label);
    default: die(`unknown format '${format}'`);
  }
}

// Coverage paths may be absolute, ./-prefixed, or relative to a subdirectory;
// git paths are repo-relative POSIX. Match by path-segment suffix, preferring
// the longest overlap; exact match wins outright.
function matchCoverageEntry(entries, cmp) {
  let best = null;
  let bestLen = -1;
  for (const e of entries) {
    let len = -1;
    if (e.cmp === cmp) len = Infinity;
    else if (segSuffix(e.cmp, cmp)) len = cmp.length;
    else if (segSuffix(cmp, e.cmp)) len = e.cmp.length;
    if (len > bestLen) { best = e; bestLen = len; }
  }
  return bestLen === -1 ? null : best;
}

// ---------------------------------------------------------------- changed

function cmdChanged(argv) {
  const opts = parseArgs(argv, ['format', 'base', 'globs', 'min']);
  if (opts._.length !== 1) die('changed: exactly one <coverage-file> required (see --help)');
  const covPath = opts._[0];

  const min = opts.min !== undefined ? parseFloat(opts.min) : 0.7;
  if (!Number.isFinite(min) || min < 0 || min > 1) die(`--min must be a number between 0 and 1, got '${opts.min}'`);
  const format = opts.format ?? 'auto';
  if (format !== 'auto' && !COV_FORMATS.includes(format)) {
    die(`unknown --format '${format}' (expected ${COV_FORMATS.join('|')}|auto)`);
  }
  const globs = opts.globs !== undefined ? compileGlobs(opts.globs) : null;

  let covText;
  try {
    covText = readFileSync(covPath, 'utf8');
  } catch (e) {
    die(`cannot read coverage file ${covPath}: ${e.message}`, 1);
  }
  const covFormat = format === 'auto' ? sniffCoverage(covText, covPath) : format;
  const entries = parseCoverage(covText, covFormat, covPath);
  const totalExecutable = entries.reduce((s, e) => s + e.lines.size, 0);
  if (totalExecutable === 0) {
    die(`${covPath}: coverage report contains no executable-line data — refusing to compute a vacuous ratio`, 1);
  }

  if (git(['rev-parse', '--is-inside-work-tree'], { allowFail: true }) === null) {
    die(`not inside a git work tree (cwd ${process.cwd()}) — changed lines come from git diff`, 1);
  }
  const { base, note: baseNote } = resolveBase(opts.base);
  let changedFiles = collectChangedFiles(base);
  if (globs !== null) changedFiles = changedFiles.filter((f) => matchesGlobs(globs, f.path));
  changedFiles.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const filesOut = [];
  const notes = [];
  let changedLines = 0;
  let coveredLines = 0;
  for (const cf of changedFiles) {
    const entry = matchCoverageEntry(entries, cf.cmp);
    let changed = 0;
    let covered = 0;
    if (entry === null) {
      notes.push(`${cf.path}: not present in the coverage report — its ${cf.added.size} changed line(s) are excluded (not instrumented)`);
    } else {
      for (const l of cf.added) {
        if (entry.lines.has(l)) {
          changed++;
          if (entry.lines.get(l) > 0) covered++;
        }
      }
      if (changed === 0) {
        notes.push(`${cf.path}: none of its ${cf.added.size} changed line(s) are executable lines in the report`);
      }
    }
    changedLines += changed;
    coveredLines += covered;
    filesOut.push({ path: cf.path, changed, covered });
  }

  const rawRatio = changedLines === 0 ? 1 : coveredLines / changedLines;
  const pass = changedLines === 0 ? true : rawRatio + 1e-9 >= min;
  const coverage = {
    changedLines,
    coveredLines,
    ratio: r3(rawRatio),
    min,
    pass,
    files: filesOut,
  };

  if (opts.json) {
    process.stdout.write(JSON.stringify(coverage, null, 2) + '\n');
  } else {
    let s = `changed-lines coverage (${covFormat}, base ${baseNote})\n`;
    for (const f of coverage.files) {
      s += `  ${f.path}  ${f.covered}/${f.changed} changed executable line(s) covered\n`;
    }
    for (const note of notes) s += `  note: ${note}\n`;
    if (changedLines === 0) {
      s += `no changed executable lines — coverage gate passes vacuously (ratio 1)\n`;
    }
    s += `${pass ? 'PASS' : 'FAIL'} ${coveredLines}/${changedLines} covered, ratio ${coverage.ratio} (min ${min})\n`;
    process.stdout.write(s);
  }
  process.exit(pass ? 0 : 1);
}

// ---------------------------------------------------------------- help / main

const HELP = `cover.mjs — changed-lines coverage gate for the crucible loop
Zero dependencies (node builtins, hand-rolled cobertura XML). Intersects the
lines ADDED/MODIFIED by a git diff with a coverage report's executable-line
hit data and emits exactly SCHEMAS.md section 4's "coverage" object.

USAGE
  node cover.mjs changed <coverage-file> --format <fmt> [--base <git-ref>]
                 [--globs <glob,glob>] [--min 0.7] [--json]

BEHAVIOR
  Changed lines come from \`git diff --unified=0 <base>\` hunk headers; deleted
  lines count for nothing. Default base: HEAD when the working tree or index
  has uncommitted changes, else HEAD~1; in a single-commit repo with a clean
  tree, git's empty tree (so the initial commit counts as changed).
  Diff lines that are NOT executable lines in the coverage report (blank
  lines, comments, braces, uninstrumented files) are excluded from both the
  numerator and the denominator. When 0 changed executable lines remain, the
  ratio is 1 and the gate passes (nothing changed cannot fail coverage).
  Paths are matched by path-segment suffix (coverage reports emit absolute,
  ./-prefixed, or subdirectory-relative paths; git emits repo-relative POSIX
  paths); on Windows the comparison is case-insensitive with normalized
  separators.

OPTIONS
  --format   lcov | cobertura | coveragepy | go | auto (default: auto)
             lcov: SF:/DA: tracefile        cobertura: XML <coverage> report
             coveragepy: coverage.py JSON (coverage json)
             go: go test -coverprofile      auto: sniff by content
  --base     explicit git diff base ref (overrides the default above)
  --globs    comma-separated globs (**, *, ?) restricting which changed files
             count, e.g. --globs 'src/**/*.ts,lib/**'
  --min      minimum passing ratio, 0..1 (default 0.7)
  --json     print the coverage object as JSON:
             { changedLines, coveredLines, ratio, min, pass,
               files: [{ path, changed, covered }] }
             ratio is rounded to 3 decimals.

EXIT CODES
  0 pass · 1 gate failure (ratio < min) or coverage/git parse failure · 2 usage error
`;

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    process.stdout.write(HELP);
    process.exit(argv.length === 0 ? 2 : 0);
  }
  const cmd = argv[0];
  const rest = argv.slice(1);
  if (rest.includes('--help') || rest.includes('-h')) { process.stdout.write(HELP); process.exit(0); }
  switch (cmd) {
    case 'changed': return cmdChanged(rest);
    default: die(`unknown command '${cmd}' (see --help)`);
  }
}

main();
