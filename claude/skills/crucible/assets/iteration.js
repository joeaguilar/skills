export const meta = {
  name: 'crucible-iteration',
  description: 'One crucible round: a build link (Spec -> Build || blind Test-author -> Evidence -> bounded Repair), a critique of a built target, or both',
  whenToUse: 'Invoked by the crucible skill, once per build link and once per critique. Never run by hand — the skill supplies args and records the ledger.',
  phases: [
    { title: 'Spec', detail: 'pin behavior ids, interface, and disjoint file ownership from the brief or the prior critique' },
    { title: 'Build', detail: 'builder and blind test-author in parallel, disjoint globs' },
    { title: 'Evidence', detail: 'run registered instruments, aggregate the evidence report' },
    { title: 'Repair', detail: 'up to 2 source-only repair attempts when layer 1 fails' },
    { title: 'Critique', detail: 'blind instrumented critic; skipped on a build link, the only phase of a deferred critique' },
  ],
}

// ---------------------------------------------------------------------------
// args (supplied by the crucible skill; see SKILL.md "Phase 1")
//   target        string   target name from CONTRACT.json
//   iter          number   iteration number; 0 means the baseline round (evidence only)
//   mode          string   'build' (default) | 'critique'. 'critique' judges an iteration that
//                          was already built and committed: no Spec, no Build, no new evidence
//                          run. Its record is the evidence report that link left behind.
//   critique      boolean  false = a build link: stop once layer 1 passes, no critic. Default
//                          true for a build round, false for the baseline.
//   brief         string   what the target has to deliver and which documents say so; the Spec
//                          stage reads it when there is no prior critique to work from
//   criticModel   string   model every Claude critic seat runs on; unset = the session model
//   dir           string   artifact dir, default '.crucible'
//   gateFlags     string   accepted and ignored: the hard-layer check a link uses takes no gate flags
//   builtBy       string   model the round's build actually ran on (the ledger's build `actual`);
//                          unset = the session model, which is Claude. The critic is the other
//                          family: a Claude-built round gets the codex seat, a GPT-built one a
//                          Claude critic. The panel's does-it-reproduce seat follows the same rule
//   seat          string   'opus' | 'codex' — explicit override for the regular critic seat
//   panel         boolean  true for a 3-critic panel with a median merge (used with --confirm >= 2)
//   codexSeat     boolean  false when the codex seat is unavailable and the user consented to Claude-only
//   seatScript    string   absolute path to the codex-seat skill's codex-seat.sh, or null
//   codexModel    string   model the Codex critic seat runs on: the `frontier` role in
//                          ~/.claude/MODELS.md, resolved by the caller; default 'gpt-6-astra'
//   codexEffort   string   that seat's -e pin (the role's Effort column); default 'high'
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
const critiqueOnly = a.mode === 'critique'
// A baseline is a measurement, not a judgement, and a build link is judged later with the
// rest of its chain: a critic runs only where one was asked for.
const withCritique = critiqueOnly ? true : baseline ? a.critique === true : a.critique !== false
const brief = typeof a.brief === 'string' ? a.brief : ''
const criticModel = a.criticModel || null
const criticName = criticModel || 'opus'
const criticOpts = (o) => (criticModel ? { ...o, model: criticModel } : o)
// The critic follows the builder: the family that did not build the round judges it.
const builtByGpt = /^gpt-/i.test(a.builtBy || '')
const seat = a.seat === 'codex' || a.seat === 'opus' ? a.seat : builtByGpt ? 'opus' : 'codex'
const panel = a.panel === true
const codexSeat = a.codexSeat !== false && !!a.seatScript
const reproduceOnCodex = codexSeat && !builtByGpt
const codexModel = a.codexModel || 'gpt-6-astra'
const codexEffort = a.codexEffort || 'high'
// The Codex critic as a read-only codex seat: the brief is the critic prompt, its final
// message (out.md) is the critique JSON, and done says when it finished.
const codexCritic = (p, out, seatDir) => `Run this critique as a read-only codex seat and clerk the result.

1. mkdir -p ${seatDir}, then write the critic prompt below to ${seatDir}/brief.md, verbatim, followed by
   one line: "Your final message must be the critique JSON alone."
2. Run, with Bash timeout 600000:
     bash "${a.seatScript}" run -d ${seatDir} -m ${codexModel} -e ${codexEffort} -s read-only
   If the run may pass 9 minutes, use \`start\` in place of \`run\`, then call
   \`bash "${a.seatScript}" wait -d ${seatDir}\` again for as long as it exits 3.
3. Once ${seatDir}/done reads exit=0, copy ${seatDir}/out.md to ${out} and run
     node ${TOOLS}/gate.mjs --validate ${out} --json
   If the validator rejects it, launch a fresh seat dir (${seatDir}-r2, -r3, …) with the validator's error
   appended to the brief. You are the clerk: transcribing is your job, editing the verdict is score
   laundering. If the seat cannot run at all (done non-zero, empty out.md), say so plainly and return
   validated:false — do not critique it yourself.

--- CRITIC PROMPT (verbatim, do not add or remove a word) ---
${p}
--- END CRITIC PROMPT ---`
const sourceGlobs = a.sourceGlobs || []
const testGlobs = a.testGlobs || []
const findings = a.findings || []

