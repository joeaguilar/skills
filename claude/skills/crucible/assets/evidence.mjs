#!/usr/bin/env node
// assets/evidence.mjs — declared-command runner for the crucible loop.
//
// Executes the contract's registered instruments (kind "command" / "probe"),
// captures raw output, extracts metrics, delegates test + coverage parsing to
// its sibling tools (testreport.mjs, cover.mjs — run as child processes, never
// imported), and writes the aggregated evidence report per SCHEMAS.md §4.
//
// This tool NEVER computes a verdict: no `layer1`, no top-level pass. That is
// gate.mjs's job — the referee recomputes pass/fail from the parts recorded here.
//
// Zero dependencies (node builtins). Node >= 18.
// Subcommands: run | baseline | show. All take --json. See --help.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONTRACT = '.crucible/CONTRACT.json';
const DEFAULT_TIMEOUT_MS = 600000;
const SIBLING_TIMEOUT_MS = 120000;

// ---------------------------------------------------------------- plumbing

function die(msg, code = 2) {
  process.stderr.write(`evidence: ${msg}\n`);
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

function loadJSONFile(absPath, label, dieCode = 2) {
  let txt;
  try {
    txt = readFileSync(absPath, 'utf8');
  } catch (e) {
    die(`cannot read ${label} ${toPosix(absPath)}: ${e.message}`, dieCode);
  }
  try {
    return JSON.parse(txt);
  } catch (e) {
    die(`invalid JSON in ${label} ${toPosix(absPath)}: ${e.message}`, dieCode);
  }
}

function tryLoadJSON(absPath) {
  try {
    return { ok: true, value: JSON.parse(readFileSync(absPath, 'utf8')) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

const toPosix = (p) => String(p).replace(/\\/g, '/');
const truncate = (s, n = 200) => {
  const one = String(s ?? '').replace(/\s+/g, ' ').trim();
  return one.length > n ? one.slice(0, n) + '…' : one;
};

// ---------------------------------------------------------------- contract

function loadContract(root, contractPath) {
  const contract = loadJSONFile(resolve(root, contractPath), 'contract');
  if (!Array.isArray(contract.targets) || contract.targets.length === 0) {
    die(`contract ${contractPath} has no targets[]`);
  }
  if (!Array.isArray(contract.instruments)) {
    die(`contract ${contractPath} has no instruments[]`);
  }
  return contract;
}

function pickTarget(contract, name) {
  const t = contract.targets.find((t) => t.name === name);
  if (!t) {
    die(`unknown target '${name}' (contract declares: ${contract.targets.map((t) => t.name).join(', ')})`);
  }
  return t;
}

// ---------------------------------------------------------------- siblings

// Run a sibling tool (testreport.mjs / cover.mjs) resolved next to this file,
// as a child process with --json already in `args`. Returns the parsed JSON
// object, or null after pushing a note naming exactly what broke.
function runSibling(name, args, notes, label) {
  const p = resolve(HERE, name);
  if (!existsSync(p)) {
    notes.push(`${label}: sibling ${name} not found at ${toPosix(p)}`);
    return null;
  }
  let res;
  try {
    res = spawnSync(process.execPath, [p, ...args], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: SIBLING_TIMEOUT_MS,
    });
  } catch (e) {
    notes.push(`${label}: ${name} spawn threw: ${e.message}`);
    return null;
  }
  if (res.error) {
    notes.push(`${label}: ${name} failed to spawn: ${res.error.message}`);
    return null;
  }
  const stdout = res.stdout ?? '';
  try {
    return JSON.parse(stdout);
  } catch {
    notes.push(
      `${label}: ${name} ${args[0]} exited ${res.status}, stdout was not JSON: ${truncate(stdout || res.stderr)}`
    );
    return null;
  }
}

// ---------------------------------------------------------------- instruments

// Execute one instrument, capture stdout+stderr to the raw file, and return
// the §4 instrument record. Never throws — a timeout or spawn failure becomes
// ran:false + a human error string so the remaining instruments still run.
function execInstrument(inst, iter, dir, root) {
  const rec = {
    id: inst.id,
    kind: inst.kind,
    ran: false,
    exit: null,
    durationMs: null,
    artifact: inst.artifact ?? null,
    stdoutPath: null,
    error: null,
  };
  if (inst.kind === 'tool') {
    rec.error = 'tool-kind instrument: orchestrator must supply result';
    return rec;
  }
  const stdoutRel = `${dir}/evidence/raw/${inst.id}.iter${iter}.out`;
  rec.stdoutPath = stdoutRel;
  const stdoutAbs = resolve(root, stdoutRel);
  if (typeof inst.cmd !== 'string' || inst.cmd.trim() === '') {
    rec.error = `instrument has kind "${inst.kind}" but no cmd`;
    writeFileSync(stdoutAbs, '');
    return rec;
  }
  const cwd = resolve(root, inst.cwd ?? '.');
  const timeoutMs = Number.isFinite(inst.timeoutMs) ? inst.timeoutMs : DEFAULT_TIMEOUT_MS;
  const t0 = Date.now();
  let res;
  try {
    res = spawnSync(inst.cmd, {
      shell: true,
      cwd,
      timeout: timeoutMs,
      encoding: 'buffer',
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (e) {
    rec.durationMs = Date.now() - t0;
    rec.error = `spawn threw: ${e.message}`;
    writeFileSync(stdoutAbs, '');
    return rec;
  }
  rec.durationMs = Date.now() - t0;
  writeFileSync(
    stdoutAbs,
    Buffer.concat([res.stdout ?? Buffer.alloc(0), res.stderr ?? Buffer.alloc(0)])
  );
  if (res.error) {
    rec.error =
      res.error.code === 'ETIMEDOUT'
        ? `timed out after ${timeoutMs}ms`
        : `failed to run: ${res.error.message}`;
    return rec;
  }
  if (res.status === null) {
    rec.error = `terminated by signal ${res.signal ?? 'unknown'}`;
    return rec;
  }
  rec.ran = true;
  rec.exit = res.status;
  return rec;
}

// ---------------------------------------------------------------- tests block

// Resolve the file to feed a parser: the declared artifact when it exists on
// disk, else the raw stdout capture. Returns null (with a note) when neither
// is available.
function resultsFileFor(inst, rec, root, notes, label) {
  if (inst.artifact) {
    const abs = resolve(root, inst.artifact);
    if (existsSync(abs)) return abs;
    notes.push(`${label}: declared artifact ${toPosix(inst.artifact)} not found on disk`);
  }
  if (rec && rec.stdoutPath) {
    const abs = resolve(root, rec.stdoutPath);
    if (existsSync(abs)) return abs;
  }
  notes.push(`${label}: no artifact and no stdout capture to parse for instrument '${inst.id}'`);
  return null;
}

function computeTests(ctx) {
  const { contract, target, iter, dir, root, recById, instById, selectedIds, notes } = ctx;
  const testId = contract.hard?.testInstrument;
  if (!testId) {
    notes.push('tests: contract has no hard.testInstrument; test results not collected');
    return { tests: null, parseFail: false, resultsPath: null, fmt: null };
  }
  const inst = instById.get(testId);
  if (!inst) {
    notes.push(`tests: hard.testInstrument '${testId}' is not a contract instrument`);
    return { tests: null, parseFail: true, resultsPath: null, fmt: null };
  }
  if (!selectedIds.has(testId)) {
    notes.push(`tests: test instrument '${testId}' excluded by --only; test results not collected`);
    return { tests: null, parseFail: false, resultsPath: null, fmt: null };
  }
  const fmt = inst.produces;
  const resultsPath = resultsFileFor(inst, recById.get(testId), root, notes, 'tests');
  if (!resultsPath) return { tests: null, parseFail: true, resultsPath: null, fmt };

  // 1. Normalize the runner output via the sibling parser.
  const out = runSibling('testreport.mjs', ['parse', resultsPath, '--format', fmt, '--json'], notes, 'tests');
  if (!out) return { tests: null, parseFail: true, resultsPath, fmt };
  if (typeof out.passed !== 'number' || typeof out.failed !== 'number' || !Array.isArray(out.failures)) {
    notes.push(`tests: testreport.mjs parse output missing passed/failed/failures: ${truncate(JSON.stringify(out))}`);
    return { tests: null, parseFail: true, resultsPath, fmt };
  }
  const failures = out.failures.map(String);
  const tests = {
    passed: out.passed,
    failed: out.failed,
    skipped: typeof out.skipped === 'number' ? out.skipped : 0,
    failures,
    baselineFailures: [],
    newFailures: [],
    fixedFailures: [],
  };
  const baselineAbs = resolve(root, `${dir}/baseline/${target.name}.json`);
  if (!existsSync(baselineAbs)) {
    // Iteration 0: no baseline yet — every failure is new by definition.
    tests.newFailures = [...failures];
    return { tests, parseFail: false, resultsPath, fmt };
  }
  // 2. Diff against the baseline via the sibling's diff (it takes the parse
  //    output as its current side, so persist that next to the raw capture).
  const parsedRel = `${dir}/evidence/raw/${inst.id}.iter${iter}.parsed.json`;
  writeFileSync(resolve(root, parsedRel), JSON.stringify(out, null, 2) + '\n');
  const dout = runSibling(
    'testreport.mjs',
    ['diff', resolve(root, parsedRel), '--baseline', baselineAbs, '--json'],
    notes,
    'tests'
  );
  if (
    dout &&
    Array.isArray(dout.baselineFailures) &&
    Array.isArray(dout.newFailures) &&
    Array.isArray(dout.fixedFailures)
  ) {
    tests.baselineFailures = dout.baselineFailures.map(String);
    tests.newFailures = dout.newFailures.map(String);
    tests.fixedFailures = dout.fixedFailures.map(String);
  } else {
    // testreport's diff output lacked the diff fields — compute locally from the
    // baseline file rather than pretending nothing regressed.
    const bl = tryLoadJSON(baselineAbs);
    const baselineFailures = bl.ok && Array.isArray(bl.value?.tests?.failures)
      ? bl.value.tests.failures.map(String)
      : null;
    if (baselineFailures === null) {
      notes.push(`tests: could not read baseline failures from ${toPosix(baselineAbs)}`);
      return { tests: null, parseFail: true, resultsPath, fmt };
    }
    const blSet = new Set(baselineFailures);
    const nowSet = new Set(failures);
    tests.baselineFailures = baselineFailures;
    tests.newFailures = failures.filter((f) => !blSet.has(f));
    tests.fixedFailures = baselineFailures.filter((f) => !nowSet.has(f));
    notes.push('tests: testreport.mjs diff output lacked baseline fields; diff computed locally');
  }
  return { tests, parseFail: false, resultsPath, fmt };
}

// ---------------------------------------------------------------- behaviors

function computeBehaviors(ctx, resultsPath, fmt) {
  const { target, iter, dir, root, notes } = ctx;
  const mapRel = `${dir}/evidence/${target.name}_iter${iter}.behaviors.json`;
  const mapAbs = resolve(root, mapRel);
  const specAbs = resolve(root, `${dir}/spec/${target.name}_iter${iter}.json`);

  // Declared ids come from the spec when present.
  let specIds = null;
  if (existsSync(specAbs)) {
    const sp = tryLoadJSON(specAbs);
    if (sp.ok && Array.isArray(sp.value?.behaviors)) {
      specIds = sp.value.behaviors.map((b) => String(b.id));
    } else {
      notes.push(`behaviors: spec ${toPosix(specAbs)} unreadable or malformed${sp.ok ? '' : `: ${sp.error}`}`);
    }
  }

  if (!existsSync(mapAbs)) {
    const declared = specIds ?? [];
    if (declared.length > 0) {
      notes.push(
        `behaviors: map ${toPosix(mapRel)} not found; all ${declared.length} declared behavior(s) recorded as missing`
      );
    }
    return { behaviors: { declared, satisfied: [], missing: [...declared] }, parseFail: false };
  }

  // Fallback declared list when no spec: the map's own behavior ids.
  const mapIds = (() => {
    const mp = tryLoadJSON(mapAbs);
    return mp.ok && Array.isArray(mp.value?.map)
      ? [...new Set(mp.value.map.map((m) => String(m.behavior)))]
      : [];
  })();

  const failClosed = (why) => {
    const declared = specIds ?? mapIds;
    notes.push(`behaviors: ${why}; all ${declared.length} declared behavior(s) recorded as missing`);
    return { behaviors: { declared, satisfied: [], missing: [...declared] }, parseFail: true };
  };

  if (!resultsPath || !fmt) {
    return failClosed('no test results available to check the behavior map against');
  }
  const out = runSibling(
    'testreport.mjs',
    ['behaviors', resultsPath, '--format', fmt, '--map', mapAbs, '--json'],
    notes,
    'behaviors'
  );
  if (!out || !Array.isArray(out.satisfied)) {
    return failClosed('testreport.mjs behaviors produced no usable satisfied[] list');
  }
  const declared = specIds ?? (Array.isArray(out.declared) ? out.declared.map(String) : mapIds);
  const satisfiedSet = new Set(out.satisfied.map(String));
  const satisfied = declared.filter((id) => satisfiedSet.has(id));
  const missing = declared.filter((id) => !satisfiedSet.has(id));
  return { behaviors: { declared, satisfied, missing }, parseFail: false };
}

// ---------------------------------------------------------------- coverage

function computeCoverage(ctx) {
  const { contract, target, root, recById, instById, selectedIds, notes } = ctx;
  const cfg = contract.hard?.coverage;
  if (!cfg) return { coverage: null, parseFail: false };
  const inst = instById.get(cfg.instrument);
  if (!inst) {
    notes.push(`coverage: hard.coverage.instrument '${cfg.instrument}' is not a contract instrument`);
    return { coverage: null, parseFail: true };
  }
  if (!selectedIds.has(cfg.instrument)) {
    notes.push(`coverage: instrument '${cfg.instrument}' excluded by --only; coverage not collected`);
    return { coverage: null, parseFail: false };
  }
  const covFile = resultsFileFor(inst, recById.get(cfg.instrument), root, notes, 'coverage');
  if (!covFile) return { coverage: null, parseFail: true };
  const globs = (target.sourceGlobs ?? []).join(',');
  const out = runSibling(
    'cover.mjs',
    ['changed', covFile, '--format', inst.produces, '--min', String(cfg.min), '--globs', globs, '--json'],
    notes,
    'coverage'
  );
  if (!out || typeof out.pass !== 'boolean') {
    if (out) notes.push(`coverage: cover.mjs output missing pass verdict: ${truncate(JSON.stringify(out))}`);
    return { coverage: null, parseFail: true };
  }
  return {
    coverage: {
      changedLines: typeof out.changedLines === 'number' ? out.changedLines : null,
      coveredLines: typeof out.coveredLines === 'number' ? out.coveredLines : null,
      ratio: typeof out.ratio === 'number' ? out.ratio : null,
      min: typeof out.min === 'number' ? out.min : cfg.min,
      pass: out.pass,
      files: Array.isArray(out.files) ? out.files : [],
    },
    parseFail: false,
  };
}

// ---------------------------------------------------------------- metrics

function walkJSONPath(obj, path) {
  let cur = obj;
  for (const seg of String(path).split('.')) {
    const m = seg.match(/^([^[\]]*)((?:\[\d+\])*)$/);
    if (!m) return { ok: false, why: `bad path segment '${seg}'` };
    const name = m[1];
    if (name !== '') {
      if (cur === null || typeof cur !== 'object' || Array.isArray(cur) || !(name in cur)) {
        return { ok: false, why: `missing key '${name}'` };
      }
      cur = cur[name];
    }
    for (const ix of m[2].match(/\d+/g) ?? []) {
      const i = parseInt(ix, 10);
      if (!Array.isArray(cur) || i >= cur.length) return { ok: false, why: `index [${i}] out of range` };
      cur = cur[i];
    }
  }
  return { ok: true, value: cur };
}

function compareOp(v, op, threshold) {
  switch (op) {
    case '<=': return v <= threshold;
    case '<': return v < threshold;
    case '>=': return v >= threshold;
    case '>': return v > threshold;
    case '==': return v === threshold;
    default: return null;
  }
}

function computeMetrics(ctx) {
  const { contract, root, recById, instById, selectedIds, notes } = ctx;
  const metrics = [];
  let parseFail = false;
  const fail = (entry, why) => {
    notes.push(`metric ${entry.id}: ${why}`);
    parseFail = true;
    metrics.push(entry);
  };
  for (const m of contract.hard?.metrics ?? []) {
    const entry = { id: m.id, value: null, op: m.op, threshold: m.threshold, pass: false };
    const inst = instById.get(m.instrument);
    if (!inst) { fail(entry, `references unknown instrument '${m.instrument}'`); continue; }
    if (!selectedIds.has(m.instrument)) {
      notes.push(`metric ${m.id}: instrument '${m.instrument}' excluded by --only; not measured`);
      metrics.push(entry);
      continue;
    }
    const srcFile = (() => {
      if (inst.artifact) {
        const abs = resolve(root, inst.artifact);
        if (existsSync(abs)) return abs;
      }
      const rec = recById.get(m.instrument);
      if (rec && rec.stdoutPath) {
        const abs = resolve(root, rec.stdoutPath);
        if (existsSync(abs)) return abs;
      }
      return null;
    })();
    if (!srcFile) { fail(entry, `no artifact and no stdout capture for instrument '${m.instrument}'`); continue; }
    let text;
    try {
      text = readFileSync(srcFile, 'utf8');
    } catch (e) {
      fail(entry, `cannot read ${toPosix(srcFile)}: ${e.message}`);
      continue;
    }
    const ext = inst.extract;
    if (!ext || typeof ext !== 'object') {
      fail(entry, `instrument '${inst.id}' has no extract rule`);
      continue;
    }
    if (ext.type === 'regex') {
      let re;
      try {
        re = new RegExp(ext.pattern);
      } catch (e) {
        fail(entry, `invalid regex pattern: ${e.message}`);
        continue;
      }
      const mres = re.exec(text);
      if (!mres) { fail(entry, `pattern ${JSON.stringify(ext.pattern)} did not match ${toPosix(srcFile)}`); continue; }
      const g = Number.isInteger(ext.group) ? ext.group : 1;
      const cap = mres[g];
      if (cap === undefined) { fail(entry, `group ${g} captured nothing`); continue; }
      const v = Number(String(cap).trim());
      if (!Number.isFinite(v)) { fail(entry, `captured '${truncate(cap, 40)}' is not numeric`); continue; }
      entry.value = v;
    } else if (ext.type === 'json') {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        fail(entry, `${toPosix(srcFile)} is not JSON: ${e.message}`);
        continue;
      }
      const walked = walkJSONPath(parsed, ext.path);
      if (!walked.ok) { fail(entry, `path '${ext.path}': ${walked.why}`); continue; }
      const v = typeof walked.value === 'number' ? walked.value : Number(String(walked.value ?? '').trim());
      if (!Number.isFinite(v)) {
        fail(entry, `path '${ext.path}' yielded non-numeric ${truncate(JSON.stringify(walked.value), 40)}`);
        continue;
      }
      entry.value = v;
    } else {
      fail(entry, `unknown extract.type '${ext.type}'`);
      continue;
    }
    const verdict = compareOp(entry.value, m.op, m.threshold);
    if (verdict === null) {
      // the extracted value stands; the comparison is what broke
      fail(entry, `unknown op '${m.op}'`);
      continue;
    }
    entry.pass = verdict;
    metrics.push(entry);
  }
  return { metrics, parseFail };
}

// ---------------------------------------------------------------- run / baseline

function doRun({ contractPath, targetName, iter, only, isBaseline, json }) {
  const root = process.cwd();
  const contract = loadContract(root, contractPath);
  const dir = contract.artifactDir ?? '.crucible';
  const target = pickTarget(contract, targetName);

  const instruments = contract.instruments;
  const instById = new Map(instruments.map((i) => [i.id, i]));
  let selected = instruments;
  if (only) {
    const ids = only.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) die('--only requires at least one instrument id');
    for (const id of ids) {
      if (!instById.has(id)) {
        die(`--only names unknown instrument '${id}' (contract declares: ${instruments.map((i) => i.id).join(', ')})`);
      }
    }
    const keep = new Set(ids);
    selected = instruments.filter((i) => keep.has(i.id)); // declaration order preserved
  }
  const selectedIds = new Set(selected.map((i) => i.id));

  mkdirSync(resolve(root, `${dir}/evidence/raw`), { recursive: true });
  if (isBaseline) mkdirSync(resolve(root, `${dir}/baseline`), { recursive: true });

  const notes = [];
  if (only) {
    const excluded = instruments.filter((i) => !selectedIds.has(i.id)).map((i) => i.id);
    if (excluded.length > 0) notes.push(`--only excluded instrument(s): ${excluded.join(', ')}`);
  }

  // 1. Execute every selected command/probe instrument, in declaration order.
  //    A failure never aborts the run — remaining instruments still execute.
  const records = selected.map((inst) => execInstrument(inst, iter, dir, root));
  const recById = new Map(records.map((r) => [r.id, r]));

  const ctx = { contract, target, iter, dir, root, recById, instById, selectedIds, notes };

  // 2. Tests / behaviors / coverage / metrics.
  const t = computeTests(ctx);
  const b = computeBehaviors(ctx, t.resultsPath, t.fmt);
  const c = computeCoverage(ctx);
  const m = computeMetrics(ctx);

  const report = {
    iteration: iter,
    target: target.name,
    instruments: records,
    tests: t.tests,
    coverage: c.coverage,
    behaviors: b.behaviors,
    metrics: m.metrics,
    notes,
  };

  // 3. Write the report (and, for baseline, the §6 baseline file).
  const reportRel = `${dir}/evidence/${target.name}_iter${iter}.json`;
  writeFileSync(resolve(root, reportRel), JSON.stringify(report, null, 2) + '\n');
  let baselineRel = null;
  if (isBaseline) {
    baselineRel = `${dir}/baseline/${target.name}.json`;
    const baseline = {
      ...report,
      capturedAt: new Date().toISOString().slice(0, 10),
      metricsBefore: m.metrics.map((mt) => ({ id: mt.id, value: mt.value })),
    };
    writeFileSync(resolve(root, baselineRel), JSON.stringify(baseline, null, 2) + '\n');
  }

  // 4. Exit code = instrument health, NOT quality-gate verdicts.
  //    tool-kind instruments are the orchestrator's responsibility and never
  //    count against this tool's exit code.
  const instrumentFailures = records.filter((r) => r.kind !== 'tool' && !r.ran).map((r) => r.id);
  const parseFailed = t.parseFail || b.parseFail || c.parseFail || m.parseFail;
  const exitCode = instrumentFailures.length > 0 || parseFailed ? 1 : 0;

  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          command: isBaseline ? 'baseline' : 'run',
          reportPath: reportRel,
          ...(baselineRel ? { baselinePath: baselineRel } : {}),
          instrumentFailures,
          parseFailed,
          report,
        },
        null,
        2
      ) + '\n'
    );
  } else {
    process.stdout.write(summarize(report, reportRel, baselineRel, instrumentFailures, parseFailed));
  }
  process.exit(exitCode);
}

