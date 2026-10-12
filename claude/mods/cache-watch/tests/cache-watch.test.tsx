import type { ModelForkResult, ModelUsage, On, SessionMessage, SessionRateLimit, TurnUsage } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { Ledger } from '../types'

const MIN = 60_000
const OPUS = 'claude-opus-5-5'
const SONNET = 'claude-sonnet-5-5'
const HAIKU = 'claude-haiku-4-5-20251001'
/** A subscription inside its plan's usage: the main conversation gets the hour. */
const PLAN: SessionRateLimit[] = [{ kind: 'five_hour', percentUsed: 20 }]

/** A steady turn over a 102k prefix: nearly all of it read, the last exchange written. */
const STEADY: ModelUsage = {
  input_tokens: 10,
  output_tokens: 500,
  cache_read_input_tokens: 100_000,
  cache_creation_input_tokens: 2_000,
}

/** A turn over a 500k prefix, where a lapse costs dollars. */
const LARGE: ModelUsage = {
  input_tokens: 10,
  output_tokens: 500,
  cache_read_input_tokens: 498_000,
  cache_creation_input_tokens: 2_000,
}

const MESSAGES: SessionMessage[] = [{ role: 'user', text: 'A long conversation.', toolUses: [] }]

/** What the fork answers when asked for the handoff: the document, with a code fence of its own, then the two prompts. */
const REPLY = `\`\`\`handoff-doc
## Goal
Ship the fidelity upgrade.

## Done
- itr#220 landed as abc1234.

\`\`\`sh
cargo test --all-targets
\`\`\`

## Open
- itr#221 is next.
\`\`\`

\`\`\`handoff-compact
Keep: epic itr#215, the capture fix is still open.
\`\`\`

\`\`\`handoff-wake
Read the handoff file fully first, then start with itr#221.
\`\`\``

const BAND = {
  plugin: 'cache-watch',
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
  plugin: 'cache-watch',
  component: 'Pane',
  requestId: 'cache-watch',
  props: {
    title: 'Cache Watch',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

/** The world beneath the mod: a clock the test moves, an API that answers, and what was shown. */
const world = (
  on: On,
  limits: SessionRateLimit[] = PLAN,
  variables: Record<string, string> = {},
  given: Record<string, string> = {},
) => {
  const toasts: string[] = []
  const written = new Map<string, unknown>()
  /** The brief each compaction's summarizer was given. */
  const compactions: (string | undefined)[] = []
  /** The prompt of each fork the mod asked for. */
  const forks: string[] = []
  /** The project's files, by path as the test spells it; the kit hands the mod the host's spelling. */
  const files = new Map<string, string>(Object.entries(given))
  const keyOf = (path: string) => path.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')
  const box = { text: '' }
  const clock = mock.clock(on, { now: 1_000 * MIN })
  let answer: TurnUsage | null = null
  let forkReply: ModelForkResult = { isAnswered: true, text: REPLY, usage: STEADY }
  /** How full the context is, as the engine would report it; undefined until a test says. */
  let percent: number | undefined

  mock.env(on, variables)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { window: 1_000_000, ...(percent === undefined ? {} : { percent }) },
      rateLimits: limits,
    },
  }))
  on('session.model', () => ({ value: HAIKU }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.root', () => ({ value: '/repo/sub' }))
  on('session.repo', () => ({ value: { name: 'repo', root: '/repo', remote: null, internal: false } }))
  on('fs.read', (_$, e) => {
    const text = files.get(keyOf(e.path))

    return text === undefined ? { deny: 'no such file' } : { value: text }
  })
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('session.compact', (_$, e) => {
    compactions.push(e.instructions)

    return {
      messages: [{ role: 'user' as const, text: 'The summary.', toolUses: [] }],
      tokensAfter: 30_000,
    }
  })
  on('model.fork', (_$, e) => {
    forks.push(e.prompt)

    return { value: forkReply }
  })
  on('fs.write', (_$, e) => {
    files.set(keyOf(e.path), e.text)

    return { value: undefined }
  })
  on('prompt.read', () => ({ value: { text: box.text, cursor: box.text.length } }))
  on('prompt.fill', (_$, e) => {
    box.text = e.text

    return { isFilled: true, text: e.text }
  })
  on('settings.read', () => ({ value: {} }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('tool.list', () => ({ value: [{ name: 'Bash', description: 'Runs a command', mcp: false }] }))
  on('state.set', (_$, e, next) => {
    written.set(e.key, e.value)

    return next(e)
  })
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn' as const,
      usage: answer,
    }
  })
  on('classic.SessionStart', () => ({}))
  on('classic.PostModelSwitch', () => ({}))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  // What the band holds beneath the mod: another mod's row, or the engine's nothing.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box key="beneath" />
  })

  /** One model request and its response, in the main loop or in a subagent's. */
  const respond = async ($: Engine, usage: ModelUsage, model = OPUS, agentId?: string) => {
    answer = { ...usage, model }

    const stream = $.turn.step({
      turnId: 't1',
      index: 0,
      model,
      effort: 'high',
      messageCount: 2,
      ...(agentId === undefined ? {} : { agentId }),
    })

    for await (const _chunk of stream) {
      // The response's chunks are not what is under test.
    }

    await clock.settle()
  }

  const held = () => written.get('ledger') as Ledger
  const setFork = (reply: ModelForkResult) => {
    forkReply = reply
  }
  const setPercent = (share: number) => {
    percent = share
  }

  return { clock, toasts, held, respond, compactions, forks, files, box, setFork, setPercent }
}

