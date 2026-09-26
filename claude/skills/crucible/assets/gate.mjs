#!/usr/bin/env node
/**
 * gate.mjs — deterministic stop-condition state machine for the crucible loop.
 *
 * Forked from the gauntlet gate. Closure is a pure function of the files under
 * the artifact dir: critiques/ (layer 2, scored) plus evidence/ + baseline/
 * (layer 1, hard). No LLM judgment: critics emit scores, instruments emit
 * evidence; this tool decides.
 *
 * Axes are DECLARATIVE: read from CONTRACT.json (axes[].name, in order).
 * Nothing here hardcodes an axis list.
 *
 * Layer 1 (hard, binary) — recomputed from evidence/<target>_iter<N>.json and
 * baseline/<target>.json. Self-reported verdicts are never trusted:
 *   (a) no new test failures: failures \ baselineFailures must be empty
 *       (recomputed from the baseline file, not read from tests.newFailures)
 *   (b) coverage.ratio >= hard.coverage.min
 *   (c) behaviors: declared \ satisfied must be empty when hard.behaviorMap
 *   (d) every hard.metrics[] entry satisfies its op/threshold
 *   (e) every instrument in the report ran clean (ran:true, error:null) when
 *       hard.instrumentsMustRun
 *
 * Layer 2 (scored) — the gauntlet rule, unchanged in spirit: the two most
 * recent critiques must both have every measured (non-null) axis >= bar; a
 * null axis needs an explicit --waive <target>:<axis>.
 *
 * States per target (critiques sorted by iteration):
 *   CLOSED   — layer 2 closes AND the most recent iteration passes layer 1.
 *   BLOCKED  — layer 2 closure met but layer 1 fails (failing clause named),
 *              an unwaived null axis blocks (UNMEASURED), or closure is
 *              withheld because an invalid or unmerged critique file is in
 *              the record.
 *   CONFIRM  — latest critique all measured axes >= bar, previous was not (or
 *              absent): next round is a confirmation round.
 *   PLATEAU  — 3 consecutive critiques with no improvement in total measured
 *              score.
 *   CAPPED   — iteration budget spent and target not closed.
 *   CONTINUE — otherwise; every axis < bar listed with latest findings.
 *
 * Fail-safe: an unreadable/invalid critique file is an unverifiable verdict.
 * Closure is withheld (CLOSED -> BLOCKED) for the target the file belongs to —
 * or for ALL targets when the file cannot be attributed — until the file is
 * fixed or removed. Panel rounds write per-critic files
 * (<target>_iter<N>.<critic>.json); the gate reads only the merged unsuffixed
 * file, and per-critic files with no merged verdict likewise withhold closure.
 *
 * Node >= 18, zero dependencies, plain ESM.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';

const FINDING_FIELDS = ['axis', 'score', 'region', 'defect', 'fix'];
const MUTATION_STRING_FIELDS = ['behavior', 'mutation', 'command', 'output'];
const DEFAULT_BAR = 8;
const DEFAULT_CAP = 40;

const AXIS_NAME_RE = /^[a-z][a-z0-9_]*$/;
const TARGET_NAME_RE = /^[A-Za-z0-9._-]+$/;
const ANCHOR_KEYS = ['3', '5', '8', '10'];
const INSTRUMENT_KINDS = ['command', 'tool', 'probe'];
const PRODUCES = ['junit', 'tap', 'cargo-json', 'pytest-json', 'go-json', 'lcov', 'cobertura', 'coveragepy', 'raw'];
const EXTRACT_TYPES = ['regex', 'json'];
const METRIC_OPS = ['<=', '<', '>=', '>', '=='];

const DEFAULT_DIR = path.resolve('.crucible', 'critiques');

// ---------------------------------------------------------------- CLI parsing

const HELP = `gate.mjs — two-layer deterministic stop-condition gate for the crucible loop

USAGE
  node tools/gate.mjs [options]                   Full state report, all targets
  node tools/gate.mjs --check <target>            Exit 0 iff target is CLOSED,
                                                  else exit 1, blocking reason on stdout
  node tools/gate.mjs --validate <file.json>      Schema-validate one critique verdict
                                                  against the contract axes; exit 1
                                                  naming every offending field
  node tools/gate.mjs --validate-contract [path]  Schema-validate CONTRACT.json;
                                                  exit 1 naming every offending field
  node tools/gate.mjs --verify-engine [--manifest <path>]
                                                  Recompute sha256 of every engine file
                                                  in manifest.json; exit 1 naming every
                                                  drifted or missing file
  node tools/gate.mjs --help                      This help

OPTIONS
  --dir <critiquesDir>     Critique directory (default: .crucible/critiques)
  --contract <path>        CONTRACT.json path (default: <dir>/../CONTRACT.json)
  --manifest <path>        manifest.json path for --verify-engine
                           (default: <dir>/../manifest.json)
  --json                   Machine-readable JSON output (all commands)
  --cap <N>                Iteration cap (default ${DEFAULT_CAP}, overridden by the
                           contract's cap, overridden by this flag); at/over cap,
                           every non-closed target reports CAPPED
  --bar <N>                Closure bar for every axis, 1-10 (default ${DEFAULT_BAR},
                           overridden by the contract's bar, overridden by this
                           flag); per-invocation like every flag — record it in
                           the STATUS.md "Gate flags:" line so it rides every call
  --waive <target>:<axis>  Waive a null axis explicitly (repeatable,
                           per-invocation; nothing is persisted)

CLOSURE = LAYER 1 AND LAYER 2
  layer 1 (hard, binary)  recomputed from evidence/<target>_iter<N>.json and
                          baseline/<target>.json — never trusted from a
                          self-reported verdict field: no new test failures,
                          coverage.ratio >= hard.coverage.min, behavior map
                          complete, every hard metric within threshold, every
                          instrument ran clean
  layer 2 (scored)        two most recent critiques both all-measured >= <bar>,
                          null axes waived

STATES (<bar> = effective bar, default ${DEFAULT_BAR})
  CLOSED    layer 2 closes AND the most recent iteration passes layer 1
  BLOCKED   layer 2 closure met but layer 1 fails (failing clause named),
            an UNMEASURED (null, unwaived) axis blocks, or closure withheld
            because an invalid/unmerged critique file is in the record
  CONFIRM   latest all measured >= <bar>, previous was not — confirmation round next
  PLATEAU   3 consecutive critiques with no improvement in total measured score
  CAPPED    iteration cap reached and target not closed
  CONTINUE  work remains; axes < <bar> listed with latest findings

EXIT CODES
  default report:      0 (2 on I/O or usage error)
  --check:             0 CLOSED, 1 not closed (reason on stdout), 2 usage/I/O error
  --validate:          0 valid, 1 invalid (every offending field named), 2 usage/I/O error
  --validate-contract: 0 valid, 1 invalid (every offending field named), 2 usage/I/O error
  --verify-engine:     0 all hashes match, 1 drift (every file named), 2 usage/I/O error
`;

function parseArgs(argv) {
  const opts = {
    dir: DEFAULT_DIR,
    contract: null,
    manifest: null,
    json: false,
    cap: null, // resolved later: flag > contract cap > DEFAULT_CAP
    bar: null, // resolved later: flag > contract bar > DEFAULT_BAR
    waive: [], // [{target, axis}] — axis membership checked once the contract is loaded
    check: null,
    validate: null,
    validateContract: false,
    validateContractPath: null,
    verifyEngine: false,
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
      case '--contract': opts.contract = path.resolve(need('--contract')); break;
      case '--manifest': opts.manifest = path.resolve(need('--manifest')); break;
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
        if (!m) usageError(`--waive expects <target>:<axis> (got ${JSON.stringify(v)})`);
        opts.waive.push({ target: m[1], axis: m[2] });
        break;
      }
      case '--check': opts.check = need('--check'); break;
      case '--validate': opts.validate = path.resolve(need('--validate')); break;
      case '--validate-contract':
        opts.validateContract = true;
        if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts.validateContractPath = path.resolve(argv[++i]);
        break;
      case '--verify-engine': opts.verifyEngine = true; break;
      default: usageError(`unknown argument ${JSON.stringify(a)} (see --help)`);
    }
  }
  const modes = [opts.check !== null, opts.validate !== null, opts.validateContract, opts.verifyEngine].filter(Boolean);
  if (modes.length > 1) usageError('choose exactly one of --check, --validate, --validate-contract, --verify-engine');
  if (opts.manifest !== null && !opts.verifyEngine) usageError('--manifest only applies to --verify-engine');
  return opts;
}

function usageError(msg) {
  process.stderr.write(`gate: ${msg}\n`);
  process.exit(2);
}

function describe(v) {
  if (v === undefined) return 'missing';
  if (v === null) return 'null';
  if (typeof v === 'string') return `string ${JSON.stringify(v)}`;
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'object';
  return `${typeof v} ${JSON.stringify(v)}`;
}

function artifactDirOf(opts) { return path.dirname(opts.dir); }
function contractPathOf(opts) { return opts.contract ?? path.join(artifactDirOf(opts), 'CONTRACT.json'); }

// ---------------------------------------------------------------- contract

function loadContractOrExit(opts) {
  const file = contractPathOf(opts);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    usageError(`cannot read contract ${file}: ${e.message} (pass --contract <path>, or create it and check it with --validate-contract)`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    usageError(`contract ${file} is not valid JSON: ${e.message}`);
  }
  const errors = validateContract(data);
  if (errors.length) {
    usageError(`contract ${file} is invalid (${errors.length} error(s); run --validate-contract for the full list); first: ${errors[0]}`);
  }
  return { file, data };
}

/** Validate a parsed CONTRACT.json object. Returns an array of error strings naming fields. */
function validateContract(obj) {
  const errors = [];
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return ['(root): must be a JSON object'];
  }
  if ('version' in obj && !Number.isInteger(obj.version)) {
    errors.push(`version: must be an integer (got ${describe(obj.version)})`);
  }
  if ('artifactDir' in obj && typeof obj.artifactDir !== 'string') {
    errors.push(`artifactDir: must be a string (got ${describe(obj.artifactDir)})`);
  }
  if ('cap' in obj && !(Number.isInteger(obj.cap) && obj.cap >= 1)) {
    errors.push(`cap: must be a positive integer (got ${describe(obj.cap)})`);
  }
  if ('bar' in obj && !(Number.isInteger(obj.bar) && obj.bar >= 1 && obj.bar <= 10)) {
    errors.push(`bar: must be an integer 1-10 (got ${describe(obj.bar)})`);
  }
  if ('codexSeat' in obj && typeof obj.codexSeat !== 'boolean') {
    errors.push(`codexSeat: must be a boolean (got ${describe(obj.codexSeat)})`);
  }

  // axes — the declarative replacement for the gauntlet's hardcoded list.
  if (!Array.isArray(obj.axes) || obj.axes.length === 0) {
    errors.push(`axes: must be a non-empty array (got ${describe(obj.axes)})`);
  } else {
    const seen = new Set();
    obj.axes.forEach((ax, i) => {
      if (ax === null || typeof ax !== 'object' || Array.isArray(ax)) {
        errors.push(`axes[${i}]: must be an object (got ${describe(ax)})`);
        return;
      }
      if (typeof ax.name !== 'string' || !AXIS_NAME_RE.test(ax.name)) {
        errors.push(`axes[${i}].name: must match ${AXIS_NAME_RE} (got ${describe(ax.name)})`);
      } else if (seen.has(ax.name)) {
        errors.push(`axes[${i}].name: duplicate axis ${JSON.stringify(ax.name)}`);
      } else {
        seen.add(ax.name);
      }
      if (ax.anchors === null || typeof ax.anchors !== 'object' || Array.isArray(ax.anchors)) {
        errors.push(`axes[${i}].anchors: must be an object with keys exactly "3","5","8","10" (got ${describe(ax.anchors)})`);
      } else {
        for (const k of ANCHOR_KEYS) {
          if (!(k in ax.anchors)) errors.push(`axes[${i}].anchors.${k}: missing required anchor`);
          else if (typeof ax.anchors[k] !== 'string' || ax.anchors[k].length === 0) {
            errors.push(`axes[${i}].anchors.${k}: must be a non-empty string (got ${describe(ax.anchors[k])})`);
          }
        }
        for (const k of Object.keys(ax.anchors)) {
          if (!ANCHOR_KEYS.includes(k)) errors.push(`axes[${i}].anchors.${k}: unknown anchor key (allowed: "3","5","8","10")`);
        }
      }
    });
  }

  // targets
  if (!Array.isArray(obj.targets) || obj.targets.length === 0) {
    errors.push(`targets: must be a non-empty array (got ${describe(obj.targets)})`);
  } else {
    const seen = new Set();
    obj.targets.forEach((t, i) => {
      if (t === null || typeof t !== 'object' || Array.isArray(t)) {
        errors.push(`targets[${i}]: must be an object (got ${describe(t)})`);
        return;
      }
      const label = typeof t.name === 'string' ? `targets[${i}] (${t.name})` : `targets[${i}]`;
      if (typeof t.name !== 'string' || !TARGET_NAME_RE.test(t.name)) {
        errors.push(`targets[${i}].name: must match ${TARGET_NAME_RE} (got ${describe(t.name)})`);
      } else if (seen.has(t.name)) {
        errors.push(`targets[${i}].name: duplicate target ${JSON.stringify(t.name)}`);
      } else {
        seen.add(t.name);
      }
      for (const key of ['sourceGlobs', 'testGlobs']) {
        if (!Array.isArray(t[key])) {
          errors.push(`${label}.${key}: must be an array of glob strings (got ${describe(t[key])})`);
          continue;
        }
        t[key].forEach((g, j) => {
          if (typeof g !== 'string' || g.length === 0) errors.push(`${label}.${key}[${j}]: must be a non-empty string (got ${describe(g)})`);
        });
      }
      if (Array.isArray(t.sourceGlobs) && Array.isArray(t.testGlobs)) {
        t.sourceGlobs.forEach((s, si) => {
          if (typeof s !== 'string' || s.length === 0) return;
          t.testGlobs.forEach((g, gi) => {
            if (typeof g !== 'string' || g.length === 0) return;
            const a = literalGlobPrefix(s);
            const b = literalGlobPrefix(g);
            if (a.startsWith(b) || b.startsWith(a)) {
              errors.push(`${label}: sourceGlobs[${si}] ${JSON.stringify(s)} and testGlobs[${gi}] ${JSON.stringify(g)} share the literal prefix ${JSON.stringify(a.length <= b.length ? a : b)} — source and test ownership must be disjoint`);
            }
          });
        });
      }
      if ('cap' in t && !(Number.isInteger(t.cap) && t.cap >= 1)) {
        errors.push(`${label}.cap: must be a positive integer (got ${describe(t.cap)})`);
      }
      if ('bar' in t && !(Number.isInteger(t.bar) && t.bar >= 1 && t.bar <= 10)) {
        errors.push(`${label}.bar: must be an integer 1-10 (got ${describe(t.bar)})`);
      }
    });
  }

  // instruments — required whenever hard references them.
  const instrumentIds = new Set();
  if ('instruments' in obj || ('hard' in obj && obj.hard !== null)) {
    if (!Array.isArray(obj.instruments)) {
      errors.push(`instruments: must be an array (got ${describe(obj.instruments)})`);
    } else {
      obj.instruments.forEach((ins, i) => {
        if (ins === null || typeof ins !== 'object' || Array.isArray(ins)) {
          errors.push(`instruments[${i}]: must be an object (got ${describe(ins)})`);
          return;
        }
        const label = typeof ins.id === 'string' && ins.id.length ? `instruments[${i}] (${ins.id})` : `instruments[${i}]`;
        if (typeof ins.id !== 'string' || ins.id.length === 0) {
          errors.push(`instruments[${i}].id: must be a non-empty string (got ${describe(ins.id)})`);
        } else if (instrumentIds.has(ins.id)) {
          errors.push(`instruments[${i}].id: duplicate instrument id ${JSON.stringify(ins.id)}`);
        } else {
          instrumentIds.add(ins.id);
        }
        if (!INSTRUMENT_KINDS.includes(ins.kind)) {
          errors.push(`${label}.kind: must be one of ${INSTRUMENT_KINDS.join(', ')} (got ${describe(ins.kind)})`);
        }
        if (ins.kind === 'tool') {
          if (ins.cmd !== null) errors.push(`${label}.cmd: must be null for kind "tool" (got ${describe(ins.cmd)})`);
          if (typeof ins.note !== 'string' || ins.note.length === 0) {
            errors.push(`${label}.note: kind "tool" requires a non-empty note stating the exact invocation and required output shape (got ${describe(ins.note)})`);
          }
        } else if (ins.kind === 'command' || ins.kind === 'probe') {
          if (typeof ins.cmd !== 'string' || ins.cmd.length === 0) {
            errors.push(`${label}.cmd: must be a non-empty string for kind ${JSON.stringify(ins.kind)} (got ${describe(ins.cmd)})`);
          }
        }
        if (!PRODUCES.includes(ins.produces)) {
          errors.push(`${label}.produces: must be one of ${PRODUCES.join(', ')} (got ${describe(ins.produces)})`);
        }
        if ('timeoutMs' in ins && ins.timeoutMs !== null && !(Number.isInteger(ins.timeoutMs) && ins.timeoutMs >= 1)) {
          errors.push(`${label}.timeoutMs: must be a positive integer or null (got ${describe(ins.timeoutMs)})`);
        }
        if ('artifact' in ins && ins.artifact !== null && typeof ins.artifact !== 'string') {
          errors.push(`${label}.artifact: must be a string or null (got ${describe(ins.artifact)})`);
        }
        if ('extract' in ins && ins.extract !== null) {
          const ex = ins.extract;
          if (typeof ex !== 'object' || Array.isArray(ex)) {
            errors.push(`${label}.extract: must be null or an object (got ${describe(ex)})`);
          } else if (!EXTRACT_TYPES.includes(ex.type)) {
            errors.push(`${label}.extract.type: must be one of ${EXTRACT_TYPES.join(', ')} (got ${describe(ex.type)})`);
          } else if (ex.type === 'regex') {
            if (typeof ex.pattern !== 'string' || ex.pattern.length === 0) {
              errors.push(`${label}.extract.pattern: regex extract requires a non-empty pattern (got ${describe(ex.pattern)})`);
            }
            if ('group' in ex && !(Number.isInteger(ex.group) && ex.group >= 0)) {
              errors.push(`${label}.extract.group: must be a non-negative integer (got ${describe(ex.group)})`);
            }
          } else if (ex.type === 'json') {
            if (typeof ex.path !== 'string' || ex.path.length === 0) {
              errors.push(`${label}.extract.path: json extract requires a non-empty path (got ${describe(ex.path)})`);
            }
          }
        }
      });
    }
  }

  // hard — every instrument id it references must exist in instruments[].
  if ('hard' in obj && obj.hard !== null) {
    const h = obj.hard;
    if (typeof h !== 'object' || Array.isArray(h)) {
      errors.push(`hard: must be an object or null (got ${describe(h)})`);
    } else {
      const ref = (field, id) => {
        if (typeof id !== 'string' || id.length === 0) {
          errors.push(`${field}: must be a non-empty instrument id (got ${describe(id)})`);
        } else if (!instrumentIds.has(id)) {
          errors.push(`${field}: references instrument ${JSON.stringify(id)} which does not exist in instruments[]`);
        }
      };
      if ('testInstrument' in h && h.testInstrument !== null) ref('hard.testInstrument', h.testInstrument);
      if ('allowNewFailures' in h && typeof h.allowNewFailures !== 'boolean') {
        errors.push(`hard.allowNewFailures: must be a boolean (got ${describe(h.allowNewFailures)})`);
      }
      if ('coverage' in h && h.coverage !== null) {
        if (typeof h.coverage !== 'object' || Array.isArray(h.coverage)) {
          errors.push(`hard.coverage: must be an object or null (got ${describe(h.coverage)})`);
        } else {
          ref('hard.coverage.instrument', h.coverage.instrument);
          if (typeof h.coverage.min !== 'number' || h.coverage.min < 0 || h.coverage.min > 1) {
            errors.push(`hard.coverage.min: must be a number 0-1 (got ${describe(h.coverage.min)})`);
          }
        }
      }
      if ('behaviorMap' in h && typeof h.behaviorMap !== 'boolean') {
        errors.push(`hard.behaviorMap: must be a boolean (got ${describe(h.behaviorMap)})`);
      }
      if ('instrumentsMustRun' in h && typeof h.instrumentsMustRun !== 'boolean') {
        errors.push(`hard.instrumentsMustRun: must be a boolean (got ${describe(h.instrumentsMustRun)})`);
      }
      if ('metrics' in h && h.metrics !== null) {
        if (!Array.isArray(h.metrics)) {
          errors.push(`hard.metrics: must be an array (got ${describe(h.metrics)})`);
        } else {
          h.metrics.forEach((m, i) => {
            if (m === null || typeof m !== 'object' || Array.isArray(m)) {
              errors.push(`hard.metrics[${i}]: must be an object (got ${describe(m)})`);
              return;
            }
            if (typeof m.id !== 'string' || m.id.length === 0) {
              errors.push(`hard.metrics[${i}].id: must be a non-empty string (got ${describe(m.id)})`);
            }
            ref(`hard.metrics[${i}].instrument`, m.instrument);
            if (!METRIC_OPS.includes(m.op)) {
              errors.push(`hard.metrics[${i}].op: must be one of ${METRIC_OPS.join(' ')} (got ${describe(m.op)})`);
            }
            if (typeof m.threshold !== 'number') {
              errors.push(`hard.metrics[${i}].threshold: must be a number (got ${describe(m.threshold)})`);
            }
          });
        }
      }
    }
  }
  return errors;
}

