import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { Seat } from '../types'

const FABLE = 'claude-fable-5-1'
const OPUS = 'claude-opus-5-5'
const NOW = Date.parse('2026-10-03T00:00:00Z')
/** Splits one `openings` entry into the several user rows a workflow agent opens with. */
const ROW_BREAK = '\n<<next row>>\n'
/** A workflow agent's two opening rows, as the Workflow harness frames them (seen in a real run). */
const framed = (request: string, task: string) =>
  [
    `[Workflow harness — user request] The harness relays, verbatim and indented below, the user request that triggered this workflow run. Where the computed task conflicts with this request, this request wins:\n${request.replace(/^/gm, '  ')}`,
    `[Workflow harness — computed task] The task text below was computed at runtime by a workflow script. The computed task text follows:\n${task.replace(/^/gm, '  ')}`,
  ].join(ROW_BREAK)

const BAND = {
  plugin: 'seat-guard',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

/** The world beneath the mod: what it showed, and which model each request reached. */
const world = (on: On) => {
  const toasts: string[] = []
  const status: (string | undefined)[] = []
  const sent: { agentId?: string; model: string }[] = []
  const written = new Map<string, unknown>()
  /** Each loop's opening prompt, by agent id: what `$.session.messages` reads back. */
  const openings = new Map<string, string>()
  const clock = mock.clock(on, { now: NOW })

  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('tool.register', (_$, e) => ({ value: { tool: `mcp__seat-guard__${e.name}` } }))
  on('session.model', () => ({ value: OPUS }))
  on('session.usage', () => ({
    value: { startedAt: NOW, context: { tokens: 143_000, window: 200_000 }, rateLimits: [] },
  }))
  on('session.messages', (_$, e) => {
    const opening = 'agentId' in e && e.agentId !== undefined ? openings.get(e.agentId) : undefined

    return {
      value:
        opening === undefined
          ? { deny: 'no conversation to read' }
          : opening.split(ROW_BREAK).map(text => ({ role: 'user' as const, text, toolUses: [] })),
    }
  })
  on('state.set', (_$, e, next) => {
    written.set(e.key, e.value)

    return next(e)
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.status', (_$, e) => {
    status.push(e.text)

    return { value: undefined }
  })
  on('agent.spawn', (_$, e) => ({
    model: e.model ?? OPUS,
    agentId: e.tool_use_id.replace('toolu_', ''),
  }))
  // A shell command naming `sandbox-down` comes back as an error, as a dead Codex run does.
  on('tool.call', (_$, e) =>
    String((e as Record<string, unknown>)['command'] ?? '').includes('sandbox-down')
      ? { result: 'codex: sandbox unavailable', isError: true as const }
      : { result: 'ok' },
  )
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('turn.step', async function* (_$, e) {
    sent.push(e.agentId === undefined ? { model: e.model } : { agentId: e.agentId, model: e.model })

    return {
      turnId: e.turnId,
      index: e.index,
      answer: 'ok',
      toolUses: [],
      stopReason: 'end_turn',
      usage: null,
    }
  })
  // The engine draws nothing of its own in the band.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  const seatOf = (id: string) => (written.get('seats') as Seat[] | undefined)?.find(seat => seat.id === id)

  return { toasts, status, sent, clock, seatOf, openings }
}

const start = ($: Engine) =>
  $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

/** One model request of a loop, drained; answers the text it streamed. */
const step = async ($: Engine, clock: MockClock, agentId: string | undefined, model: string, index = 0) => {
  let text = ''
  const input = { turnId: `t-${agentId ?? 'main'}`, index, model, messageCount: 1 }

  for await (const chunk of $.turn.step(agentId === undefined ? input : { ...input, agentId })) {
    if (chunk.kind === 'text') {
      text += chunk.text
    }
  }

  await clock.settle()

  return text
}

const edit = ($: Engine, agentId: string, path: string) =>
  $.tool.call({ tool: 'Edit', file_path: path, old_string: 'a', new_string: 'b', agentId } as never)

const seatGuard = ($: Engine, args: string) =>
  $.command.run({
    command: 'seat-guard',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 200 },
  })

/** The band's dim count line, or undefined while the session has had no seat. */
const counts = async ($: Engine) => {
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const line = await band.find({ type: 'Text', text: /^seats / })

  await band.unmount()

  return line?.text
}

