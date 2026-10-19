import type { AgentInfo, On, SessionMessage } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { Parked, Run } from '../types'

const MIN = 60_000

const BAND = {
  plugin: 'run-watch',
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

const PANE = {
  plugin: 'run-watch',
  component: 'Pane',
  requestId: 'run-watch',
  props: {
    title: 'Run Watch',
    isFocused: false,
    bodyColumns: 48,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const TRANSCRIPT: SessionMessage[] = [
  {
    role: 'assistant',
    text: 'Running the validator now.',
    toolUses: [{ tool_use_id: 'toolu_v', tool: 'Bash', input: { command: 'python validate.py' } }],
  },
]

/** The world beneath the mod: a clock the test moves, and what it showed and asked for. */
const world = (on: On, agents: AgentInfo[] = []) => {
  const toasts: string[] = []
  const submitted: string[] = []
  const stopped: string[] = []
  const written = new Map<string, unknown>()
  const clock = mock.clock(on, { now: 1_000 * MIN })

  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('state.set', (_$, e, next) => {
    written.set(e.key, e.value)

    return next(e)
  })
  on('agent.list', () => ({ value: agents }))
  on('agent.spawn', (_$, e) => ({
    model: 'claude-opus-5-5',
    agentId: e.tool_use_id.replace('toolu_', ''),
  }))
  on('tool.call', (_$, e) => {
    if (e.tool === 'TaskStop') {
      stopped.push(e.task_id ?? '')
    }

    return { result: 'ok' }
  })
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('classic.Stop', () => ({}))
  on('prompt.submit', (_$, e) => {
    submitted.push(e.text)

    return { text: e.text }
  })
  on('session.messages', () => ({ value: TRANSCRIPT }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  // The engine draws nothing of its own in the band.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })

  const runOf = (id: string) => (written.get('runs') as Run[] | undefined)?.find(run => run.id === id)
  const parked = () => (written.get('parked') as Parked[] | undefined) ?? []

  return { clock, toasts, submitted, stopped, runOf, parked }
}

const start = ($: Engine) =>
  $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

const spawn = ($: Engine, agentId: string, description: string) =>
  $.agent.spawn({
    tool_use_id: `toolu_${agentId}`,
    prompt: 'do the work',
    description,
    subagentType: 'general-purpose',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: true,
    fork: false,
  })

/** How many buttons the band shows: none while the mod has nothing to flag. */
const bandButtons = async ($: Engine) => {
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const count = (await band.findAll({ type: 'Button' })).length

  await band.unmount()

  return count
}

const listed = (id: string, description: string): AgentInfo => ({
  id,
  description,
  type: 'general-purpose',
  status: 'running',
})

test('a spawned agent is a running row until its turn ends', async ($, on) => {
  const { runOf } = world(on)

  await start($)
  await spawn($, 'spawned-1', 'map the routes')

  expect(runOf('spawned-1')).toMatchObject({
    label: 'map the routes',
    kind: 'agent',
    model: 'claude-opus-5-5',
    status: 'running',
  })

  await $.turn.complete({
    answer: 'done',
    durationMs: 5,
    isAborted: false,
    turnId: 't1',
    agentId: 'spawned-1',
    reason: 'answer',
  })

  expect(runOf('spawned-1')).toMatchObject({ status: 'ended' })
})

test('thirty quiet minutes is a soft warning: one toast, the row turned, no band', async ($, on) => {
  const { clock, toasts, runOf } = world(on, [listed('soft-1', 'build the hero rig')])

  await start($)
  await spawn($, 'soft-1', 'build the hero rig')
  await clock.advance(29 * MIN)

  expect(toasts).toEqual([])

  await clock.advance(2 * MIN)

  // The toast is raised by the tick that crosses the threshold.
  expect(toasts).toEqual(['Run Watch: “build the hero rig” quiet 30m'])
  expect(runOf('soft-1')).toMatchObject({ alertLevel: 1 })

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await pane.find({ type: 'Text', text: /1 running · 1 quiet/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /! build the hero rig/ })).toBeDefined()
  expect(await pane.find({ type: 'Button', text: 'Wake ¤' })).toBeDefined()
  await pane.unmount()

  // The band waits for the main threshold: nothing of the mod's is drawn there.
  expect(await bandButtons($)).toBe(0)
})

test('an hour quiet holds the band, with each action and what costs tokens marked', async ($, on) => {
  const { clock, toasts } = world(on, [listed('main-1', 'port the shaders')])

  await start($)
  await spawn($, 'main-1', 'port the shaders')
  await clock.advance(61 * MIN)

  expect(toasts).toHaveLength(2)
  expect(toasts[1]).toContain('“port the shaders” quiet 1h00')

  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ ...BAND, surface })

    expect(await band.find({ type: 'Text', text: /port the shaders” quiet 1h01/ })).toBeDefined()
    expect(await band.find({ type: 'Button', text: 'Wake ¤' })).toBeDefined()
    expect(await band.find({ type: 'Button', text: 'Inspect' })).toBeDefined()
    expect(await band.find({ type: 'Button', text: 'Close' })).toBeDefined()
    expect(await band.find({ type: 'Button', text: 'Resubmit ¤' })).toBeDefined()
    expect(await band.find({ type: 'Text', text: /¤ uses tokens/ })).toBeDefined()
    await band.unmount()
  }

  await clock.advance(60 * MIN)

  expect(toasts).toHaveLength(3)
  expect(toasts[2]).toContain('quiet 2h00')
})

test('Wake hands the main session a prompt and lowers the band until the quiet doubles', async ($, on) => {
  const { clock, submitted } = world(on, [listed('wake-1', 'rig the heroes')])

  await start($)
  await spawn($, 'wake-1', 'rig the heroes')
  await clock.advance(61 * MIN)

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await band.press({ key: 'band-wake' })
  await band.unmount()
  await clock.advance(50)

  expect(submitted).toHaveLength(1)
  expect(submitted[0]).toContain('The agent “rig the heroes” (wake-1) has made no tool call for 1h01')
  expect(submitted[0]).toContain('Check on it without restarting it')
  expect(await bandButtons($)).toBe(0)

  await clock.advance(60 * MIN)

  const again = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await again.find({ type: 'Text', text: /rig the heroes” quiet 2h/ })).toBeDefined()
  await again.unmount()
})

