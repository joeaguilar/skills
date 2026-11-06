#!/usr/bin/env node
// session-metrics.mjs — weekly efficiency of Claude Code sessions, read from the local
// transcripts (~/.claude/projects/**/*.jsonl). No dependencies.
//
//   node claude/scripts/session-metrics.mjs                 table of every week on disk
//   node claude/scripts/session-metrics.mjs --since 2026-10-01
//   node claude/scripts/session-metrics.mjs --record        also merge the rows into
//                                                           <record dir>/sessions-<os>.tsv
//   node claude/scripts/session-metrics.mjs --record --push commit and push that file too
//   node claude/scripts/session-metrics.mjs --combined      every machine's recorded rows,
//                                                           summed per week (no scan)
//   node claude/scripts/session-metrics.mjs --record --out FILE   record somewhere else
//   node claude/scripts/session-metrics.mjs --json          rows as JSON
//
// The record dir is the private `claude-metrics` repo cloned beside this skills checkout
// (`gitea clone claude-metrics ../claude-metrics`), else ~/.claude/metrics. Never this
// repo: it is public, and the rows are spend. Transcripts are deleted after
// cleanupPeriodDays, so --record is what keeps history: a recorded week is replaced
// only by a recount with at least as many requests, so a week half-deleted by cleanup
// never overwrites its complete row.
//
// Cost is API-equivalent (what the tokens would cost at first-party API prices), not
// what a subscription bills. GPT seats run through `codex exec` and are not counted.
//
// red_checks and review_agents measure the global "Tests prove themselves" and
// "Adversarial review" rules: a red check is a `gatr run --tag red-<name>`; a review
// agent is an Agent call whose description names a review, critique, judge or
// challenger seat, or a main-thread `codex-seat run|start` whose seat directory names a
// review. Workflow agent() calls are not tool calls in the parent transcript, so they
// are not counted.
//
// The tool-economics columns watch whether gatr and kgr pay for themselves; token counts
// are result characters / 4. A gate episode is one gate call (the gates_total set) plus
// the read-backs among the six calls after it, stopping early at an edit or another gate
// (a read-back: gatr last/errors/log at command position, a .log viewed or searched, a
// Read or Grep of a .log). gate_tok is its mean size. gate_followup_pct is the share of
// gate calls with such a read-back, or with a rerun of the same gate command anywhere
// before the next edit: each one more request that re-reads the whole context. A code
// lookup is grep/rg/Select-String (or the Grep tool, or a kgr query) at command position,
// not a `| grep` filter or a log search; its episode adds the Read / cat / sed -n views
// among the eight calls right after it, stopping at the first call that is not one.
// lookup_tok is the mean episode size and kgr_lookup_pct kgr's share of lookups. Rows
// recorded before these columns existed carry no values for them.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// $/MTok: input, output, cache read. Writes are 1.25x input (5m TTL) and 2x (1h TTL).
// Source: the claude-api skill's model table (cached 2026-10-06); checked against a
// cost Claude Code reported itself. Update when prices change.
const PRICES = {
  'claude-fable-5-1': { in: 10, out: 50, read: 0.25 },
  'claude-fable-5': { in: 10, out: 50, read: 1.0 },
  'claude-opus-5-5': { in: 4, out: 20, read: 0.2 },
  'claude-opus-5': { in: 5, out: 25, read: 0.5 },
  'claude-opus-4-8': { in: 5, out: 25, read: 0.5 },
  'claude-opus-4-7': { in: 5, out: 25, read: 0.5 },
  'claude-sonnet-5-5': { in: 2, out: 10, read: 0.2 },
  'claude-sonnet-5': { in: 2, out: 10, read: 0.2 },
  'claude-sonnet-4-6': { in: 3, out: 15, read: 0.3 },
  'claude-haiku-5-5': { in: 0.1, out: 0.5, read: 0.01, over100k: { in: 0.5, out: 2.5, read: 0.05 } },
  'claude-haiku-4-5': { in: 1, out: 5, read: 0.1 },
};
const PRICE_IDS = Object.keys(PRICES).sort((a, b) => b.length - a.length);

