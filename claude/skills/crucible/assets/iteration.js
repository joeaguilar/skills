export const meta = {
  name: 'crucible-iteration',
  description: 'One crucible iteration: Spec -> (Build || blind Test-author) -> Evidence -> bounded Repair -> Critique',
  whenToUse: 'Invoked by the crucible skill, once per iteration per target. Never run by hand — the skill supplies args and records the ledger.',
  phases: [
    { title: 'Spec', detail: 'pin behavior ids, interface, and disjoint file ownership from the prior critique' },
    { title: 'Build', detail: 'builder and blind test-author in parallel, disjoint globs' },
    { title: 'Evidence', detail: 'run registered instruments, aggregate the evidence report' },
    { title: 'Repair', detail: 'up to 2 source-only repair attempts when layer 1 fails' },
    { title: 'Critique', detail: 'blind instrumented critic, or a 3-seat panel on confirmation rounds' },
  ],
}

// ---------------------------------------------------------------------------
// args (supplied by the crucible skill; see SKILL.md "Phase 1")
//   target        string   target name from CONTRACT.json
//   iter          number   iteration number; 0 means the baseline round
//   dir           string   artifact dir, default '.crucible'
//   gateFlags     string   the verbatim STATUS.md `Gate flags:` line contents
//   seat          string   'opus' | 'codex' — whose turn the regular critic seat is
//   panel         boolean  true on a confirmation round (3 critics, median merge)
//   codexSeat     boolean  false when the companion is absent and the user consented to Claude-only
//   companion     string   absolute path to codex-companion.mjs, or null
//   priorCritique string   path to the previous iteration's merged critique, or null
//   findings      array    the prior critique's findings, verbatim (cited to the builder)
//   sourceGlobs   array    target's source globs
//   testGlobs     array    target's test globs
// ---------------------------------------------------------------------------

const a = args || {}
const dir = a.dir || '.crucible'
const target = a.target
const iter = a.iter
const baseline = iter === 0
const seat = a.seat === 'codex' ? 'codex' : 'opus'
const panel = a.panel === true
const codexSeat = a.codexSeat !== false && !!a.companion
const gateFlags = a.gateFlags || ''
const sourceGlobs = a.sourceGlobs || []
const testGlobs = a.testGlobs || []
const findings = a.findings || []

if (!target || typeof iter !== 'number') {
  throw new Error('crucible-iteration: args.target (string) and args.iter (number) are required')
}

const TOOLS = `${dir}/tools`
const SPEC_PATH = `${dir}/spec/${target}_iter${iter}.json`
const EVIDENCE_PATH = baseline ? `${dir}/baseline/${target}.json` : `${dir}/evidence/${target}_iter${iter}.json`
const BEHAVIORS_PATH = `${dir}/evidence/${target}_iter${iter}.behaviors.json`
const RUBRIC = `${dir}/RUBRIC.md`

const ledger = []
const row = (stage, planned, actual, reason) => {
  ledger.push({ iter, target, stage, planned, actual, reason: reason || '—' })
}

// --- structured-output schemas ---------------------------------------------

const SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['behaviors', 'interface', 'ownership', 'specPath'],
  properties: {
    specPath: { type: 'string' },
    behaviors: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'statement', 'source'],
        properties: {
          id: { type: 'string', pattern: '^B[0-9]+$' },
          statement: { type: 'string' },
          source: { type: 'string' },
        },
      },
    },
    interface: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['symbol', 'file'],
        properties: { symbol: { type: 'string' }, file: { type: 'string' }, note: { type: ['string', 'null'] } },
      },
    },
    ownership: {
      type: 'object',
      additionalProperties: false,
      required: ['builder', 'testAuthor'],
      properties: {
        builder: { type: 'array', items: { type: 'string' } },
        testAuthor: { type: 'array', items: { type: 'string' } },
      },
    },
  },
}

const WORK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['filesWritten', 'claims', 'outOfScopeWrites'],
  properties: {
    filesWritten: { type: 'array', items: { type: 'string' } },
    claims: { type: 'array', items: { type: 'string' } },
    outOfScopeWrites: { type: 'array', items: { type: 'string' } },
    behaviorsCovered: { type: 'array', items: { type: 'string' } },
    notes: { type: ['string', 'null'] },
  },
}

const EVIDENCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['evidencePath', 'instrumentsHealthy', 'gateVerdict', 'layer1Failures'],
  properties: {
    evidencePath: { type: 'string' },
    instrumentsHealthy: { type: 'boolean' },
    gateVerdict: { type: 'string' },
    layer1Failures: { type: 'array', items: { type: 'string' } },
    brokenInstruments: { type: 'array', items: { type: 'string' } },
    gateOutput: { type: 'string' },
  },
}

const CRITIQUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['critiquePath', 'critic', 'validated', 'scores'],
  properties: {
    critiquePath: { type: 'string' },
    critic: { type: 'string' },
    validated: { type: 'boolean' },
    scores: { type: 'object', additionalProperties: { type: ['integer', 'null'] } },
    validatorErrors: { type: 'array', items: { type: 'string' } },
  },
}

// --- prompt fragments -------------------------------------------------------

const OWNERSHIP_RULE = (globs) => `
FILE OWNERSHIP — hard boundary. You may create or modify files matching ONLY these globs:
${globs.map((g) => `  - ${g}`).join('\n')}
Writing outside them is a stop-the-iteration defect. If the work seems to require a file you do not own,
do not write it: report it in outOfScopeWrites and stop. Another agent owns that file RIGHT NOW and is
editing it in parallel.`

const NO_TEST_EDITS = `
You must NOT create, edit, or delete any test file. A different agent is writing the tests for this
iteration, blind to your implementation, at the same time. Editing a test to make it pass is score
laundering and voids the iteration.`

const INSTRUMENT_RULE = `
Every measured claim you make must cite the exact registered command you ran and its verbatim output.
Registered instruments live in ${dir}/CONTRACT.json under "instruments" — run them with:
  node ${TOOLS}/evidence.mjs run --target ${target} --iter ${iter} --json
Do NOT hand-roll a measurement script, and do NOT cite a command that is not registered. If a number you
need has no registered instrument, say so as a finding rather than improvising one.`

// ---------------------------------------------------------------------------
// Phase: Spec
// ---------------------------------------------------------------------------

let spec = null

if (!baseline) {
  phase('Spec')
  spec = await agent(
    `You are the Spec stage of a crucible iteration. Produce the iteration spec that a builder and a BLIND
test-author will each receive — they never see each other's output, so this document is the only thing
that keeps them aligned. Vagueness here becomes a failed iteration.

Target: ${target}      Iteration: ${iter}
Artifact dir: ${dir}
Prior critique: ${a.priorCritique || '(none)'}

Findings to address this iteration (verbatim from the prior critique):
${findings.length ? JSON.stringify(findings, null, 2) : '(none — first working iteration; derive behaviors from the baseline critique)'}

Do this:
1. Read the prior critique and the target's current source (globs: ${sourceGlobs.join(', ')}).
2. Turn the findings into a numbered behavior list. Each behavior is ONE externally observable statement
   about what the code must do — phrased so a test can fail when it is false, and phrased WITHOUT reference
   to any particular implementation. Ids are B1, B2, ... and are the join key the gate uses to prove
   functional coverage. Fold findings that share one behavior; split a finding that hides two.
3. Pin any interface the two agents must agree on: exact signatures, types, error shapes, file paths. If the
   builder is free to choose, say so explicitly rather than leaving it unstated.
4. Set ownership: builder gets ${JSON.stringify(sourceGlobs)}, test-author gets ${JSON.stringify(testGlobs)}.
   These must not intersect.
5. Write the spec JSON to ${SPEC_PATH} (schema: ${dir}/tools/SCHEMAS.md section 2) and return the same object.

Behaviors must be testable, not aspirational: "rejects an unterminated string with a caret at the opening
quote column" is a behavior; "improve error handling" is not.`,
    { label: `spec:${target}#${iter}`, phase: 'Spec', schema: SPEC_SCHEMA }
  )
  row('spec', 'workflow', 'workflow', null)

  if (!spec || !spec.behaviors || spec.behaviors.length === 0) {
    log(`spec produced no behaviors for ${target} iter ${iter} — iteration cannot proceed`)
    return { iteration: iter, target, status: 'SPEC-EMPTY', ledger }
  }
  log(`spec: ${spec.behaviors.length} behaviors (${spec.behaviors.map((b) => b.id).join(', ')})`)
}

