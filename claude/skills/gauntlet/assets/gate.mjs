#!/usr/bin/env node
/**
 * gate.mjs — deterministic stop-condition state machine for the Cyberfunk gauntlet loop.
 *
 * Closure is a pure function of the critique JSON files in critiques/.
 * No LLM judgment, no stakes leaked to critics: critics emit scores; this tool decides.
 *
 * States per subsystem (critiques sorted by iteration):
 *   CLOSED   — two most recent critiques BOTH have every measured (non-null) axis >= 8,
 *              AND every axis null in both of those critiques is waived.
 *   BLOCKED  — measured closure met, but an unwaived null axis blocks (UNMEASURED).
 *   CONFIRM  — latest critique all measured axes >= 8, previous was not (or absent):
 *              next round is a confirmation round.
 *   PLATEAU  — 3 consecutive critiques with no improvement in total measured score.
 *   CAPPED   — total iterations across all subsystems at/over --cap and not CLOSED.
 *   CONTINUE — otherwise; every axis < 8 listed with latest score + latest findings.
 *
 * Null-axis waivers: critiques/live_checks.json — a subsystem's null PERFORMANCE axis
 * is waived when live_checks.json contains verdict items covering that subsystem (the
 * run's real mechanism: performance was never scored from stills and closed via a
 * live-check pass; live_checks.json itself says "No axis is re-scored", so it never
 * waives any other axis). Other null axes require an explicit
 * --waive <subsystem>:<axis> (repeatable).
 *
 * Fail-safe: an unreadable/invalid critique file is an unverifiable verdict. Closure
 * is withheld (CLOSED -> BLOCKED) for the subsystem the file belongs to — or for ALL
 * subsystems when the file cannot be attributed — until the file is fixed or removed.
 *
 * Node >= 18, zero dependencies, plain ESM.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const AXES = [
  'palette_lighting',
  'sprite_readability',
  'parallax_depth',
  'ui_polish',
  'animation_feel',
  'scene_composition',
  'performance',
];
const FINDING_FIELDS = ['axis', 'score', 'region', 'defect', 'fix'];
const DEFAULT_BAR = 8;
let CLOSE_BAR = DEFAULT_BAR; // overridden per-invocation by --bar
const DEFAULT_CAP = 40;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(SCRIPT_DIR, '..', 'critiques');

// ---------------------------------------------------------------- CLI parsing

const HELP = `gate.mjs — deterministic stop-condition gate over critique JSON files

USAGE
  node tools/gate.mjs [options]                 Full state report, all subsystems
  node tools/gate.mjs --check <subsystem>       Exit 0 iff subsystem is CLOSED,
                                                else exit 1, blocking reason on stdout
  node tools/gate.mjs --validate <file.json>    Schema-validate one critique verdict;
                                                exit 1 naming every offending field
  node tools/gate.mjs --help                    This help

OPTIONS
  --dir <critiquesDir>       Critique directory (default: ${DEFAULT_DIR})
  --json                     Machine-readable JSON output (all commands)
  --cap <N>                  Iteration cap across all subsystems (default ${DEFAULT_CAP});
                             at/over cap, every non-closed subsystem reports CAPPED
  --bar <N>                  Closure bar for every axis (default ${DEFAULT_BAR}, range 1-10);
                             per-invocation like every flag — record it in the
                             STATUS.md "Gate flags:" line so it rides every call
  --waive <subsystem>:<axis> Waive a null axis explicitly (repeatable)

STATES (<bar> = --bar value, default ${DEFAULT_BAR})
  CLOSED    two most recent critiques both all-measured >= <bar>, null axes waived
            (live_checks.json coverage auto-waives ONLY a null performance axis;
             any other null axis needs an explicit --waive)
  BLOCKED   measured closure met but an UNMEASURED (null, unwaived) axis blocks,
            OR closure withheld because an invalid critique file is in the record
  CONFIRM   latest all measured >= <bar>, previous was not — confirmation round next
  PLATEAU   3 consecutive critiques with no improvement in total measured score
  CAPPED    iteration cap reached and subsystem not closed
  CONTINUE  work remains; axes < <bar> listed with latest findings

EXIT CODES
  default report: 0 (2 on I/O or usage error)
  --check:        0 CLOSED, 1 not closed (reason on stdout), 2 usage/I/O error
  --validate:     0 valid, 1 invalid (every offending field named), 2 usage/I/O error
`;

function parseArgs(argv) {
  const opts = {
    dir: DEFAULT_DIR,
    json: false,
    cap: DEFAULT_CAP,
    bar: DEFAULT_BAR,
    waive: [], // [{subsystem, axis}]
    check: null,
    validate: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const need = (name) => {
      if (i + 1 >= argv.length) usageError(`${name} requires a value`);
      return argv[++i];
    };
    switch (a) {
      case '--help': case '-h': opts.help = true; break;
      case '--json': opts.json = true; break;
      case '--dir': opts.dir = path.resolve(need('--dir')); break;
      case '--cap': {
        const v = need('--cap');
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1) usageError(`--cap must be a positive integer (got ${JSON.stringify(v)})`);
        opts.cap = n;
        break;
      }
      case '--bar': {
        const v = need('--bar');
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 10) usageError(`--bar must be an integer 1-10 (got ${JSON.stringify(v)})`);
        opts.bar = n;
        break;
      }
      case '--waive': {
        const v = need('--waive');
        const m = /^([^:]+):([^:]+)$/.exec(v);
        if (!m) usageError(`--waive expects <subsystem>:<axis> (got ${JSON.stringify(v)})`);
        if (!AXES.includes(m[2])) usageError(`--waive: unknown axis ${JSON.stringify(m[2])}; known axes: ${AXES.join(', ')}`);
        opts.waive.push({ subsystem: m[1], axis: m[2] });
        break;
      }
      case '--check': opts.check = need('--check'); break;
      case '--validate': opts.validate = path.resolve(need('--validate')); break;
      default: usageError(`unknown argument ${JSON.stringify(a)} (see --help)`);
    }
  }
  return opts;
}

function usageError(msg) {
  process.stderr.write(`gate: ${msg}\n`);
  process.exit(2);
}

// ---------------------------------------------------------------- validation

/** Validate one parsed critique object. Returns array of error strings naming fields. */
function validateCritique(obj) {
  const errors = [];
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return ['(root): must be a JSON object'];
  }
  if (!Number.isInteger(obj.iteration)) {
    errors.push(`iteration: must be an integer (got ${describe(obj.iteration)})`);
  }
  if (typeof obj.subsystem !== 'string' || obj.subsystem.length === 0) {
    errors.push(`subsystem: must be a non-empty string (got ${describe(obj.subsystem)})`);
  }
  if (obj.scores === null || typeof obj.scores !== 'object' || Array.isArray(obj.scores)) {
    errors.push(`scores: must be an object with exactly the 7 axes (got ${describe(obj.scores)})`);
  } else {
    for (const axis of AXES) {
      if (!(axis in obj.scores)) {
        errors.push(`scores.${axis}: missing required axis`);
        continue;
      }
      const v = obj.scores[axis];
      if (v !== null && !(Number.isInteger(v) && v >= 1 && v <= 10)) {
        errors.push(`scores.${axis}: must be an integer 1-10 or null (got ${describe(v)})`);
      }
    }
    for (const k of Object.keys(obj.scores)) {
      if (!AXES.includes(k)) errors.push(`scores.${k}: unknown axis`);
    }
  }
  if ('findings' in obj && obj.findings !== undefined) {
    if (!Array.isArray(obj.findings)) {
      errors.push(`findings: must be an array (got ${describe(obj.findings)})`);
    } else {
      obj.findings.forEach((f, i) => {
        if (f === null || typeof f !== 'object' || Array.isArray(f)) {
          errors.push(`findings[${i}]: must be an object (got ${describe(f)})`);
          return;
        }
        for (const field of FINDING_FIELDS) {
          if (!(field in f)) errors.push(`findings[${i}].${field}: missing required field`);
        }
        if ('axis' in f && !AXES.includes(f.axis)) {
          errors.push(`findings[${i}].axis: unknown axis ${describe(f.axis)}`);
        }
        if ('score' in f && !(Number.isInteger(f.score) && f.score >= 1 && f.score <= 10)) {
          errors.push(`findings[${i}].score: must be an integer 1-10 (got ${describe(f.score)})`);
        }
        for (const field of ['region', 'defect', 'fix']) {
          if (field in f && (typeof f[field] !== 'string' || f[field].length === 0)) {
            errors.push(`findings[${i}].${field}: must be a non-empty string (got ${describe(f[field])})`);
          }
        }
      });
    }
  }
  return errors;
}