/** How many buttons the band shows: none while the mod has nothing to flag. */
const bandButtons = async ($: Engine) => {
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const count = (await band.findAll({ type: 'Button' })).length

  await band.unmount()

  return count
}

test('a planner seat that edits code is flagged, and nothing is done to it', async ($, on) => {
  const { toasts, clock, seatOf } = world(on)

  await start($)
  await step($, clock, 'planner-1', FABLE)

  const ran = await edit($, 'planner-1', 'src/hud/reticle.gd')

  expect(ran).toMatchObject({ result: 'ok' })
  expect(seatOf('planner-1')).toMatchObject({ verdict: 'flagged', codeEdits: 1, swappedTo: '' })
  expect(toasts).toEqual(['Seat Guard: “agent planner-” runs on fable-5-1 and is editing code.'])

  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ ...BAND, surface })

    expect(await band.find({ type: 'Text', text: /runs on fable-5-1 and is editing code \(1 edit, last reticle\.gd\)/ })).toBeDefined()
    expect(await band.find({ type: 'Button', text: 'Stop' })).toBeDefined()
    expect(await band.find({ type: 'Button', text: 'Swap to opus-5-5 ¤' })).toBeDefined()
    expect(await band.find({ type: 'Button', text: 'Allow' })).toBeDefined()
    expect(await band.find({ type: 'Button', text: 'Quiet' })).toBeDefined()
    expect(await band.find({ type: 'Text', text: /¤ uses tokens/ })).toBeDefined()
    await band.unmount()
  }
})

test('/seat-guard quiet silences a session of planner seats, and on brings the flags back', async ($, on) => {
  const { toasts, clock, seatOf } = world(on)

  await start($)

  expect((await seatGuard($, 'quiet')).text).toContain('quiet for this session')

  await step($, clock, 'unattended-1', FABLE)

  expect(await edit($, 'unattended-1', 'src/world/tiles.gd')).toMatchObject({ result: 'ok' })
  expect(seatOf('unattended-1')).toMatchObject({ verdict: 'none', codeEdits: 1 })
  expect(toasts).toEqual([])
  expect(await bandButtons($)).toBe(0)
  expect(await counts($)).toBe('seats fable-5-1 1 · 1 live · quiet')

  expect((await seatGuard($, 'on')).text).toContain('Seat Guard: on.')
  await edit($, 'unattended-1', 'src/world/tiles.gd')

  expect(seatOf('unattended-1')).toMatchObject({ verdict: 'flagged', codeEdits: 2 })
  expect(toasts).toHaveLength(1)
  expect(await bandButtons($)).toBe(4)
})

test('the Quiet button lowers the band for the rest of the session', async ($, on) => {
  const { toasts, clock } = world(on)

  await start($)
  await step($, clock, 'first-1', FABLE)
  await edit($, 'first-1', 'src/a.gd')

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await band.press({ key: 'seat-quiet' })
  await band.unmount()

  await step($, clock, 'second-1', FABLE)
  await edit($, 'second-1', 'src/b.gd')

  expect(await bandButtons($)).toBe(0)
  expect(toasts).toHaveLength(1)
})

test('a planner seat writing documents, and a writer seat editing code, are left alone', async ($, on) => {
  const { toasts, clock, seatOf } = world(on)

  await start($)
  await step($, clock, 'planner-2', FABLE)
  await edit($, 'planner-2', 'docs/HANDOFF.md')
  await step($, clock, 'writer-2', OPUS)
  await edit($, 'writer-2', 'src/hud/reticle.gd')

  expect(seatOf('planner-2')).toMatchObject({ verdict: 'none', codeEdits: 0 })
  expect(seatOf('writer-2')).toMatchObject({ verdict: 'none', codeEdits: 0 })
  expect(toasts).toEqual([])

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await band.find({ type: 'Button' })).toBeUndefined()
  await band.unmount()
})