const command = ($: Engine, args: string) =>
  $.command.run({
    command: 'cache-watch',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 200 },
  })

const start = ($: Engine) =>
  $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

/** The mod's line above the prompt: its words and the colour of its head; undefined when it draws none. */
const band = async ($: Engine) => {
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const parts = await ui.findAll({ type: 'Text' })

  await ui.unmount()

  return parts.length === 0
    ? undefined
    : { text: parts.map(part => part.text).join(''), tone: parts[0]?.props.color }
}

test('a response makes the cache warm: how long, how large, and what the next turn costs', async ($, on) => {
  const { respond, held } = world(on)

  await start($)

  expect(await band($)).toBeUndefined()

  await respond($, STEADY)

  expect(held()).toMatchObject({ ttl: '1h', ttlSource: 'plan', cached: 102_000, tail: 510 })
  expect(await band($)).toEqual({
    text: 'cache ▰▰▰▰▰ 60m · 103k · next $0.02 · cold $0.82 · hit 98%',
    tone: 'success',
  })
})

test('the reading runs down green, turns yellow on its last fifth and red once cold', async ($, on) => {
  const { clock, respond } = world(on)

  await start($)
  await respond($, STEADY)
  await clock.advance(40 * MIN)

  expect(await band($)).toEqual({
    text: 'cache ▰▰▱▱▱ 20m · 103k · next $0.02 · cold $0.82 · hit 98%',
    tone: 'success',
  })

  await clock.advance(10 * MIN)

  expect(await band($)).toEqual({
    text: 'cache ▰▱▱▱▱ 10m · 103k · next $0.02 · cold $0.82 · hit 98%',
    tone: 'warning',
  })

  await clock.advance(6 * MIN)

  expect(await band($)).toMatchObject({ tone: 'warning' })
  expect((await band($))?.text).toContain('cache ▰▱▱▱▱ 4m00s')

  await clock.advance(5 * MIN)

  expect(await band($)).toEqual({
    text: 'cache ▱▱▱▱▱ cold · idle 1h01 · 103k · next $0.82 · hit 98%',
    tone: 'error',
  })
})

test('the band draws on every surface and keeps what other mods drew beneath it', async ($, on) => {
  const { respond } = world(on)

  await start($)
  await respond($, STEADY)

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })

    expect(await ui.find({ type: 'Text', text: /cache ▰▰▰▰▰ 60m/ })).toMatchObject({
      props: { color: 'success' },
    })
    expect(await ui.find({ type: 'Text', text: /103k · next \$0\.02 · cold \$0\.82/ })).toBeDefined()
    expect(await ui.find({ key: 'beneath' })).toBeDefined()
    await ui.unmount()
  }
})