/**
 * Literal prefix of a glob: everything before the first wildcard character
 * ("src/parser/**" -> "src/parser/", "tests/a.ts" -> "tests/a.ts"), which
 * subsumes stripping a trailing "/**" or "*". Both-direction startsWith on
 * these prefixes is the sourceGlobs/testGlobs disjointness check.
 */
function literalGlobPrefix(glob) {
  const norm = glob.replace(/\\/g, '/');
  const i = norm.search(/[*?[{]/);
  return i === -1 ? norm : norm.slice(0, i);
}

// ---------------------------------------------------------------- critique validation

/**
 * Validate one parsed critique object against the contract.
 * ctx = { axes: [name...], instrumentIds: Set|null, targetNames: Set|null }.
 * Returns an array of error strings naming fields.
 */
function validateCritique(obj, ctx) {
  const { axes } = ctx;
  const errors = [];
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return ['(root): must be a JSON object'];
  }
  if (!Number.isInteger(obj.iteration)) {
    errors.push(`iteration: must be an integer (got ${describe(obj.iteration)})`);
  }
  if (typeof obj.target !== 'string' || obj.target.length === 0) {
    errors.push(`target: must be a non-empty string (got ${describe(obj.target)})`);
  } else if (ctx.targetNames && !ctx.targetNames.has(obj.target)) {
    errors.push(`target: ${JSON.stringify(obj.target)} is not declared in CONTRACT.json targets (known: ${[...ctx.targetNames].join(', ') || 'none'})`);
  }
  if ('critic' in obj && obj.critic !== null && (typeof obj.critic !== 'string' || obj.critic.length === 0)) {
    errors.push(`critic: must be a non-empty string when present (got ${describe(obj.critic)})`);
  }
  const scoresObj = (obj.scores !== null && typeof obj.scores === 'object' && !Array.isArray(obj.scores)) ? obj.scores : null;
  if (scoresObj === null) {
    errors.push(`scores: must be an object with exactly the ${axes.length} contract axes (${axes.join(', ')}) (got ${describe(obj.scores)})`);
  } else {
    for (const axis of axes) {
      if (!(axis in scoresObj)) {
        errors.push(`scores.${axis}: missing required axis`);
        continue;
      }
      const v = scoresObj[axis];
      if (v !== null && !(Number.isInteger(v) && v >= 1 && v <= 10)) {
        errors.push(`scores.${axis}: must be an integer 1-10 or null (got ${describe(v)})`);
      }
    }
    for (const k of Object.keys(scoresObj)) {
      if (!axes.includes(k)) errors.push(`scores.${k}: unknown axis (contract axes: ${axes.join(', ')})`);
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
        if ('axis' in f && !axes.includes(f.axis)) {
          errors.push(`findings[${i}].axis: unknown axis ${describe(f.axis)} (contract axes: ${axes.join(', ')})`);
        }
        if ('score' in f && !(Number.isInteger(f.score) && f.score >= 1 && f.score <= 10)) {
          errors.push(`findings[${i}].score: must be an integer 1-10 (got ${describe(f.score)})`);
        }
        for (const field of ['region', 'defect', 'fix']) {
          if (field in f && (typeof f[field] !== 'string' || f[field].length === 0)) {
            errors.push(`findings[${i}].${field}: must be a non-empty string (got ${describe(f[field])})`);
          }
        }
        if ('evidence' in f && f.evidence !== null && f.evidence !== undefined) {
          const ev = f.evidence;
          if (typeof ev !== 'object' || Array.isArray(ev)) {
            errors.push(`findings[${i}].evidence: must be an object (got ${describe(ev)})`);
          } else if (typeof ev.instrument !== 'string' || ev.instrument.length === 0) {
            errors.push(`findings[${i}].evidence.instrument: must be a non-empty contract instrument id (got ${describe(ev.instrument)})`);
          } else if (ctx.instrumentIds && !ctx.instrumentIds.has(ev.instrument)) {
            errors.push(`findings[${i}].evidence.instrument: ${JSON.stringify(ev.instrument)} is not a contract instrument id (known: ${[...ctx.instrumentIds].join(', ') || 'none'})`);
          }
        }
      });
    }
  }
  // Load-bearing rule: a non-null test_quality score REQUIRES a mutation block.
  const mutationRequired = axes.includes('test_quality') && scoresObj !== null && Number.isInteger(scoresObj.test_quality);
  if (mutationRequired && (obj.mutation === undefined || obj.mutation === null)) {
    errors.push(`mutation: REQUIRED because scores.test_quality is non-null (${scoresObj.test_quality}) — a test_quality score with no mutation experiment is an invalid critique, not a low score`);
  }
  if (obj.mutation !== undefined && obj.mutation !== null) {
    const mu = obj.mutation;
    if (typeof mu !== 'object' || Array.isArray(mu)) {
      errors.push(`mutation: must be an object (got ${describe(mu)})`);
    } else {
      for (const field of MUTATION_STRING_FIELDS) {
        if (typeof mu[field] !== 'string' || mu[field].length === 0) {
          errors.push(`mutation.${field}: must be a non-empty string (got ${describe(mu[field])})`);
        }
      }
      if (typeof mu.testFailed !== 'boolean') {
        errors.push(`mutation.testFailed: must be a boolean (got ${describe(mu.testFailed)})`);
      }
      if (mu.reverted !== true) {
        errors.push(`mutation.reverted: must be exactly true — the mutation must be reverted before the verdict lands (got ${describe(mu.reverted)})`);
      }
    }
  }
  return errors;
}

