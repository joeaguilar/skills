import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CodexCount, CodexLaunch, Seat } from '../types'

/**
 * The seats that plan and review but do not write code, by model id: the
 * `planner` binding in ~/.claude/MODELS.md.
 */
const PLANNER = /fable/i
/**
 * Where a swapped seat's requests go: the Claude writer in MODELS.md. A full
 * model id, since a request's model takes no alias (`opus` is a 404 there).
 */
const WRITER = 'claude-opus-5-5'
/** Files a planner seat writes as its own work: plans, handoffs, reviews. */
const DOCS = /\.(md|mdx|markdown|txt|rst|adoc)$/i
const EDITS = new Set(['Edit', 'Write', 'NotebookEdit'])
const SHELLS = new Set(['Bash', 'PowerShell'])
/** `codex exec` where a command starts, not inside an echo or a search pattern. */
const CODEX =
  /(?:^|[;&|(]|\n)\s*(?:\w+=\S+\s+)*(?:(?:nohup|time|timeout\s+\S+)\s+)*["']?(?:[^\s"']*[\\/])?codex(?:\.exe)?["']?\s+exec\b/
const CODEX_MODEL = /(?:\s-m|\s--model)[=\s]+["']?([\w.-]+)/
/**
 * A Codex-companion run where a command starts: the script by path, or through
 * the `$COMPANION` variable the skills resolve it into.
 */
const COMPANION =
  /(?:^|[;&|(]|\n)\s*(?:\w+=\S+\s+)*node(?:\.exe)?\s+["']?(?:\$\{?COMPANION\}?|[^\s"']*codex-companion\.mjs)["']?\s+(?:task|review|adversarial-review)\b/
/** A loop's opening prompt names its seat on its first line: `[seat crucible:parser#2 build]`. */
const TAG = /^\s*\[seat ([^\]\n]{1,120})\]/
/** The tool a ledger-keeping skill calls for what each seat really ran on. */
const LEDGER_TOOL = 'mcp__seat-guard__ledger'
/** The share of the five-hour window past which the person is told once. */
const LIMIT_PERCENT = 85
const MAX_SEATS = 200
const TOAST_MS = 15_000
/** Marks an action that spends tokens. */
const COST = '¤'
const LEGEND = `${COST} uses tokens`

type Action = 'stop' | 'swap' | 'allow' | 'quiet'

const ACTIONS: readonly Action[] = ['stop', 'swap', 'allow', 'quiet']

const modelName = (id: string) => id.replace(/^claude-/, '').replace(/-\d{8}$/, '')

const LABELS: Record<Action, string> = {
  stop: 'Stop',
  // A swapped seat's next request re-reads its whole context on the new model.
  swap: `Swap to ${modelName(WRITER)} ${COST}`,
  allow: 'Allow',
  quiet: 'Quiet',
}

// Every mod's band shares one site: these letters are no other mod's.
const HOTKEYS: Record<Action, string> = { stop: 's', swap: 'o', allow: 'a', quiet: 'q' }

const seatList = atom({ plugin: 'seat-guard', key: 'seats' } as const, [])
const codexList = atom({ plugin: 'seat-guard', key: 'codex' } as const, [])
const quietFlag = atom({ plugin: 'seat-guard', key: 'isQuiet' } as const, false)

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path

/** Compact duration, as the status line spells it: `<1m`, `45m`, `3h12`. */
const span = (ms: number) => {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)

  if (minutes < 1) {
    return '<1m'
  }

  if (minutes < 60) {
    return `${minutes}m`
  }

  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}

/** The model a seat's requests really go to. */
const modelOf = (seat: Seat) => (seat.swappedTo === '' ? seat.model : seat.swappedTo)

/** The code file an edit call writes, or '' for any other call and for a document. */
const codeFileOf = (tool: string, args: Record<string, unknown>) => {
  if (!EDITS.has(tool)) {
    return ''
  }

  const path = args['file_path'] ?? args['notebook_path']

  return typeof path === 'string' && !DOCS.test(path) ? path : ''
}

/** The Codex model a shell command launches, or '' when it launches none. */
const codexOf = (tool: string, args: Record<string, unknown>) => {
  const command = args['command']

  if (!SHELLS.has(tool) || typeof command !== 'string') {
    return ''
  }

  if (CODEX.test(command)) {
    return CODEX_MODEL.exec(command)?.[1] ?? 'codex'
  }

  return COMPANION.test(command) ? 'codex-companion' : ''
}

/** The seat name an opening prompt carries on its first line, or ''. */
const tagOf = (prompt: string) => oneLine(TAG.exec(prompt)?.[1] ?? '')

/**
 * How the Workflow harness frames a workflow agent's opening rows: the request
 * the person typed, relayed, then the script's own text indented under a header.
 */
const HARNESS = /^\[Workflow harness — ([^\]]+)\]/