if (!target || typeof iter !== 'number') {
  throw new Error('crucible-iteration: args.target (string) and args.iter (number) are required')
}
if (critiqueOnly && baseline) {
  throw new Error('crucible-iteration: mode "critique" needs the iteration of a built link (iter >= 1)')
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

// Every agent's prompt opens with a seat line naming this iteration and its stage,
// in the ledger's own stage words. Where the Seat Guard mod is loaded it reads that
// line off the agent's conversation and pairs it with the model the engine really
// sent the agent's requests to: the fact STATUS.md's `actual` column wants.
const seated = (stage, prompt, opts) => agent(`[seat crucible:${target}#${iter} ${stage}]\n${prompt}`, opts)

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
  node ${TOOLS}/evidence.mjs run --target ${target} --iter ${iter} --scratch --json
Always pass --scratch. It writes your run under ${dir}/evidence/scratch/ and leaves the round's record
(${dir}/evidence/${target}_iter${iter}.json) as it is; a run without it replaces the record. The scratch
report's changed-line coverage is taken against a different base than the record's, so cite coverage from
the record only. --only <id,id> restricts a run to the instruments you need.
Do NOT hand-roll a measurement script, and do NOT cite a command that is not registered. If a number you
need has no registered instrument, say so as a finding rather than improvising one.`

// ---------------------------------------------------------------------------
// Phase: Spec
// ---------------------------------------------------------------------------

let spec = null

if (!baseline && !critiqueOnly) {
  phase('Spec')
  spec = await seated(
    'spec',
    `You are the Spec stage of a crucible iteration. Produce the iteration spec that a builder and a BLIND
test-author will each receive — they never see each other's output, so this document is the only thing
that keeps them aligned. Vagueness here becomes a failed iteration.

Target: ${target}      Iteration: ${iter}
Artifact dir: ${dir}
Prior critique: ${a.priorCritique || '(none)'}

What this target has to deliver (the brief):
${brief || '(no brief given — read the project\'s own spec and roadmap documents for this target)'}

Findings to address this iteration (verbatim from the prior critique):
${findings.length ? JSON.stringify(findings, null, 2) : '(none — this is the target\'s first build; the brief and the documents it names are the source)'}

Do this:
1. Read the brief and the documents it names, the prior critique when there is one, and the target's
   current source (globs: ${sourceGlobs.join(', ')}). Read what the targets this one builds on already
   expose, so the interface you pin fits them.
2. Turn the brief (first build) or the findings (later rounds) into a numbered behavior list. On a first
   build, cover everything the brief asks of this target in this one iteration: the next target is built
   on top of it before any critic looks, so a behavior left for later is a gap in the chain. Each behavior is ONE externally observable statement
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

if (!baseline && !critiqueOnly) {
  phase('Build')
  const behaviorBlock = spec.behaviors.map((b) => `  ${b.id}: ${b.statement}`).join('\n')
  const interfaceBlock = spec.interface.length
    ? spec.interface.map((i) => `  ${i.symbol}   (${i.file})${i.note ? ' — ' + i.note : ''}`).join('\n')
    : '  (none pinned — you choose, but keep it obvious from the behavior statements)'

  const both = await parallel([
    () =>
      seated(
        'build',
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
      seated(
        'test-author',
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
${baseline
      ? `3. A baseline has no verdict: return gateVerdict "baseline" and an empty layer1Failures.`
      : `3. node ${TOOLS}/gate.mjs --layer1 ${target} --iter ${iter} --json
   This is the hard layer's verdict on the report you just wrote. Return "PASS" or "FAIL" as gateVerdict
   and its "failing" array, verbatim, as layer1Failures (empty when "pass" is true). The gate is the
   referee: do not interpret, argue with, or restate its verdict in friendlier terms, and do not work
   the clauses out yourself.`}

If an instrument failed to RUN (timeout, missing binary, unparseable output), that is a broken rig: repair
the rig — never the numbers — and re-run. Report broken instruments explicitly.${attemptNote || ''}

Return the evidence path, whether all instruments are healthy, the gate's verdict string, and the specific
layer-1 clauses that failed (empty when layer 1 passes).`

let ev
if (critiqueOnly) {
  // The link's own evidence report is the record. The orchestrator checked it with
  // `gate.mjs --layer1` before asking for this critique; nothing is re-run here, because
  // the link is committed and a fresh changed-line reading would be of another diff.
  ev = { evidencePath: EVIDENCE_PATH, instrumentsHealthy: true, gateVerdict: 'recorded', layer1Failures: [] }
} else {
  phase('Evidence')
  ev = await seated('evidence', evidencePrompt(null), {
    label: `evidence:${target}#${iter}`,
    phase: 'Evidence',
    schema: EVIDENCE_SCHEMA,
  })
  row('evidence', 'workflow', ev ? 'workflow' : 'failed', ev ? null : 'AGENT-FAILED')
}

let repairAttempts = 0
if (!baseline && !critiqueOnly && ev) {
  while (ev && ev.layer1Failures && ev.layer1Failures.length > 0 && repairAttempts < 2) {
    repairAttempts += 1
    phase('Repair')
    log(`layer 1 failed (${ev.layer1Failures.join('; ')}) — repair attempt ${repairAttempts}/2`)

    const repair = await seated(
      'repair',
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

    ev = await seated('evidence', evidencePrompt(`\n\nThis is a re-run after repair attempt ${repairAttempts}.`), {
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

// A build link ends here: layer 1 holds, and the next link can be built on this one.
if (!withCritique) {
  return {
    iteration: iter,
    target,
    status: baseline ? 'BASELINE-DONE' : 'LINK-DONE',
    evidencePath: ev.evidencePath,
    specPath: baseline ? null : SPEC_PATH,
    behaviors: spec ? spec.behaviors.map((b) => b.id) : [],
    critiques: [],
    repairAttempts,
    gateVerdictAtEvidence: ev.gateVerdict,
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

A finding is a defect: something wrong or missing that a builder can act on. Each needs axis, score,
region (file:line-range), defect, concrete fix, and the evidence that proves it (instrument id, exact
command, verbatim output). Where an axis has no defect, write no finding for it — do not write one to
explain a good score. One line per axis in "summary" is the place for that.

What the target is held to is its declared behaviors (${dir}/spec/${target}_iter*.json, every iteration)
and the rubric's anchors. A sentence in a comment or a doc that no declared behavior states is not a
behavior: if one looks unconstrained, list it once in a top-level "notes" array of strings, and do not
score it, mutate against it, or write a finding for it.

The test_quality axis is UNSCORABLE without a mutation experiment. To score it: pick one DECLARED behavior
the tests claim to cover, break that behavior in the SOURCE, run the registered test command, cite the
output, then REVERT your mutation and confirm the revert. Record it in the mutation block. If the suite
stays green under the mutation, the test does not constrain behavior — that is a finding, and the axis
scores low. One experiment scores the axis. Run at most three, each on a different declared behavior at
its centre, and stop there: a full run of the test instrument is the most expensive thing you do.
Never mutate a test file. Never leave a mutation in the tree.

Score against the anchors as written. An axis you cannot measure with a registered instrument scores null —
do not estimate it. Write your verdict JSON to ${outPath} and return the path.

Before returning: run
  node ${TOOLS}/gate.mjs --validate ${outPath} --json
and if it rejects the file, fix YOUR OWN JSON to satisfy the named field errors and re-validate. Do not
alter a score to make the validator pass; the validator checks shape, never content.`

let critiques = []

if (panel) {
  log(`3-critic panel${reproduceOnCodex ? ' (does-it-reproduce seat on Codex)' : builtByGpt ? ' (all-Claude: a GPT-built round is judged by Claude)' : ' (all-Claude: codex seat unavailable)'}`)
  const lenses = [
    { lens: 'correctness and error handling — does it do what it claims at the edges', out: `${dir}/critiques/${target}_iter${iter}.opus.json`, seat: 'opus' },
    { lens: 'design and maintainability — api_design, readability, docs_dx', out: `${dir}/critiques/${target}_iter${iter}.opus2.json`, seat: 'opus' },
    {
      lens: 'does-it-reproduce — re-derive the prior round\'s measured claims from a fresh run of the registered instruments, and score ONLY what reproduces',
      out: `${dir}/critiques/${target}_iter${iter}.${reproduceOnCodex ? 'codex' : 'opus3'}.json`,
      seat: reproduceOnCodex ? 'codex' : 'opus',
    },
  ]

  // One critic at a time. Each runs a mutation experiment in the one working tree, and
  // two at once put one seat's mutation into another seat's instrument run.
  const panelSeats = lenses.map((l) => async () => {
      const p = criticPrompt(l.lens, l.out)
      if (l.seat === 'codex') {
        return seated(
          'critique:codex',
          codexCritic(p, l.out, `${dir}/seats/${target}_iter${iter}_reproduce`),
          { label: `${codexModel}:critic:${target}#${iter}`, phase: 'Critique', schema: CRITIQUE_SCHEMA }
        )
      }
      return seated(`critique:${criticName}`, p, criticOpts({ label: `critic:${criticName}:${target}#${iter}`, phase: 'Critique', schema: CRITIQUE_SCHEMA }))
  })
  critiques = []
  for (const runSeat of panelSeats) {
    try {
      critiques.push(await runSeat())
    } catch (e) {
      log(`panel critic failed: ${e && e.message ? e.message : e}`)
      critiques.push(null)
    }
  }

  const landed = critiques.filter(Boolean).filter((c) => c.validated)
  row(
    'critique',
    builtByGpt ? `panel:${criticName},${criticName},${criticName}` : `panel:${criticName},${criticName},codex`,
    `panel:${landed.length} validated`,
    !builtByGpt && !codexSeat ? 'SANDBOX-DOWN' : null
  )

  if (landed.length >= 2) {
    const merged = await seated(
      'merge',
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
    ? await seated(
        'critique:codex',
        codexCritic(p, out, `${dir}/seats/${target}_iter${iter}`),
        { label: `${codexModel}:critic:${target}#${iter}`, phase: 'Critique', schema: CRITIQUE_SCHEMA }
      )
    : await seated(`critique:${criticName}`, p, criticOpts({ label: `critic:${criticName}:${target}#${iter}`, phase: 'Critique', schema: CRITIQUE_SCHEMA }))

  row('critique', seat === 'codex' ? 'codex' : criticName, useCodex ? 'codex' : criticName, seat === 'codex' && !useCodex ? 'SANDBOX-DOWN' : null)
  critiques = [c].filter(Boolean)
}

const validated = critiques.filter((c) => c && c.validated)
if (validated.length === 0) {
  return { iteration: iter, target, status: 'CRITIQUE-FAILED', ledger, evidencePath: ev.evidencePath, repairAttempts }
}

return {
  iteration: iter,
  target,
  status: baseline ? 'BASELINE-DONE' : critiqueOnly ? 'CRITIQUE-DONE' : 'ITERATION-DONE',
  evidencePath: ev.evidencePath,
  specPath: baseline || critiqueOnly ? null : SPEC_PATH,
  behaviors: spec ? spec.behaviors.map((b) => b.id) : [],
  critiques: validated.map((c) => ({ path: c.critiquePath, critic: c.critic, scores: c.scores })),
  repairAttempts,
  gateVerdictAtEvidence: ev.gateVerdict,
  ledger,
}