// ---------------------------------------------------------------- summaries

function summarize(report, reportRel, baselineRel, instrumentFailures, parseFailed) {
  let s = `evidence — target ${report.target}, iteration ${report.iteration}\n`;
  s += '\ninstruments:\n';
  const idW = Math.max(4, ...report.instruments.map((r) => r.id.length));
  for (const r of report.instruments) {
    const status = r.kind === 'tool'
      ? 'AWAITING ORCHESTRATOR'
      : r.ran
        ? `ran, exit ${r.exit}, ${r.durationMs}ms`
        : `DID NOT RUN: ${r.error}`;
    s += `  ${r.id.padEnd(idW)}  ${r.kind.padEnd(7)}  ${status}\n`;
  }
  s += '\n';
  if (report.tests) {
    const t = report.tests;
    s += `tests: ${t.passed} passed, ${t.failed} failed, ${t.skipped} skipped`;
    s += ` — ${t.newFailures.length} new, ${t.fixedFailures.length} fixed vs baseline (${t.baselineFailures.length} baseline)\n`;
    for (const f of t.newFailures) s += `  NEW FAILURE: ${f}\n`;
  } else {
    s += 'tests: not collected (see notes)\n';
  }
  if (report.coverage) {
    const c = report.coverage;
    s += `coverage: ${c.coveredLines}/${c.changedLines} changed lines = ${c.ratio} (min ${c.min}) ${c.pass ? 'PASS' : 'FAIL'}\n`;
  } else {
    s += 'coverage: not collected\n';
  }
  if (report.behaviors) {
    const b = report.behaviors;
    s += `behaviors: ${b.satisfied.length}/${b.declared.length} satisfied`;
    if (b.missing.length > 0) s += `; missing: ${b.missing.join(', ')}`;
    s += '\n';
  }
  for (const mt of report.metrics) {
    s += `metric ${mt.id}: ${mt.value === null ? 'UNMEASURED' : mt.value} ${mt.op} ${mt.threshold} ${mt.pass ? 'PASS' : 'FAIL'}\n`;
  }
  if (report.notes.length > 0) {
    s += '\nnotes:\n';
    for (const n of report.notes) s += `  - ${n}\n`;
  }
  s += `\nreport: ${reportRel}\n`;
  if (baselineRel) s += `baseline: ${baselineRel}\n`;
  if (instrumentFailures.length > 0) s += `INSTRUMENT FAILURES: ${instrumentFailures.join(', ')}\n`;
  if (parseFailed) s += 'PARSE FAILURES: see notes\n';
  return s;
}