function describe(v) {
  if (v === undefined) return 'missing';
  if (v === null) return 'null';
  if (typeof v === 'string') return `string ${JSON.stringify(v)}`;
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'object';
  return `${typeof v} ${JSON.stringify(v)}`;
}

// ---------------------------------------------------------------- loading

function loadDir(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json')).sort();
  } catch (e) {
    usageError(`cannot read critiques dir ${dir}: ${e.message}`);
  }
  const critiques = []; // {file, data}
  const invalid = [];   // {file, errors}
  let liveChecks = null; // {file, data}
  for (const f of entries) {
    const full = path.join(dir, f);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (e) {
      invalid.push({ file: f, subsystem: null, errors: [`(file): invalid JSON — ${e.message}`] });
      continue;
    }
    // The waiver source is not a critique verdict: detect by round_type or filename.
    if ((data && data.round_type === 'live_checks') || f === 'live_checks.json') {
      liveChecks = { file: f, data };
      continue;
    }
    const errors = validateCritique(data);
    if (errors.length) {
      const sub = (data && typeof data.subsystem === 'string' && data.subsystem.length) ? data.subsystem : null;
      invalid.push({ file: f, subsystem: sub, errors });
    } else {
      critiques.push({ file: f, data });
    }
  }
  return { critiques, invalid, liveChecks };
}

