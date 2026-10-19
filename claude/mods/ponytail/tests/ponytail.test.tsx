import type { On, PromptComposeTrait, PromptOrigin } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { BODY } from '../hooks/body'
import { switchOf } from '../hooks/register'

const SECTION = 'ponytail:mode'
const OFFER = 'ponytail fits this — /ponytail on'

const BAND = {
  plugin: 'ponytail',
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

/** The world beneath the mod: the engine's own system prompt, and what the mod said. */
const world = (on: On) => {
  const toasts: string[] = []
  const entered: string[] = []
  const written = new Map<string, unknown>()

  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('state.set', (_$, e, next) => {
    written.set(e.key, e.value)

    return next(e)
  })
  on('prompt.submit', (_$, e) => {
    entered.push(e.text)

    return { text: e.text }
  })
  on('prompt.compose', (_$, e) =>
    e.traits.includes('bare')
      ? { sections: [{ id: 'bare', text: 'One line.', scope: 'shared' }] }
      : {
          sections: [
            { id: 'intro', text: 'You are Claude Code.', scope: 'shared' },
            { id: 'memory', text: 'Remembered.', scope: 'session' },
          ],
        },
  )
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  // The engine draws one row of its own in the band, so a test sees it kept.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text>beneath</Text>
      </Box>
    )
  })

  return { toasts, entered, written }
}

const start = ($: Engine) => $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

const ponytail = ($: Engine, args: string) =>
  $.command.run({
    command: 'ponytail',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 200 },
  })

/** A prompt entering the session, typed by the person unless an origin says otherwise. */
const say = ($: Engine, text: string, origin: PromptOrigin = { kind: 'composer' }) =>
  $.prompt.submit({ text, wait: false, origin })

/** The system prompt as the engine renders one for a request with these traits. */
const compose = ($: Engine, traits: readonly PromptComposeTrait[] = []) =>
  $.prompt.compose({
    model: 'claude-opus-5-5',
    promptModel: 'claude-opus-5-5',
    surfaces: ['terminal'],
    tools: ['Read', 'Edit'],
    outputStyle: null,
    traits,
  })

/** The ids of the system prompt's sections as a request would carry them. */
const sectionIds = async ($: Engine, traits: readonly PromptComposeTrait[] = []) =>
  (await compose($, traits)).sections.map(section => section.id)

/** What the band shows: its texts and its buttons' labels. */
const band = async ($: Engine) => {
  const mounted = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const texts = (await mounted.findAll({ type: 'Text' })).map(found => found.text)
  const buttons = (await mounted.findAll({ type: 'Button' })).map(found => found.text)

  await mounted.unmount()

  return { texts, buttons }
}

test('the command switches the mode and says where it stands, and starts off', async ($, on) => {
  world(on)
  await start($)

  expect(await ponytail($, 'status')).toMatchObject({ text: 'Ponytail: off. /ponytail on turns it on for this session.' })
  expect(await ponytail($, 'on')).toMatchObject({ text: 'Ponytail: on for this session. /ponytail off turns it off.' })
  expect(await ponytail($, '')).toMatchObject({ text: 'Ponytail: on for this session. /ponytail off turns it off.' })
  expect(await ponytail($, 'OFF')).toMatchObject({ text: 'Ponytail: off. /ponytail on turns it on for this session.' })
})

test('a word that is no switch changes nothing and says so', async ($, on) => {
  const { written } = world(on)

  await start($)
  await ponytail($, 'on')

  expect(await ponytail($, 'harder')).toMatchObject({
    text: 'Ponytail: "harder" is not a switch. /ponytail on | off | status',
  })
  expect(written.get('isOn')).toBe(true)
})

test('the section is in the system prompt only while the mode is on, last and on the session side', async ($, on) => {
  world(on)
  await start($)

  expect(await sectionIds($)).toEqual(['intro', 'memory'])

  await ponytail($, 'on')

  const { sections } = await compose($)

  expect(sections.map(section => section.id)).toEqual(['intro', 'memory', SECTION])
  expect(sections.at(-1)).toEqual({ id: SECTION, text: BODY, scope: 'session' })

  await ponytail($, 'off')

  expect(await sectionIds($)).toEqual(['intro', 'memory'])
})

test('a bare prompt and a measuring render never carry the section', async ($, on) => {
  world(on)
  await start($)
  await ponytail($, 'on')

  expect(await sectionIds($, ['bare'])).toEqual(['bare'])
  expect(await sectionIds($, ['analysis'])).toEqual(['intro', 'memory'])
  expect(await sectionIds($, ['lean', 'skills'])).toEqual(['intro', 'memory', SECTION])
})

