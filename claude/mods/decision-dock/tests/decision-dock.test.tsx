import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { Item } from '../types'

const BAND = {
  plugin: 'decision-dock',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 12 },
    view: {},
  },
} as const

const REPLY = `Both mods are built and pass their checks.

## Open questions and pending decisions

1. **Canonical home.** I suggest a Claude-only root in this repo.
   Shall I set that up and commit?
2. **Review.** Do you want a Codex review of both mods?

3. Is 15 minutes the right threshold?`

/** The world beneath the mod: the prompt box, and what was written and shown. */
const world = (on: On) => {
  const toasts: string[] = []
  const box = { text: '' }
  const written = new Map<string, unknown>()

  mock.clock(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('state.set', (_$, e, next) => {
    written.set(e.key, e.value)

    return next(e)
  })
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('prompt.read', () => ({ value: { text: box.text, cursor: box.text.length } }))
  on('prompt.fill', (_$, e) => {
    box.text = e.mode === 'append' ? box.text + e.text : e.text

    return { isFilled: true }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  // The engine draws nothing of its own in the band.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  const items = () => (written.get('items') as Item[] | undefined) ?? []

  return { toasts, box, items }
}

const start = ($: Engine) =>
  $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

/** The end of a turn: the main loop's unless an agent is named. */
const reply = ($: Engine, answer: string, agentId?: string) =>
  $.turn.complete({
    answer,
    durationMs: 1,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    ...(agentId === undefined ? {} : { agentId }),
  })

const typed = ($: Engine, text: string) =>
  $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })

const answerCommand = ($: Engine) =>
  $.command.run({
    command: 'answer',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 200 },
  })

/** The band's item lines, in order; none while nothing is pinned. */
const pinned = async ($: Engine) => {
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const texts = (await band.findAll({ type: 'Text' })).map(found => found.text)

  await band.unmount()

  return texts.filter(text => /^\d+\. /.test(text))
}

test('the numbered list under a questions heading is pinned, one line an item', async ($, on) => {
  const { items } = world(on)

  await start($)
  await reply($, REPLY)

  expect(items().map(item => item.n)).toEqual([1, 2, 3])
  expect(await pinned($)).toEqual([
    '1. Canonical home. I suggest a Claude-only root in this repo.',
    '2. Review. Do you want a Codex review of both mods?',
    '3. Is 15 minutes the right threshold?',
  ])

  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ ...BAND, surface })

    expect(await band.find({ type: 'Text', text: 'Open (3)' })).toBeDefined()
    expect(await band.find({ type: 'Button', text: 'Answer' })).toBeDefined()
    expect(await band.find({ type: 'Button', text: 'Dismiss' })).toBeDefined()
    await band.unmount()
  }
})

test('numbered steps a reply ends on are pinned; a list buried in the middle is not', async ($, on) => {
  const { items } = world(on)

  await start($)
  await reply($, 'Run these on the NAS:\n\n1. Copy the kit.\n2. Start the container.\n3. Run the check.\n4. Paste the output here.\n\nTell me what step 4 prints.')

  expect(items().map(item => item.text)).toEqual([
    'Copy the kit.',
    'Start the container.',
    'Run the check.',
    'Paste the output here.',
  ])

  await typed($, 'done')
  await reply($, 'Three things changed:\n\n1. The parser.\n2. The tests.\n\nThe parser now reads v2 output.\nIt is faster.\nIt also handles renames.\nNothing else moved.')

  expect(items()).toEqual([])
})

test('a hand-back that ends without a list leaves the dock; the person\'s own prompt clears it', async ($, on) => {
  const { items } = world(on)

  await start($)
  await reply($, REPLY)
  await reply($, 'The subagent finished the port.', 'agent-1')
  await $.prompt.submit({ text: 'task done', wait: false, origin: { kind: 'task-notification' } })
  await reply($, 'Noted: the port landed.')

  expect(items()).toHaveLength(3)

  await typed($, '1. yes 2. no 3. 30 minutes')

  expect(items()).toEqual([])
  expect(await pinned($)).toEqual([])
})

test('Answer starts the reply at the first number and keeps a draft; Dismiss clears the dock', async ($, on) => {
  const { box, items } = world(on)

  await start($)
  await reply($, REPLY)

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await band.press({ key: 'dock-answer' })

  expect(box.text).toBe('1. ')

  box.text = 'before that:'
  await band.press({ key: 'dock-answer' })

  expect(box.text).toBe('before that:\n1. ')

  await band.press({ key: 'dock-dismiss' })
  await band.unmount()

  expect(items()).toEqual([])
})

test('/answer fills the box and prints nothing; with nothing open it says so', async ($, on) => {
  const { box } = world(on)

  await start($)

  expect((await answerCommand($)).text).toBe('Decision Dock: nothing is open.')

  await reply($, REPLY)

  expect((await answerCommand($)).text).toBeUndefined()
  expect(box.text).toBe('1. ')
})
