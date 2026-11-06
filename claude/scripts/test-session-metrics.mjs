#!/usr/bin/env node
// test-session-metrics.mjs — checks the red_checks and review_agents counters and the
// tool-economics columns (gate_tok, gate_followup_pct, lookup_calls, kgr_lookup_pct,
// lookup_tok) in session-metrics.mjs against synthetic transcripts, through a scan and
// through a --record / --combined round trip. Each case sits in its own ISO week, so
// every case is checked on its own and an overcount in one cannot hide an undercount in
// another.
//   node claude/scripts/test-session-metrics.mjs

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'session-metrics.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'session-metrics-test-'));
const root = path.join(tmp, 'projects', 'demo');

const bash = (command) => ['Bash', { command }];
const agent = (description, name = 'Agent') => [name, { description, prompt: 'x' }];
const seat = (verb, dir) => `bash ~/.claude/skills/codex-seat/scripts/codex-seat.sh ${verb} -d wave/seats/${dir} -m m -e high -s read-only`;

// [label, tool call, red_checks, review_agents, transcript]
const cases = [
  ['red run', bash('gatr run --tag red-retry -- npm test'), 1, 0],
  ['red run, = form, after &&', bash('cd app && gatr run --tag=red-parse -- pytest -k parse'), 1, 0],
  ['red run, two spaces before the tag', bash('gatr run --tag  red-two -- npm test'), 1, 0],
  ['red run, quoted tag', bash('gatr run --tag "red-quoted" -- npm test'), 1, 0],
  ['two red runs in one command', bash('gatr run --tag red-a -- npm test; gatr run --tag red-b -- npm test'), 2, 0],
  ['ordinary gate', bash('gatr run --tag unit -- npm test'), 0, 0],
  ['red- after gatr\'s own --', bash('gatr run --tag unit -- echo --tag red-demo'), 0, 0],
  ['mention inside quotes', bash('echo "Try gatr run --tag red-demo"'), 0, 0],
  ['mention in a heredoc', bash("git commit -F - <<'EOF'\nDocument gatr run --tag red-demo\nEOF"), 0, 0],
  ['mention in a comment', bash('# gatr run --tag red-comment'), 0, 0],
  ['mention in a multi-line single-quoted string', bash("printf '%s\\n' 'Example:\ngatr run --tag red-demo\n'"), 0, 0],
  ['mention in a multi-line commit -m', bash('git commit -m "feat: x\n\nRun gatr run --tag red-<name> first."'), 0, 0],
  ['mention in a heredoc with a dashed delimiter', bash("cat <<'DOC-TEXT'\ngatr run --tag red-demo\nDOC-TEXT"), 0, 0],
  ['mention in a PowerShell here-string with an apostrophe', ['PowerShell', { command: "git commit -F - @'\nfeat: don't skip it\n\ngatr run --tag red-demo\n'@" }], 0, 0],
  ['red run inside "$(...)"', bash('echo "$(gatr run --tag red-sub -- npm test)"'), 1, 0],
  ['red run across a \\ continuation', bash('gatr run \\\n  --tag red-cont -- npm test'), 1, 0],
  ['red run across a PowerShell ` continuation', ['PowerShell', { command: 'gatr run `\n  --tag red-ps -- npm test' }], 1, 0],
  ['apostrophe in a comment, then a red run', bash("# don't skip this\ngatr run --tag red-after -- npm test\necho 'done'"), 1, 0],
  ['# inside quotes is not a comment', bash('gatr run --tag red-hash -- npm test -- --grep "issue #12"'), 1, 0],
  ['red run inside bash -lc', bash("bash -lc 'gatr run --tag red-lc -- npm test'"), 1, 0],
  ['quoted | before the tag', bash('gatr run --filter "Deprecation|Experimental" --tag red-filter -- npm test'), 1, 0],
  ['escaped \\$( in a commit message', bash('git commit -m "docs: \\$(gatr run --tag red-example -- npm test)"'), 0, 0],
  ['quoted mention inside "$(...)"', bash("git commit -m \"$(printf '%s\\n' 'docs: gatr run --tag red-example')\""), 0, 0],
  ['commit message via "$(cat <<EOF)"', bash("git commit -m \"$(cat <<'EOF'\nfeat: x\n\nRun gatr run --tag red-<name> first.\nEOF\n)\""), 0, 0],
  ['PowerShell `" inside a string', ['PowerShell', { command: 'git commit -m "docs: `" gatr run --tag red-example `" is an example"' }], 0, 0],
  ['PowerShell block comment', ['PowerShell', { command: '<#\ngatr run --tag red-example -- npm test\n#>' }], 0, 0],
  ['bash `...` inside quotes is not an escape', bash('echo "`date`"; gatr run --tag red-bt -- npm test'), 1, 0],
  ['an escaped ; before # is not a comment', bash('echo \\;#; gatr run --tag red-x -- npm test'), 1, 0],
  ['review agent', agent('review: retry backoff'), 0, 1],
  ['critique, older Task tool name', agent('Adversarial critique of the plan', 'Task'), 0, 1],
  ['codex-seat wrapper agent', agent('gpt-6.1-sol:review-12'), 0, 1],
  ['explore agent', agent('Explore the parser'), 0, 0],
  ['"preview" is not "review"', agent('Preview the cut'), 0, 0],
  ['"critical" is not "critic"', agent('Implement critical-path scheduler'), 0, 0],
  ['review seat, run', bash(seat('run', 'review-13')), 0, 1],
  ['review seat, start (detached)', bash(seat('start', 'review-14')), 0, 1],
  ['two review seats in one command', bash(`${seat('run', 'review-a')}; ${seat('start', 'review-b')}`), 0, 2],
  ['wait on a review seat, start a build seat', bash(`${seat('wait', 'review-old')}; ${seat('start', 'build-new')}`), 0, 0],
  ['builder seat', bash(seat('run', 'build-15')), 0, 0],
  ['"preview" seat directory', bash(seat('run', 'preview-a')), 0, 0],
  ['quoted seat directory', bash("bash codex-seat.sh run -d 'C:/tmp/seats/review-q' -m m -e high"), 0, 1],
  ['quoted seat directory with a space', bash('bash codex-seat.sh run -d "C:/My Project/seats/review-1" -m m -e high'), 0, 1],
  // A wrapper's own transcript: its codex-seat run is the seat the wrapper's Agent call
  // already counted, so it must not count again.
  ['codex-seat run inside a wrapper', bash(seat('run', 'review-12')), 0, 0, path.join('s1', 'subagents', 'agent-w.jsonl')],
];