test('the band stands aside while a survey holds it', async ($, on) => {
  const { respond } = world(on)

  await start($)
  await respond($, STEADY)

  const ui = await $.ui.mount({
    ...BAND,
    props: { ...BAND.props, hasSurvey: true },
    surface: 'terminal',
  })

  expect(await ui.findAll({ type: 'Text' })).toEqual([])
  expect(await ui.find({ key: 'beneath' })).toBeDefined()
  await ui.unmount()
})

test('with the band option off there is no line, only the pane and the toasts', { options: { band: false } }, async ($, on) => {
  const { respond, held } = world(on)

  await start($)
  await respond($, STEADY)

  expect(held().main.requests).toBe(1)
  expect(await band($)).toBeUndefined()
})

test('an idle session is warned once before a costly lapse', async ($, on) => {
  const { clock, toasts, respond } = world(on)

  await start($)
  await respond($, LARGE)
  await clock.advance(54 * MIN)

  expect(toasts).toEqual([])

  await clock.advance(2 * MIN)

  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toContain('cold in 5m00s')
  expect(toasts[0]).toContain('re-cache 501k for $4.00, not $0.10')

  await clock.advance(10 * MIN)

  expect(toasts).toHaveLength(1)
})

test('a request past the lifetime that reads nothing is a miss, with its cost and its cause', async ($, on) => {
  const { clock, toasts, held, respond } = world(on)

  await start($)
  await respond($, LARGE)
  await clock.advance(61 * MIN)
  await respond($, { ...LARGE, cache_read_input_tokens: 0, cache_creation_input_tokens: 500_000 })

  expect(held()).toMatchObject({ missCount: 1, missTokens: 500_000, rebuilds: 0 })
  expect(held().misses[0]).toMatchObject({ cause: 'ttl', tokens: 500_000, gapMs: 61 * MIN })
  expect(Math.round((held().misses[0]?.usd ?? 0) * 100)).toBe(390)
  expect(toasts[toasts.length - 1]).toBe(
    'Cache Watch: miss, 500k re-processed for $3.90 extra (idle past the lifetime)',
  )
})

test('a miss right after a model change is laid at the model', async ($, on) => {
  const { clock, held, respond } = world(on)

  await start($)
  await respond($, STEADY)
  await clock.advance(2 * MIN)
  await respond(
    $,
    { ...STEADY, cache_read_input_tokens: 0, cache_creation_input_tokens: 102_500 },
    SONNET,
  )

  expect(held().misses[0]).toMatchObject({ cause: 'model', tokens: 102_000 })
  expect(held().model).toBe(SONNET)
})

test('a compaction is an expected rebuild, not a miss; on auto it forks nothing', async ($, on) => {
  const { held, respond, forks, compactions } = world(on)

  await start($)
  await respond($, STEADY)
  await $.session.compact({ trigger: 'manual', messages: MESSAGES })

  expect(await band($)).toEqual({
    text: 'cache ▱▱▱▱▱ compacted · rebuilds next turn · 30.0k · next $0.24',
    tone: 'warning',
  })
  expect(forks).toEqual([])
  expect(compactions).toEqual([undefined])

  await respond($, { ...STEADY, cache_read_input_tokens: 20_000, cache_creation_input_tokens: 10_000 })

  expect(held()).toMatchObject({ rebuilds: 1, missCount: 0, pending: '', cached: 30_000 })
})