// ---------------------------------------------------------------------------
// Phase: Build — builder || blind test-author
// ---------------------------------------------------------------------------

let build = null
let tests = null

if (!baseline) {
  phase('Build')
  const behaviorBlock = spec.behaviors.map((b) => `  ${b.id}: ${b.statement}`).join('\n')
  const interfaceBlock = spec.interface.length
    ? spec.interface.map((i) => `  ${i.symbol}   (${i.file})${i.note ? ' — ' + i.note : ''}`).join('\n')
    : '  (none pinned — you choose, but keep it obvious from the behavior statements)'

  const both = await parallel([
    () =>
      agent(
        `You are the Builder for target "${target}", iteration ${iter}.

Implement the source changes that make these behaviors true:
${behaviorBlock}

Pinned interface (a blind test-author is writing tests against exactly this, right now):
${interfaceBlock}

Findings you are answering (verbatim):
${JSON.stringify(findings, null, 2)}
${OWNERSHIP_RULE(spec.ownership.builder)}
${NO_TEST_EDITS}

Match the surrounding code's idiom, naming, and comment density. Return the files you wrote and a claim
list — one checkable claim per behavior, each phrased so the evidence run can confirm or refute it.`,
        { label: `build:${target}#${iter}`, phase: 'Build', schema: WORK_SCHEMA }
      ),
    () =>
      agent(
        `You are the blind Test-author for target "${target}", iteration ${iter}.

You are writing tests AT THE SAME TIME as the implementer, and you cannot see their work. Do not read the
source files under ${JSON.stringify(spec.ownership.builder)} for this iteration's changes, and do not wait
for them. Write the tests the behaviors demand, not the tests the implementation would pass.

Behaviors to pin:
${behaviorBlock}

Interface you may assume:
${interfaceBlock}
${OWNERSHIP_RULE(spec.ownership.testAuthor)}

Rules that make this work:
- Each behavior gets at least one test whose NAME contains its id as a standalone word — e.g.
  "parser B1 rejects unterminated string". The gate joins behaviors to tests on that token; a test that
  omits it does not count, no matter how good it is.
- Test the behavior, not the line. Assert the observable contract: values, error types, error positions,
  emitted effects. A test that only asserts "did not throw" is a failure of this stage.
- Cover the boundary the behavior implies (empty, max, malformed, concurrent) in the same or a sibling test.
- A test you expect to FAIL right now is correct and expected — the implementer may not have landed it yet.
  Write the true assertion, never a weakened one.
- Write the behavior->test map to ${BEHAVIORS_PATH} (schema: ${dir}/tools/SCHEMAS.md section 3).

Return the test files you wrote and, in behaviorsCovered, the behavior ids you mapped.`,
        { label: `tests:${target}#${iter}`, phase: 'Build', schema: WORK_SCHEMA }
      ),
  ])

  build = both[0]
  tests = both[1]
  row('build', 'workflow', build ? 'workflow' : 'failed', build ? null : 'AGENT-FAILED')
  row('test-author', 'workflow', tests ? 'workflow' : 'failed', tests ? null : 'AGENT-FAILED')

  const strays = [...((build && build.outOfScopeWrites) || []), ...((tests && tests.outOfScopeWrites) || [])]
  if (strays.length) {
    log(`OWNERSHIP VIOLATION: ${strays.join(', ')} — iteration stops before commit`)
    return { iteration: iter, target, status: 'OWNERSHIP-VIOLATION', strays, ledger, build, tests }
  }
}

// ---------------------------------------------------------------------------
// Phase: Evidence  (+ bounded Repair)
// ---------------------------------------------------------------------------

phase('Evidence')