const lines = new Map();
cases.forEach(([, [name, input], , , file = 'session.jsonl'], i) => {
  const day = new Date(Date.UTC(2026, 0, 7) + i * 7 * 86400000).toISOString().slice(0, 10); // Wednesdays
  const line = JSON.stringify({
    type: 'assistant', timestamp: `${day}T12:00:00Z`, sessionId: 's1',
    message: { id: `m${i}`, model: 'claude-opus-5-5', usage: { input_tokens: 1, output_tokens: 1 },
      content: [{ type: 'tool_use', id: `t${i}`, name, input }] },
  });
  lines.set(file, [...(lines.get(file) || []), line]);
});
for (const [file, ls] of lines) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), ls.join('\n') + '\n');
}

const run = (...args) => JSON.parse(execFileSync(process.execPath, [script, '--root', path.join(tmp, 'projects'), '--json', ...args],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));

function check(rows, how) {
  assert.equal(rows.length, cases.length, `${how}: one week row per case`);
  const wrong = cases.flatMap(([label, , red, review], i) => {
    const r = rows[i];
    return r.red_checks === red && r.review_agents === review ? []
      : [`  ${label}: red_checks ${r.red_checks} (want ${red}), review_agents ${r.review_agents} (want ${review})`];
  });
  assert.equal(wrong.length, 0, `${how}:\n${wrong.join('\n')}`);
}