function cmdShow(argv) {
  const opts = parseArgs(argv, []);
  if (opts._.length !== 1) die('show: exactly one <evidence.json> path required');
  const abs = resolve(process.cwd(), opts._[0]);
  let report;
  try {
    report = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (e) {
    die(`cannot read evidence report ${toPosix(abs)}: ${e.message}`, 1);
  }
  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    if (!Array.isArray(report.instruments) || !Array.isArray(report.metrics) || !Array.isArray(report.notes)) {
      die(`${toPosix(abs)} does not look like an evidence report (missing instruments/metrics/notes)`, 1);
    }
    process.stdout.write(summarize(report, toPosix(opts._[0]), null, [], false));
  }
  process.exit(0);
}

// ---------------------------------------------------------------- help / main

const HELP = `evidence.mjs — declared-command runner for the crucible loop
Executes the contract's registered instruments, captures raw output, extracts
metrics, delegates test/coverage parsing to sibling tools (testreport.mjs,
cover.mjs, run as child processes), and writes the aggregated evidence report
(SCHEMAS.md section 4). Zero dependencies (node builtins). All commands take --json.

USAGE
  node evidence.mjs run --target <name> --iter <N> [--contract .crucible/CONTRACT.json] [--only id,id] [--json]
  node evidence.mjs baseline --target <name> [--contract ...] [--only id,id] [--json]
  node evidence.mjs show <evidence.json> [--json]

COMMANDS
  run       Execute every kind:"command" / kind:"probe" instrument in declaration
            order (each with its cwd and timeoutMs, default 600000ms), capturing
            stdout+stderr to <dir>/evidence/raw/<id>.iter<N>.out. kind:"tool"
            instruments are NOT executed — they are emitted with ran:false and
            error "tool-kind instrument: orchestrator must supply result" so the
            orchestrator can patch in the result. One instrument failing never
            aborts the run. Writes <dir>/evidence/<target>_iter<N>.json.
            --only id,id restricts the run to those instrument ids.
  baseline  run with iteration 0, plus: writes <dir>/baseline/<target>.json with
            capturedAt (ISO date) and metricsBefore (SCHEMAS.md section 6).
  show      Pretty-print an existing evidence report (--json emits it verbatim).

THE REPORT CARRIES NO VERDICT
  This tool never writes a layer1 field, a top-level pass, or any summary
  verdict. gate.mjs recomputes the verdict from the recorded parts — the
  referee does not accept a self-reported one.

EXIT CODES (INSTRUMENT HEALTH, NOT QUALITY GATES)
  0  every command/probe instrument ran and every parse succeeded — even when
     tests failed, coverage is below min, or a metric missed its threshold.
     A clean run whose coverage is below threshold still exits 0; gate.mjs
     judges the numbers, this tool only collects them.
  1  an instrument failed to run (spawn failure, timeout, killed by signal) or
     a parse failed (test/coverage/behavior/metric extraction). tool-kind
     instruments never affect the exit code.
  2  usage error.
`;

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    process.stdout.write(HELP);
    process.exit(argv.length === 0 ? 2 : 0);
  }
  const cmd = argv[0];
  const rest = argv.slice(1);
  if (rest.includes('--help') || rest.includes('-h')) {
    process.stdout.write(HELP);
    process.exit(0);
  }
  switch (cmd) {
    case 'run': {
      const opts = parseArgs(rest, ['target', 'iter', 'contract', 'only']);
      if (opts._.length > 0) die(`run: unexpected argument '${opts._[0]}'`);
      if (!opts.target) die('run: --target <name> required');
      if (opts.iter === undefined) die('run: --iter <N> required');
      const iter = parseInt(opts.iter, 10);
      if (!Number.isInteger(iter) || iter < 0 || String(iter) !== String(opts.iter).trim()) {
        die(`run: --iter must be a non-negative integer, got '${opts.iter}'`);
      }
      return doRun({
        contractPath: opts.contract ?? DEFAULT_CONTRACT,
        targetName: opts.target,
        iter,
        only: opts.only ?? null,
        isBaseline: false,
        json: !!opts.json,
      });
    }
    case 'baseline': {
      const opts = parseArgs(rest, ['target', 'contract', 'only']);
      if (opts._.length > 0) die(`baseline: unexpected argument '${opts._[0]}'`);
      if (!opts.target) die('baseline: --target <name> required');
      return doRun({
        contractPath: opts.contract ?? DEFAULT_CONTRACT,
        targetName: opts.target,
        iter: 0,
        only: opts.only ?? null,
        isBaseline: true,
        json: !!opts.json,
      });
    }
    case 'show':
      return cmdShow(rest);
    default:
      die(`unknown command '${cmd}' (see --help)`);
  }
}

main();