/**
 * Live-check waiver coverage: the set of subsystems for which live_checks.json
 * carries verdict items. Structure observed in the real file:
 *   { round_type:"live_checks", items:[{id, subsystem, check, verdict, ...}], summary:{...} }
 */
function liveCheckCoverage(liveChecks) {
  const cov = new Map(); // subsystem -> {items, pass, concern, other}
  if (!liveChecks || !Array.isArray(liveChecks.data?.items)) return cov;
  for (const item of liveChecks.data.items) {
    if (!item || typeof item.subsystem !== 'string' || typeof item.verdict !== 'string') continue;
    const c = cov.get(item.subsystem) ?? { items: 0, pass: 0, concern: 0, other: 0 };
    c.items++;
    const v = item.verdict.toUpperCase();
    if (v === 'PASS') c.pass++;
    else if (v === 'CONCERN') c.concern++;
    else c.other++;
    cov.set(item.subsystem, c);
  }
  return cov;
}

// ---------------------------------------------------------------- state machine

const measured = (scores) => AXES.filter((a) => scores[a] !== null);
const measuredOk = (scores) => {
  const m = measured(scores);
  return m.length > 0 && m.every((a) => scores[a] >= CLOSE_BAR);
};
const totalMeasured = (scores) => measured(scores).reduce((s, a) => s + scores[a], 0);

/**
 * Evaluate one subsystem. crits = validated critiques sorted by iteration (ascending).
 * Returns the full per-subsystem record.
 */
