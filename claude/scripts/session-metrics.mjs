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
  'kgr_calls', 'grep_calls', 'compactions', 'input_tok', 'cache_write_tok',
  'cache_read_tok', 'output_tok', 'unpriced_requests',
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

const GATE_RE = /\b(cargo (test|clippy|build|check|nextest)|npm (run )?(test|lint|typecheck|build)|pnpm (test|lint|typecheck)|npx (tsc|vitest|jest|eslint)|tsc( |$)|pytest|go (test|vet|build)|node --test|dotnet test|make (check|test)|just (check|test))\b/;
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
    toolCalls: 0, toolErrors: 0, skills: 0, gates: 0, gatr: 0, kgr: 0, grep: 0, compactions: 0, unpriced: 0 };
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
          if (b.name === 'Bash' || b.name === 'PowerShell') {
            const cmd = String(inp.command || '');
            if (/(^|[\s;&|(])gatr\s+run\b/.test(cmd)) { w.gates++; w.gatr++; }
            else if (GATE_RE.test(cmd)) w.gates++;
            if (/(^|[\s;&|(])kgr\s+[a-z]/.test(cmd)) w.kgr++;
            if (/(^|[\s;&|(])(grep|rg)\s/.test(cmd)) w.grep++;
          }
        }
      } else if (o.type === 'user') {
        if (Array.isArray(msg.content)) {
          for (const b of msg.content) if (b?.type === 'tool_result' && b.is_error) w.toolErrors++;
        }
        if (o.isCompactSummary) { w.compactions++; continue; }
        if (sub || o.isSidechain || o.isMeta) continue;
        const t = humanText(msg.content);
        if (t && !NOT_HUMAN.test(t.trimStart())) { w.prompts++; if (o.sessionId) w.sessions.add(o.sessionId); }
      }
    }
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
      compactions: w.compactions, input_tok: w.inTok, cache_write_tok: w.cw, cache_read_tok: w.cr,
      output_tok: w.out, unpriced_requests: w.unpriced,
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
      w.kgr += n('kgr_calls'); w.grep += n('grep_calls'); w.compactions += n('compactions'); w.unpriced += n('unpriced_requests');
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
    'subagent_cost_pct', 'tool_error_pct', 'skill_loads', 'gates_total', 'gatr_pct', 'kgr_calls', 'grep_calls', 'compactions'];
  const head = ['week', 'sess', 'prompts', '$', '$/prompt', 'req/prompt', 'cache%', 'subagent$%', 'toolerr%', 'skills', 'gates', 'gatr%', 'kgr', 'grep', 'compact'];
  if (withOs) { show.splice(1, 0, 'os'); head.splice(1, 0, 'machines'); }
  const cells = [head, ...rows.map((r) => show.map((c) => String(r[c])))];
  const width = head.map((_, i) => Math.max(...cells.map((row) => row[i].length)));
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
