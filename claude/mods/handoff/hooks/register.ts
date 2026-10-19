import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Plan } from '../types'

/** Leads the handoff prompt, so its turn is told from any other. */
const MARK = '[handoff]'
const TOAST_MS = 12_000
/** A compaction is refused while a turn runs: how often and how long to retry. */
const RETRY_MS = 1_000
const RETRIES = 20
/** Long enough for the hook that set the timer to have returned. */
const SOON_MS = 50

const IDLE: Plan = { phase: 'idle', turnId: '', isHeld: false, compact: '', wake: '' }

const plan = atom({ plugin: 'handoff', key: 'plan' } as const, IDLE)

const ASK = `${MARK} Prepare this session for compaction.

1. Write the handoff document. If this project already keeps one (HANDOFF.md, a handoff or RESUME file under docs/, the active campaign's or sprint's HANDOFF.md), update that file; otherwise create HANDOFF.md at the repository root. A session with no memory of this one must be able to continue from it alone. Cover: the goal; what is done and committed, with commit hashes; what is in flight or uncommitted, including anything subagents, workflows or background runs left behind; what is broken right now; the next steps in order; the decisions and standing rules given in this session (model routing, commit rules, review limits); and the open questions that wait on me.
2. Commit what can be committed, the handoff document included, following this repository's commit rules. Name anything left uncommitted in the handoff.
3. End your reply with these two fenced blocks and nothing after them. Plain text inside, no code fences.

\`\`\`handoff-compact
What the compaction summary must keep: the handoff file's path, the tracker ids, what is done, what is broken, the standing rules, the open questions.
\`\`\`

\`\`\`handoff-wake
The prompt that resumes the work after compaction: read the handoff file fully first, the standing rules restated, the first step named.
\`\`\`

If the handoff cannot be written, say why and leave both blocks out; nothing is compacted without them.`

const askFor = (focus: string) => (focus === '' ? ASK : `${ASK}\n\nFocus: ${focus}`)

/** The text of one fenced block of the reply, or '' when it has none. */
const blockOf = (answer: string, name: string) =>
  new RegExp('```' + name + '[^\\n]*\\n([\\s\\S]*?)\\n```').exec(answer)?.[1]?.trim() ?? ''

const say = ($: EngineInterface, text: string) => {
  $.ui.toast(`Handoff: ${text}`, { timeoutMs: TOAST_MS })
}

/**
 * Submits the handoff prompt as the person's own words. A command hook holds
 * the turn a submission would wait on, so this runs from a timer after it.
 */
const ask = async ($: EngineInterface, focus: string) => {
  try {
    await $.prompt.submit({ text: askFor(focus), asUser: true })
  } catch {
    await update($, plan, held => ({ ...IDLE, wake: held.wake }))
    say($, 'the handoff prompt could not be submitted; nothing was started.')
  }
}

/** Puts the wake prompt in the input box, unless a draft is already there. */
const fillWake = async ($: EngineInterface) => {
  const { wake } = await read($, plan)

  if (wake === '') {
    return 'No wake prompt is held; run /handoff first.'
  }

  if ((await $.prompt.read()).text.trim() !== '') {
    return 'The input box holds a draft; clear it and run /handoff wake.'
  }

  const { isFilled } = await $.prompt.fill({ text: wake })

  return isFilled
    ? 'The wake prompt is in the input box; Enter resumes.'
    : 'The input box could not take the wake prompt; run /handoff wake.'
}

/** After a compaction that used the handoff: the plan is spent, the wake prompt offered. */
const afterCompact = async ($: EngineInterface) => {
  await update($, plan, held => ({ ...IDLE, wake: held.wake }))
  say($, `compacted. ${await fillWake($)}`)
}

/** Compacts with the handoff's instructions once the turn that wrote it is over. */
const compactNow = async ($: EngineInterface, attempt: number) => {
  const held = await read($, plan)

  if (held.phase !== 'ready' || held.isHeld) {
    return
  }

  try {
    const done = await $.session.compact({ instructions: held.compact })

    if (done.skip !== undefined) {
      say($, `compaction skipped (${done.skip}). Your own /compact still uses the handoff.`)

      return
    }
  } catch {
    if (attempt >= RETRIES) {
      say($, 'the session stayed busy, so nothing was compacted. Your own /compact uses the handoff.')

      return
    }

    $.clock.after(RETRY_MS, () => {
      void compactNow($, attempt + 1)
    })

    return
  }

  await afterCompact($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'handoff',
      description:
        'Write the handoff document, compact with it, and queue the wake prompt (¤ uses tokens)',
      argumentHint: '[hold | wake | cancel | focus]',
    })

    return next(e)
  })

  on('command.run', { command: 'handoff' }, async ($, e) => {
    const args = e.args.trim()

    if (args === 'wake') {
      return { text: `Handoff: ${await fillWake($)}` }
    }

    if (args === 'cancel') {
      await update($, plan, held => ({ ...IDLE, wake: held.wake }))

      return { text: 'Handoff: cancelled; nothing will be compacted.' }
    }

    const isHeld = args === 'hold' || args.startsWith('hold ')
    const focus = isHeld ? args.slice('hold'.length).trim() : args

    await update($, plan, () => ({ ...IDLE, phase: 'writing', isHeld }))
    $.clock.after(SOON_MS, () => {
      void ask($, focus)
    })

    return {
      text: isHeld
        ? 'Handoff: writing the handoff document; your next /compact will use it.'
        : 'Handoff: writing the handoff document; compaction follows.',
    }
  })

  on('turn.start', async ($, e, next) => {
    if (e.text.includes(MARK)) {
      await update($, plan, held =>
        held.phase === 'writing' && held.turnId === '' ? { ...held, turnId: e.turnId } : held,
      )
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      return next(e)
    }

    const held = await read($, plan)

    if (held.phase !== 'writing') {
      return next(e)
    }

    const compact = blockOf(e.answer, 'handoff-compact')
    const wake = blockOf(e.answer, 'handoff-wake')
    const hasBlocks = compact !== '' && wake !== ''

    // Another prompt's turn ran first: the handoff turn is still to come.
    if (held.turnId !== e.turnId && !hasBlocks) {
      return next(e)
    }

    if (e.reason !== 'answer' || !hasBlocks) {
      await update($, plan, () => ({ ...IDLE, wake: held.wake }))
      say(
        $,
        e.reason === 'answer'
          ? 'the reply has no compact and wake blocks, so nothing was compacted.'
          : 'the handoff turn did not finish, so nothing was compacted.',
      )

      return next(e)
    }

    await update($, plan, () => ({ ...held, phase: 'ready', turnId: e.turnId, compact, wake }))

    if (held.isHeld) {
      say($, 'saved. Your next /compact uses it, then the wake prompt is filled.')
    } else {
      say($, 'saved, compacting.')
      $.clock.after(RETRY_MS, () => {
        void compactNow($, 0)
      })
    }

    return next(e)
  })

  // The person's own /compact, or the engine's at its threshold, while a
  // handoff is held: the summarizer is told what the handoff says to keep.
  on('session.compact', async ($, e, next) => {
    const held = await read($, plan)

    if (held.phase !== 'ready' || e.agentId !== undefined) {
      return next(e)
    }

    const instructions =
      e.instructions === undefined ? held.compact : `${held.compact}\n\n${e.instructions}`
    const done = await next({ ...e, instructions })

    if (e.trigger !== 'precompute' && done.skip === undefined) {
      $.clock.after(RETRY_MS, () => {
        void afterCompact($)
      })
    }

    return done
  })
}