test('the body is the skill\'s, less the lines that made the model its own switch', () => {
  expect(BODY.startsWith('# Ponytail\n')).toBe(true)
  expect(BODY).toContain('## The ladder')
  expect(BODY).toContain('The shortest path to done is the right path.')
  expect(BODY).not.toContain('ACTIVE EVERY RESPONSE')
  expect(BODY).not.toContain('stop ponytail')
  expect(BODY).not.toContain('normal mode')
  expect(BODY).not.toContain('ponytail on|off')
  expect(BODY).not.toMatch(/^---$/m)
})

test('a typed switch toggles the mode and the prompt goes through untouched', async ($, on) => {
  const { entered, written } = world(on)

  await start($)

  expect(await say($, 'ponytail on, then add the date field')).toMatchObject({
    text: 'ponytail on, then add the date field',
  })
  expect(written.get('isOn')).toBe(true)
  expect(await sectionIds($)).toContain(SECTION)

  await say($, 'ok stop ponytail and build the full picker')

  expect(written.get('isOn')).toBe(false)

  await say($, 'Ponytail ON')
  await say($, 'ponytail off')

  expect(written.get('isOn')).toBe(false)
  expect(entered).toEqual([
    'ponytail on, then add the date field',
    'ok stop ponytail and build the full picker',
    'Ponytail ON',
    'ponytail off',
  ])
})

test('"normal mode" turns it off only as the whole prompt', async ($, on) => {
  const { written } = world(on)

  await start($)
  await ponytail($, 'on')
  await say($, 'the app boots in normal mode on this board')

  expect(written.get('isOn')).toBe(true)

  await say($, ' Normal mode. ')

  expect(written.get('isOn')).toBe(false)
})

test('which typed words are a switch', () => {
  expect(switchOf('ponytail on')).toBe('on')
  expect(switchOf('please: stop  ponytail')).toBe('off')
  expect(switchOf('ponytail off for now, ponytail on after lunch')).toBe('on')
  expect(switchOf('ponytail on, no wait, stop ponytail')).toBe('off')
  expect(switchOf('normal mode')).toBe('off')
  expect(switchOf('what does ponytail on|off do?')).toBeUndefined()
  expect(switchOf('put the ponytail one first')).toBeUndefined()
  expect(switchOf('tie a ponytail')).toBeUndefined()
})

test('a prompt that is not the person\'s own words switches nothing', async ($, on) => {
  const { written, toasts } = world(on)

  await start($)
  await say($, 'ponytail on', { kind: 'task-notification' })
  await say($, 'this is bloat, ponytail on', { kind: 'plugin', name: 'other-mod' })

  expect(written.has('isOn')).toBe(false)
  expect(toasts).toEqual([])

  await say($, 'ponytail on', { kind: 'plugin', name: 'queue', asUser: true })

  expect(written.get('isOn')).toBe(true)
})

test('a prompt that names over-building gets one offer per session, and only while off', async ($, on) => {
  const { toasts, written } = world(on)

  await start($)
  await say($, 'add a settings page')

  expect(toasts).toEqual([])

  await say($, 'this is over-engineered, give me the minimal solution')
  await say($, 'so much boilerplate. YAGNI')

  expect(toasts).toEqual([OFFER])
  expect(written.has('isOn')).toBe(false)
})

test('no offer is made while the mode is on, nor by the prompt that switches it on', async ($, on) => {
  const { toasts } = world(on)

  await start($)
  await say($, 'too much bloat here: ponytail on')
  await say($, 'do less')

  expect(toasts).toEqual([])
})

test('the band shows the mode and its Off button only while on, above what was beneath it', async ($, on) => {
  const { written } = world(on)

  await start($)

  expect(await band($)).toEqual({ texts: ['beneath'], buttons: [] })

  await ponytail($, 'on')

  expect(await band($)).toEqual({ texts: ['ponytail on', 'beneath'], buttons: ['Off'] })

  for (const surface of ['terminal', 'desktop'] as const) {
    await ponytail($, 'on')

    const mounted = await $.ui.mount({ ...BAND, surface })

    await mounted.press({ key: 'ponytail-off' })
    await mounted.unmount()

    expect(written.get('isOn')).toBe(false)
    expect(await band($)).toEqual({ texts: ['beneath'], buttons: [] })
  }
})

test('a survey in the band is left alone', async ($, on) => {
  world(on)
  await start($)
  await ponytail($, 'on')

  const mounted = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'terminal' })
  const buttons = await mounted.findAll({ type: 'Button' })

  await mounted.unmount()

  expect(buttons).toEqual([])
})
