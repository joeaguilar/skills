import type { On, SessionMessage } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const REPLY = `Handoff written to HANDOFF.md and committed as abc1234.

\`\`\`handoff-compact
Keep: HANDOFF.md, epic itr#215, the capture fix is still open.
\`\`\`

\`\`\`handoff-wake
Read HANDOFF.md fully first, then start with itr#221.
\`\`\``

const MESSAGES: SessionMessage[] = [{ role: 'user', text: 'continue the upgrade', toolUses: [] }]

/** The world beneath the mod: the prompt box, and what was asked of the engine. */
const world = (on: On) => {
  const toasts: string[] = []
  const submitted: string[] = []
  const compactions: (string | undefined)[] = []
  const box = { text: '' }
  const clock = mock.clock(on)

  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('prompt.submit', (_$, e) => {
    submitted.push(e.text)

    return { text: e.text }
  })
  on('prompt.read', () => ({ value: { text: box.text, cursor: box.text.length } }))
  on('prompt.fill', (_$, e) => {
    box.text = e.text

    return { isFilled: true, text: e.text }
  })
  on('session.compact', (_$, e) => {
    compactions.push(e.instructions)

    // The mod's own call carries instructions alone: core supplies the transcript.
    return { messages: e.messages ?? MESSAGES }
  })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))

  return { toasts, submitted, compactions, box, clock }
}

const start = ($: Engine) =>
  $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

const handoff = ($: Engine, args: string) =>
  $.command.run({
    command: 'handoff',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 200 },
  })

/** The handoff turn as the engine runs it: the submitted prompt, then the reply. */
const turn = async ($: Engine, text: string, answer: string, turnId = 't1') => {
  await $.turn.start({ text, turnId })
  await $.turn.complete({ answer, durationMs: 1, isAborted: false, turnId, reason: 'answer' })
}

test('/handoff asks for the document, compacts with its instructions, and fills the wake prompt', async ($, on) => {
  const { submitted, compactions, box, clock, toasts } = world(on)

  await start($)
  await handoff($, 'the fidelity upgrade')
  await clock.advance(50)

  expect(submitted).toHaveLength(1)
  expect(submitted[0]).toContain('[handoff] Prepare this session for compaction.')
  expect(submitted[0]).toContain('Focus: the fidelity upgrade')
  expect(compactions).toEqual([])

  await turn($, submitted[0] ?? '', REPLY)
  await clock.advance(1_000)

  expect(compactions).toEqual(['Keep: HANDOFF.md, epic itr#215, the capture fix is still open.'])
  expect(box.text).toBe('Read HANDOFF.md fully first, then start with itr#221.')
  expect(toasts.at(-1)).toContain('compacted. The wake prompt is in the input box')
})

test('a reply without the two blocks compacts nothing', async ($, on) => {
  const { submitted, compactions, box, clock, toasts } = world(on)

  await start($)
  await handoff($, '')
  await clock.advance(50)
  await turn($, submitted[0] ?? '', 'The commit hook rejected the handoff commit; I stopped.')
  await clock.advance(5_000)

  expect(compactions).toEqual([])
  expect(box.text).toBe('')
  expect(toasts).toEqual(['Handoff: the reply has no compact and wake blocks, so nothing was compacted.'])
})

test('another prompt finishing first leaves the handoff waiting for its own turn', async ($, on) => {
  const { submitted, compactions, clock } = world(on)

  await start($)
  await handoff($, '')
  await clock.advance(50)
  await turn($, 'fix the typo', 'Fixed.', 't0')
  await clock.advance(5_000)

  expect(compactions).toEqual([])

  await turn($, submitted[0] ?? '', REPLY)
  await clock.advance(1_000)

  expect(compactions).toHaveLength(1)
})

test('/handoff hold waits for the person to compact, then feeds their /compact the instructions', async ($, on) => {
  const { submitted, compactions, box, clock } = world(on)

  await start($)
  await handoff($, 'hold')
  await clock.advance(50)
  await turn($, submitted[0] ?? '', REPLY)
  await clock.advance(30_000)

  expect(compactions).toEqual([])
  expect(box.text).toBe('')

  await $.session.compact({ trigger: 'manual', instructions: 'and the open bugs', messages: MESSAGES })
  await clock.advance(1_000)

  expect(compactions).toEqual([
    'Keep: HANDOFF.md, epic itr#215, the capture fix is still open.\n\nand the open bugs',
  ])
  expect(box.text).toBe('Read HANDOFF.md fully first, then start with itr#221.')
})

test('a draft in the input box is kept; /handoff wake fills once it is clear', async ($, on) => {
  const { submitted, box, clock, toasts } = world(on)

  await start($)
  await handoff($, '')
  await clock.advance(50)
  box.text = 'half a thought'
  await turn($, submitted[0] ?? '', REPLY)
  await clock.advance(1_000)

  expect(box.text).toBe('half a thought')
  expect(toasts.at(-1)).toContain('The input box holds a draft')

  box.text = ''

  expect((await handoff($, 'wake')).text).toBe(
    'Handoff: The wake prompt is in the input box; Enter resumes.',
  )
  expect(box.text).toBe('Read HANDOFF.md fully first, then start with itr#221.')
})

test('a compaction with no handoff held passes through untouched', async ($, on) => {
  const { compactions, box, clock } = world(on)

  await start($)
  await $.session.compact({ trigger: 'auto', messages: MESSAGES })
  await clock.advance(5_000)

  expect(compactions).toEqual([undefined])
  expect(box.text).toBe('')
})