/** Parse <target>_iter<N>[.<critic>].json. Returns {target, iteration, critic|null} or null. */
function parseCritiqueName(file) {
  const m = /^(.+)_iter(\d+)(?:\.([A-Za-z0-9_-]+))?\.json$/.exec(file);
  if (!m) return null;
  return { target: m[1], iteration: Number(m[2]), critic: m[3] ?? null };
}

/** Filename <-> content consistency (the naming is load-bearing: the gate reads by name). */
function filenameConsistencyErrors(basename, data) {
  const named = parseCritiqueName(basename);
  const errors = [];
  if (!named) {
    errors.push(`(file): filename ${JSON.stringify(basename)} must match <target>_iter<N>[.<critic>].json`);
    return errors;
  }
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.target === 'string' && data.target.length && data.target !== named.target) {
      errors.push(`target: content says ${JSON.stringify(data.target)} but filename says ${JSON.stringify(named.target)}`);
    }
    if (Number.isInteger(data.iteration) && data.iteration !== named.iteration) {
      errors.push(`iteration: content says ${data.iteration} but filename says ${named.iteration}`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------- loading

function loadDir(dir, ctx) {
  let entries;
  try {
    entries = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json')).sort();
  } catch (e) {
    usageError(`cannot read critiques dir ${dir}: ${e.message}`);
  }
  const critiques = [];      // merged (unsuffixed) valid verdicts {file, data}
  const invalid = [];        // {file, target, errors}
  const panelFiles = [];     // suffixed per-critic files {file, target, iteration, critic}
  const unsuffixedSeen = new Set(); // "<target> <iteration>" for any unsuffixed file, valid or not
  for (const f of entries) {
    const full = path.join(dir, f);
    const named = parseCritiqueName(f);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (e) {
      if (named && named.critic !== null) {
        panelFiles.push({ file: f, target: named.target, iteration: named.iteration, critic: named.critic });
      } else if (named) {
        unsuffixedSeen.add(`${named.target} ${named.iteration}`);
      }
      invalid.push({ file: f, target: named ? named.target : null, errors: [`(file): invalid JSON — ${e.message}`] });
      continue;
    }
    const errors = [...validateCritique(data, ctx), ...filenameConsistencyErrors(f, data)];
    const target = (data && typeof data.target === 'string' && data.target.length) ? data.target : (named ? named.target : null);
    if (named && named.critic !== null) {
      // Per-critic panel file: never part of the record the gate reads. The
      // merged unsuffixed file is the verdict; this one is validated only.
      panelFiles.push({ file: f, target: named.target, iteration: named.iteration, critic: named.critic });
      if (errors.length) invalid.push({ file: f, target: named.target, errors });
      continue;
    }
    if (named) unsuffixedSeen.add(`${named.target} ${named.iteration}`);
    if (errors.length) {
      invalid.push({ file: f, target, errors });
    } else {
      critiques.push({ file: f, data });
    }
  }
  return { critiques, invalid, panelFiles, unsuffixedSeen };
}

// ---------------------------------------------------------------- layer 1 (hard gate)

function metricPass(value, op, threshold) {
  switch (op) {
    case '<=': return value <= threshold;
    case '<': return value < threshold;
    case '>=': return value >= threshold;
    case '>': return value > threshold;
    case '==': return value === threshold;
    default: return false;
  }
}

/**
 * Recompute the layer-1 verdict for a target's most recent iteration from
 * evidence/<target>_iter<N>.json and baseline/<target>.json. Never trusts a
 * self-reported verdict field (tests.newFailures and behaviors.missing are
 * recomputed from their parts).
 */
function evaluateLayer1(targetName, latestIteration, artifactDir, contract) {
  const hard = (contract.hard !== null && typeof contract.hard === 'object' && !Array.isArray(contract.hard)) ? contract.hard : null;
  const evidenceFile = path.join(artifactDir, 'evidence', `${targetName}_iter${latestIteration}.json`);
  const baselineFile = path.join(artifactDir, 'baseline', `${targetName}.json`);
  const result = { evaluated: hard !== null, pass: true, evidence_file: hard !== null ? evidenceFile : null, clauses: [], note: null };
  if (hard === null) {
    result.note = 'contract has no "hard" section — layer 1 not configured, treated as pass';
    return result;
  }
  const clause = (name, pass, detail) => {
    result.clauses.push({ clause: name, pass, detail });
    if (!pass) result.pass = false;
  };

  let ev;
  try {
    ev = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
  } catch (e) {
    clause('evidence_report', false, `evidence report unreadable: ${evidenceFile} — ${e.message}`);
    return result;
  }
  if (ev === null || typeof ev !== 'object' || Array.isArray(ev)) {
    clause('evidence_report', false, `${evidenceFile}: (root) must be a JSON object`);
    return result;
  }
  if (ev.iteration !== latestIteration) {
    clause('evidence_report', false, `${evidenceFile}: iteration is ${describe(ev.iteration)}, expected ${latestIteration} (the latest critique iteration)`);
  }
  if (ev.target !== targetName) {
    clause('evidence_report', false, `${evidenceFile}: target is ${describe(ev.target)}, expected ${JSON.stringify(targetName)}`);
  }

  // (a) no new test failures vs baseline — recomputed as failures \ baselineFailures.
  if (hard.allowNewFailures !== true) {
    const failures = Array.isArray(ev.tests?.failures) ? ev.tests.failures : null;
    if (failures === null) {
      clause('new_failures', false, `${evidenceFile}: tests.failures must be an array to recompute new failures (got ${describe(ev.tests?.failures)})`);
    } else {
      let baseline = null;
      let baseErr = null;
      try {
        baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
      } catch (e) {
        baseErr = e.message;
      }
      const baseFailures = Array.isArray(baseline?.tests?.failures) ? baseline.tests.failures : null;
      if (baseFailures === null) {
        clause('new_failures', false, baseline === null
          ? `baseline unreadable: ${baselineFile} — ${baseErr}`
          : `${baselineFile}: tests.failures must be an array (got ${describe(baseline?.tests?.failures)})`);
      } else {
        const baseSet = new Set(baseFailures);
        const newFailures = failures.filter((x) => !baseSet.has(x));
        clause('new_failures', newFailures.length === 0, newFailures.length
          ? `new test failures vs baseline (recomputed failures \\ baselineFailures): ${newFailures.join('; ')}`
          : `no new test failures (recomputed: ${failures.length} failing, ${baseSet.size} baseline)`);
      }
    }
  }

  // (b) coverage.ratio >= hard.coverage.min
  if (hard.coverage !== null && hard.coverage !== undefined && typeof hard.coverage === 'object') {
    const min = hard.coverage.min;
    const ratio = ev.coverage?.ratio;
    if (typeof ratio !== 'number') {
      clause('coverage', false, `${evidenceFile}: coverage.ratio must be a number (got ${describe(ev.coverage?.ratio)})`);
    } else {
      clause('coverage', ratio >= min, `coverage.ratio ${ratio} ${ratio >= min ? '>=' : '<'} hard.coverage.min ${min}`);
    }
  }

  // (c) behaviors: declared \ satisfied must be empty — recomputed, with every
  // satisfied claim cross-checked against an INDEPENDENT part of the report:
  // a behavior is NOT satisfied if any test name in tests.failures carries its
  // id as a standalone token (\bB<N>\b — the same rule testreport.mjs uses).
  // behaviors.satisfied and behaviors.missing alone are forgeable in one edit;
  // the failure list contradicting a satisfied claim exposes that.
  if (hard.behaviorMap === true) {
    const declared = Array.isArray(ev.behaviors?.declared) ? ev.behaviors.declared : null;
    const satisfied = Array.isArray(ev.behaviors?.satisfied) ? ev.behaviors.satisfied : null;
    const behaviorFailures = Array.isArray(ev.tests?.failures) ? ev.tests.failures : null;
    if (declared === null || satisfied === null) {
      clause('behaviors', false, `${evidenceFile}: behaviors.declared and behaviors.satisfied must be arrays to recompute missing behaviors (got declared=${describe(ev.behaviors?.declared)}, satisfied=${describe(ev.behaviors?.satisfied)})`);
    } else if (behaviorFailures === null) {
      clause('behaviors', false, `${evidenceFile}: tests.failures must be an array to cross-check satisfied behaviors against failing tests (got ${describe(ev.tests?.failures)})`);
    } else {
      const contradicted = new Map(); // behavior id -> failing test name carrying its token
      for (const b of satisfied) {
        if (typeof b !== 'string' || b.length === 0) continue;
        const token = new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        const hit = behaviorFailures.find((t) => typeof t === 'string' && token.test(t));
        if (hit !== undefined) contradicted.set(b, hit);
      }
      const satEffective = new Set(satisfied.filter((b) => !contradicted.has(b)));
      const missing = declared.filter((b) => !satEffective.has(b));
      if (missing.length === 0) {
        clause('behaviors', true, `all ${declared.length} declared behavior(s) satisfied (recomputed, cross-checked against tests.failures)`);
      } else {
        const parts = [];
        const plainMissing = missing.filter((b) => !contradicted.has(b));
        if (plainMissing.length) {
          parts.push(`behaviors missing (recomputed declared \\ satisfied): ${plainMissing.join(', ')}`);
        }
        for (const b of missing) {
          if (contradicted.has(b)) {
            parts.push(`behavior ${b} is claimed satisfied but a FAILING test carries its id: ${JSON.stringify(contradicted.get(b))} — evidence tampering or a stale report`);
          }
        }
        clause('behaviors', false, parts.join('; '));
      }
    }
  }

  // (d) every hard.metrics[] entry within threshold.
  if (Array.isArray(hard.metrics)) {
    for (const m of hard.metrics) {
      const name = `metric:${m.id}`;
      const entry = Array.isArray(ev.metrics) ? ev.metrics.find((x) => x !== null && typeof x === 'object' && x.id === m.id) : undefined;
      if (entry === undefined) {
        clause(name, false, `${evidenceFile}: metrics[] has no entry with id ${JSON.stringify(m.id)}`);
      } else if (typeof entry.value !== 'number') {
        clause(name, false, `${evidenceFile}: metrics[] entry ${JSON.stringify(m.id)}: value must be a number (got ${describe(entry.value)})`);
      } else {
        const ok = metricPass(entry.value, m.op, m.threshold);
        clause(name, ok, `${m.id}=${entry.value} ${ok ? 'satisfies' : 'violates'} ${m.op} ${m.threshold}`);
      }
    }
  }

  // (e) every instrument in the report ran clean.
  if (hard.instrumentsMustRun === true) {
    if (!Array.isArray(ev.instruments)) {
      clause('instruments_ran', false, `${evidenceFile}: instruments must be an array (got ${describe(ev.instruments)})`);
    } else {
      const bad = ev.instruments.filter((i) => i === null || typeof i !== 'object' || i.ran !== true || i.error !== null);
      clause('instruments_ran', bad.length === 0, bad.length
        ? `instruments did not run clean: ${bad.map((i) => `${(i && typeof i === 'object' && typeof i.id === 'string') ? i.id : '(no id)'} (ran=${describe(i?.ran)}, error=${describe(i?.error)})`).join('; ')}`
        : `all ${ev.instruments.length} instrument(s) ran with no error`);
    }
  }

  return result;
}

// ---------------------------------------------------------------- state machine (layer 2 + verdict)

const measuredAxes = (scores, axes) => axes.filter((a) => scores[a] !== null);
const measuredOk = (scores, axes, bar) => {
  const m = measuredAxes(scores, axes);
  return m.length > 0 && m.every((a) => scores[a] >= bar);
};
const totalMeasured = (scores, axes) => measuredAxes(scores, axes).reduce((s, a) => s + scores[a], 0);

/**
 * Evaluate one target. crits = validated merged critiques sorted by iteration
 * (ascending). Layer-2 math is the gauntlet's, unchanged: consecutive-round
 * closure, plateau over 3 totals, cap enforcement, waiver handling. Layer 1
 * gates the CLOSED verdict only: a would-be CLOSED with a failing layer-1
 * clause is BLOCKED with that clause named.
 */
function evaluateTarget(name, crits, waivedAxes, capReached, invalidRelevant, unmergedPanel, layer1, axes, bar) {
  const latest = crits[crits.length - 1];
  const prev = crits.length >= 2 ? crits[crits.length - 2] : null;
  const ls = latest.data.scores;
  const ps = prev?.data.scores ?? null;

  // Per-axis history, streak, latest.
  const axisInfo = {};
  for (const axis of axes) {
    const history = crits.map((c) => c.data.scores[axis]);
    let streak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i] !== null && history[i] >= bar) streak++;
      else break;
    }
    axisInfo[axis] = {
      history,
      latest: ls[axis],
      streak_at_bar: streak,
      waived: waivedAxes.has(axis) ? waivedAxes.get(axis) : null,
    };
  }

  // Null-axis policy: null in the latest two critiques blocks unless waived.
  const nullBoth = prev ? axes.filter((a) => ls[a] === null && ps[a] === null) : axes.filter((a) => ls[a] === null);
  const unmeasuredBlockers = nullBoth.filter((a) => !waivedAxes.has(a));
  const waivedNulls = nullBoth.filter((a) => waivedAxes.has(a))
    .map((a) => ({ axis: a, source: waivedAxes.get(a) }));

  const latestOk = measuredOk(ls, axes, bar);
  const prevOk = prev !== null && measuredOk(ps, axes, bar);
  const closedMeasured = latestOk && prevOk;

  const totals = crits.map((c) => totalMeasured(c.data.scores, axes));
  const n = totals.length;
  const plateau = n >= 3 && totals[n - 1] <= totals[n - 2] && totals[n - 2] <= totals[n - 3];

  let state, reason;
  const blockers = [];
  const layer1Failing = layer1.evaluated ? layer1.clauses.filter((c) => !c.pass) : [];

  if (closedMeasured && unmeasuredBlockers.length === 0) {
    const withheld = [];
    if (invalidRelevant.length) {
      withheld.push(`WITHHELD: invalid critique file(s) in the record: ${invalidRelevant.join(', ')} — fix or remove (see --validate)`);
      for (const f of invalidRelevant) {
        blockers.push({ axis: null, kind: 'INVALID_FILE', latest_score: null,
          note: `${f} failed validation; an unreadable verdict cannot be counted as good news` });
      }
    }
    if (unmergedPanel.length) {
      withheld.push(`WITHHELD: panel iteration(s) with per-critic files but no merged verdict: ${unmergedPanel.map((u) => `iter ${u.iteration} (${u.critics} critic file(s))`).join(', ')}`);
      for (const u of unmergedPanel) {
        blockers.push({ axis: null, kind: 'UNMERGED_PANEL', latest_score: null,
          note: `iteration ${u.iteration} has ${u.critics} per-critic file(s) but no merged ${name}_iter${u.iteration}.json — the gate reads only the merged verdict` });
      }
    }
    if (layer1Failing.length) {
      withheld.push(`layer 1 hard gate FAILS: ${layer1Failing.map((c) => c.clause).join(', ')}`);
      for (const c of layer1Failing) {
        blockers.push({ axis: null, kind: 'HARD_GATE', clause: c.clause, latest_score: null, note: c.detail });
      }
    }
    if (withheld.length) {
      state = 'BLOCKED';
      reason = `layer 2 closure met (iters ${prev.data.iteration}+${latest.data.iteration} all measured >=${bar}) but ${withheld.join('; ')}`;
    } else {
      state = 'CLOSED';
      reason = `iters ${prev.data.iteration}+${latest.data.iteration} both all-measured >=${bar}; layer 1 hard gate ${layer1.evaluated ? `PASS (evidence iter ${latest.data.iteration})` : 'not configured (no "hard" section in contract)'}`
        + (waivedNulls.length ? `; null axes waived: ${waivedNulls.map((w) => `${w.axis} (${w.source})`).join(', ')}` : '');
    }
  } else if (capReached) {
    state = 'CAPPED';
    reason = `iteration cap reached and target not closed`;
  } else if (closedMeasured) {
    state = 'BLOCKED';
    reason = `measured closure met (iters ${prev.data.iteration}+${latest.data.iteration} all >=${bar}) but UNMEASURED axes block: ${unmeasuredBlockers.join(', ')}`;
    for (const a of unmeasuredBlockers) {
      blockers.push({ axis: a, kind: 'UNMEASURED', latest_score: null,
        note: `null in latest two critiques with no waiver (--waive ${name}:${a})` });
    }
  } else if (latestOk) {
    state = 'CONFIRM';
    reason = prev
      ? `iter ${latest.data.iteration} all measured >=${bar} but iter ${prev.data.iteration} was not — next round is a confirmation round`
      : `iter ${latest.data.iteration} all measured >=${bar} with no prior critique — next round is a confirmation round`;
    for (const a of unmeasuredBlockers) {
      blockers.push({ axis: a, kind: 'UNMEASURED', latest_score: null,
        note: 'will block closure at confirmation unless waived' });
    }
    for (const c of layer1Failing) {
      blockers.push({ axis: null, kind: 'HARD_GATE', clause: c.clause, latest_score: null,
        note: `will block closure: ${c.detail}` });
    }
  } else if (plateau) {
    state = 'PLATEAU';
    reason = `no improvement in total measured score over 3 consecutive critiques (${totals.slice(-3).join(' -> ')}) — write PLATEAU-${name}.md`;
    pushWorkOrder(blockers, latest, ls, axes, bar);
  } else {
    state = 'CONTINUE';
    const low = axes.filter((a) => ls[a] !== null && ls[a] < bar);
    reason = low.length
      ? `axes below ${bar}: ${low.map((a) => `${a}=${ls[a]}`).join(', ')}`
      : `awaiting more critiques`;
    pushWorkOrder(blockers, latest, ls, axes, bar);
    for (const a of unmeasuredBlockers) {
      blockers.push({ axis: a, kind: 'UNMEASURED', latest_score: null,
        note: 'null in latest critiques; will block closure unless waived' });
    }
  }

  return {
    target: name,
    state,
    reason,
    bar,
    iterations: crits.length,
    latest_iteration: latest.data.iteration,
    latest_file: latest.file,
    totals_measured: totals,
    axes: axisInfo,
    waived_nulls: waivedNulls,
    layer1,
    panel: [], // filled by buildReport
    blockers,
  };
}