// Tool-economics columns. Each case is a short call sequence with result sizes, in its own
// ISO week under its own root. A call is [tool, input, result chars].
const seqRoot = path.join(tmp, 'seq-projects', 'demo');
const sh = (command, chars = 0) => ['Bash', { command }, chars];
const ps = (command, chars = 0) => ['PowerShell', { command }, chars];
const read = (file_path, chars) => ['Read', { file_path }, chars];
const edit = () => ['Edit', { file_path: 'src/a.rs', old_string: 'a', new_string: 'b' }, 20];
const grepTool = (pattern, chars) => ['Grep', { pattern }, chars];
const G = (gates, tok, follow) => ({ gates_total: gates, gate_tok: tok, gate_followup_pct: follow });
const K = (lookups, kgrPct, tok) => ({ lookup_calls: lookups, kgr_lookup_pct: kgrPct, lookup_tok: tok });

const seqCases = [
  ['gatr run, then an edit', [sh('gatr run --tag unit -- cargo test', 400), edit()], { ...G(1, 100, 0), ...K(0, 0, 0) }],
  ['gatr run, then gatr last and gatr errors', [sh('gatr run --tag unit -- cargo test', 400), sh('gatr last', 200), sh('gatr errors', 400)], G(1, 250, 100)],
  ['log path pulled out of gatr last and grepped', [sh('gatr run --tag unit -- cargo test', 400), sh("L=$(gatr last | grep -o 'log=[^ ]*' | cut -d= -f2); grep -n FAILED \"$L\"", 400)], G(1, 200, 100)],
  ['Read of the gatr log', [sh('gatr run --tag unit -- cargo test', 400), read('C:/Users/x/.local/state/gatr/p-1/2026-11-01T10-00-00_unit.log', 800)], G(1, 300, 100)],
  ['an edit ends the episode', [sh('gatr run --tag unit -- cargo test', 400), edit(), sh('gatr last', 200)], G(1, 100, 0)],
  ['raw gate rerun with a longer tail', [sh('cargo test 2>&1 | tail -40', 800), sh('cargo test 2>&1 | tail -200', 4000)], G(2, 600, 50)],
  ['different crates are not a rerun', [sh('cargo test -p a', 400), sh('cargo test -p b', 400)], G(2, 100, 0)],
  ['same gate rerun under another gatr tag', [sh('gatr run --tag a -- cargo test 2>&1 | tail -5', 200), sh('gatr run --tag b -- cargo test', 400)], G(2, 75, 50)],
  ['grep lookup, then two reads', [sh('rg -n parse src', 400), read('src/a.rs', 4000), read('src/b.rs', 4000), edit()], { ...K(1, 0, 2100), ...G(0, 0, 0) }],
  ['Grep tool, then a cat', [grepTool('parse', 400), sh('cat src/a.rs', 800)], K(1, 0, 300)],
  ['kgr refs', [sh('kgr refs parse', 800), edit()], K(1, 100, 200)],
  ['kgr show and an rg lookup', [sh('kgr show parse', 400), sh('rg -n parse', 400)], K(2, 50, 100)],
  ['a lookup chain stops at the next lookup', [sh('rg -n parse', 400), read('src/a.rs', 800), sh('grep -rn parse .', 400), read('src/b.rs', 800)], K(2, 0, 300)],
  ['kgr --help and | grep filters are not lookups', [sh('kgr --help', 400), sh('cargo build 2>&1 | grep warning', 400)], { ...K(0, 0, 0), ...G(1, 100, 0) }],
  ['mentions are not lookups', [sh('echo "rg parse src"', 100), sh('git commit -m "use grep -rn to find it"', 100)], K(0, 0, 0)],
  ['Select-String after Get-ChildItem is a lookup', [ps('Get-ChildItem -Recurse src | Select-String -Pattern parse', 400)], K(1, 0, 100)],
  // From the 2026-11-06 adversarial review; each failed before its fix.
  ['a rerun with a different log redirect', [sh('cargo test > first.log', 400), sh('cargo test > second.log', 400), edit()], G(2, 100, 50)],
  ['a lookup and a gate in one call', [sh('rg -n parse src; npm test', 400)], K(1, 0, 100)],
  ['a lookup whose pattern names a gate', [sh("rg -n 'cargo test' src", 400)], K(1, 0, 100)],
  ['.log inside a grep pattern is not a log read', [sh('cargo test', 400), sh("rg -n 'error.log' src", 800), edit()], { ...G(1, 100, 0), ...K(1, 0, 200) }],
  ['Grep tool on a gatr log is not a lookup', [['Grep', { pattern: 'FAILED', path: '/home/me/.local/state/gatr/unit.log' }, 400]], K(0, 0, 0)],
  ['a Read of a .log still follows a lookup', [sh('rg -n parse src', 400), read('fixtures/example.log', 800)], K(1, 0, 300)],
  ['rg after if', [sh('if rg -q parse src; then echo yes; fi', 400)], K(1, 0, 100)],
  ['rg inside bash -lc', [sh("bash -lc 'rg -n parse src'", 400)], K(1, 0, 100)],
  ['rg inside $(...)', [sh('echo $(rg -n parse src)', 400)], K(1, 0, 100)],
  ['an escaped \\; does not split the command', [sh('echo \\; rg parse src', 100)], K(0, 0, 0)],
  ['quoted gate arguments keep their meaning', [sh('pytest -k "unit or slow"', 400), sh('pytest -k unit_or_slow', 400), edit()], G(2, 100, 0)],
  // Round 2 of the review.
  ['an -e pattern is not a file', [sh('cargo test', 400), sh('rg -e "error.log" src', 800), edit()], { ...G(1, 100, 0), ...K(1, 0, 200) }],
  ['--regexp= leaves the log as the file', [sh('rg --regexp=FAILED unit.log', 400)], K(0, 0, 0)],
  ['a gatr last elsewhere in the call keeps a code lookup', [sh('rg parse src; gatr last', 400)], K(1, 0, 100)],
  ['a rerun after another gate, before an edit', [sh('cargo test', 400), sh('cargo check', 400), sh('cargo test', 400), edit()], G(3, 100, 33.3)],
  ['a rerun past the read-back window, before an edit', [sh('cargo test', 400), ...Array.from({ length: 6 }, () => sh('pwd', 0)), sh('cargo test', 400), edit()], G(2, 100, 50)],
  ['quote style does not change the gate', [sh("cargo test -p 'a'", 400), sh('cargo test -p "a"', 400), edit()], G(2, 100, 50)],
  ['echo gatr last is not a read-back', [sh('cargo test', 400), sh('echo gatr last', 100), edit()], G(1, 100, 0)],
  ['a path-prefixed gatr last is a read-back', [sh('cargo test', 400), sh('/home/u/bin/gatr last', 200), edit()], G(1, 150, 100)],
  ['a comment right after ; hides the rest of the line', [sh('echo ok;# comment; rg parse src', 100)], K(0, 0, 0)],
  ['python -c is not shell code', [sh('python -c "x = 0; rg = 1"', 100)], K(0, 0, 0)],
  ['an output redirect target is not a log read', [sh('cargo test', 400), sh('cat /dev/null > unit.log', 0), edit()], G(1, 100, 0)],
  ['a *.log.rs glob is source, not a log', [['Grep', { pattern: 'parse', glob: '*.log.rs' }, 400]], K(1, 0, 100)],
  // Round 3 of the review.
  ['a redirect target does not swallow the next ;', [sh('echo ok >out; rg parse src', 400)], K(1, 0, 100)],
  ['an option value is not the pattern', [sh('cargo test', 400), sh('rg --type rust error.log src', 800), edit()], { ...G(1, 100, 0), ...K(1, 0, 200) }],
  ['a sed program is not a file', [sh('cargo test', 400), sh("sed -n '/error.log/p' src/a.rs", 800), edit()], G(1, 100, 0)],
  ['--include=*.log searches logs', [sh("grep -r -e FAILED --include='*.log' .", 400)], K(0, 0, 0)],
  ['bash -lc reruns are the same gate', [sh('bash -lc "cargo test"', 400), sh('bash -lc "cargo test"', 400), edit()], G(2, 100, 50)],
  ['a quoted test name is the same argument', [sh('cargo test "parser::tests::parse"', 400), sh('cargo test parser::tests::parse', 400), edit()], G(2, 100, 50)],
  ['bash type is not a file view', [sh('rg parse src', 400), sh('type cat', 400), read('src/a.rs', 800)], K(1, 0, 100)],
  ['a pipe after $(...) filters the outer command', [sh('cat $(find src -type f) | grep parse', 400)], K(0, 0, 0)],
  ['a .log directory does not make a log', [sh('cargo test', 400), read('/tmp/debug.log/src/a.rs', 800), edit()], G(1, 100, 0)],
  ['rg inside dash -c', [sh('dash -c "rg parse src"', 400)], K(1, 0, 100)],
];

