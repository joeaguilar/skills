import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Item } from '../types'

/** A numbered list item: `1. text` or `1) text`. */
const ITEM = /^\s{0,3}(\d{1,2})[.)]\s+(\S.*)$/
/** A line that announces a reply's open questions or pending decisions. */
const HEADING = /\b(?:questions?|decisions?)\b/i
/** How many lines of prose may follow a list for it still to be the reply's ending. */
const TAIL_LINES = 2
const MAX_ITEMS = 9
const MAX_TEXT = 200

type Action = 'answer' | 'dismiss'

const LABELS: Record<Action, string> = { answer: 'Answer', dismiss: 'Dismiss' }

// Every mod's band shares one site: these letters are no other mod's.
const HOTKEYS: Record<Action, string> = { answer: 'n', dismiss: 'x' }

const dock = atom({ plugin: 'decision-dock', key: 'items' } as const, [])

type Run = {
  items: Item[]
  /** The row its first item is on, and the row its last line is on. */
  start: number
  end: number
}

const plain = (text: string) => text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()

/** Every numbered list in the reply that counts up from 1, in order. */
const runsOf = (rows: readonly string[]) => {
  const runs: Run[] = []
  let run: Run | undefined
  let hasGap = false

  rows.forEach((row, at) => {
    const found = ITEM.exec(row)

    if (found !== null) {
      const n = Number(found[1])
      const item: Item = { n, text: plain(found[2] ?? '').slice(0, MAX_TEXT) }

      if (n === 1) {
        run = { items: [item], start: at, end: at }
        runs.push(run)
      } else if (run !== undefined && n === run.items.length + 1) {
        run.items.push(item)
        run.end = at
      } else {
        run = undefined
      }

      hasGap = false
    } else if (row.trim() === '') {
      hasGap = true
    } else if (run !== undefined && !hasGap) {
      // An item's own continuation line.
      run.end = at
    } else {
      run = undefined
    }
  })

  return runs
}

/**
 * The list a reply leaves open: the last numbered list under a line that
 * names questions or decisions, else the list the reply ends on.
 */
const openItems = (reply: string): Item[] => {
  const rows = reply.split(/\r?\n/)
  const runs = runsOf(rows)
  const headed = runs.filter(run => {
    const above = rows
      .slice(0, run.start)
      .reverse()
      .find(row => row.trim() !== '')

    return above !== undefined && HEADING.test(above)
  })
  const last = runs.at(-1)
  const isEnding =
    last !== undefined &&
    rows.slice(last.end + 1).filter(row => row.trim() !== '').length <= TAIL_LINES
  const chosen = headed.at(-1) ?? (isEnding ? last : undefined)

  return chosen === undefined ? [] : chosen.items.slice(0, MAX_ITEMS)
}

/**
 * Starts the reply in the prompt box. The box leaves the cursor at the end of
 * what it is given, so only `1. ` goes in: the person types on from there.
 */
const startReply = async ($: EngineInterface) => {
  const items = await read($, dock)
  const first = items[0]

  if (first === undefined) {
    return 'Decision Dock: nothing is open.'
  }

  const lead = `${first.n}. `
  const box = await $.prompt.read()
  const filled = await $.prompt.fill(
    box.text.trim() === '' ? { text: lead } : { text: `\n${lead}`, mode: 'append' },
  )

  return filled.isFilled ? undefined : 'Decision Dock: the input box could not be filled.'
}

const act = async ($: EngineInterface, action: Action) => {
  if (action === 'dismiss') {
    await update($, dock, () => [])

    return
  }

  const refusal = await startReply($)

  if (refusal !== undefined) {
    $.ui.toast(refusal)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'answer',
      description: 'Start a numbered reply to the questions pinned above the prompt',
      immediate: true,
    })

    return next(e)
  })

  on('command.run', { command: 'answer' }, async $ => {
    const refusal = await startReply($)

    // Nothing printed when it worked: a printed line is one more the model reads.
    return refusal === undefined ? {} : { text: refusal }
  })

  // A reply of the main loop that ends on a numbered list pins it. One that
  // does not leaves the dock alone: a subagent's hand-back should not clear it.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.reason === 'answer') {
      const items = openItems(e.answer)

      if (items.length > 0) {
        await update($, dock, () => items)
      }
    }

    return next(e)
  })

  // The person's own prompt answers the questions or moves on: either way the dock is spent.
  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'composer' || e.origin.kind === 'bridge') {
      await update($, dock, held => (held.length === 0 ? held : []))
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const items = await read($, dock)

    if (items.length === 0) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    // Another mod's band, when one draws beneath this one, stays under it.
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          <Text bold>Open ({items.length})</Text>
          {(['answer', 'dismiss'] as const).map(action => (
            <Button
              key={`dock-${action}`}
              label={LABELS[action]}
              hotkey={HOTKEYS[action]}
              onPress={() => act($, action)}
            />
          ))}
        </Box>
        {items.map(item => (
          <Text wrap="truncate-end">
            {item.n}. {item.text}
          </Text>
        ))}
        {below}
      </Box>
    )
  })
}