test('auto+summary forks the warm cache for a handoff, writes the file, briefs the summarizer and queues the wake prompt', { options: { compact: 'auto+summary' } }, async ($, on) => {
  const { clock, toasts, respond, forks, files, compactions, box, held } = world(on)

  await start($)
  await respond($, STEADY)
  await $.session.compact({ trigger: 'auto', messages: MESSAGES })
  await clock.advance(1_000)

  expect(forks).toHaveLength(1)
  expect(forks[0]).toContain('about to be compacted')
  expect(forks[0]).toContain('```handoff-wake')

  const [path = '', text = ''] = [...files.entries()][0] ?? []

  expect(/[\\/]repo[\\/]auto-compact-handoff-\d{4}-\d{2}-\d{2}-\d{4}\.md$/.test(path)).toBe(true)
  expect(text).toContain('# Auto-compact handoff · ')
  expect(text).toContain('Read it fully before any other work.')
  // The document is read up to the next block, so its own code fence does not cut it short.
  expect(text).toContain('cargo test --all-targets')
  expect(text).toContain('- itr#221 is next.')
  expect(text).toContain('haiku-4-5')

  expect(compactions).toHaveLength(1)
  expect(compactions[0]).toContain('Keep: epic itr#215, the capture fix is still open.')
  // The kit hands fs.write the host's spelling of the path; the brief names the same file.
  expect(compactions[0]).toContain(`The handoff document is at `)
  expect(compactions[0]).toContain(path.slice(path.lastIndexOf('auto-compact-handoff-')))
  expect(held()).toMatchObject({ pending: 'compact', pendingTokens: 30_000 })
  expect(box.text).toBe('Read the handoff file fully first, then start with itr#221.')
  expect(toasts.at(-1)).toContain('compacted after writing auto-compact-handoff-')
  expect(toasts.at(-1)).toContain('The wake prompt is in the input box')
})

test('auto+summary keeps the person’s own /compact instructions after its brief', { options: { compact: 'auto+summary' } }, async ($, on) => {
  const { clock, respond, compactions, box } = world(on)

  await start($)
  await respond($, STEADY)
  box.text = 'half a thought'
  await $.session.compact({ trigger: 'manual', instructions: 'and the open bugs', messages: MESSAGES })
  await clock.advance(1_000)

  expect(compactions[0]?.endsWith('\n\nand the open bugs')).toBe(true)
  expect(box.text).toBe('half a thought')

  box.text = ''

  expect((await command($, 'wake')).text).toBe(
    'Cache Watch: The wake prompt is in the input box; Enter resumes.',
  )
  expect(box.text).toBe('Read the handoff file fully first, then start with itr#221.')
})

test('a fork that cannot answer leaves the compaction as it was', { options: { compact: 'auto+summary' } }, async ($, on) => {
  const { clock, toasts, respond, files, compactions, box, setFork } = world(on)

  setFork({ isAnswered: false, reason: 'aborted', usage: STEADY })
  await start($)
  await respond($, STEADY)
  await $.session.compact({ trigger: 'auto', messages: MESSAGES })
  await clock.advance(1_000)

  expect(files.size).toBe(0)
  expect(compactions).toEqual([undefined])
  expect(box.text).toBe('')
  expect(toasts.at(-1)).toBe('Cache Watch: no handoff written (the turn was interrupted); compacting as usual')
})

test('a subagent’s or a precomputed compaction is never forked', { options: { compact: 'auto+summary' } }, async ($, on) => {
  const { respond, forks } = world(on)

  await start($)
  await respond($, STEADY)
  await $.session.compact({ trigger: 'precompute', messages: MESSAGES })
  await $.session.compact({ trigger: 'auto', agentId: 'agent-1', messages: MESSAGES })

  expect(forks).toEqual([])
})

test('manual holds off the engine’s threshold compaction, says so once, and lets /compact through plainly', { options: { compact: 'manual' } }, async ($, on) => {
  const { toasts, forks, compactions, respond } = world(on)

  await start($)
  await respond($, STEADY)

  const held = await $.session.compact({ trigger: 'auto', messages: MESSAGES })

  expect(held.skip).toBe('Cache Watch: this project compacts by hand (.cache-watch: manual); /compact when ready')
  expect(compactions).toEqual([])
  expect(toasts).toEqual(['Cache Watch: compaction held off here (.cache-watch: manual); /compact when ready'])
  expect((await band($))?.text).toContain('· manual')

  await $.session.compact({ trigger: 'auto', messages: MESSAGES })

  expect(toasts).toHaveLength(1)

  await $.session.compact({ trigger: 'manual', messages: MESSAGES })

  expect(forks).toEqual([])
  expect(compactions).toEqual([undefined])
})