fs.mkdirSync(seqRoot, { recursive: true });
seqCases.forEach(([, calls], i) => {
  // One transcript per case: a scan that runs to the next edit must not reach the next case.
  const seqLines = [];
  const day = new Date(Date.UTC(2027, 0, 6) + i * 7 * 86400000).toISOString().slice(0, 10);
  calls.forEach(([name, input, chars], j) => {
    const ts = `${day}T12:00:${String(j).padStart(2, '0')}Z`;
    const id = `q${i}-${j}`;
    seqLines.push(JSON.stringify({ type: 'assistant', timestamp: ts, sessionId: 's2',
      message: { id: `m${id}`, model: 'claude-opus-5-5', usage: { input_tokens: 1, output_tokens: 1 },
        content: [{ type: 'tool_use', id, name, input }] } }));
    seqLines.push(JSON.stringify({ type: 'user', timestamp: ts, sessionId: 's2',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'x'.repeat(chars) }] } }));
  });
  fs.writeFileSync(path.join(seqRoot, `session-${i}.jsonl`), seqLines.join('\n') + '\n');
});

const runSeq = (...args) => JSON.parse(execFileSync(process.execPath, [script, '--root', path.dirname(seqRoot), '--json', ...args],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));

function checkSeq(rows, how) {
  assert.equal(rows.length, seqCases.length, `${how}: one week row per sequence case`);
  const wrong = seqCases.flatMap(([label, , want], i) => Object.entries(want)
    .filter(([k, v]) => rows[i][k] !== v)
    .map(([k, v]) => `  ${label}: ${k} ${rows[i][k]} (want ${v})`));
  assert.equal(wrong.length, 0, `${how}:\n${wrong.join('\n')}`);
}

// Every check runs, so one failing group never hides another.
const failures = [];
const attempt = (fn) => { try { fn(); } catch (e) { failures.push(e.message); } };
try {
  attempt(() => check(run(), 'scan'));
  const out = path.join(tmp, 'rec', 'sessions-test.tsv');
  run('--record', '--out', out);
  attempt(() => check(run('--combined', '--out', out), '--record / --combined'));
  attempt(() => checkSeq(runSeq(), 'tool columns, scan'));
  const seqOut = path.join(tmp, 'rec-seq', 'sessions-test.tsv');
  runSeq('--record', '--out', seqOut);
  attempt(() => checkSeq(runSeq('--combined', '--out', seqOut), 'tool columns, --record / --combined'));
  if (failures.length) { console.error(failures.join('\n\n')); process.exitCode = 1; }
  else console.log(`session-metrics: all ${cases.length} counter cases and ${seqCases.length} tool-column cases passed`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