function evaluateSubsystem(name, crits, waivedAxes, capReached, invalidRelevant) {
  const latest = crits[crits.length - 1];
  const prev = crits.length >= 2 ? crits[crits.length - 2] : null;
  const ls = latest.data.scores;
  const ps = prev?.data.scores ?? null;

  // Per-axis history, streak, latest.
  const axes = {};
  for (const axis of AXES) {
    const history = crits.map((c) => c.data.scores[axis]);
    let streak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i] !== null && history[i] >= CLOSE_BAR) streak++;
      else break;
    }
    axes[axis] = {
      history,
      latest: ls[axis],
      streak_ge8: streak,
      waived: waivedAxes.has(axis) ? waivedAxes.get(axis) : null,
    };
  }

  // Null-axis policy: null in the latest two critiques blocks unless waived.
  const nullBoth = prev ? AXES.filter((a) => ls[a] === null && ps[a] === null) : AXES.filter((a) => ls[a] === null);
  const unmeasuredBlockers = nullBoth.filter((a) => !waivedAxes.has(a));
  const waivedNulls = nullBoth.filter((a) => waivedAxes.has(a))
    .map((a) => ({ axis: a, source: waivedAxes.get(a) }));

  const latestOk = measuredOk(ls);
  const prevOk = prev !== null && measuredOk(ps);
  const closedMeasured = latestOk && prevOk;

  const totals = crits.map((c) => totalMeasured(c.data.scores));
  const n = totals.length;
  const plateau = n >= 3 && totals[n - 1] <= totals[n - 2] && totals[n - 2] <= totals[n - 3];

  let state, reason;
  const blockers = [];

  if (closedMeasured && unmeasuredBlockers.length === 0) {
    if (invalidRelevant.length) {
      // Fail-safe: an unverifiable critique file in the record withholds closure.
      state = 'BLOCKED';
      reason = `closure criteria met (iters ${prev.data.iteration}+${latest.data.iteration}) but WITHHELD: `
        + `invalid critique file(s) in the record: ${invalidRelevant.join(', ')} — fix or remove (see --validate)`;
      for (const f of invalidRelevant) {
        blockers.push({ axis: null, kind: 'INVALID_FILE', latest_score: null,
          note: `${f} failed validation; an unreadable verdict cannot be counted as good news` });
      }
    } else {
      state = 'CLOSED';
      reason = `iters ${prev.data.iteration}+${latest.data.iteration} both all-measured >=${CLOSE_BAR}`
        + (waivedNulls.length ? `; null axes waived: ${waivedNulls.map((w) => `${w.axis} (${w.source})`).join(', ')}` : '');
    }
  } else if (capReached) {
    state = 'CAPPED';
    reason = `iteration cap reached and subsystem not closed`;
  } else if (closedMeasured) {
    state = 'BLOCKED';
    reason = `measured closure met (iters ${prev.data.iteration}+${latest.data.iteration} all >=${CLOSE_BAR}) but UNMEASURED axes block: ${unmeasuredBlockers.join(', ')}`;
    for (const a of unmeasuredBlockers) {
      blockers.push({ axis: a, kind: 'UNMEASURED', latest_score: null,
        note: 'null in latest two critiques with no waiver (live_checks.json coverage or --waive)' });
    }
  } else if (latestOk) {
    state = 'CONFIRM';
    reason = prev
      ? `iter ${latest.data.iteration} all measured >=${CLOSE_BAR} but iter ${prev.data.iteration} was not — next round is a confirmation round`
      : `iter ${latest.data.iteration} all measured >=${CLOSE_BAR} with no prior critique — next round is a confirmation round`;
    for (const a of unmeasuredBlockers) {
      blockers.push({ axis: a, kind: 'UNMEASURED', latest_score: null,
        note: 'will block closure at confirmation unless waived' });
    }
  } else if (plateau) {
    state = 'PLATEAU';
    reason = `no improvement in total measured score over 3 consecutive critiques (${totals.slice(-3).join(' -> ')}) — write PLATEAU.md`;
    pushWorkOrder(blockers, latest, ls);
  } else {
    state = 'CONTINUE';
    const low = AXES.filter((a) => ls[a] !== null && ls[a] < CLOSE_BAR);
    reason = low.length
      ? `axes below ${CLOSE_BAR}: ${low.map((a) => `${a}=${ls[a]}`).join(', ')}`
      : `awaiting more critiques`;
    pushWorkOrder(blockers, latest, ls);
    for (const a of unmeasuredBlockers) {
      blockers.push({ axis: a, kind: 'UNMEASURED', latest_score: null,
        note: 'null in latest critiques; will block closure unless waived' });
    }
  }

  return {
    subsystem: name,
    state,
    reason,
    iterations: crits.length,
    latest_iteration: latest.data.iteration,
    latest_file: latest.file,
    totals_measured: totals,
    axes,
    waived_nulls: waivedNulls,
    blockers,
  };
}

/** CONTINUE/PLATEAU work order: every axis <8 with latest score and that axis's findings. */
function pushWorkOrder(blockers, latest, ls) {
  const findings = Array.isArray(latest.data.findings) ? latest.data.findings : [];
  for (const a of AXES) {
    if (ls[a] === null || ls[a] >= CLOSE_BAR) continue;
    blockers.push({
      axis: a,
      kind: 'BELOW_BAR',
      latest_score: ls[a],
      findings: findings.filter((f) => f.axis === a)
        .map((f) => ({ score: f.score, region: f.region, defect: f.defect, fix: f.fix })),
    });
  }
}