test('on auto the mod compacts on its own once the context crosses the threshold, between turns', async ($, on) => {
  const { clock, held, respond, compactions, forks, setPercent } = world(on)

  await start($)
  await respond($, STEADY)
  setPercent(84)
  await clock.advance(15_000)

  expect(compactions).toEqual([])

  setPercent(86)
  await clock.advance(15_000)

  expect(compactions).toEqual([undefined])
  expect(forks).toEqual([])
  expect(held()).toMatchObject({ pending: 'compact', pendingTokens: 30_000 })

  // Still over the threshold until the next response: judged once, not again every tick.
  await clock.advance(60_000)

  expect(compactions).toHaveLength(1)
})

test('on auto+summary the mod’s own compaction writes the handoff first', { options: { compact: 'auto+summary' } }, async ($, on) => {
  const { clock, respond, compactions, forks, files, box, setPercent } = world(on)

  await start($)
  await respond($, STEADY)
  setPercent(90)
  await clock.advance(15_000)
  await clock.advance(1_000)

  expect(forks).toHaveLength(1)
  expect([...files.keys()].some(path => path.includes('/repo/auto-compact-handoff-'))).toBe(true)
  expect(compactions).toHaveLength(1)
  expect(compactions[0]).toContain('Keep: epic itr#215')
  expect(box.text).toBe('Read the handoff file fully first, then start with itr#221.')
})

test('in a manual project the threshold only brings one word, no compaction', { options: { compact: 'manual' } }, async ($, on) => {
  const { clock, toasts, respond, compactions, setPercent } = world(on)

  await start($)
  await respond($, STEADY)
  setPercent(90)
  await clock.advance(15_000)
  await clock.advance(60_000)

  expect(compactions).toEqual([])
  expect(toasts).toEqual([
    'Cache Watch: compaction held off here (.cache-watch: manual), context at 90% of the window; /compact when ready',
  ])
})

test('/cache-watch summary and manual write the project’s .cache-watch and apply at once; an unknown word prints the usage', async ($, on) => {
  const { forks, files, respond } = world(on)

  await start($)
  await respond($, STEADY)

  const set = await command($, 'summary')

  expect(set.text).toContain('compaction set to auto+summary ¤')
  expect(set.text).toContain('.cache-watch')
  expect(files.get('/repo/.cache-watch')).toBe(
    '# Cache Watch: how this project compacts. compact: manual | auto | auto+summary. threshold: 10-99 (% of the window).\ncompact: auto+summary\n',
  )

  await $.session.compact({ trigger: 'auto', messages: MESSAGES })

  expect(forks).toHaveLength(1)
  expect((await command($, 'manual')).text).toContain('compaction set to manual')
  expect(files.get('/repo/.cache-watch')).toBe(
    '# Cache Watch: how this project compacts. compact: manual | auto | auto+summary. threshold: 10-99 (% of the window).\ncompact: manual\n',
  )
  expect((await $.session.compact({ trigger: 'auto', messages: MESSAGES })).skip).toBeDefined()
  expect((await command($, 'later')).text).toBe('Cache Watch: /cache-watch [manual | auto | summary | wake]')
})

test('the pane’s selector sets the mode with a press, marks the one in force, and the file follows', async ($, on) => {
  const { clock, forks, files, respond } = world(on)

  await start($)
  await respond($, STEADY)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Button', key: 'mode-auto' })).toMatchObject({ props: { variant: 'primary' } })
  expect(await ui.find({ type: 'Button', key: 'mode-manual' })).toMatchObject({ props: { variant: 'secondary' } })

  await ui.press({ key: 'mode-manual' })
  await clock.settle()

  expect(files.get('/repo/.cache-watch')).toBe(
    '# Cache Watch: how this project compacts. compact: manual | auto | auto+summary. threshold: 10-99 (% of the window).\ncompact: manual\n',
  )
  expect(await ui.find({ type: 'Button', key: 'mode-manual' })).toMatchObject({ props: { variant: 'primary' } })
  expect(await ui.find({ type: 'Text', text: /manual: nothing compacts on its own here/ })).toBeDefined()
  expect((await $.session.compact({ trigger: 'auto', messages: MESSAGES })).skip).toBeDefined()

  await ui.press({ key: 'mode-auto+summary' })
  await clock.settle()

  expect(files.get('/repo/.cache-watch')).toContain('compact: auto+summary\n')
  await $.session.compact({ trigger: 'auto', messages: MESSAGES })
  expect(forks).toHaveLength(1)
  await ui.unmount()
})

