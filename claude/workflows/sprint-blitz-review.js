// args: { sprintFolder, tracker?='itr', verifyCmd?, wave, finalize? }
// Requires an already-groomed itr sprint backlog (run /sprint first).
// Advances one wave per invocation; call again with resumeFromRunId and
// args.wave+1 after smoke-testing, or args.finalize=true once all waves
// are committed to run the closing sprint-review synthesis.
export const meta = {
  name: 'sprint-blitz-review',
  description: 'Execute a groomed itr sprint backlog wave-by-wave: implement, adversarially review, repair, verify, commit — pausing for a human smoke test after each wave, then close out the sprint',
  phases: [
    { title: 'Wave Plan' },
    { title: 'Implement' },
    { title: 'Review' },
    { title: 'Repair' },
    { title: 'Verify' },
    { title: 'Commit' },
    { title: 'Sprint Review' },
  ],
}

const WAVE_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    waves: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          tickets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                ownedFiles: { type: 'array', items: { type: 'string' } },
                prompt: { type: 'string' },
              },
              required: ['id', 'title', 'ownedFiles', 'prompt'],
            },
          },
        },
        required: ['id', 'tickets'],
      },
    },
  },
  required: ['waves'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          summary: { type: 'string' },
          severity: { type: 'string', enum: ['blocking', 'advisory'] },
        },
        required: ['file', 'summary', 'severity'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: { pass: { type: 'boolean' }, notes: { type: 'string' } },
  required: ['pass'],
}

const SPRINT_REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    outcomes: { type: 'string' },
    demo: { type: 'string' },
    retro: { type: 'string' },
    triageFiled: { type: 'array', items: { type: 'string' } },
  },
  required: ['outcomes', 'demo', 'retro'],
}

if (!args || !args.sprintFolder || !args.wave) {
  throw new Error('sprint-blitz-review requires args: { sprintFolder, tracker?, verifyCmd?, wave, finalize? }')
}

const tracker = args.tracker || 'itr'
const verifyCmd = args.verifyCmd

phase('Wave Plan')
const plan = await agent(
  `Read the groomed sprint backlog for sprint/${args.sprintFolder} from ${tracker} (list-open, respect blocked-by/owned-files). ` +
  `Pack ready tickets into conflict-free waves the same way /blitz does: same-wave tickets must not share owned files or have a blocked-by edge between them. ` +
  `For each ticket write a self-contained implementation prompt (ticket id, title, acceptance criteria, owned files, Definition of Done). ` +
  `Return the full wave plan.`,
  { schema: WAVE_PLAN_SCHEMA, label: 'wave-plan' }
)

if (!plan.waves.length) {
  log('No ready tickets — nothing to plan.')
  return { done: true, reason: 'empty-backlog' }
}

// Resume trick: always replay from wave 0. Waves < args.wave issue the exact same
// prompts as the run that already committed them, so resumeFromRunId cache-hits
// them instantly; only the newly-unlocked wave (index === args.wave - 1) runs live.
const targetWave = Math.min(args.wave, plan.waves.length)

for (let i = 0; i < targetWave; i++) {
  const wave = plan.waves[i]
  const waveNum = wave.id
  const ownedFiles = wave.tickets.flatMap(t => t.ownedFiles)

  phase(`Wave ${waveNum} Implement`)
  await parallel(wave.tickets.map(t => () =>
    agent(t.prompt, { phase: `Wave ${waveNum} Implement`, label: `impl:${t.id}` })
  ))

  phase(`Wave ${waveNum} Review`)
  const review = await agent(
    `Adversarially code-review the working-tree diff touching these files: ${ownedFiles.join(', ')}. ` +
    `Flag correctness bugs first, then reuse/simplification/efficiency issues. Mark each finding blocking or advisory.`,
    { schema: REVIEW_SCHEMA, phase: `Wave ${waveNum} Review`, label: `review:${waveNum}` }
  )

  const blocking = review.findings.filter(f => f.severity === 'blocking')
  if (blocking.length) {
    phase(`Wave ${waveNum} Repair`)
    await parallel(blocking.map(f => () =>
      agent(`Fix this review finding: ${f.summary} (in ${f.file}).`, { phase: `Wave ${waveNum} Repair`, label: `repair:${f.file}` })
    ))
  }

  phase(`Wave ${waveNum} Verify`)
  const verdict = await agent(
    verifyCmd
      ? `Run \`${verifyCmd}\` and report pass/fail with a one-line reason.`
      : `Run this project's verify gate (tests/build/lint) and report pass/fail with a one-line reason.`,
    { schema: VERDICT_SCHEMA, phase: `Wave ${waveNum} Verify`, label: `verify:${waveNum}` }
  )

  if (!verdict.pass) {
    log(`Wave ${waveNum} failed verify: ${verdict.notes || 'no details'} — stopping before commit.`)
    return { done: false, wave: waveNum, failed: 'verify', notes: verdict.notes }
  }

  phase(`Wave ${waveNum} Commit`)
  await agent(
    `Stage exactly the files these tickets own (${ownedFiles.join(', ')}) and create one git commit, Conventional Commits style, ` +
    `summarizing wave ${waveNum} (tickets: ${wave.tickets.map(t => t.id).join(', ')}). Then close each ticket in ${tracker} with its evidence.`,
    { phase: `Wave ${waveNum} Commit`, label: `commit:${waveNum}` }
  )

  log(`Wave ${waveNum}/${plan.waves.length} committed. ${blocking.length ? blocking.length + ' finding(s) repaired.' : 'Review clean.'}`)
}

const allWavesDone = targetWave >= plan.waves.length

if (!allWavesDone) {
  log(`Wave ${targetWave} done — smoke-test it, then resume with args.wave=${targetWave + 1} and resumeFromRunId.`)
  return { done: false, wave: targetWave, totalWaves: plan.waves.length, awaitingSmokeTest: true }
}

if (!args.finalize) {
  log(`All ${plan.waves.length} waves committed — smoke-test the last wave, then resume with args.finalize=true to run sprint-review.`)
  return { done: false, wave: targetWave, totalWaves: plan.waves.length, awaitingSmokeTest: true }
}

phase('Sprint Review')
const sprintReview = await agent(
  `Close out sprint/${args.sprintFolder}: fill Outcomes/Demo/Retro in plan.md from the wave history, ` +
  `file any advisory review findings left open into ${tracker} as triage follow-ups, close the epic, update sprint/CURRENT.`,
  { schema: SPRINT_REVIEW_SCHEMA, phase: 'Sprint Review', label: 'sprint-review' }
)

return { done: true, waves: plan.waves.length, sprintReview }