test('Swap sends the seat\'s later requests to the writer model and no one else\'s', async ($, on) => {
  const { sent, clock, seatOf } = world(on)

  await start($)
  await step($, clock, 'swap-1', FABLE)
  await step($, clock, 'other-1', FABLE)
  await edit($, 'swap-1', 'src/player/dash.gd')

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await band.press({ key: 'seat-swap' })

  expect(await band.find({ type: 'Button' })).toBeUndefined()
  await band.unmount()

  await step($, clock, 'swap-1', FABLE, 1)
  await step($, clock, 'other-1', FABLE, 1)
  await step($, clock, undefined, FABLE)

  expect(sent.slice(2)).toEqual([
    { agentId: 'swap-1', model: OPUS },
    { agentId: 'other-1', model: FABLE },
    { model: FABLE },
  ])
  expect(seatOf('swap-1')).toMatchObject({ verdict: 'none', swappedTo: OPUS })

  // On the writer model now: its further edits are a writer's.
  await edit($, 'swap-1', 'src/player/dash.gd')

  expect(seatOf('swap-1')).toMatchObject({ verdict: 'none', codeEdits: 1 })
})

test('Stop ends the seat at its next request with no request sent, and refuses its tools meanwhile', async ($, on) => {
  const { sent, clock, seatOf } = world(on)

  await start($)
  await step($, clock, 'stop-1', FABLE)
  await edit($, 'stop-1', 'src/world/tiles.gd')

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await band.press({ key: 'seat-stop' })
  await band.unmount()

  const refused = await edit($, 'stop-1', 'src/world/tiles.gd')

  expect(JSON.stringify(refused)).toContain('the user stopped this seat')

  const answer = await step($, clock, 'stop-1', FABLE, 1)

  expect(answer).toContain('Stopped by the user from Seat Guard before finishing.')
  expect(answer).toContain('it had made 1 code edit (last: src/world/tiles.gd)')
  expect(sent).toEqual([{ agentId: 'stop-1', model: FABLE }])
  expect(seatOf('stop-1')).toMatchObject({ verdict: 'stopped' })
})

test('Allow lowers the band and lets the seat go on', async ($, on) => {
  const { sent, clock, seatOf } = world(on)

  await start($)
  await step($, clock, 'allow-1', FABLE)
  await edit($, 'allow-1', 'tools/gate.mjs')

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await band.press({ key: 'seat-allow' })

  expect(await band.find({ type: 'Button' })).toBeUndefined()
  await band.unmount()

  expect(await edit($, 'allow-1', 'tools/gate.mjs')).toMatchObject({ result: 'ok' })
  await step($, clock, 'allow-1', FABLE, 1)

  expect(seatOf('allow-1')).toMatchObject({ verdict: 'allowed', codeEdits: 2 })
  expect(sent.at(-1)).toEqual({ agentId: 'allow-1', model: FABLE })
})

test('the band counts seats by model and Codex launches in one dim line, and pins no status row', async ($, on) => {
  const { status, clock } = world(on)

  await start($)

  expect(await counts($)).toBeUndefined()

  await $.agent.spawn({
    tool_use_id: 'toolu_named-1',
    prompt: 'do the work',
    description: 'plan the sprint',
    subagentType: 'Plan',
    provider: { plugin: 'engine', tier: 'core' },
    model: FABLE,
    parentModel: OPUS,
    background: true,
    fork: false,
  })
  await step($, clock, 'named-1', FABLE)
  await step($, clock, 'wf-1', OPUS)
  await step($, clock, 'wf-2', OPUS)
  await $.tool.call({ tool: 'Bash', command: 'codex exec -m gpt-6-astra "build the lane"', agentId: 'wf-1' } as never)
  await $.tool.call({ tool: 'Bash', command: 'cd lanes && timeout 600 codex exec --model gpt-6-astra "review"' })
  // Words in an echo or a search are not a launch.
  await $.tool.call({ tool: 'Bash', command: 'echo codex exec -m gpt-5.5; ccq bash --grep "codex exec"' })
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't-wf-2', agentId: 'wf-2', reason: 'answer' })

  expect(await counts($)).toBe('seats fable-5-1 1 · opus-5-5 2 · gpt-6-astra 2 · 2 live')
  // The engine paints a status row as a warning: the counts are never one.
  expect(status.every(text => text === undefined)).toBe(true)
})

test('the five-hour window is called out once when it passes 85 percent', async ($, on) => {
  const { toasts, clock } = world(on)
  const measure = (percentUsed: number) =>
    $.session.measure({
      context: { window: 1_000_000 },
      rateLimits: [{ kind: 'five_hour', percentUsed, resetsAt: '2026-10-03T01:12:00Z' }],
      changed: ['rateLimits'],
    })

  await start($)
  await step($, clock, 'live-1', OPUS)
  await measure(84)

  expect(toasts).toEqual([])

  await measure(86)
  await measure(91)

  expect(toasts).toEqual(['Seat Guard: the 5h window is at 86%, resets in 1h12; 1 Claude seat live.'])
})