const evidencePrompt = (attemptNote) => `You are the Evidence stage for target "${target}", iteration ${iter}.

Run, in this order, and report exactly what happened — never summarize a number you did not see:

1. ${baseline
      ? `node ${TOOLS}/evidence.mjs baseline --target ${target} --json`
      : `node ${TOOLS}/evidence.mjs run --target ${target} --iter ${iter} --json`}
   This executes every registered instrument and writes ${EVIDENCE_PATH}.
   Its exit code reflects INSTRUMENT HEALTH, not whether quality gates passed.
2. For any instrument of kind "tool" (Chrome MCP, unity-bridge, or another skill), perform its documented
   invocation yourself and patch its result into the evidence report's instruments entry, citing the
   transcript. A tool instrument left with ran:false is a broken rig, not a passing gate.
3. node ${TOOLS}/gate.mjs --check ${target} ${gateFlags} --json
   Report its verdict verbatim. The gate is the referee: do not interpret, argue with, or restate its
   verdict in friendlier terms.

If an instrument failed to RUN (timeout, missing binary, unparseable output), that is a broken rig: repair
the rig — never the numbers — and re-run. Report broken instruments explicitly.${attemptNote || ''}

Return the evidence path, whether all instruments are healthy, the gate's verdict string, and the specific
layer-1 clauses that failed (empty when layer 1 passes).`

let ev = await agent(evidencePrompt(null), {
  label: `evidence:${target}#${iter}`,
  phase: 'Evidence',
  schema: EVIDENCE_SCHEMA,
})
row('evidence', 'workflow', ev ? 'workflow' : 'failed', ev ? null : 'AGENT-FAILED')

let repairAttempts = 0
if (!baseline && ev) {
  while (ev && ev.layer1Failures && ev.layer1Failures.length > 0 && repairAttempts < 2) {
    repairAttempts += 1
    phase('Repair')
    log(`layer 1 failed (${ev.layer1Failures.join('; ')}) — repair attempt ${repairAttempts}/2`)

    const repair = await agent(
      `You are the Builder, repairing target "${target}", iteration ${iter} (attempt ${repairAttempts} of 2).

Layer 1 of the gate failed on these clauses:
${ev.layer1Failures.map((f) => `  - ${f}`).join('\n')}

Evidence report: ${EVIDENCE_PATH}
Read it, read the failing test output it points at, and fix the SOURCE.
${OWNERSHIP_RULE(spec.ownership.builder)}
${NO_TEST_EDITS}

The tests were written blind, against the behavior statements, before your implementation existed. A test
failing means the behavior is not yet true — not that the test is wrong. If you are certain a test
contradicts its behavior statement, do NOT edit it: report it in notes and leave it failing, so a critic
can adjudicate with evidence.

Behaviors:
${spec.behaviors.map((b) => `  ${b.id}: ${b.statement}`).join('\n')}`,
      { label: `repair:${target}#${iter}.${repairAttempts}`, phase: 'Repair', schema: WORK_SCHEMA }
    )
    row('repair', 'workflow', repair ? 'workflow' : 'failed', repair ? null : 'AGENT-FAILED')

    if (repair && repair.outOfScopeWrites && repair.outOfScopeWrites.length) {
      log(`OWNERSHIP VIOLATION during repair: ${repair.outOfScopeWrites.join(', ')}`)
      return { iteration: iter, target, status: 'OWNERSHIP-VIOLATION', strays: repair.outOfScopeWrites, ledger }
    }

    ev = await agent(evidencePrompt(`\n\nThis is a re-run after repair attempt ${repairAttempts}.`), {
      label: `evidence:${target}#${iter}.r${repairAttempts}`,
      phase: 'Evidence',
      schema: EVIDENCE_SCHEMA,
    })
    row('evidence', 'workflow', ev ? 'workflow' : 'failed', ev ? null : 'AGENT-FAILED')
  }
}

if (!ev) {
  return { iteration: iter, target, status: 'EVIDENCE-FAILED', ledger, repairAttempts }
}