/** CONTINUE/PLATEAU work order: every axis < bar with latest score and that axis's findings. */
function pushWorkOrder(blockers, latest, ls, axes, bar) {
  const findings = Array.isArray(latest.data.findings) ? latest.data.findings : [];
  for (const a of axes) {
    if (ls[a] === null || ls[a] >= bar) continue;
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
  const contract = loadContractOrExit(opts);
  const c = contract.data;
  const axes = c.axes.map((a) => a.name);
  const instrumentIds = new Set(Array.isArray(c.instruments) ? c.instruments.filter((x) => x && typeof x.id === 'string').map((x) => x.id) : []);
  const targetNames = new Set(c.targets.map((t) => t.name));
  for (const w of opts.waive) {
    if (!axes.includes(w.axis)) usageError(`--waive: unknown axis ${JSON.stringify(w.axis)}; contract axes: ${axes.join(', ')}`);
  }
  const bar = opts.bar ?? (Number.isInteger(c.bar) ? c.bar : DEFAULT_BAR);
  const cap = opts.cap ?? (Number.isInteger(c.cap) ? c.cap : DEFAULT_CAP);

  const { critiques, invalid, panelFiles, unsuffixedSeen } = loadDir(opts.dir, { axes, instrumentIds, targetNames });
  const artifactDir = artifactDirOf(opts);

  // Group merged critiques by target, sort by iteration (stable: iteration, then filename).
  const byTarget = new Map();
  for (const cr of critiques) {
    const t = cr.data.target;
    if (!byTarget.has(t)) byTarget.set(t, []);
    byTarget.get(t).push(cr);
  }
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // codepoint order — locale-independent
  for (const arr of byTarget.values()) {
    arr.sort((a, b) => a.data.iteration - b.data.iteration || cmp(a.file, b.file));
  }

  const totalIterations = critiques.length;
  const capReachedGlobal = totalIterations >= cap;

  // Panel bookkeeping: target -> Map(iteration -> {iteration, critics, files, merged}).
  const panels = new Map();
  for (const p of panelFiles) {
    if (!panels.has(p.target)) panels.set(p.target, new Map());
    const m = panels.get(p.target);
    if (!m.has(p.iteration)) {
      m.set(p.iteration, { iteration: p.iteration, critics: 0, files: [], merged: unsuffixedSeen.has(`${p.target} ${p.iteration}`) });
    }
    const e = m.get(p.iteration);
    e.critics++;
    e.files.push(p.file);
  }

  // Attribute invalid files: by parsed target field, else by filename prefix,
  // else unattributed (fail-safe: blocks closure of EVERY target).
  const knownForAttribution = new Set([...byTarget.keys(), ...targetNames, ...panels.keys()]);
  const knownSorted = [...knownForAttribution].sort(cmp);
  const invalidByTarget = new Map();
  const invalidGlobal = [];
  for (const inv of invalid) {
    const base = inv.file.replace(/\.json$/i, '');
    let owner = inv.target !== null && knownForAttribution.has(inv.target) ? inv.target : null;
    if (owner === null) {
      owner = knownSorted.find((s) => base === s || base.startsWith(s + '_') || base.startsWith(s + '.')) ?? null;
    }
    if (owner !== null) {
      if (!invalidByTarget.has(owner)) invalidByTarget.set(owner, []);
      invalidByTarget.get(owner).push(inv.file);
    } else {
      invalidGlobal.push(inv.file);
    }
  }

  const targets = {};
  for (const [name, crits] of [...byTarget.entries()].sort((a, b) => cmp(a[0], b[0]))) {
    const tdef = c.targets.find((t) => t.name === name) ?? null;
    const tBar = opts.bar ?? (tdef && Number.isInteger(tdef.bar) ? tdef.bar : bar);
    const tCap = opts.cap ?? (tdef && Number.isInteger(tdef.cap) ? tdef.cap : cap);
    const capReached = capReachedGlobal || crits.length >= tCap;
    const waived = new Map(); // axis -> source string
    for (const w of opts.waive) {
      if (w.target === name) waived.set(w.axis, `--waive ${w.target}:${w.axis}`);
    }
    const invalidRelevant = [...(invalidByTarget.get(name) ?? []), ...invalidGlobal].sort(cmp);
    const panelList = panels.has(name) ? [...panels.get(name).values()].sort((a, b) => a.iteration - b.iteration) : [];
    const unmergedPanel = panelList.filter((p) => !p.merged);
    const latestIteration = crits[crits.length - 1].data.iteration;
    const layer1 = evaluateLayer1(name, latestIteration, artifactDir, c);
    const rec = evaluateTarget(name, crits, waived, capReached, invalidRelevant, unmergedPanel, layer1, axes, tBar);
    rec.panel = panelList;
    targets[name] = rec;
  }

  // Targets that exist ONLY as per-critic panel files: no merged verdict, no record — BLOCKED.
  for (const [name, m] of [...panels.entries()].sort((a, b) => cmp(a[0], b[0]))) {
    if (targets[name]) continue;
    const list = [...m.values()].sort((a, b) => a.iteration - b.iteration);
    targets[name] = {
      target: name,
      state: 'BLOCKED',
      reason: `per-critic panel file(s) exist (${list.map((p) => `iter ${p.iteration}: ${p.critics}`).join(', ')}) but no merged verdict — the gate reads only the merged ${name}_iter<N>.json`,
      bar: opts.bar ?? bar,
      iterations: 0,
      latest_iteration: null,
      latest_file: null,
      totals_measured: [],
      axes: {},
      waived_nulls: [],
      layer1: { evaluated: false, pass: false, evidence_file: null, clauses: [], note: 'not evaluated — no merged critique record' },
      panel: list,
      blockers: list.filter((p) => !p.merged).map((p) => ({ axis: null, kind: 'UNMERGED_PANEL', latest_score: null,
        note: `iteration ${p.iteration} has ${p.critics} per-critic file(s) but no merged ${name}_iter${p.iteration}.json` })),
    };
  }

  return {
    dir: opts.dir,
    contract: contract.file,
    cap,
    bar,
    total_iterations: totalIterations,
    cap_reached: capReachedGlobal,
    targets,
    invalid_files: invalid,
  };
}

// ---------------------------------------------------------------- text rendering

function renderReport(r) {
  const out = [];
  out.push(`GATE REPORT  dir=${r.dir}`);
  out.push(`contract=${r.contract}`);
  out.push(`iterations ${r.total_iterations}/${r.cap}${r.cap_reached ? '  ** CAP REACHED **' : ''}  bar=${r.bar}`);
  out.push('');
  for (const sub of Object.values(r.targets)) {
    out.push(`## ${sub.target}  —  ${sub.state}  (${sub.iterations} critiques, latest iter ${sub.latest_iteration ?? '-'})`);
    out.push(`   ${sub.reason}`);
    if (sub.totals_measured.length) out.push(`   total measured score: ${sub.totals_measured.join(' -> ')}`);
    const axisNames = Object.keys(sub.axes);
    if (axisNames.length) {
      const w = Math.max(...axisNames.map((a) => a.length));
      for (const axis of axisNames) {
        const ax = sub.axes[axis];
        const hist = ax.history.map((v) => (v === null ? '-' : v)).join(' ');
        const flags = [];
        if (ax.latest === null) flags.push(ax.waived ? 'null, WAIVED' : 'null, UNMEASURED');
        out.push(`   ${axis.padEnd(w)}  [${hist}]  latest=${ax.latest === null ? '-' : ax.latest}  streak>=${sub.bar}: ${ax.streak_at_bar}${flags.length ? '  (' + flags.join('; ') + ')' : ''}`);
      }
    }
    const l1 = sub.layer1;
    if (l1.evaluated) {
      out.push(`   layer 1 (hard gate): ${l1.pass ? 'PASS' : 'FAIL'}  evidence=${l1.evidence_file}`);
      for (const cl of l1.clauses) out.push(`     ${cl.pass ? 'ok  ' : 'FAIL'} ${cl.clause}: ${cl.detail}`);
    } else {
      out.push(`   layer 1 (hard gate): ${l1.note}`);
    }
    for (const p of sub.panel) {
      out.push(p.merged
        ? `   panel: iter ${p.iteration} merged from ${p.critics} critic file(s)`
        : `   panel: iter ${p.iteration} has ${p.critics} critic file(s) but NO merged verdict`);
    }
    if (sub.waived_nulls.length) {
      for (const wn of sub.waived_nulls) out.push(`   waiver: ${wn.axis} <- ${wn.source}`);
    }
    if (sub.blockers.length) {
      out.push('   blockers:');
      for (const b of sub.blockers) {
        if (b.kind === 'INVALID_FILE' || b.kind === 'UNMERGED_PANEL') {
          out.push(`     - ${b.kind} — ${b.note}`);
        } else if (b.kind === 'HARD_GATE') {
          out.push(`     - HARD_GATE ${b.clause} — ${b.note}`);
        } else if (b.kind === 'UNMEASURED') {
          out.push(`     - ${b.axis}: UNMEASURED — ${b.note}`);
        } else {
          out.push(`     - ${b.axis}=${b.latest_score} (<${sub.bar})`);
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
  const sub = r.targets[opts.check];
  let closed, state, reason;
  if (!sub) {
    closed = false;
    state = 'UNKNOWN';
    reason = `no critiques found for target ${JSON.stringify(opts.check)} in ${r.dir} (known: ${Object.keys(r.targets).join(', ') || 'none'})`;
  } else {
    closed = sub.state === 'CLOSED';
    state = sub.state;
    reason = sub.reason;
  }
  if (opts.json) {
    process.stdout.write(JSON.stringify({ target: opts.check, state, closed, reason,
      layer1: sub ? sub.layer1 : null, blockers: sub ? sub.blockers : [] }, null, 2) + '\n');
  } else {
    process.stdout.write(`${opts.check}: ${state} — ${reason}\n`);
    if (!closed && sub) {
      for (const b of sub.blockers) {
        process.stdout.write(
          b.kind === 'INVALID_FILE' || b.kind === 'UNMERGED_PANEL' ? `  blocker: ${b.kind} — ${b.note}\n`
          : b.kind === 'HARD_GATE' ? `  blocker: HARD_GATE ${b.clause} — ${b.note}\n`
          : b.kind === 'UNMEASURED' ? `  blocker: ${b.axis} UNMEASURED — ${b.note}\n`
          : `  blocker: ${b.axis}=${b.latest_score} (<${sub.bar})\n`);
      }
    }
  }
  process.exit(closed ? 0 : 1);
}

function cmdValidate(opts) {
  const contract = loadContractOrExit(opts);
  const c = contract.data;
  const ctx = {
    axes: c.axes.map((a) => a.name),
    instrumentIds: new Set(Array.isArray(c.instruments) ? c.instruments.filter((x) => x && typeof x.id === 'string').map((x) => x.id) : []),
    targetNames: new Set(c.targets.map((t) => t.name)),
  };
  let raw;
  try {
    raw = fs.readFileSync(opts.validate, 'utf8');
  } catch (e) {
    usageError(`cannot read ${opts.validate}: ${e.message}`);
  }
  let data = null, errors;
  try {
    data = JSON.parse(raw);
    errors = [...validateCritique(data, ctx), ...filenameConsistencyErrors(path.basename(opts.validate), data)];
  } catch (e) {
    errors = [`(file): invalid JSON — ${e.message}`];
  }
  const valid = errors.length === 0;
  if (opts.json) {
    process.stdout.write(JSON.stringify({ file: opts.validate, contract: contract.file, valid, errors }, null, 2) + '\n');
  } else if (valid) {
    process.stdout.write(`VALID: ${opts.validate} (iteration ${data.iteration}, target ${data.target})\n`);
  } else {
    process.stdout.write(`INVALID: ${opts.validate} — ${errors.length} error(s)\n`);
    for (const e of errors) process.stdout.write(`  - ${e}\n`);
  }
  process.exit(valid ? 0 : 1);
}

function cmdValidateContract(opts) {
  const file = opts.validateContractPath ?? contractPathOf(opts);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    usageError(`cannot read contract ${file}: ${e.message}`);
  }
  let errors;
  try {
    errors = validateContract(JSON.parse(raw));
  } catch (e) {
    errors = [`(file): invalid JSON — ${e.message}`];
  }
  const valid = errors.length === 0;
  if (opts.json) {
    process.stdout.write(JSON.stringify({ file, valid, errors }, null, 2) + '\n');
  } else if (valid) {
    process.stdout.write(`VALID CONTRACT: ${file}\n`);
  } else {
    process.stdout.write(`INVALID CONTRACT: ${file} — ${errors.length} error(s)\n`);
    for (const e of errors) process.stdout.write(`  - ${e}\n`);
  }
  process.exit(valid ? 0 : 1);
}

function cmdVerifyEngine(opts) {
  const file = opts.manifest ?? path.join(artifactDirOf(opts), 'manifest.json');
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    usageError(`cannot read manifest ${file}: ${e.message}`);
  }
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (e) {
    usageError(`manifest ${file} is not valid JSON: ${e.message} — the engine cannot be verified`);
  }
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)
      || manifest.files === null || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) {
    usageError(`manifest ${file}: "files" must be an object mapping relative paths to sha256 hex`);
  }
  const baseDir = path.dirname(file);
  const results = [];
  for (const [rel, expected] of Object.entries(manifest.files)) {
    if (typeof expected !== 'string' || !/^[0-9a-fA-F]{64}$/.test(expected)) {
      results.push({ file: rel, status: 'bad_entry', expected: typeof expected === 'string' ? expected : null, actual: null,
        detail: `files[${JSON.stringify(rel)}]: expected value must be a 64-char sha256 hex string (got ${describe(expected)})` });
      continue;
    }
    const full = path.resolve(baseDir, rel);
    let buf;
    try {
      buf = fs.readFileSync(full);
    } catch (e) {
      results.push({ file: rel, status: 'missing', expected: expected.toLowerCase(), actual: null,
        detail: `${rel}: unreadable at ${full} — ${e.message}` });
      continue;
    }
    const actual = crypto.createHash('sha256').update(buf).digest('hex');
    if (actual === expected.toLowerCase()) {
      results.push({ file: rel, status: 'ok', expected: expected.toLowerCase(), actual, detail: null });
    } else {
      results.push({ file: rel, status: 'drifted', expected: expected.toLowerCase(), actual,
        detail: `${rel}: sha256 ${actual} != manifest ${expected.toLowerCase()}` });
    }
  }
  const bad = results.filter((x) => x.status !== 'ok');
  const ok = bad.length === 0;
  if (opts.json) {
    process.stdout.write(JSON.stringify({ manifest: file, ok, files: results }, null, 2) + '\n');
  } else if (ok) {
    process.stdout.write(`ENGINE OK: ${results.length} file(s) match ${file}\n`);
  } else {
    process.stdout.write(`ENGINE DRIFT: ${bad.length} of ${results.length} file(s) fail verification against ${file}\n`);
    for (const x of bad) process.stdout.write(`  - ${x.status.toUpperCase()}: ${x.detail}\n`);
  }
  process.exit(ok ? 0 : 1);
}

// ---------------------------------------------------------------- main

const opts = parseArgs(process.argv.slice(2));
if (opts.help) { process.stdout.write(HELP); process.exit(0); }
if (opts.verifyEngine) cmdVerifyEngine(opts);
else if (opts.validateContract) cmdValidateContract(opts);
else if (opts.validate !== null) cmdValidate(opts);
else if (opts.check !== null) cmdCheck(opts);
else cmdReport(opts);