/**
 * The seat name a loop's opening rows carry. A subagent's prompt is its first
 * row. A workflow agent's is the harness's `computed task` row, the script's text
 * starting on the line after the header; the relayed `user request` row is the
 * person's words, never the seat's, so a seat line quoted there names nothing.
 */
const openingTag = (rows: readonly { role: string; text: string }[]) => {
  for (const row of rows) {
    if (row.role !== 'user') {
      return ''
    }

    const frame = HARNESS.exec(row.text)?.[1]

    if (frame === 'user request') {
      continue
    }

    const lines = row.text.split('\n')
    const tag = tagOf((frame === undefined ? lines : lines.slice(1)).find(line => line.trim() !== '') ?? '')

    if (tag !== '') {
      return tag
    }
  }

  return ''
}

const flagLine = (seat: Seat) =>
  `Seat Guard: “${clip(seat.label, 40)}” runs on ${modelName(seat.model)} and is editing code (${seat.codeEdits} ${seat.codeEdits === 1 ? 'edit' : 'edits'}, last ${fileName(seat.lastFile)})`

/** What the seat's parent reads in place of its answer once the person stopped it. */
const stopText = (seat: Seat) =>
  `Stopped by the user from Seat Guard before finishing. This seat ran on ${modelName(seat.model)}, which plans and reviews but does not write code under ~/.claude/MODELS.md; it had made ${seat.codeEdits} code ${seat.codeEdits === 1 ? 'edit' : 'edits'} (last: ${seat.lastFile}). What it changed is on disk and unverified. Route the remaining writing to a writer seat.`

// The working copy: every model request and tool call of a seat reads it with
// no host call, and `publish` hands the drawings a snapshot.
const seats = new Map<string, Seat>()
const codex = new Map<string, number>()
/** The five-hour window the person was already told about, by its reset time. */
let warnedWindow = ''
/**
 * Silenced for the session: seats are still counted, nothing is flagged or
 * toasted. For a run started with planner seats on purpose.
 */
let isQuiet = false

const enroll = (id: string): Seat => {
  const seat: Seat = {
    id,
    label: `agent ${id.slice(0, 8)}`,
    model: '',
    swappedTo: '',
    codeEdits: 0,
    lastFile: '',
    verdict: 'none',
    isLive: true,
    tag: '',
    steps: 0,
    tokens: 0,
    launched: [],
  }

  if (seats.size >= MAX_SEATS) {
    const spent = [...seats.values()].find(one => !one.isLive)

    if (spent !== undefined) {
      seats.delete(spent.id)
    }
  }

  seats.set(id, seat)

  return seat
}

/**
 * The band's count line: seats seen this session by model, then Codex launches.
 * Drawn dim in the band, not as a status row, which the engine paints as a warning.
 */