function buildReport(opts) {
  const { critiques, invalid, liveChecks } = loadDir(opts.dir);
  const cov = liveCheckCoverage(liveChecks);

  // Group by subsystem, sort by iteration (stable: iteration, then filename).
  const bySub = new Map();
  for (const c of critiques) {
    const s = c.data.subsystem;
    if (!bySub.has(s)) bySub.set(s, []);
    bySub.get(s).push(c);
  }
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // codepoint order — locale-independent
  for (const arr of bySub.values()) {
    arr.sort((a, b) => a.data.iteration - b.data.iteration || cmp(a.file, b.file));
  }

  const totalIterations = critiques.length;
  const capReached = totalIterations >= opts.cap;

  // Attribute invalid files: by parsed subsystem field, else by filename prefix,
  // else unattributed (fail-safe: blocks closure of EVERY subsystem).
  const knownSubs = [...bySub.keys()].sort(cmp);
  const invalidBySub = new Map(); // subsystem -> [file]
  const invalidGlobal = [];
  for (const inv of invalid) {
    const base = inv.file.replace(/\.json$/i, '');
    const owner = inv.subsystem && knownSubs.includes(inv.subsystem)
      ? inv.subsystem
      : knownSubs.find((s) => base === s || base.startsWith(s + '_') || base.startsWith(s + '.'));
    if (owner) {
      if (!invalidBySub.has(owner)) invalidBySub.set(owner, []);
      invalidBySub.get(owner).push(inv.file);
    } else {
      invalidGlobal.push(inv.file);
    }
  }

  const subsystems = {};
  for (const [name, crits] of [...bySub.entries()].sort((a, b) => cmp(a[0], b[0]))) {
    const waived = new Map(); // axis -> source string
    const c = cov.get(name);
    if (c) {
      // live_checks.json waives ONLY performance — its own scope says "No axis is
      // re-scored"; performance is the axis the run judged live instead of from stills.
      waived.set('performance', `live_checks.json: ${c.items} items covering ${name} (${c.pass} PASS / ${c.concern} CONCERN${c.other ? ` / ${c.other} other` : ''})`);
    }
    for (const w of opts.waive) {
      if (w.subsystem === name) waived.set(w.axis, `--waive ${w.subsystem}:${w.axis}`);
    }
    const invalidRelevant = [...(invalidBySub.get(name) ?? []), ...invalidGlobal].sort(cmp);
    subsystems[name] = evaluateSubsystem(name, crits, waived, capReached, invalidRelevant);
  }

  return {
    dir: opts.dir,
    cap: opts.cap,
    bar: opts.bar,
    total_iterations: totalIterations,
    cap_reached: capReached,
    live_checks: liveChecks
      ? { file: liveChecks.file, coverage: Object.fromEntries([...cov.entries()].map(([k, v]) => [k, v])) }
      : null,
    subsystems,
    invalid_files: invalid,
  };
}

// ---------------------------------------------------------------- text rendering