test('the project’s .cache-watch stands over the option, with its own threshold, and keeps its other lines', { options: { compact: 'manual' } }, async ($, on) => {
  const { clock, forks, files, compactions, respond, setPercent } = world(on, PLAN, {}, {
    '/repo/.cache-watch': 'threshold: 70\ncompact: auto + summary\n',
  })

  await start($)
  await respond($, STEADY)
  setPercent(75)
  await clock.advance(15_000)

  expect(forks).toHaveLength(1)
  expect(compactions).toHaveLength(1)

  await command($, 'auto')

  expect(files.get('/repo/.cache-watch')).toBe('threshold: 70\ncompact: auto\n')
})

test('a .cache-watch edited by hand is read again at the next compaction', async ($, on) => {
  const { files, toasts, respond } = world(on)

  await start($)
  await respond($, STEADY)
  files.set('/repo/.cache-watch', 'compact: manual\n')

  expect((await $.session.compact({ trigger: 'auto', messages: MESSAGES })).skip).toBeDefined()
  expect(toasts).toHaveLength(1)
})

test('off a subscription the lifetime is five minutes, until a hit after a longer gap proves the hour', async ($, on) => {
  const { clock, held, respond } = world(on, [])

  await start($)
  await respond($, STEADY)

  expect(held()).toMatchObject({ ttl: '5m', ttlSource: 'default' })
  expect(await band($)).toEqual({
    text: 'cache ▰▰▰▰▰ 5m00s · 103k · next $0.02 · cold $0.51 · hit 98%',
    tone: 'success',
  })

  await clock.advance(10 * MIN)

  expect(await band($)).toMatchObject({ tone: 'error' })
  expect((await band($))?.text).toContain('cold · idle 10m')

  await respond($, { ...STEADY, cache_read_input_tokens: 102_000, cache_creation_input_tokens: 600 })

  expect(held()).toMatchObject({ ttl: '1h', ttlSource: 'observed', missCount: 0 })
  expect((await band($))?.text).toContain('cache ▰▰▰▰▰ 60m')
})

test('the lifetime follows Claude Code’s own switches over the plan default', async ($, on) => {
  const { held } = world(on, PLAN, {
    ENABLE_PROMPT_CACHING_1H: '1',
    FORCE_PROMPT_CACHING_5M: '1',
    CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL: '1h',
  })

  await start($)

  expect(held()).toMatchObject({ ttl: '5m', ttlSource: 'env', otherTtl: '5m' })
})

test('the ttl option pins the lifetime over everything else', { options: { ttl: '5m' } }, async ($, on) => {
  const { held } = world(on, PLAN, { CLAUDE_CODE_PROMPT_CACHE_TTL: '1h' })

  await start($)

  expect(held()).toMatchObject({ ttl: '5m', ttlSource: 'option' })
})

test('a resumed conversation is read from what the engine says of it', async ($, on) => {
  const { held } = world(on, [])

  await start($)
  await $.classic.SessionStart({
    source: 'resume',
    model: OPUS,
    seconds_since_last_response: 20 * 60,
    context_tokens: 200_000,
    prompt_cache_likely_expired: false,
  })

  // Twenty idle minutes and not expired: the lifetime in force is the hour.
  expect(held()).toMatchObject({ ttl: '1h', ttlSource: 'engine', isSeeded: true })
  expect(await band($)).toEqual({
    text: 'cache ▰▰▰▰▱ 40m · 200k · next $0.04 · cold $1.60',
    tone: 'success',
  })
})