const countsLine = (list: readonly Seat[], launches: readonly CodexCount[], quiet: boolean) => {
  const counts = new Map<string, number>()

  for (const seat of list) {
    const name = modelName(modelOf(seat)) || 'unknown'

    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  const parts = [
    ...[...counts].sort(([a], [b]) => a.localeCompare(b)),
    ...launches.map(({ model, count }): [string, number] => [model, count]).sort(([a], [b]) => a.localeCompare(b)),
  ].map(([name, count]) => `${name} ${count}`)

  if (parts.length === 0) {
    return quiet ? 'seats quiet' : undefined
  }

  const live = list.filter(seat => seat.isLive).length

  return `seats ${parts.join(' · ')}${live > 0 ? ` · ${live} live` : ''}${quiet ? ' · quiet' : ''}`
}

const publish = async ($: EngineInterface) => {
  await update($, seatList, () => [...seats.values()].map(seat => ({ ...seat })))
  await update($, codexList, () => [...codex].map(([model, count]) => ({ model, count })))
}

/** Loops whose opening row has been looked at for a seat line: only that row can name the seat. */
const opened = new Set<string>()

/**
 * A user row stored to a loop's conversation before its first request: its
 * opening prompt. The relayed `user request` row of a workflow agent is passed
 * over, and the row after it is the one read.
 */
const noteOpening = (id: string, text: string) => {
  if (HARNESS.exec(text)?.[1] === 'user request') {
    return
  }

  opened.add(id)

  const seat = seats.get(id) ?? enroll(id)

  if (seat.tag === '' && seat.steps === 0) {
    seat.tag = openingTag([{ role: 'user', text }])
  }
}

/**
 * Reads a loop's own opening prompt for its seat tag. Started unawaited from the
 * loop's first request, so that request waits on nothing.
 */
const readTag = async ($: EngineInterface, id: string) => {
  const rows = await $.session.messages({ agentId: id })
  const seat = seats.get(id)

  if (!Array.isArray(rows) || seat === undefined || seat.tag !== '') {
    return
  }

  const tag = openingTag(rows)

  if (tag !== '') {
    seat.tag = tag
    await publish($)
  }
}

/** A table cell: one line, no column break, cut to a readable width. */
const cell = (text: string) => clip(oneLine(text).replace(/\|/g, '/'), 60)

const launchCell = (launched: readonly CodexLaunch[]) =>
  launched.length === 0
    ? '—'
    : launched.map(({ model, isOk }) => (isOk ? model : `${model} (failed)`)).join(', ')

const ledgerRow = (seat: Seat) => {
  const model = modelName(seat.model) || 'unknown'
  const ran = seat.swappedTo === '' ? model : `${model} → ${modelName(seat.swappedTo)}`
  const state = seat.isLive ? 'live' : seat.verdict === 'stopped' ? 'stopped' : 'done'

  return `| ${cell(seat.tag === '' ? seat.label : seat.tag)} | ${ran} | ${launchCell(seat.launched)} | ${seat.steps} | ${seat.tokens} | ${state} |`
}

/**
 * The ledger a route-keeping skill copies from: every seat of the session with
 * the model its requests reached, as the engine saw them. `filter` keeps the
 * seats whose tag or label holds it.
 */
const ledgerText = async ($: EngineInterface, filter: string) => {
  const needle = filter.toLowerCase()
  const all = [...seats.values()]
  const rows = all.filter(seat => `${seat.tag} ${seat.label}`.toLowerCase().includes(needle))
  const scope = needle === '' ? '' : ` matching “${filter}”`
  const usage = await $.session.usage()
  const context = usage.context.tokens === undefined ? '' : ` · context ${usage.context.tokens} tokens`
  const launches = [...codex].map(([model, count]) => `${model} ${count}`).join(' · ')

  return [
    'Seat Guard ledger: what the engine ran, not what a seat reported.',
    rows.length === 0
      ? `No seat has run in this session${scope}.`
      : `${rows.length} of ${all.length} ${all.length === 1 ? 'seat' : 'seats'}${scope}. Tokens are each seat’s finished turns: input, cache and output.`,
    ...(rows.length === 0
      ? []
      : ['', '| seat | model | codex launched | requests | tokens | state |', '|---|---|---|---|---|---|', ...rows.map(ledgerRow), '']),
    `orchestrator: ${modelName(await $.session.model())}${context}`,
    ...(launches === '' ? [] : [`codex launches, all loops: ${launches}`]),
  ].join('\n')
}

/** A toast, unless the person silenced the mod for this session. */
const say = ($: EngineInterface, text: string) => {
  if (!isQuiet) {
    $.ui.toast(`Seat Guard: ${text}`, { timeoutMs: TOAST_MS })
  }
}

const setQuiet = async ($: EngineInterface, quiet: boolean) => {
  isQuiet = quiet
  await update($, quietFlag, () => quiet)
}

/**
 * A pressed button. Nothing here happens unless the person asks: Stop ends the
 * seat at its next model request, Swap sends its later requests to the writer
 * model, Allow lets it go on as it is, Quiet silences the mod for the session.
 */
const act = async ($: EngineInterface, action: Action, id: string) => {
  if (action === 'quiet') {
    await setQuiet($, true)

    return
  }

  const seat = seats.get(id)

  if (seat === undefined) {
    return
  }

  const label = clip(seat.label, 40)

  if (action === 'stop') {
    seat.verdict = 'stopping'
    say($, `“${label}” stops at its next step.`)
  } else if (action === 'swap') {
    seat.swappedTo = WRITER
    seat.verdict = 'none'
    say($, `“${label}” runs on ${modelName(WRITER)} from its next step.`)
  } else {
    seat.verdict = 'allowed'
  }

  await publish($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // A reload starts the module over: take the seats back from the session.
    for (const seat of await read($, seatList)) {
      // A seat an earlier version stored has no ledger fields yet.
      const stored: Partial<Seat> = seat

      seats.set(seat.id, {
        ...seat,
        tag: stored.tag ?? '',
        steps: stored.steps ?? 0,
        tokens: stored.tokens ?? 0,
        launched: [...(stored.launched ?? [])],
      })
    }

    for (const { model, count } of await read($, codexList)) {
      codex.set(model, count)
    }

    isQuiet = await read($, quietFlag)
    await $.command.register({
      name: 'seat-guard',
      description: 'Silence Seat Guard for this session, turn it back on, or print the ledger of what each seat ran on',
      argumentHint: '[quiet | on | ledger [filter]]',
      immediate: true,
    })
    await $.tool.register({
      name: 'ledger',
      description:
        'Lists every subagent and workflow seat this session has run, with the model its requests really reached, the Codex runs it launched, and its request and token counts, as the engine recorded them. Read-only. Use it to fill the `actual` column of a route ledger (crucible, gauntlet) instead of reporting it from memory. `filter` keeps seats whose tag or label contains it, for example `crucible:parser#2`.',
      inputSchema: {
        type: 'object',
        properties: { filter: { type: 'string', description: 'Part of a seat tag or label; omit for every seat.' } },
      },
    })
    // An earlier version pinned the counts as a status row: take it down.
    $.ui.status(undefined)

    return next(e)
  })

  on('command.run', { command: 'seat-guard' }, async ($, e) => {
    const word = e.args.trim()

    if (word === 'ledger' || word.startsWith('ledger ')) {
      return { text: await ledgerText($, word.slice('ledger'.length).trim()) }
    }

    if (word === 'quiet' || word === 'on') {
      await setQuiet($, word === 'quiet')
    }

    return {
      text: isQuiet
        ? 'Seat Guard: quiet for this session. Seats are still counted; /seat-guard on turns it back on.'
        : 'Seat Guard: on. /seat-guard quiet silences it for this session.',
    }
  })

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)

    if (spawned.agentId === undefined) {
      return spawned
    }

    const seat = seats.get(spawned.agentId) ?? enroll(spawned.agentId)

    seat.label = oneLine(e.description) || e.subagentType
    seat.tag = seat.tag === '' ? tagOf(e.prompt) : seat.tag
    seat.model = seat.model === '' ? (spawned.model ?? '') : seat.model
    seat.isLive = true
    await publish($)

    return spawned
  })

  // Every row stored to a loop's conversation passes here. A loop's opening rows
  // arrive before its first request, which is where a workflow agent's seat line
  // is read. The row is passed on as it came: nothing is changed, nothing waits.
  on('session.append', (_$, e, next) => {
    const id = e.agentId

    if (id !== undefined && e.message.role === 'user' && !opened.has(id)) {
      noteOpening(id, e.message.content.map(block => (block.type === 'text' ? block.text : '')).join('\n'))
    }

    return next(e)
  })

  // Every model request of every loop passes here. The main loop's go straight
  // through: its model is the person's own choice.
  on('turn.step', async function* ($, e, next) {
    const id = e.agentId

    if (id === undefined) {
      return yield* next(e)
    }

    const seat = seats.get(id) ?? enroll(id)

    if (seat.steps === 0 && seat.tag === '') {
      void readTag($, id).catch(() => undefined)
    }

    seat.steps += 1

    if (seat.model !== e.model || !seat.isLive) {
      seat.model = e.model
      seat.isLive = true
      await publish($)
    }

    if (seat.verdict === 'stopping') {
      const text = stopText(seat)

      seat.verdict = 'stopped'
      await publish($)
      yield { kind: 'text', index: 0, text }
      yield { kind: 'stop', stopReason: 'end_turn', usage: null }

      return {
        turnId: e.turnId,
        index: e.index,
        answer: text,
        toolUses: [],
        stopReason: 'end_turn',
        usage: null,
      }
    }

    return yield* next(seat.swappedTo === '' ? e : { ...e, model: seat.swappedTo })
  })

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)

    if (tool === LEDGER_TOOL) {
      const filter = (e as Record<string, unknown>)['filter']

      return { result: await ledgerText($, typeof filter === 'string' ? filter.trim() : '') }
    }

    const launched = codexOf(tool, e)

    if (launched !== '') {
      codex.set(launched, (codex.get(launched) ?? 0) + 1)
      await publish($)
    }

    const id = e.agentId

    if (id === undefined) {
      return next(e)
    }

    const seat = seats.get(id) ?? enroll(id)

    // Only after the person pressed Stop: the seat is told to wrap up.
    if (seat.verdict === 'stopping' || seat.verdict === 'stopped') {
      return {
        deny: 'Seat Guard: the user stopped this seat. Call no more tools; say what you finished and end your reply.',
      }
    }

    const file = codeFileOf(tool, e)

    if (file !== '' && PLANNER.test(modelOf(seat))) {
      seat.codeEdits += 1
      seat.lastFile = file

      if (seat.verdict === 'none' && !isQuiet) {
        seat.verdict = 'flagged'
        say($, `“${clip(seat.label, 40)}” runs on ${modelName(seat.model)} and is editing code.`)
      }

      await publish($)
    }

    if (launched === '') {
      return next(e)
    }

    // What the seat launched and whether the shell call came back clean: the
    // ledger's record of a Codex seat that did or did not run.
    const out = await next(e)

    seat.launched.push({ model: launched, isOk: out.deny === undefined && out.isError !== true })
    await publish($)

    return out
  })

  on('turn.complete', async ($, e, next) => {
    const seat = e.agentId === undefined ? undefined : seats.get(e.agentId)

    if (seat !== undefined) {
      seat.isLive = false

      if (e.usage !== undefined) {
        seat.tokens +=
          e.usage.input_tokens +
          e.usage.output_tokens +
          e.usage.cache_read_input_tokens +
          e.usage.cache_creation_input_tokens
      }

      // Over: there is nothing left to stop or swap.
      if (seat.verdict === 'flagged' || seat.verdict === 'stopping') {
        seat.verdict = seat.verdict === 'stopping' ? 'stopped' : 'none'
      }

      await publish($)
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const window = e.rateLimits.find(limit => limit.kind === 'five_hour')
    const key = window?.resetsAt ?? ''

    if (window !== undefined && window.percentUsed >= LIMIT_PERCENT && warnedWindow !== key) {
      const live = [...seats.values()].filter(seat => seat.isLive).length
      const left = key === '' ? '' : `, resets in ${span(Date.parse(key) - (await $.clock.now()))}`

      warnedWindow = key
      say(
        $,
        `the 5h window is at ${Math.round(window.percentUsed)}%${left}; ${live} Claude ${live === 1 ? 'seat' : 'seats'} live.`,
      )
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const list = await read($, seatList)
    const quiet = await read($, quietFlag)
    const counts = countsLine(list, await read($, codexList), quiet)
    const flagged = quiet ? [] : list.filter(seat => seat.verdict === 'flagged')
    const first = flagged[0]

    if (first === undefined && counts === undefined) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    // Another mod's band, when one draws beneath this one, stays under it.
    const below = await next(e)
    const more = flagged.length > 1 ? ` (+${flagged.length - 1} more)` : ''

    return (
      <Box flexDirection="column">
        {first !== undefined && (
          <Text color="warning" wrap="truncate-end">
            {flagLine(first)}
            {more}
          </Text>
        )}
        {first !== undefined && (
          <Box flexDirection="row" columnGap={1}>
            {ACTIONS.map(action => (
              <Button
                key={`seat-${action}`}
                label={LABELS[action]}
                hotkey={HOTKEYS[action]}
                onPress={() => act($, action, first.id)}
              />
            ))}
            <Text dimColor>{LEGEND}</Text>
          </Box>
        )}
        {counts !== undefined && (
          <Text dimColor wrap="truncate-end">
            {counts}
          </Text>
        )}
        {below}
      </Box>
    )
  })
}
