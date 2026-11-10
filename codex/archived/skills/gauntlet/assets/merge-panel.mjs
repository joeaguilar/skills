#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';

const AXES = [
  'palette_lighting',
  'sprite_readability',
  'parallax_depth',
  'ui_polish',
  'animation_feel',
  'scene_composition',
  'performance',
];

function die(message, code = 2) {
  process.stderr.write(`merge-panel: ${message}\n`);
  process.exit(code);
}

function help() {
  process.stdout.write(`merge-panel.mjs — deterministic three-critic median merge

USAGE
  node tools/merge-panel.mjs --out <merged.json> <critic-a.json> <critic-b.json> <critic-c.json>

All inputs must name the same subsystem and iteration. Every non-null axis must
have three integer scores from 1-10; an axis is null in the merge if any seat
returns null. Findings are preserved with a panel_source field.
`);
}

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    help();
    process.exit(0);
  }
  const outIndex = argv.indexOf('--out');
  if (outIndex < 0 || !argv[outIndex + 1]) die('--out <merged.json> is required');
  const output = argv[outIndex + 1];
  const files = argv.filter((_, index) => index !== outIndex && index !== outIndex + 1);
  if (files.length !== 3) die('exactly three critic JSON files are required');
  return { output, files };
}

function load(file) {
  let value;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    die(`${file}: ${error.message}`, 1);
  }
  if (!Number.isInteger(value.iteration)) die(`${file}: iteration must be an integer`, 1);
  if (typeof value.subsystem !== 'string' || value.subsystem.length === 0) {
    die(`${file}: subsystem must be a non-empty string`, 1);
  }
  if (!value.scores || typeof value.scores !== 'object' || Array.isArray(value.scores)) {
    die(`${file}: scores must be an object`, 1);
  }
  for (const axis of AXES) {
    const score = value.scores[axis];
    if (score !== null && !(Number.isInteger(score) && score >= 1 && score <= 10)) {
      die(`${file}: scores.${axis} must be an integer 1-10 or null`, 1);
    }
  }
  if (value.findings !== undefined && !Array.isArray(value.findings)) {
    die(`${file}: findings must be an array when present`, 1);
  }
  return value;
}

const { output, files } = parseArgs(process.argv.slice(2));
const verdicts = files.map(load);
const { subsystem, iteration } = verdicts[0];

for (let index = 1; index < verdicts.length; index += 1) {
  if (verdicts[index].subsystem !== subsystem || verdicts[index].iteration !== iteration) {
    die(`${files[index]} does not match subsystem ${subsystem} iteration ${iteration}`, 1);
  }
}

const scores = {};
for (const axis of AXES) {
  const values = verdicts.map((verdict) => verdict.scores[axis]);
  scores[axis] = values.some((value) => value === null)
    ? null
    : [...values].sort((a, b) => a - b)[1];
}

const findings = verdicts.flatMap((verdict, index) =>
  (verdict.findings ?? []).map((finding) => ({
    ...finding,
    panel_source: files[index],
  })),
);

const merged = {
  subsystem,
  iteration,
  scores,
  findings,
  panel_sources: files,
  merge: 'per-axis median of three; any null remains null',
};

writeFileSync(output, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ output, subsystem, iteration, scores }, null, 2)}\n`);