test('a resume inside five minutes reads the lifetime off the engine’s re-cache estimate', async ($, on) => {
  const { held } = world(on, [])

  // As a real resume runs: the classic event first and naming no model, then the session's start.
  await $.classic.SessionStart({
    source: 'resume',
    seconds_since_last_response: 60,
    context_tokens: 30_000,
    prompt_cache_likely_expired: false,
    estimated_cache_write_usd: 0.06,
  })
  await start($)

  // Six cents for 30k tokens of Haiku is twice its input rate: the one-hour write.
  expect(held()).toMatchObject({ ttl: '1h', ttlSource: 'engine', model: HAIKU })
  expect(await band($)).toEqual({
    text: 'cache ▰▰▰▰▰ 59m · 30.0k · next <$0.01 · cold $0.06',
    tone: 'success',
  })
})

test('a model switch leaves the cache cold on the new model', async ($, on) => {
  const { respond } = world(on)

  await start($)
  await respond($, STEADY)
  await $.classic.PostModelSwitch({
    from_model: OPUS,
    to_model: SONNET,
    requested_model: 'sonnet',
    source: 'command',
    context_tokens: 102_510,
    prompt_cache_warm: true,
    cache_ttl: '1h',
    estimated_cache_write_usd: 0.41,
    pricing: 'catalog',
  })

  expect(await band($)).toEqual({
    text: 'cache ▱▱▱▱▱ cold on sonnet-5-5 · 103k · next $0.41',
    tone: 'error',
  })
})

test('a subagent’s requests are tallied apart and leave the main reading alone', async ($, on) => {
  const { held, respond } = world(on)

  await start($)
  await respond($, STEADY, SONNET, 'agent-1')

  expect(await band($)).toBeUndefined()
  expect(held().main.requests).toBe(0)
  expect(held().others).toMatchObject({ requests: 1, read: 100_000, written: 2_000 })
})

test('/clear starts the reading over', async ($, on) => {
  const { held, respond } = world(on)

  await start($)
  await respond($, STEADY)
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })

  expect(await band($)).toBeUndefined()
  expect(held()).toMatchObject({ refreshedAt: 0, ttl: '1h', main: { requests: 0 } })
})

test('/cache-watch opens the pane and prints the reading', async ($, on) => {
  const { respond } = world(on)

  await start($)
  await respond($, STEADY)

  const ran = await command($, '')

  expect(ran.text).toBe('cache ▰▰▰▰▰ 60m · 103k · next $0.02 · cold $0.82 · hit 98%')
})

test('the pane lays out warmth, size, cost and the session’s totals on every surface that seats one', async ($, on) => {
  const { clock, respond } = world(on)

  await start($)
  await respond($, LARGE)
  await clock.advance(61 * MIN)
  await respond($, { ...LARGE, cache_read_input_tokens: 0, cache_creation_input_tokens: 500_000 })
  await clock.advance(3 * MIN)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const lines = (await ui.findAll({ type: 'Text' })).map(line => line.text)

    expect(lines).toEqual([
      '▰▰▰▰▰ warm · 57m left',
      'One-hour lifetime (subscription, within plan usage) · opus-5-5 · last request 3m ago',
      'Compaction',
      '  auto: the conversation compacts at the threshold, and the cache rebuilds cold',
      '  rule from the option · compacts from 85% of the window',
      ' ',
      'Size',
      '  501k tokens in context · 50% of 1.00M',
      '  500k cached · 510 new behind it',
      'Next turn',
      '  while warm  $0.10',
      '  once cold   $4.00 (a lapse adds $3.90)',
      'Main conversation',
      '  2 requests · 50% of input read from cache',
      '  498k read · 502k written · 20 uncached',
      // The one miss re-wrote the whole prefix: so far the cache has cost more than it saved.
      '  input cost $4.12 · caching has cost $0.12 more so far',
      '  1 miss · 500k re-processed · $3.90 extra',
      '    3m ago · idle past the lifetime (1h01) · 500k · $3.90',
    ])
    expect((await ui.findAll({ type: 'Button' })).map(button => button.props.label)).toEqual(['manual', 'auto', 'summary ¤'])
    expect(await ui.find({ type: 'Text', text: /warm · 57m left/ })).toMatchObject({
      props: { color: 'success' },
    })
    await ui.unmount()
  }
})
