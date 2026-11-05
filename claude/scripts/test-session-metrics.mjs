#!/usr/bin/env node
// test-session-metrics.mjs — checks the red_checks and review_agents counters in
// session-metrics.mjs against a synthetic transcript, through a scan and through a
// --record / --combined round trip. Each case sits in its own ISO week, so every case
// is checked on its own and an overcount in one cannot hide an undercount in another.
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

try {
  check(run(), 'scan');
  const out = path.join(tmp, 'rec', 'sessions-test.tsv');
  run('--record', '--out', out);
  check(run('--combined', '--out', out), '--record / --combined');
  console.log(`session-metrics: all ${cases.length} cases passed`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