const spawn = ($: Engine, id: string, prompt: string, description: string) =>
  $.agent.spawn({
    tool_use_id: `toolu_${id}`,
    prompt,
    description,
    subagentType: 'general-purpose',
    provider: { plugin: 'engine', tier: 'core' },
    model: OPUS,
    parentModel: OPUS,
    background: true,
    fork: false,
  })

const done = ($: Engine, agentId: string, usage?: { input: number; output: number; read: number; written: number }) =>
  $.turn.complete({
    answer: 'ok',
    durationMs: 1,
    isAborted: false,
    turnId: `t-${agentId}`,
    agentId,
    reason: 'answer',
    ...(usage === undefined
      ? {}
      : {
          usage: {
            model: OPUS,
            input_tokens: usage.input,
            output_tokens: usage.output,
            cache_read_input_tokens: usage.read,
            cache_creation_input_tokens: usage.written,
          },
        }),
  })

test('a seat is named by the tag on the first line of its opening prompt', async ($, on) => {
  const { clock, seatOf, openings } = world(on)

  await start($)

  // A workflow agent raises no agent.spawn: its tag is read from its own conversation.
  openings.set('wf-build', '[seat crucible:parser#2 build]\nYou are the Builder for target "parser", iteration 2.')
  await step($, clock, 'wf-build', OPUS)

  expect(seatOf('wf-build')).toMatchObject({ tag: 'crucible:parser#2 build', steps: 1 })

  // An Agent-tool seat carries it on the prompt it was spawned with.
  await spawn($, 'critic-1', '  [seat gauntlet:street#3 critic:opus]\nScore the street scene.', 'Gauntlet critic')

  expect(seatOf('critic-1')).toMatchObject({ tag: 'gauntlet:street#3 critic:opus', label: 'Gauntlet critic' })

  // No tag line, or one further down, names nothing.
  openings.set('wf-plain', 'You are the Evidence stage.\n[seat not-a-first-line]')
  await step($, clock, 'wf-plain', OPUS)
  await spawn($, 'plain-1', 'do the work', 'Blitz task #42')

  expect(seatOf('wf-plain')).toMatchObject({ tag: '' })
  expect(seatOf('plain-1')).toMatchObject({ tag: '' })

  // A seat whose conversation cannot be read is still counted.
  await step($, clock, 'wf-unread', OPUS)

  expect(seatOf('wf-unread')).toMatchObject({ tag: '', steps: 1 })
})

test('a workflow agent is named by the seat line of its computed task, not by the relayed user request', async ($, on) => {
  const { clock, seatOf, openings } = world(on)

  await start($)

  // The harness relays what the person typed, then indents the script's text under a header.
  openings.set(
    'wf-framed',
    framed('run the crucible loop\n[seat quoted:by-the-user#9 build]', '[seat crucible:parser#3 evidence]\nYou are the Evidence stage.'),
  )
  await step($, clock, 'wf-framed', OPUS)

  expect(seatOf('wf-framed')).toMatchObject({ tag: 'crucible:parser#3 evidence' })

  // The same two rows, seen as they are stored to a conversation that cannot be read back.
  const [request = '', task = ''] = framed('do the thing', '[seat gauntlet:street#4 critique:opus]\nScore it.').split(ROW_BREAK)

  for (const text of [request, task, 'a tool result\n[seat too:late#2 build]']) {
    // The kit has no store beneath this event, so the dispatch rejects after the mod's hook has run.
    await $.session
      .append({
        message: { type: 'user', role: 'user', content: [{ type: 'text', text }] },
        door: 'prompt',
        origin: { kind: 'engine' },
        uuid: `row-${text.length}`,
        agentId: 'wf-stored',
      } as never)
      .catch(() => undefined)
  }

  await step($, clock, 'wf-stored', OPUS)

  expect(seatOf('wf-stored')).toMatchObject({ tag: 'gauntlet:street#4 critique:opus', steps: 1 })

  // A script whose text opens with anything else names no seat, whatever the person's request held.
  openings.set('wf-untagged', framed('[seat quoted:by-the-user#9 build]', 'You are the Builder.\n[seat too:late#1 build]'))
  await step($, clock, 'wf-untagged', OPUS)

  expect(seatOf('wf-untagged')).toMatchObject({ tag: '' })
})