function renderReport(r) {
  const out = [];
  out.push(`GATE REPORT  dir=${r.dir}`);
  out.push(`iterations ${r.total_iterations}/${r.cap}${r.cap_reached ? '  ** CAP REACHED **' : ''}`
    + `  live_checks=${r.live_checks ? r.live_checks.file : 'absent'}`);
  out.push('');
  for (const sub of Object.values(r.subsystems)) {
    out.push(`## ${sub.subsystem}  —  ${sub.state}  (${sub.iterations} critiques, latest iter ${sub.latest_iteration})`);
    out.push(`   ${sub.reason}`);
    out.push(`   total measured score: ${sub.totals_measured.join(' -> ')}`);
    const w = Math.max(...AXES.map((a) => a.length));
    for (const axis of AXES) {
      const ax = sub.axes[axis];
      const hist = ax.history.map((v) => (v === null ? '-' : v)).join(' ');
      const flags = [];
      if (ax.latest === null) flags.push(ax.waived ? 'null, WAIVED' : 'null, UNMEASURED');
      out.push(`   ${axis.padEnd(w)}  [${hist}]  latest=${ax.latest === null ? '-' : ax.latest}  streak>=8: ${ax.streak_ge8}${flags.length ? '  (' + flags.join('; ') + ')' : ''}`);
    }
    if (sub.waived_nulls.length) {
      for (const wn of sub.waived_nulls) out.push(`   waiver: ${wn.axis} <- ${wn.source}`);
    }
    if (sub.blockers.length) {
      out.push('   blockers:');
      for (const b of sub.blockers) {
        if (b.kind === 'INVALID_FILE') {
          out.push(`     - INVALID_FILE — ${b.note}`);
        } else if (b.kind === 'UNMEASURED') {
          out.push(`     - ${b.axis}: UNMEASURED — ${b.note}`);
        } else {
          out.push(`     - ${b.axis}=${b.latest_score} (<${CLOSE_BAR})`);
          for (const f of b.findings ?? []) {
            out.push(`         [${f.score}] ${f.region}`);
            out.push(`             defect: ${f.defect}`);
            out.push(`             fix:    ${f.fix}`);
          }
        }
      }
    }
    out.push('');
  }
  if (r.invalid_files.length) {
    out.push('INVALID FILES (excluded from the record):');
    for (const inv of r.invalid_files) {
      out.push(`  ${inv.file}:`);
      for (const e of inv.errors) out.push(`    - ${e}`);
    }
    out.push('');
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- commands

function cmdReport(opts) {
  const r = buildReport(opts);
  process.stdout.write(opts.json ? JSON.stringify(r, null, 2) + '\n' : renderReport(r) + '\n');
  process.exit(0);
}

function cmdCheck(opts) {
  const r = buildReport(opts);
  const sub = r.subsystems[opts.check];
  let closed, state, reason;
  if (!sub) {
    closed = false; state = 'UNKNOWN';
    reason = `no critiques found for subsystem ${JSON.stringify(opts.check)} in ${r.dir} (known: ${Object.keys(r.subsystems).join(', ') || 'none'})`;
  } else {
    closed = sub.state === 'CLOSED';
    state = sub.state;
    reason = sub.reason;
  }
  if (opts.json) {
    process.stdout.write(JSON.stringify({ subsystem: opts.check, state, closed, reason,
      blockers: sub ? sub.blockers : [] }, null, 2) + '\n');
  } else {
    process.stdout.write(`${opts.check}: ${state} — ${reason}\n`);
    if (!closed && sub) {
      for (const b of sub.blockers) {
        process.stdout.write(
          b.kind === 'INVALID_FILE' ? `  blocker: INVALID_FILE — ${b.note}\n`
          : b.kind === 'UNMEASURED' ? `  blocker: ${b.axis} UNMEASURED — ${b.note}\n`
          : `  blocker: ${b.axis}=${b.latest_score} (<${CLOSE_BAR})\n`);
      }
    }
  }
  process.exit(closed ? 0 : 1);
}

function cmdValidate(opts) {
  let raw;
  try {
    raw = fs.readFileSync(opts.validate, 'utf8');
  } catch (e) {
    usageError(`cannot read ${opts.validate}: ${e.message}`);
  }
  let data, errors;
  try {
    data = JSON.parse(raw);
    errors = validateCritique(data);
  } catch (e) {
    errors = [`(file): invalid JSON — ${e.message}`];
  }
  const valid = errors.length === 0;
  if (opts.json) {
    process.stdout.write(JSON.stringify({ file: opts.validate, valid, errors }, null, 2) + '\n');
  } else if (valid) {
    process.stdout.write(`VALID: ${opts.validate} (iteration ${data.iteration}, subsystem ${data.subsystem})\n`);
  } else {
    process.stdout.write(`INVALID: ${opts.validate} — ${errors.length} error(s)\n`);
    for (const e of errors) process.stdout.write(`  - ${e}\n`);
  }
  process.exit(valid ? 0 : 1);
}

// ---------------------------------------------------------------- main

const opts = parseArgs(process.argv.slice(2));
CLOSE_BAR = opts.bar;
if (opts.help) { process.stdout.write(HELP); process.exit(0); }
if (opts.validate !== null) cmdValidate(opts);
else if (opts.check !== null) cmdCheck(opts);
else cmdReport(opts);