test('Resubmit asks the main session to stop the run and start it afresh', async ($, on) => {
  const { clock, submitted } = world(on, [listed('again-1', 'draft the story bible')])

  await start($)
  await spawn($, 'again-1', 'draft the story bible')
  await clock.advance(61 * MIN)

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await band.press({ key: 'band-resubmit' })
  await band.unmount()
  await clock.advance(50)

  expect(submitted).toHaveLength(1)
  expect(submitted[0]).toContain('“draft the story bible” (again-1)')
  expect(submitted[0]).toContain('hand its task to a fresh agent')
})

test('Close stops the agent without a prompt, and Inspect shows its transcript', async ($, on) => {
  const { clock, submitted, stopped, runOf, toasts } = world(on, [listed('close-1', 'validate the level data')])

  await start($)
  await spawn($, 'close-1', 'validate the level data')
  await clock.advance(31 * MIN)

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await pane.press({ key: 'inspect-close-1' })

  expect(await pane.find({ type: 'Text', text: /says: Running the validator now\./ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Bash python validate\.py → still running/ })).toBeDefined()

  await pane.press({ key: 'close-close-1' })
  await pane.unmount()
  await clock.advance(50)

  expect(stopped).toEqual(['close-1'])
  expect(runOf('close-1')).toMatchObject({ status: 'ended' })
  expect(toasts.at(-1)).toBe('Run Watch: stopped “validate the level data”')
  expect(submitted).toEqual([])
})

test('a tool call in the run clears its flag', async ($, on) => {
  const { clock, toasts, runOf } = world(on, [listed('wakes-1', 'port the shaders')])

  await start($)
  await spawn($, 'wakes-1', 'port the shaders')
  await clock.advance(31 * MIN)

  expect(toasts).toHaveLength(1)

  await $.tool.call({ tool: 'Bash', command: 'npm test', agentId: 'wakes-1' } as never)
  await clock.advance(MIN)

  // Moving again: the flag is down, so neither the pane nor the band marks it.
  expect(runOf('wakes-1')).toMatchObject({ alertLevel: 0, busyTool: '' })
  expect(clock.now() - (runOf('wakes-1')?.lastAt ?? 0)).toBeLessThan(30 * MIN)
  expect(toasts).toHaveLength(1)
})

test('an agent the engine lists as killed is marked failed and said so', async ($, on) => {
  const agents: AgentInfo[] = [listed('killed-1', 'review lane b556')]
  const { clock, toasts, runOf } = world(on, agents)

  await start($)
  await spawn($, 'killed-1', 'review lane b556')
  agents[0] = { ...listed('killed-1', 'review lane b556'), status: 'killed' }
  await clock.advance(MIN)

  expect(runOf('killed-1')).toMatchObject({ status: 'failed' })
  expect(toasts).toEqual(['Run Watch: “review lane b556” ended as killed'])

  // A failed run holds the band at once; closing it dismisses the row.
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await band.find({ type: 'Button', text: 'Wake ¤' })).toBeUndefined()
  expect(await band.find({ type: 'Button', text: 'Resubmit ¤' })).toBeDefined()
  await band.press({ key: 'band-close' })
  await band.unmount()

  expect(runOf('killed-1')).toBeUndefined()
})

test('a loop no list names is a row while its workflow is in flight', async ($, on) => {
  const { runOf } = world(on)

  await start($)
  await $.tool.call({ tool: 'Bash', command: 'cargo test', agentId: 'wf-agent-1' } as never)

  await $.classic.Stop({
    stop_hook_active: false,
    background_tasks: [
      { id: 'wf_1', type: 'workflow', status: 'running', description: 'sprint wave', name: 'sprint-blitz-review' },
    ],
  })

  expect(runOf('wf-agent-1')).toMatchObject({ kind: 'unlisted', status: 'running' })

  await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })

  expect(runOf('wf-agent-1')).toMatchObject({ status: 'ended' })
})

test('an idle session waiting on a background shell is warned at thirty minutes and flagged at an hour', async ($, on) => {
  const { clock, toasts, parked, submitted, stopped } = world(on)

  await start($)
  await $.classic.Stop({
    stop_hook_active: false,
    background_tasks: [
      { id: 'sh_1', type: 'shell', status: 'running', description: 'validator', command: 'python validate.py' },
    ],
  })

  expect(parked()).toMatchObject([{ id: 'sh_1', label: 'python validate.py' }])

  await clock.advance(31 * MIN)

  expect(toasts).toEqual(['Run Watch: nothing has moved for 30m, waiting on shell: python validate.py'])
  expect(await bandButtons($)).toBe(0)

  await clock.advance(30 * MIN)

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await band.find({ type: 'Text', text: /nothing has moved for 1h01, waiting on 1 background task/ })).toBeDefined()
  await band.press({ key: 'band-wake' })
  await clock.advance(50)

  expect(submitted).toHaveLength(1)
  expect(submitted[0]).toContain('waiting on a background shell (sh_1): python validate.py')

  await band.unmount()

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await pane.press({ key: 'close-sh_1' })
  await pane.unmount()

  expect(stopped).toEqual(['sh_1'])
  expect(parked()).toEqual([])
})