if (!baseline && ev.layer1Failures && ev.layer1Failures.length > 0) {
  log(`layer 1 still failing after ${repairAttempts} repair attempts — no critic will spawn`)
  return {
    iteration: iter,
    target,
    status: 'LAYER1-FAILED',
    layer1Failures: ev.layer1Failures,
    evidencePath: ev.evidencePath,
    repairAttempts,
    ledger,
    build,
    tests,
  }
}

if (!ev.instrumentsHealthy) {
  log(`instrument(s) broken: ${(ev.brokenInstruments || []).join(', ')} — never critique on missing evidence`)
  return {
    iteration: iter,
    target,
    status: 'RIG-BROKEN',
    brokenInstruments: ev.brokenInstruments || [],
    ledger,
  }
}

// ---------------------------------------------------------------------------
// Phase: Critique — blind, instrumented, validated
// ---------------------------------------------------------------------------

phase('Critique')

const criticPrompt = (lens, outPath) => `Score this target against the rubric.

Rubric: read ${RUBRIC} in full. It is the only scoring authority; score every axis it lists.
Target: ${target}
Evidence report for this round: ${ev.evidencePath}
Prior critique: ${a.priorCritique || '(none — this is the first scored round)'}
Source under review: ${sourceGlobs.join(', ')}
Tests under review: ${testGlobs.join(', ')}
${lens ? `\nYour lens this round: ${lens}\nScore every axis, but investigate your lens's axes deeply.\n` : ''}
${INSTRUMENT_RULE}

Required for every finding: axis, score, region (file:line-range), defect, concrete fix, and the evidence
that proves it (instrument id, exact command, verbatim output).

The test_quality axis is UNSCORABLE without a mutation experiment. To score it: pick one behavior the new
tests claim to cover, break that behavior in the SOURCE, run the registered test command, cite the output,
then REVERT your mutation and confirm the revert. Record it in the mutation block. If the suite stays green
under the mutation, the test does not constrain behavior — that is a finding, and the axis scores low.
Never mutate a test file. Never leave a mutation in the tree.

Score against the anchors as written. An axis you cannot measure with a registered instrument scores null —
do not estimate it. Write your verdict JSON to ${outPath} and return the path.

Before returning: run
  node ${TOOLS}/gate.mjs --validate ${outPath} --json
and if it rejects the file, fix YOUR OWN JSON to satisfy the named field errors and re-validate. Do not
alter a score to make the validator pass; the validator checks shape, never content.`

let critiques = []

if (panel) {
  log(`confirmation round — 3-critic panel${codexSeat ? ' (does-it-reproduce seat on Codex)' : ' (all-Claude: companion unavailable)'}`)
  const lenses = [
    { lens: 'correctness and error handling — does it do what it claims at the edges', out: `${dir}/critiques/${target}_iter${iter}.opus.json`, seat: 'opus' },
    { lens: 'design and maintainability — api_design, readability, docs_dx', out: `${dir}/critiques/${target}_iter${iter}.opus2.json`, seat: 'opus' },
    {
      lens: 'does-it-reproduce — re-derive the prior round\'s measured claims from a fresh run of the registered instruments, and score ONLY what reproduces',
      out: `${dir}/critiques/${target}_iter${iter}.${codexSeat ? 'codex' : 'opus3'}.json`,
      seat: codexSeat ? 'codex' : 'opus',
    },
  ]

  critiques = await parallel(
    lenses.map((l) => () => {
      const p = criticPrompt(l.lens, l.out)
      if (l.seat === 'codex') {
        return agent(
          `Run this critique through the Codex companion, read-only, and clerk the result.

Command:
  node "${a.companion}" task "<the critic prompt below, passed verbatim>"

Pass NO --write flag and leave model/effort unset. Instruct Codex that its stdout must be the critique JSON
alone. Write that stdout to ${l.out} only after
  node ${TOOLS}/gate.mjs --validate ${l.out} --json
passes. If the validator rejects it, re-invoke the companion fresh with the validator's error appended —
you are the clerk: transcribing is your job, editing the verdict is score laundering. If the companion
cannot run at all, say so plainly and return validated:false — do not silently critique it yourself.

