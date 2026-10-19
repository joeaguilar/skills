import { atom, read, update } from 'claude-code'
import type { EngineInterface, PromptOrigin, Register } from 'claude-code'

import type { Switch } from '../types'

import { BODY } from './body'

/** The system prompt section the mode adds: this plugin's own id. */
const SECTION = 'ponytail:mode'
const TOAST_MS = 15_000
const OFFER = 'ponytail fits this — /ponytail on'

// Every mod's band shares one site: this letter is no other mod's.
const HOTKEY = 't'

/** `ponytail on`, but not the usage line `ponytail on|off`. */
const TYPED_ON = /\bponytail\s+on\b(?!\s*[|/])/gi
const TYPED_OFF = /\b(?:ponytail\s+off|stop\s+ponytail)\b/gi
/** `normal mode` switches the mode off only when it is the whole prompt. */
const ONLY_NORMAL_MODE = /^\s*normal\s+mode\s*[.!]?\s*$/i
/** What a prompt names when the person is fed up with over-building. */
const OVERBUILT =
  /\b(?:yagni|minimal\s+solution|do\s+less|shortest\s+path|over-?\s?engineer(?:ed|ing|s)?|bloat(?:ed)?|boilerplate)\b/i

const isOn = atom({ plugin: 'ponytail', key: 'isOn' } as const, false)
const hasOffered = atom({ plugin: 'ponytail', key: 'hasOffered' } as const, false)

/** Whether a prompt is the person's own words: typed here, sent from their phone, or staged by them. */
const isOwnWords = (origin: PromptOrigin) =>
  origin.kind === 'composer' ||
  origin.kind === 'bridge' ||
  origin.kind === 'sdk' ||
  (origin.kind === 'plugin' && origin.asUser === true)

/** Where the last match of `pattern` starts in `text`; -1 when it has none. */
const lastOf = (text: string, pattern: RegExp) => {
  let at = -1

  for (const found of text.matchAll(pattern)) {
    at = found.index
  }

  return at
}

/** What a prompt's typed switches ask for: the later of an on and an off wins. */
export const switchOf = (text: string): Switch | undefined => {
  if (ONLY_NORMAL_MODE.test(text)) {
    return 'off'
  }

  const on = lastOf(text, TYPED_ON)
  const off = lastOf(text, TYPED_OFF)

  if (on === -1 && off === -1) {
    return undefined
  }

  return on > off ? 'on' : 'off'
}

/** Reads a prompt for a typed switch, or makes the session's one offer. The prompt is never changed. */
const heed = async ($: EngineInterface, text: string) => {
  const asked = switchOf(text)

  if (asked !== undefined) {
    await update($, isOn, () => asked === 'on')

    return
  }

  if (!OVERBUILT.test(text) || (await read($, isOn)) || (await read($, hasOffered))) {
    return
  }

  await update($, hasOffered, () => true)
  $.ui.toast(OFFER, { timeoutMs: TOAST_MS })
}

const statusText = (on: boolean) =>
  on
    ? 'Ponytail: on for this session. /ponytail off turns it off.'
    : 'Ponytail: off. /ponytail on turns it on for this session.'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // The engine refuses the name while a skill called ponytail is installed
    // ("it is the user's /ponytail"). That /ponytail still reaches the hook
    // below, so the refusal changes nothing the person sees.
    await $.command
      .register({
        name: 'ponytail',
        description: 'Lazy senior dev mode for this session: the shortest solution that works',
        argumentHint: '[on | off | status]',
        immediate: true,
      })
      .catch(() => undefined)

    return next(e)
  })

  on('command.run', { command: 'ponytail' }, async ($, e) => {
    const word = e.args.trim().toLowerCase()

    if (word === 'on' || word === 'off') {
      await update($, isOn, () => word === 'on')
    } else if (word !== '' && word !== 'status') {
      return { text: `Ponytail: "${word}" is not a switch. /ponytail on | off | status` }
    }

    return { text: statusText(await read($, isOn)) }
  })

  // The prompt goes through as typed: a switch in it is heeded first, so the
  // request this prompt starts is already composed under the new mode.
  on('prompt.submit', async ($, e, next) => {
    if (isOwnWords(e.origin)) {
      await heed($, e.text).catch(() => undefined)
    }

    return next(e)
  })

  // The engine composes the system prompt for every request it sends, so a
  // switch reaches the next one with nothing to invalidate. `bare` is a
  // one-line prompt by the person's choice, and `analysis` sends nothing.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)

    if (e.traits.includes('bare') || e.traits.includes('analysis') || !(await read($, isOn))) {
      return composed
    }

    return {
      sections: [
        ...composed.sections.filter(section => section.id !== SECTION),
        { id: SECTION, text: BODY, scope: 'session' },
      ],
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isOn))) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    // Another mod's band, when one draws beneath this one, stays under it.
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          <Text dimColor>ponytail on</Text>
          <Button key="ponytail-off" label="Off" hotkey={HOTKEY} onPress={() => update($, isOn, () => false)} />
        </Box>
        {below}
      </Box>
    )
  })
}