const COLUMNS = [
  'week', 'os', 'sessions', 'prompts', 'requests', 'cost_usd', 'usd_per_prompt',
  'requests_per_prompt', 'output_per_prompt', 'cache_hit_pct', 'subagent_cost_pct',
  'tool_calls', 'tool_error_pct', 'skill_loads', 'gates_total', 'gatr_pct',
  'kgr_calls', 'grep_calls', 'red_checks', 'review_agents', 'compactions', 'input_tok', 'cache_write_tok',
  'cache_read_tok', 'output_tok', 'unpriced_requests',
  'gate_tok', 'gate_followup_pct', 'lookup_calls', 'kgr_lookup_pct', 'lookup_tok',
];

function parseArgs(argv) {
  const a = { root: process.env.CCQ_ROOT || path.join(os.homedir(), '.claude', 'projects'), since: null, record: false, push: false, combined: false, json: false, out: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--root') a.root = argv[++i];
    else if (k === '--since') a.since = new Date(argv[++i]);
    else if (k === '--record') a.record = true;
    else if (k === '--push') a.push = a.record = true;
    else if (k === '--combined') a.combined = true;
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--json') a.json = true;
    else if (k === '-h' || k === '--help') { const l = fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n'); console.log(l.slice(1, l.findIndex((x, i) => i > 0 && !x.startsWith('//'))).join('\n').replace(/^\/\/ ?/gm, '')); process.exit(0); }
    else { console.error(`unknown argument: ${k}`); process.exit(2); }
  }
  return a;
}

function listJsonl(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listJsonl(p, out);
    else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

// ISO-8601 week of a local date, e.g. 2026-W43.
function isoWeek(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - day + 3);
  const firstThu = new Date(t.getFullYear(), 0, 4);
  const week = 1 + Math.round(((t - firstThu) / 86400000 - 3 + ((firstThu.getDay() + 6) % 7)) / 7);
  return `${t.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function cost(model, u) {
  const id = PRICE_IDS.find((k) => model.startsWith(k));
  if (!id) return null;
  let p = PRICES[id];
  const inTok = u.input_tokens || 0;
  const cw = u.cache_creation_input_tokens || 0;
  const cr = u.cache_read_input_tokens || 0;
  if (p.over100k && inTok + cw + cr > 100_000) p = { ...p, ...p.over100k };
  const w1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const w5m = u.cache_creation?.ephemeral_5m_input_tokens ?? cw - w1h;
  const fast = u.speed === 'fast' ? 2 : 1;
  return fast * (inTok * p.in + w5m * p.in * 1.25 + w1h * p.in * 2 + cr * p.read + (u.output_tokens || 0) * p.out) / 1e6;
}

// Shell interpreters whose -c / -Command argument is itself shell code.
const SHELLS = 'bash|sh|zsh|dash|ksh|pwsh|powershell';
const GATE_RE = /\b(cargo (test|clippy|build|check|nextest)|npm (run )?(test|lint|typecheck|build)|pnpm (test|lint|typecheck)|npx (tsc|vitest|jest|eslint)|tsc( |$)|pytest|go (test|vet|build)|node --test|dotnet test|make (check|test)|just (check|test))\b/;
const REVIEW_RE = /\b(review(s|er|ers|ing)?|critiques?|critics?|judges?|judging|challengers?|adversarial)\b/i;

// Shell text reduced to what runs, so a command that only mentions `gatr run` or
// `codex-seat` (an echo, a commit message, a doc) is not a run. Heredoc bodies,
// PowerShell here-strings and comments go; line continuations join. A quoted string
// becomes one word, its whitespace and separators turned to `_`: `--tag "red-x"` is
// still a tag and a quoted path with spaces is still one -d value, while a quoted
// sentence that mentions `gatr run` no longer reads as a command. Quoted text that does
// run is parsed in turn: the script of `bash -c '...'` / `pwsh -Command "..."`, and an
// unescaped "$(...)". PowerShell escapes with a backtick, the shells with a backslash.
// A heuristic over transcript text, not a shell parser.
const SHELL_TAIL = new RegExp(String.raw`(^|[\s;&|(])(\S*[\\/])?(${SHELLS})(\.exe)?(\s+-\S+)*\s+-(l?c|Command)\s+$`, 'i');
function shellCode(cmd, ps = false) {
  const esc = ps ? '`' : '\\';
  let s = cmd
    .replace(/<<-?[ \t]*(['"]?)([A-Za-z_][\w.-]*)\1([^\n]*)\n(?:[\s\S]*?\n)?[ \t]*\2[ \t]*(?=\r?\n|$)/g, ' $3')
    .replace(/@(['"])\r?\n[\s\S]*?\r?\n\1@/g, ' ')
    .replace(/\\\r?\n|`\r?\n/g, ' ');
  if (ps) s = s.replace(/<#[\s\S]*?#>/g, ' ');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '#' && (i === 0 || /\s/.test(s[i - 1]) || (/[;&|(]/.test(s[i - 1]) && s[i - 2] !== esc))) {
      while (i + 1 < s.length && s[i + 1] !== '\n') i++;
    } else if (c === "'" || c === '"') {
      let body = '';
      for (i++; i < s.length && s[i] !== c; i++) {
        if (c === '"' && s[i] === esc && i + 1 < s.length) body += s[i++];
        body += s[i];
      }
      if (SHELL_TAIL.test(out)) { out += ` ${shellCode(body, ps)} `; continue; }
      out += body.replace(/[\s;&|]+/g, '_');
      if (c === '"') {
        const sub = ps ? /(?<!`)\$\(([^()]*)\)/g : /(?<!\\)\$\(([^()]*)\)/g;
        for (const m of body.matchAll(sub)) out += ` ; ${shellCode(m[1], ps)} ; `;
      }
    } else if (c === esc && i + 1 < s.length) {
      out += c + s[++i];
    } else {
      out += c;
    }
  }
  return out;
}

// `gatr run --tag red-<name>` invocations. gatr's own options end at a bare `--`.
function redRuns(code) {
  let n = 0;
  for (const m of code.matchAll(/(^|[\s;&|(])gatr\s+run\b([^;&|\n]*)/g)) {
    if (/(^|\s)--tag(=|\s+)red-/.test(m[2].split(/\s--(?:\s|$)/)[0])) n++;
  }
  return n;
}

// `codex-seat run|start` invocations whose own -d seat directory names a review.
function reviewSeats(code) {
  let n = 0;
  for (const m of code.matchAll(/(^|[\s;&|(/])codex-seat(\.sh)?\s+(run|start)\b([^;&|\n]*)/g)) {
    if (/(^|\s)-d\s+(\S*[/\\_.-])?review/i.test(m[4])) n++;
  }
  return n;
}
// Shell text split into what runs. Redirections go first: an output target is written, not
// read, so it is dropped; an input file stays as an operand; neither swallows a separator.
// Escaped separators (\; `;) split nothing.
const clean = (code) => code.replace(/\d?>&\d|&>\s*[^\s;&|]+/g, ' ').replace(/\d*>>?\s*[^\s;&|]+/g, ' ')
  .replace(/<\s*([^\s;&|]+)/g, ' $1').replace(/[\\`][;&|]/g, '_');
// Pull each balanced $(...) (and bash `...`) out of a text: the text keeps a placeholder
// word \u0001<n>, and each body is parsed as commands of its own.
function unnest(text, ps) {
  const inner = [];
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '$' && text[i + 1] === '(') {
      let depth = 1, j = i + 2;
      for (; j < text.length && depth; j++) { if (text[j] === '(') depth++; else if (text[j] === ')') depth--; }
      inner.push(text.slice(i + 2, depth ? j : j - 1));
      out += ` \u0001${inner.length - 1} `;
      i = j - 1;
    } else if (!ps && text[i] === '`' && text.indexOf('`', i + 1) > i) {
      const j = text.indexOf('`', i + 1);
      inner.push(text.slice(i + 1, j));
      out += ` \u0001${inner.length - 1} `;
      i = j;
    } else out += text[i];
  }
  return { out, inner };
}
// Every command chain in a shell text, substitutions included: { text, pipes, subs }, where
// pipes is the chain split on single | and subs the substitution bodies its text names.
function chainsOf(code, ps = false) {
  const chains = [];
  const walk = (text) => {
    const { out, inner } = unnest(text, ps);
    for (const chain of out.split(/\|\||&&|[;&\n]/)) {
      const subs = [...chain.matchAll(/\u0001(\d+)/g)].map((m) => inner[Number(m[1])]);
      chains.push({ text: chain, pipes: chain.split('|').map((s) => s.trim()), subs });
    }
    for (const body of inner) walk(body);
  };
  walk(clean(code));
  return chains;
}
const pipelines = (code, ps = false) => chainsOf(code, ps).map((c) => c.pipes);
// A pipeline element with its leading subshell, keyword, VAR=x and `bash -c` prefixes removed.
const PREFIX = new RegExp(String.raw`^([({!]\s*|(do|then|else|elif|if|while|until|time|exec|command|xargs)\s+|[A-Za-z_]\w*=\S*\s+|(\S*[\\/])?(${SHELLS})(\.exe)?\s+(-\S+\s+)*?-(l?c|Command)\s+)+`, 'i');
const head = (seg) => seg.replace(PREFIX, '');
const LOOKUP_CMD = /^(\S*[\\/])?(grep|egrep|rg|ag|Select-String|sls|findstr)(\.exe)?(\s|$)/i;
const LIST_CMD = /^(\S*[\\/])?(Get-ChildItem|gci|dir|ls|find)(\.exe)?(\s|$)/i;
// File viewers. type and gc are Get-Content only in PowerShell; in bash, type is a builtin.
const VIEW_SH = /^(\S*[\\/])?(cat|head|tail|sed\s+-n|bat|less|more|Get-Content)(\.exe)?\s/i;
const VIEW_PS = /^(\S*[\\/])?(cat|head|tail|Get-Content|gc|type|more)(\.exe)?\s/i;
const isView = (seg, ps) => (ps ? VIEW_PS : VIEW_SH).test(seg);
const KGR_QUERY = /^(\S*[\\/])?kgr(\.exe)?\s+(refs|dead|show|impact|query|symbols|skeleton|def|graph|check|orient|hotspots|slice)\b/;
// A gatr record read (gatr last|errors|log) at command position, and a variable set from one.
const RECORD_CMD = /^(\S*[\\/])?gatr(\.exe)?\s+(last|errors|log)\b/;
const RECORD_VAR = /([A-Za-z_]\w*)=\$\(\s*(?:\S*[\\/])?gatr(?:\.exe)?\s+(?:last|errors|log)\b/g;
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
// A .log file or glob, judged by its last path segment, so a .log directory is not one.
const isLog = (f) => /\.log$/i.test(String(f).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '');

// Does this pipeline element view or search a .log file? Options are parsed first: a
// search's pattern is its -e/--regexp/-f/-Pattern value, else its first operand, and its
// files come after the pattern or from -g/--glob/--include/-Path; an option that takes a
// value (--type rust, -A 5) skips it. A viewer's operands are files, except sed's first,
// which is its program.
const PATTERN_OPT = /^(-e|--regexp|-f|--file|-Pattern)$/i;
const FILE_OPT = /^(-g|--i?glob|--include|-Path|-LiteralPath|-Include)$/i;
const VALUE_OPT = /^(-t|--type|-T|--type-not|-A|-B|-C|--context|--after-context|--before-context|-m|--max-count|-d|--max-depth|--max-filesize|-j|--threads|-M|--max-columns|--colou?rs?|--sortr?|--exclude|--exclude-dir|--encoding|-Encoding|-Context|-Exclude)$/;
function readsLog(seg, ps) {
  const [cmd = '', ...words] = seg.split(/\s+/).map((w) => w.replace(/[)"']+$/, '')).filter(Boolean);
  const view = isView(seg, ps), sed = /(^|[\\/])sed(\.exe)?$/i.test(cmd);
  if (!view && !LOOKUP_CMD.test(seg)) return false;
  const files = [], operands = [];
  let pattern = false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i], eq = w.startsWith('--') ? w.indexOf('=') : -1;
    const name = eq > 0 ? w.slice(0, eq) : w, inline = eq > 0 ? w.slice(eq + 1) : null;
    if (sed ? /^(-e|-f|--expression|--file)$/.test(name) : !view && PATTERN_OPT.test(name)) { pattern = true; if (inline === null) i++; }
    else if (!view && /^-e./.test(w)) pattern = true;
    else if (!view && FILE_OPT.test(name)) { const v = inline ?? words[++i]; if (v) files.push(v); }
    else if ((view ? (sed ? /^$/ : /^(-n|-c|--lines|--bytes)$/) : VALUE_OPT).test(name)) { if (inline === null) i++; }
    else if (!w.startsWith('-')) operands.push(w);
  }
  const named = view && !sed ? operands : operands.slice(pattern ? 0 : 1);
  return [...files, ...named].some(isLog);
}

// The gate command a call runs, normalized so a rerun under a different tag, tail, quoting
// or redirect still compares equal: the command after gatr's `--`, else the gate element.
// Read from the raw command: a `bash -c '...'` runs its body; a quoted argument loses its
// quotes, and one holding spaces or separators is kept whole (URI-encoded), so
// "unit or slow" stays one argument; comments and continuations go.
const SHELL_C = new RegExp(String.raw`(\S*[\\/])?(${SHELLS})(\.exe)?((?:\s+-\S+)*?)\s+-(l?c|Command)\s+(?:'([^']*)'|"((?:[^"\\]|\\.)*)")`, 'gi');
function gateKey(cmd) {
  const c = cmd.replace(/\\\r?\n/g, ' ').replace(SHELL_C, (...m) => ` ${m[6] ?? m[7]} `)
    .replace(/'([^']*)'|"((?:[^"\\]|\\.)*)"/g, (q, a, b) => { const v = a ?? b; return v === '' || /[\s;&|<>()`$#]/.test(v) ? encodeURIComponent(v) : v; })
    .replace(/(^|\s)#[^\n]*/g, ' ')
    .replace(/\d*>>?&?\s*[^\s;&|]+|&>\s*[^\s;&|]+|<\s*[^\s;&|]+/g, ' ');
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const g = c.match(/(^|[\s;&|(])gatr\s+run\b[^;&|\n]*?\s--\s+([^;&|\n]*)/);
  if (g) return norm(g[2]);
  for (const p of pipelines(c)) if (GATE_RE.test(head(p[0]))) return norm(head(p[0]));
  return null;
}

// What one tool call is to the tool-economics columns.
function classify(name, input, code, ps) {
  if (name === 'Grep') return isLog(String(input.path || '')) || isLog(String(input.glob || '')) ? { readBack: true } : { lookup: true };
  if (name === 'Read') return { readBack: isLog(String(input.file_path || '')), view: true };
  if (code === null) return {};
  // A chain that reads a gatr record (piped from one, fed one by $(...), or through a
  // variable set from one) searches the log it names, not the code.
  const vars = [...code.matchAll(RECORD_VAR)].map((m) => m[1]);
  const fromRecord = (chain) => RECORD_CMD.test(head(chain.pipes[0]))
    || chain.subs.some((b) => RECORD_CMD.test(head(b.trim())))
    || vars.some((v) => new RegExp(`\\$\\{?${v}\\b`).test(chain.text));
  let readBack = false, lookup = false, kgr = false, view = false;
  for (const chain of chainsOf(code, ps)) {
    const p = chain.pipes, first = head(p[0]);
    if (RECORD_CMD.test(first)) { readBack = true; continue; }
    if (p.some((s) => readsLog(head(s), ps))) { readBack = true; if (isView(first, ps)) view = true; continue; }
    if (KGR_QUERY.test(first)) kgr = true;
    else if (LOOKUP_CMD.test(first) || (LIST_CMD.test(first) && p.slice(1).some((s) => LOOKUP_CMD.test(head(s))))) { if (fromRecord(chain)) readBack = true; else lookup = true; }
    else if (isView(first, ps)) { view = true; if (fromRecord(chain)) readBack = true; }
  }
  return { readBack, lookup: lookup || kgr, kgr, view: view && !lookup && !kgr };
}

// Fold one transcript's ordered calls into gate and lookup episodes on their weeks.
function tally(seq, resChars) {
  const size = (it) => resChars.get(it.id) || 0;
  seq.forEach((it, k) => {
    if (it.gate) {
      // Read-backs in the six calls after the gate, up to the next edit or gate, add tokens.
      let chars = size(it), follow = false;
      for (let j = k + 1; j < seq.length && j <= k + 6; j++) {
        const n = seq[j];
        if (EDIT_TOOLS.has(n.name) || n.gate) break;
        if (n.readBack) { chars += size(n); follow = true; }
      }
      // A rerun of the same gate command before the next edit, however far, is a follow-up.
      for (let j = k + 1; !follow && it.key && j < seq.length && !EDIT_TOOLS.has(seq[j].name); j++) {
        if (seq[j].gate && seq[j].key === it.key) follow = true;
      }
      it.w.gateChars += chars;
      if (follow) it.w.gateFollow++;
    }
    if (it.lookup) {
      let chars = size(it);
      for (let j = k + 1; j < seq.length && j <= k + 8 && seq[j].view; j++) chars += size(seq[j]);
      it.w.lookups++; it.w.lookupChars += chars;
      if (it.kgr) it.w.kgrLookups++;
    }
  });
}

const resultChars = (c) => (typeof c === 'string' ? c.length
  : Array.isArray(c) ? c.reduce((n, b) => n + (b?.type === 'text' ? String(b.text || '').length : 0), 0) : 0);

const NOT_HUMAN = /^(<|Another Claude session|\[Request interrupted|Caveat:|This session is being continued)/;

function humanText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  if (content.some((b) => b?.type === 'tool_result')) return null;
  const t = content.filter((b) => b?.type === 'text').map((b) => b.text).join('\n');
  return t || null;
}

function newWeek() {
  return { sessions: new Set(), prompts: 0, requests: 0, cost: 0, subCost: 0, out: 0, inTok: 0, cw: 0, cr: 0,
    toolCalls: 0, toolErrors: 0, skills: 0, gates: 0, gatr: 0, kgr: 0, grep: 0, red: 0, review: 0, compactions: 0, unpriced: 0,
    gateChars: 0, gateFollow: 0, lookups: 0, kgrLookups: 0, lookupChars: 0 };
}

function collect(files, since) {
  const weeks = new Map();
  const seenMsg = new Set();
  const seenTool = new Set();
  const unknownModels = new Set();
  for (const file of files) {
    const sub = /[\\/]subagents[\\/]|[\\/]agent-[^\\/]*\.jsonl$/.test(file);
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const seq = [];
    const resChars = new Map();
    for (const line of text.split('\n')) {
      if (!line || (!line.includes('"assistant"') && !line.includes('"user"'))) continue;
      let o;
      try { o = JSON.parse(line); } catch { continue; }
      if (!o.timestamp) continue;
      const ts = new Date(o.timestamp);
      if (since && ts < since) continue;
      const wk = isoWeek(ts);
      if (!weeks.has(wk)) weeks.set(wk, newWeek());
      const w = weeks.get(wk);
      const msg = o.message || {};
      if (o.type === 'assistant') {
        const id = msg.id || o.requestId;
        const u = msg.usage;
        if (u && msg.model && msg.model !== '<synthetic>' && id && !seenMsg.has(id)) {
          seenMsg.add(id);
          w.requests++;
          w.inTok += u.input_tokens || 0; w.cw += u.cache_creation_input_tokens || 0;
          w.cr += u.cache_read_input_tokens || 0; w.out += u.output_tokens || 0;
          const c = cost(msg.model, u);
          if (c === null) { w.unpriced++; unknownModels.add(msg.model); }
          else { w.cost += c; if (sub || o.isSidechain) w.subCost += c; }
        }
        for (const b of Array.isArray(msg.content) ? msg.content : []) {
          if (b?.type !== 'tool_use' || seenTool.has(b.id)) continue;
          seenTool.add(b.id);
          w.toolCalls++;
          const inp = b.input || {};
          if (b.name === 'Skill') w.skills++;
          if (b.name === 'Grep') w.grep++;
          if ((b.name === 'Agent' || b.name === 'Task') && REVIEW_RE.test(String(inp.description || ''))) w.review++;
          let code = null, gate = false;
          if (b.name === 'Bash' || b.name === 'PowerShell') {
            const cmd = String(inp.command || '');
            if (/(^|[\s;&|(])gatr\s+run\b/.test(cmd)) { w.gates++; w.gatr++; gate = true; }
            else if (GATE_RE.test(cmd)) { w.gates++; gate = true; }
            if (/(^|[\s;&|(])kgr\s+[a-z]/.test(cmd)) w.kgr++;
            if (/(^|[\s;&|(])(grep|rg)\s/.test(cmd)) w.grep++;
            code = shellCode(cmd, b.name === 'PowerShell');
            w.red += redRuns(code);
            // Inside a subagent this is a codex-seat wrapper's run; the parent's Agent call counted it.
            if (!sub && !o.isSidechain) w.review += reviewSeats(code);
          }
          seq.push({ id: b.id, name: b.name, w, gate, key: gate ? gateKey(String(inp.command || '')) : null, ...classify(b.name, inp, code, b.name === 'PowerShell') });
        }
      } else if (o.type === 'user') {
        if (Array.isArray(msg.content)) {
          for (const b of msg.content) {
            if (b?.type !== 'tool_result') continue;
            if (b.is_error) w.toolErrors++;
            resChars.set(b.tool_use_id, resultChars(b.content));
          }
        }
        if (o.isCompactSummary) { w.compactions++; continue; }
        if (sub || o.isSidechain || o.isMeta) continue;
        const t = humanText(msg.content);
        if (t && !NOT_HUMAN.test(t.trimStart())) { w.prompts++; if (o.sessionId) w.sessions.add(o.sessionId); }
      }
    }
    tally(seq, resChars);
  }
  return { weeks, unknownModels };
}

const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
const per = (a, b, d = 2) => (b ? Number((a / b).toFixed(d)) : 0);

function toRows(weeks, osName) {
  return [...weeks.keys()].sort().map((wk) => derive(wk, osName, { ...weeks.get(wk), sessions: weeks.get(wk).sessions.size }));
}

// One output row from a week's raw counts (sessions already a number).
function derive(wk, osName, w) {
    const inputSide = w.inTok + w.cw + w.cr;
    return {
      week: wk, os: osName, sessions: w.sessions, prompts: w.prompts, requests: w.requests,
      cost_usd: Number(w.cost.toFixed(2)), usd_per_prompt: per(w.cost, w.prompts),
      requests_per_prompt: per(w.requests, w.prompts, 1), output_per_prompt: Math.round(per(w.out, w.prompts, 0)),
      cache_hit_pct: pct(w.cr, inputSide), subagent_cost_pct: pct(w.subCost, w.cost),
      tool_calls: w.toolCalls, tool_error_pct: pct(w.toolErrors, w.toolCalls), skill_loads: w.skills,
      gates_total: w.gates, gatr_pct: pct(w.gatr, w.gates), kgr_calls: w.kgr, grep_calls: w.grep,
      red_checks: w.red, review_agents: w.review, compactions: w.compactions, input_tok: w.inTok, cache_write_tok: w.cw, cache_read_tok: w.cr,
      output_tok: w.out, unpriced_requests: w.unpriced,
      gate_tok: w.gates ? Math.round(w.gateChars / 4 / w.gates) : 0, gate_followup_pct: pct(w.gateFollow, w.gates),
      lookup_calls: w.lookups, kgr_lookup_pct: pct(w.kgrLookups, w.lookups),
      lookup_tok: w.lookups ? Math.round(w.lookupChars / 4 / w.lookups) : 0,
    };
}

function readTsv(file) {
  if (!fs.existsSync(file)) return [];
  const [head, ...lines] = fs.readFileSync(file, 'utf8').trim().split('\n');
  const cols = head.split('\t');
  return lines.filter(Boolean).map((l) => {
    const v = l.split('\t');
    return Object.fromEntries(cols.map((c, i) => [c, v[i]]));
  });
}

// Every machine's recorded rows, summed per week. Shares are re-weighted from the
// recorded percentages, so the combined figures match a scan of all machines at once.
function combine(dir) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^sessions-.+\.tsv$/.test(f)) : [];
  const by = new Map();
  for (const f of files) {
    for (const r of readTsv(path.join(dir, f))) {
      const n = (c) => Number(r[c]) || 0;
      const w = by.get(r.week) || { ...newWeek(), sessions: 0, machines: new Set() };
      w.machines.add(r.os);
      w.sessions += n('sessions'); w.prompts += n('prompts'); w.requests += n('requests');
      w.cost += n('cost_usd'); w.subCost += (n('cost_usd') * n('subagent_cost_pct')) / 100;
      w.out += n('output_tok'); w.inTok += n('input_tok'); w.cw += n('cache_write_tok'); w.cr += n('cache_read_tok');
      w.toolCalls += n('tool_calls'); w.toolErrors += Math.round((n('tool_calls') * n('tool_error_pct')) / 100);
      w.skills += n('skill_loads'); w.gates += n('gates_total'); w.gatr += Math.round((n('gates_total') * n('gatr_pct')) / 100);
      w.kgr += n('kgr_calls'); w.grep += n('grep_calls');
      w.red += n('red_checks'); w.review += n('review_agents'); w.compactions += n('compactions'); w.unpriced += n('unpriced_requests');
      w.gateChars += n('gate_tok') * 4 * n('gates_total'); w.gateFollow += Math.round((n('gates_total') * n('gate_followup_pct')) / 100);
      w.lookups += n('lookup_calls'); w.kgrLookups += Math.round((n('lookup_calls') * n('kgr_lookup_pct')) / 100);
      w.lookupChars += n('lookup_tok') * 4 * n('lookup_calls');
      by.set(r.week, w);
    }
  }
  return [...by.keys()].sort().map((wk) => derive(wk, [...by.get(wk).machines].sort().join('+'), by.get(wk)));
}

// The private claude-metrics clone beside this skills checkout, else ~/.claude/metrics.
function recordDir(out) {
  if (out) return path.dirname(path.resolve(out));
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const sibling = path.join(path.dirname(repo), 'claude-metrics');
  return fs.existsSync(path.join(sibling, '.git')) ? sibling : path.join(os.homedir(), '.claude', 'metrics');
}

// Commit the row file and push it. A failure (off the LAN, say) leaves the commit local;
// the next --push sends it.
function push(dir, file, label) {
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (!fs.existsSync(path.join(dir, '.git'))) return console.error(`--push: ${dir} is not a git clone; recorded locally only`);
  const name = path.basename(file);
  try {
    git('add', '--', name);
    if (git('diff', '--cached', '--name-only', '--', name).trim()) git('commit', '-q', '-m', `chore(metrics): record ${label}`, '--', name);
    git('pull', '-q', '--rebase');
    git('push', '-q');
    console.error(`--push: ${name} is on the remote`);
  } catch (e) {
    console.error(`--push failed, commit kept locally: ${String(e.stderr || e.message).trim().split('\n').pop()}`);
  }
}

function record(rows, file) {
  const keep = new Map();
  for (const r of readTsv(file)) keep.set(`${r.week}\t${r.os}`, r);
  let changed = 0;
  for (const r of rows) {
    const k = `${r.week}\t${r.os}`;
    const old = keep.get(k);
    if (old && Number(old.requests) > r.requests) continue; // a recount of a half-deleted week
    keep.set(k, r); changed++;
  }
  const out = [COLUMNS.join('\t'), ...[...keep.keys()].sort().map((k) => COLUMNS.map((c) => keep.get(k)[c] ?? '').join('\t'))];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out.join('\n') + '\n');
  return changed;
}

function printTable(rows, withOs = false) {
  const show = ['week', 'sessions', 'prompts', 'cost_usd', 'usd_per_prompt', 'requests_per_prompt', 'cache_hit_pct',
    'subagent_cost_pct', 'tool_error_pct', 'skill_loads', 'gates_total', 'gatr_pct', 'kgr_calls', 'grep_calls', 'red_checks', 'review_agents', 'compactions',
    'gate_tok', 'gate_followup_pct', 'lookup_calls', 'kgr_lookup_pct', 'lookup_tok'];
  const titles = ['week', 'sess', 'prompts', '$', '$/prompt', 'req/prompt', 'cache%', 'subagent$%', 'toolerr%', 'skills', 'gates', 'gatr%', 'kgr', 'grep', 'red', 'review', 'compact',
    'gate_tok', 'followup%', 'lookups', 'kgr%', 'lookup_tok'];
  if (withOs) { show.splice(1, 0, 'os'); titles.splice(1, 0, 'machines'); }
  const cells = [titles, ...rows.map((r) => show.map((c) => String(r[c] ?? '')))];
  const width = titles.map((_, i) => Math.max(...cells.map((row) => row[i].length)));
  for (const row of cells) console.log(row.map((c, i) => (i ? c.padStart(width[i]) : c.padEnd(width[i]))).join('  '));
}

const args = parseArgs(process.argv.slice(2));
const osName = { win32: 'windows', darwin: 'mac', linux: 'linux' }[process.platform] || process.platform;
const dir = recordDir(args.out);
const showCombined = () => {
  const all = combine(dir);
  if (args.json) console.log(JSON.stringify(all, null, 2));
  else if (all.length) printTable(all, true);
  else console.error(`nothing recorded yet in ${dir}`);
};
if (args.combined && !args.record) {
  showCombined();
} else {
  const { weeks, unknownModels } = collect(listJsonl(args.root), args.since);
  const rows = toRows(weeks, osName);
  if (args.json) console.log(JSON.stringify(rows, null, 2));
  else printTable(rows);
  if (unknownModels.size) console.error(`no price for: ${[...unknownModels].join(', ')} (their requests are counted, not costed)`);
  if (args.record) {
    const file = args.out || path.join(dir, `sessions-${osName}.tsv`);
    console.error(`recorded ${record(rows, file)} week row(s) in ${file}`);
    if (args.push) push(path.dirname(path.resolve(file)), file, `${osName} through ${rows.at(-1)?.week ?? 'no weeks'}`);
  }
  if (args.combined) { console.log('\nevery machine:'); showCombined(); }
}