--- CRITIC PROMPT (verbatim, do not add or remove a word) ---
${p}
--- END CRITIC PROMPT ---`,
          { label: `critic:codex:${target}#${iter}`, phase: 'Critique', schema: CRITIQUE_SCHEMA }
        )
      }
      return agent(p, { label: `critic:${l.seat}:${target}#${iter}`, phase: 'Critique', schema: CRITIQUE_SCHEMA })
    })
  )

  const landed = critiques.filter(Boolean).filter((c) => c.validated)
  row('critique', codexSeat ? 'panel:opus,opus,codex' : 'panel:opus,opus,opus', `panel:${landed.length} validated`, codexSeat ? null : 'SANDBOX-DOWN')

  if (landed.length >= 2) {
    const merged = await agent(
      `Merge the panel into one verdict for ${target} iteration ${iter}.

Per-critic verdicts:
${landed.map((c) => `  - ${c.critiquePath} (${c.critic})`).join('\n')}

Per-axis score = the MEDIAN of the critics' scores for that axis (2-of-3 agreement). A null from one critic
is dropped before taking the median; an axis null in every critic stays null. Findings: union, deduplicated
by (axis, region); keep the most specific wording and its cited evidence intact. Keep the mutation block
from whichever critic actually ran the experiment.

You are the clerk. Do not adjust a score because it "looks off", do not soften a finding, do not add one.
Write the merged verdict to ${dir}/critiques/${target}_iter${iter}.json, then validate it with
  node ${TOOLS}/gate.mjs --validate ${dir}/critiques/${target}_iter${iter}.json --json
and return the path. This merged file is the one the gate reads.`,
      { label: `merge:${target}#${iter}`, phase: 'Critique', schema: CRITIQUE_SCHEMA }
    )
    row('merge', 'workflow', merged ? 'workflow' : 'failed', merged ? null : 'AGENT-FAILED')
    critiques = [...landed, merged].filter(Boolean)
  }
} else {
  const useCodex = seat === 'codex' && codexSeat
  const out = `${dir}/critiques/${target}_iter${iter}.json`
  const p = criticPrompt(null, out)

  const c = useCodex
    ? await agent(
        `Run this critique through the Codex companion, read-only, and clerk the result.

Command:
  node "${a.companion}" task "<the critic prompt below, passed verbatim>"

Pass NO --write flag and leave model/effort unset. Codex's stdout must be the critique JSON alone. Write it
to ${out} only after \`node ${TOOLS}/gate.mjs --validate ${out} --json\` passes. On rejection, re-invoke the
companion fresh with the validator error appended. Transcribing is clerking; editing the verdict is score
laundering. If the companion cannot run, return validated:false and say so — do not critique it yourself.

--- CRITIC PROMPT (verbatim, do not add or remove a word) ---
${p}
--- END CRITIC PROMPT ---`,
        { label: `critic:codex:${target}#${iter}`, phase: 'Critique', schema: CRITIQUE_SCHEMA }
      )
    : await agent(p, { label: `critic:opus:${target}#${iter}`, phase: 'Critique', schema: CRITIQUE_SCHEMA })

  row('critique', seat, useCodex ? 'codex' : 'opus', seat === 'codex' && !useCodex ? 'SANDBOX-DOWN' : null)
  critiques = [c].filter(Boolean)
}

const validated = critiques.filter((c) => c && c.validated)
if (validated.length === 0) {
  return { iteration: iter, target, status: 'CRITIQUE-FAILED', ledger, evidencePath: ev.evidencePath, repairAttempts }
}

return {
  iteration: iter,
  target,
  status: baseline ? 'BASELINE-DONE' : 'ITERATION-DONE',
  evidencePath: ev.evidencePath,
  specPath: baseline ? null : SPEC_PATH,
  behaviors: baseline ? [] : spec.behaviors.map((b) => b.id),
  critiques: validated.map((c) => ({ path: c.critiquePath, critic: c.critic, scores: c.scores })),
  repairAttempts,
  gateVerdictAtEvidence: ev.gateVerdict,
  ledger,
}