test('the ledger gives each seat the model its requests reached and the Codex runs it made', async ($, on) => {
  const { clock, seatOf, openings } = world(on)

  await start($)

  expect((await seatGuard($, 'ledger')).text).toBe(
    'Seat Guard ledger: what the engine ran, not what a seat reported.\nNo seat has run in this session.\norchestrator: opus-5-5 · context 143000 tokens',
  )

  openings.set('wf-build', '[seat crucible:parser#2 build]\nYou are the Builder.')
  await step($, clock, 'wf-build', OPUS, 0)
  await step($, clock, 'wf-build', OPUS, 1)
  await done($, 'wf-build', { input: 100, output: 40, read: 2_000, written: 300 })

  // A wrapper seat planned for Codex: one run dies, the retry lands.
  openings.set('wf-critic', '[seat crucible:parser#2 critic:codex]\nRun this critique through the Codex companion.')
  await step($, clock, 'wf-critic', FABLE)
  await $.tool.call({
    tool: 'Bash',
    command: 'COMPANION=$(ls -d ~/x/codex-companion.mjs | tail -1); node "$COMPANION" task --sandbox-down "critique"',
    agentId: 'wf-critic',
  } as never)
  await $.tool.call({ tool: 'Bash', command: 'node /c/x/scripts/codex-companion.mjs task "critique"', agentId: 'wf-critic' } as never)
  await $.tool.call({ tool: 'Bash', command: 'codex exec -m gpt-5.5 "build"', agentId: 'wf-critic' } as never)
  // Looking the companion up is not running it.
  await $.tool.call({ tool: 'Bash', command: 'ls -d ~/x/codex-companion.mjs | sort -V | tail -1', agentId: 'wf-critic' } as never)

  expect(seatOf('wf-critic')?.launched).toEqual([
    { model: 'codex-companion', isOk: false },
    { model: 'codex-companion', isOk: true },
    { model: 'gpt-5.5', isOk: true },
  ])

  await spawn($, 'other-1', 'do the work', 'Blitz task #42')

  const all = (await seatGuard($, 'ledger')).text

  expect(all).toContain('3 of 3 seats. Tokens are each seat’s finished turns: input, cache and output.')
  expect(all).toContain('| seat | model | codex launched | requests | tokens | state |')
  expect(all).toContain('| crucible:parser#2 build | opus-5-5 | — | 2 | 2440 | done |')
  expect(all).toContain(
    '| crucible:parser#2 critic:codex | fable-5-1 | codex-companion (failed), codex-companion, gpt-5.5 | 1 | 0 | live |',
  )
  expect(all).toContain('| Blitz task #42 | opus-5-5 | — | 0 | 0 | live |')
  expect(all).toContain('orchestrator: opus-5-5 · context 143000 tokens')
  expect(all).toContain('codex launches, all loops: codex-companion 2 · gpt-5.5 1')

  const one = (await seatGuard($, 'ledger PARSER#2 BUILD')).text

  expect(one).toContain('1 of 3 seats matching “PARSER#2 BUILD”.')
  expect(one).toContain('| crucible:parser#2 build |')
  expect(one).not.toContain('critic:codex')
  expect((await seatGuard($, 'ledger nothing-like-this')).text).toContain(
    'No seat has run in this session matching “nothing-like-this”.',
  )
})

test('the ledger tool hands the model the same record, and a swapped seat shows both models', async ($, on) => {
  const { clock, openings } = world(on)

  await start($)
  openings.set('wf-plan', '[seat gauntlet:street#1 build]\nBuild the street scene.')
  await step($, clock, 'wf-plan', FABLE)
  await edit($, 'wf-plan', 'src/street.gd')

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await band.press({ key: 'seat-swap' })
  await band.unmount()
  await step($, clock, 'wf-plan', FABLE, 1)

  const answer = await $.tool.call({ tool: 'mcp__seat-guard__ledger', filter: ' street#1 ' } as never)

  expect(answer).toMatchObject({ result: expect.stringContaining('| gauntlet:street#1 build | fable-5-1 → opus-5-5 | — | 2 | 0 | live |') })
  expect(await $.tool.call({ tool: 'mcp__seat-guard__ledger' } as never)).toMatchObject({
    result: expect.stringContaining('1 of 1 seat.'),
  })
})
