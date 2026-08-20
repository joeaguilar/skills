#!/usr/bin/env node
// assets/testreport.mjs — suite-result normalizer for the crucible loop.
//
// Normalizes many test-runner outputs (JUnit XML, TAP, cargo libtest JSON,
// pytest-json-report, go test -json) into ONE shape, resolves the blind
// test-author's behavior->test map (SCHEMAS.md §3), and diffs failure sets
// against a baseline (SCHEMAS.md §4/§6). Node >= 18, zero dependencies —
// the XML parser is hand-rolled and defensive: a malformed file exits 1
// with a message naming the line and byte offset, never a raw stack.
//
// Subcommands: parse | behaviors | diff
// Every subcommand takes --json for machine output. See --help.

import { readFileSync } from 'node:fs';
import process from 'node:process';

const FORMATS = ['junit', 'tap', 'cargo-json', 'pytest-json', 'go-json'];

// ---------------------------------------------------------------- plumbing

function die(msg, code = 2) {
  process.stderr.write(`testreport: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv, flagsWithValue, boolFlags = ['json']) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-') { opts._.push(a); continue; }
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

function readInput(pathArg) {
  const label = pathArg === '-' ? '<stdin>' : pathArg;
  let text;
  try {
    text = pathArg === '-' ? readFileSync(0, 'utf8') : readFileSync(pathArg, 'utf8');
  } catch (e) {
    die(`cannot read ${label}: ${e.message}`, 1);
  }
  return { text, label };
}

function loadJSONFile(pathArg, what) {
  let txt;
  try {
    txt = readFileSync(pathArg, 'utf8');
  } catch (e) {
    die(`cannot read ${what} file ${pathArg}: ${e.message}`, 1);
  }
  try {
    return JSON.parse(txt);
  } catch (e) {
    die(`invalid JSON in ${what} file ${pathArg}: ${e.message}`, 1);
  }
}

function emit(jsonMode, obj, textFn) {
  if (jsonMode) process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  else process.stdout.write(textFn(obj));
}

// ---------------------------------------------------------------- XML (hand-rolled)

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

// Minimal defensive XML parser: returns a synthetic root whose children are the
// document's top-level elements. Elements: { tag, attrs, children, text }.
// Handles nested elements, self-closing tags, both attribute quote styles,
// unquoted attribute values, comments, CDATA, <?...?> and <!...> declarations.
// Throws Error with line + byte offset on malformed input.
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

  const root = { tag: null, attrs: {}, children: [], text: '' };
  const stack = [root];
  const top = () => stack[stack.length - 1];

  while (pos < n) {
    const lt = text.indexOf('<', pos);
    if (lt === -1) {
      if (stack.length > 1) fail(`unclosed <${top().tag}>`, pos);
      if (text.slice(pos).trim() !== '') fail('stray text outside the root element', pos);
      break;
    }
    if (lt > pos) top().text += unescapeXml(text.slice(pos, lt));
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
      top().text += text.slice(pos + 9, end);
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
    // opening tag
    let i = pos + 1;
    let nameEnd = i;
    while (nameEnd < n && !isSpace(text[nameEnd]) && text[nameEnd] !== '>' && text[nameEnd] !== '/') nameEnd++;
    const tag = text.slice(i, nameEnd);
    if (tag === '') fail('malformed tag: empty element name', pos);
    const el = { tag, attrs: {}, children: [], text: '' };
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

// ---------------------------------------------------------------- format parsers
// Each returns [{ name, status, file, durationMs }] with status passed|failed|skipped,
// or exits 1 (never returns an empty set for a format error).

function parseJUnit(text, label) {
  let root;
  try {
    root = parseXmlDoc(text);
  } catch (e) {
    die(`${label}: malformed XML — ${e.message}`, 1);
  }
  if (root.children.length === 0) {
    die(`${label}: no XML elements found — expected a <testsuites> or <testsuite> document`, 1);
  }
  const known = ['testsuites', 'testsuite', 'testcase'];
  const bad = root.children.find((el) => !known.includes(el.tag));
  if (bad) {
    die(`${label}: unexpected root element <${bad.tag}> — expected <testsuites>, <testsuite>, or <testcase>`, 1);
  }
  const tests = [];
  const walk = (el, suiteStack) => {
    if (el.tag === 'testcase') {
      const caseName = el.attrs.name ?? '';
      const classname = el.attrs.classname ?? el.attrs.class ?? '';
      const qualifier = classname !== '' ? classname : suiteStack.filter((s) => s !== '').join(' ');
      const name = qualifier !== '' ? `${qualifier} ${caseName}` : caseName;
      let status = 'passed';
      for (const ch of el.children) {
        if (ch.tag === 'failure' || ch.tag === 'error') { status = 'failed'; break; }
        if (ch.tag === 'skipped') status = 'skipped';
      }
      const t = parseFloat(el.attrs.time);
      tests.push({
        name,
        status,
        file: el.attrs.file ?? null,
        durationMs: Number.isFinite(t) ? Math.round(t * 1000) : null,
      });
      return;
    }
    const next = el.tag === 'testsuite' ? [...suiteStack, el.attrs.name ?? ''] : suiteStack;
    for (const ch of el.children) walk(ch, next);
  };
  for (const el of root.children) walk(el, []);
  return tests;
}

function parseTAP(text, label) {
  const lines = text.split(/\r?\n/);
  const tests = [];
  let plan = null;
  let sawTapMarker = false;
  let inYaml = false;
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (inYaml) {
      if (/^\s*\.\.\.\s*$/.test(line)) inYaml = false;
      continue;
    }
    if (/^\s+---\s*$/.test(line)) { inYaml = true; continue; }
    if (/^\s/.test(line)) continue; // indented: TAP14 subtest lines / diagnostics
    if (/^TAP version \d+/.test(line)) { sawTapMarker = true; continue; }
    let m = line.match(/^1\.\.(\d+)(\s*#.*)?$/);
    if (m) {
      sawTapMarker = true;
      plan = parseInt(m[1], 10);
      continue;
    }
    if (/^Bail out!/i.test(line)) {
      die(`${label}: TAP bail out at line ${idx + 1}: ${line.slice('Bail out!'.length).trim() || '(no reason given)'}`, 1);
    }
    m = line.match(/^(not )?ok\b\s*(\d+)?\s*(.*)$/);
    if (m) {
      sawTapMarker = true;
      let desc = m[3] ?? '';
      let directive = null;
      const dm = desc.match(/(^|\s)#\s*(SKIP|TODO)\b/i);
      if (dm) {
        directive = dm[2].toUpperCase();
        desc = desc.slice(0, dm.index);
      }
      desc = desc.replace(/^\s*-\s*/, '').trim();
      const num = m[2] !== undefined ? parseInt(m[2], 10) : tests.length + 1;
      const status = directive !== null ? 'skipped' : (m[1] ? 'failed' : 'passed');
      tests.push({ name: desc !== '' ? desc : `test ${num}`, status, file: null, durationMs: null });
      continue;
    }
    // comments, pragmas, anything else: ignored
  }
  if (!sawTapMarker) {
    die(`${label}: not a TAP stream — no "TAP version" line, plan (1..N), or ok/not ok test points found`, 1);
  }
  if (plan !== null && tests.length !== plan) {
    die(`${label}: TAP plan declares ${plan} test(s) but ${tests.length} test point(s) found — truncated or corrupt stream`, 1);
  }
  return tests;
}

function parseCargoJson(text, label) {
  const tests = [];
  let sawJson = 0;
  let sawSuite = false;
  for (const lineRaw of text.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (line === '' || line[0] !== '{') continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    sawJson++;
    if (obj.type === 'suite') { sawSuite = true; continue; }
    if (obj.type !== 'test') continue;
    const ev = obj.event;
    if (ev === 'started') continue;
    let status;
    if (ev === 'ok') status = 'passed';
    else if (ev === 'failed' || ev === 'timeout') status = 'failed';
    else if (ev === 'ignored') status = 'skipped';
    else continue;
    tests.push({
      name: typeof obj.name === 'string' ? obj.name : `test ${tests.length + 1}`,
      status,
      file: null,
      durationMs: typeof obj.exec_time === 'number' ? Math.round(obj.exec_time * 1000) : null,
    });
  }
  if (sawJson === 0) {
    die(`${label}: no libtest JSON lines found — expected lines like {"type":"test","event":"ok",...} (cargo test -- -Z unstable-options --format json)`, 1);
  }
  if (tests.length === 0 && !sawSuite) {
    die(`${label}: libtest JSON stream contains no finished test events and no suite summary`, 1);
  }
  return tests;
}

function parsePytestJson(text, label) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    die(`${label}: invalid JSON — ${e.message}`, 1);
  }
  if (doc === null || typeof doc !== 'object' || !Array.isArray(doc.tests)) {
    die(`${label}: not a pytest-json-report file — expected a top-level "tests" array (pytest --json-report)`, 1);
  }
  const outcomeMap = {
    passed: 'passed', xpassed: 'passed',
    failed: 'failed', error: 'failed',
    skipped: 'skipped', xfailed: 'skipped',
  };
  return doc.tests.map((t, i) => {
    const nodeid = typeof t.nodeid === 'string' ? t.nodeid : '';
    if (nodeid === '') die(`${label}: tests[${i}] has no nodeid`, 1);
    const status = outcomeMap[String(t.outcome ?? '').toLowerCase()];
    if (status === undefined) die(`${label}: tests[${i}] ("${nodeid}") has unrecognized outcome "${t.outcome}"`, 1);
    const parts = nodeid.split('::');
    let dur = null;
    for (const phase of ['setup', 'call', 'teardown']) {
      if (t[phase] && typeof t[phase].duration === 'number') dur = (dur ?? 0) + t[phase].duration;
    }
    if (dur === null && typeof t.duration === 'number') dur = t.duration;
    return {
      name: parts.join(' '),
      status,
      file: parts.length > 1 ? parts[0] : null,
      durationMs: dur === null ? null : Math.round(dur * 1000),
    };
  });
}

function parseGoJson(text, label) {
  const tests = [];
  let sawEvent = 0;
  let failedPackage = null;
  for (const lineRaw of text.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (line === '' || line[0] !== '{') continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (typeof obj.Action !== 'string') continue;
    sawEvent++;
    if (typeof obj.Test !== 'string' || obj.Test === '') {
      if (obj.Action === 'fail' && typeof obj.Package === 'string') failedPackage = obj.Package;
      continue;
    }
    let status;
    if (obj.Action === 'pass') status = 'passed';
    else if (obj.Action === 'fail') status = 'failed';
    else if (obj.Action === 'skip') status = 'skipped';
    else continue;
    tests.push({
      name: obj.Package ? `${obj.Package} ${obj.Test}` : obj.Test,
      status,
      file: null,
      durationMs: typeof obj.Elapsed === 'number' ? Math.round(obj.Elapsed * 1000) : null,
    });
  }
  if (sawEvent === 0) {
    die(`${label}: no "go test -json" events found — expected lines like {"Action":"pass","Package":...,"Test":...}`, 1);
  }
  if (tests.length === 0 && failedPackage !== null) {
    die(`${label}: no per-test results — package ${failedPackage} failed before running any test (build failure?)`, 1);
  }
  return tests;
}

function sniffFormat(text, label) {
  const t = text.replace(/^\uFEFF/, '');
  const trimmed = t.trimStart();
  if (trimmed.startsWith('<')) return 'junit';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let firstObj = null;
    try { firstObj = JSON.parse(trimmed.split(/\r?\n/, 1)[0]); } catch { /* multi-line JSON */ }
    if (firstObj !== null && typeof firstObj === 'object') {
      if (firstObj.type === 'test' || firstObj.type === 'suite') return 'cargo-json';
      if (typeof firstObj.Action === 'string') return 'go-json';
      if (Array.isArray(firstObj.tests)) return 'pytest-json';
    }
    let whole = null;
    try { whole = JSON.parse(trimmed); } catch { /* not one document */ }
    if (whole !== null && typeof whole === 'object' && Array.isArray(whole.tests)) return 'pytest-json';
    die(`${label}: cannot auto-detect the format of this JSON input — pass --format explicitly`, 1);
  }
  if (/^TAP version \d+/m.test(t) || /^1\.\.\d+/m.test(t) || /^(not )?ok\b/m.test(t)) return 'tap';
  die(`${label}: cannot auto-detect format — expected JUnit XML, a TAP stream, or JSON test output; pass --format`, 1);
}

function resolveFormat(opts, text, label) {
  const format = opts.format ?? 'auto';
  if (format !== 'auto' && !FORMATS.includes(format)) {
    die(`unknown --format '${format}' (expected ${FORMATS.join('|')}|auto)`);
  }
  return format === 'auto' ? sniffFormat(text, label) : format;
}

function parseSuite(text, format, label) {
  switch (format) {
    case 'junit': return parseJUnit(text, label);
    case 'tap': return parseTAP(text, label);
    case 'cargo-json': return parseCargoJson(text, label);
    case 'pytest-json': return parsePytestJson(text, label);
    case 'go-json': return parseGoJson(text, label);
    default: die(`unknown format '${format}'`);
  }
}

function summarize(tests) {
  let passed = 0, failed = 0, skipped = 0;
  for (const t of tests) {
    if (t.status === 'passed') passed++;
    else if (t.status === 'failed') failed++;
    else skipped++;
  }
  return {
    passed,
    failed,
    skipped,
    tests,
    failures: tests.filter((t) => t.status === 'failed').map((t) => t.name),
  };
}

// ---------------------------------------------------------------- parse

function cmdParse(argv) {
  const opts = parseArgs(argv, ['format']);
  if (opts._.length !== 1) die('parse: exactly one <file|-> required (see --help)');
  const { text, label } = readInput(opts._[0]);
  const format = resolveFormat(opts, text, label);
  const report = summarize(parseSuite(text, format, label));
  emit(opts.json, report, (o) => {
    let s = `${label} (${format}): ${o.tests.length} test(s) — ${o.passed} passed, ${o.failed} failed, ${o.skipped} skipped\n`;
    for (const name of o.failures) s += `  FAIL ${name}\n`;
    return s;
  });
  process.exit(0);
}

// ---------------------------------------------------------------- behaviors

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cmdBehaviors(argv) {
  const opts = parseArgs(argv, ['format', 'map']);
  if (opts._.length !== 1) die('behaviors: exactly one <file|-> required (see --help)');
  if (!opts.map) die('behaviors: --map <behaviors.json> required');
  const { text, label } = readInput(opts._[0]);
  const format = resolveFormat(opts, text, label);
  const tests = parseSuite(text, format, label);

  const mapDoc = loadJSONFile(opts.map, 'behavior map');
  if (mapDoc === null || typeof mapDoc !== 'object' || !Array.isArray(mapDoc.map)) {
    die(`${opts.map}: not a behavior map — expected { "map": [{ "behavior", "test", ... }] } (SCHEMAS.md §3)`, 1);
  }
  const seen = new Set();
  for (const [i, entry] of mapDoc.map.entries()) {
    if (entry === null || typeof entry !== 'object' || typeof entry.behavior !== 'string' || entry.behavior === '') {
      die(`${opts.map}: map[${i}] missing a "behavior" id`, 1);
    }
    if (typeof entry.test !== 'string' || entry.test === '') {
      die(`${opts.map}: map[${i}] (behavior ${entry.behavior}) missing a "test" name`, 1);
    }
    if (seen.has(entry.behavior)) die(`${opts.map}: duplicate behavior id ${entry.behavior}`, 1);
    seen.add(entry.behavior);
  }

  const resolution = mapDoc.map.map((entry) => {
    const token = new RegExp(`\\b${escapeRegExp(entry.behavior)}\\b`);
    const tokenMatches = tests.filter((t) => token.test(t.name));
    if (tokenMatches.length > 0) {
      const hit = tokenMatches.find((t) => t.status === 'passed') ?? tokenMatches[0];
      return { behavior: entry.behavior, test: hit.name, how: 'token', status: hit.status };
    }
    const exact = tests.find((t) => t.name === entry.test);
    if (exact !== undefined) {
      return { behavior: entry.behavior, test: exact.name, how: 'exact', status: exact.status };
    }
    return { behavior: entry.behavior, test: null, how: 'none', status: null };
  });

  const declared = mapDoc.map.map((e) => e.behavior);
  const satisfied = resolution.filter((r) => r.status === 'passed').map((r) => r.behavior);
  const missing = declared.filter((b) => !satisfied.includes(b));
  const out = { declared, satisfied, missing, resolution };

  emit(opts.json, out, (o) => {
    let s = `behaviors: ${o.declared.length} declared, ${o.satisfied.length} satisfied, ${o.missing.length} missing\n`;
    for (const r of o.resolution) {
      const verdict = r.status === 'passed' ? 'SATISFIED' : 'MISSING  ';
      const via = r.how === 'none' ? 'no matching test' : `${r.how} -> "${r.test}" (${r.status})`;
      s += `  ${verdict} ${r.behavior.padEnd(6)} ${via}\n`;
    }
    return s;
  });
  process.exit(missing.length > 0 ? 1 : 0);
}

// ---------------------------------------------------------------- diff

function extractFailures(doc, fileLabel) {
  if (doc === null || typeof doc !== 'object') {
    die(`${fileLabel}: expected a JSON object (parse output or evidence report), got ${doc === null ? 'null' : typeof doc}`, 1);
  }
  let failures;
  if (Array.isArray(doc.tests)) {
    // bare parse output: tests is the array of test records
    failures = doc.failures;
  } else if (doc.tests !== null && typeof doc.tests === 'object') {
    // evidence report / baseline (SCHEMAS.md §4/§6): tests is the summary object
    failures = doc.tests.failures;
  } else if (Array.isArray(doc.failures)) {
    failures = doc.failures;
  }
  if (!Array.isArray(failures)) {
    die(`${fileLabel}: unrecognized shape — expected a parse output ({ "tests": [...], "failures": [...] }) or an evidence report ({ "tests": { "failures": [...] } })`, 1);
  }
  for (const [i, f] of failures.entries()) {
    if (typeof f !== 'string') die(`${fileLabel}: failures[${i}] is not a string`, 1);
  }
  return failures;
}

function cmdDiff(argv) {
  const opts = parseArgs(argv, ['baseline']);
  if (opts._.length !== 1) die('diff: exactly one <current.json> required (see --help)');
  if (!opts.baseline) die('diff: --baseline <baseline.json> required');
  const current = extractFailures(loadJSONFile(opts._[0], 'current'), opts._[0]);
  const baseline = extractFailures(loadJSONFile(opts.baseline, 'baseline'), opts.baseline);
  const baseSet = new Set(baseline);
  const curSet = new Set(current);
  const out = {
    failures: current,
    baselineFailures: baseline,
    newFailures: current.filter((f) => !baseSet.has(f)),
    fixedFailures: baseline.filter((f) => !curSet.has(f)),
  };
  emit(opts.json, out, (o) => {
    let s = `diff: ${o.failures.length} current failure(s), ${o.baselineFailures.length} baseline, ${o.newFailures.length} new, ${o.fixedFailures.length} fixed\n`;
    for (const f of o.newFailures) s += `  NEW   ${f}\n`;
    for (const f of o.fixedFailures) s += `  FIXED ${f}\n`;
    return s;
  });
  process.exit(out.newFailures.length > 0 ? 1 : 0);
}

// ---------------------------------------------------------------- help / main

const HELP = `testreport.mjs — suite-result normalizer for the crucible loop
Zero dependencies (node builtins, hand-rolled XML). Normalizes test-runner
output into one shape, resolves behavior->test maps, diffs failure sets.
All commands take --json for machine output; --json always prints the full
object even when the command exits 1 as a gate.

USAGE
  node testreport.mjs <command> [args] [--json]

COMMANDS
  parse <file|-> --format <fmt> [--json]
      Normalize a test-runner report to
      { passed, failed, skipped, tests: [{name,status,file,durationMs}], failures }.
      status is passed|failed|skipped; name is the fully-qualified test name
      (suite/class + case joined with a single space) so behavior-id tokens
      survive. Exit 0 on a successful parse (even with failing tests);
      exit 1 on a malformed/unreadable report.

  behaviors <file|-> --format <fmt> --map <behaviors.json> [--json]
      Resolve each behavior in the map (SCHEMAS.md section 3) against the
      parsed results. A behavior is SATISFIED iff a test whose name contains
      the behavior id as a standalone token (\\bB<N>\\b) exists AND passed;
      falls back to exact map[].test name equality when no token match exists.
      Emits { declared, satisfied, missing, resolution:[{behavior,test,how,status}] }
      with how one of token|exact|none. Exit 1 if any behavior is missing
      (shell-gate friendly), 0 otherwise.

  diff <current.json> --baseline <baseline.json> [--json]
      Set-difference of failure NAMES between a current parse output and a
      baseline. Either file may be a bare parse output ({tests:[...],failures})
      or a full evidence report / baseline file (SCHEMAS.md sections 4/6,
      {tests:{failures:[...]}}) — detected by the shape of its "tests" key.
      Emits { failures, baselineFailures, newFailures, fixedFailures }.
      Exit 1 when newFailures is non-empty.

FORMATS (--format)
  junit        JUnit/xUnit XML (nested testsuites, self-closing testcases,
               failure/error/skipped children, both attribute quote styles)
  tap          TAP 13/14 (plan check, SKIP/TODO directives -> skipped,
               YAML diagnostics skipped, Bail out! -> exit 1)
  cargo-json   cargo test -- -Z unstable-options --format json (libtest JSON lines)
  pytest-json  pytest-json-report (top-level "tests" array)
  go-json      go test -json (Action pass|fail|skip events)
  auto         sniff by content: '<' -> junit; JSON line with "type" ->
               cargo-json, with "Action" -> go-json, document with "tests" ->
               pytest-json; TAP version/plan/ok lines -> tap

EXIT CODES
  0 success (all behaviors satisfied / no new failures) · 1 parse failure or
  gate failure (missing behavior, new failure) · 2 usage error
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
    case 'parse': return cmdParse(rest);
    case 'behaviors': return cmdBehaviors(rest);
    case 'diff': return cmdDiff(rest);
    default: die(`unknown command '${cmd}' (see --help)`);
  }
}

main();
