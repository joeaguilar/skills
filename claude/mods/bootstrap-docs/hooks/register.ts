import type { EngineInterface, Register } from 'claude-code'

import { docsOf } from './templates'

const COMMAND = 'bootstrap-docs'
/** Marks an action that spends tokens: it starts a model turn. */
const COST = '¤'
const LEGEND = `${COST} uses tokens`
/** Long enough for the command that set the timer to have been answered. */
const SOON_MS = 50
/** The file a scaffold is known by: the one every agent session starts from. */
const ENTRY = 'AGENTS.md'

const USAGE = [
  `Usage: /${COMMAND} [dir] [--force] [--project-name NAME]   write the scaffold (no model turn)`,
  `       /${COMMAND} --fill [dir] ${COST}                        ask Claude to fill it in (${LEGEND})`,
].join('\n')

/** What was asked for after the command's name. */
export type Asked = {
  /** The folder as typed; '' for the session's own. */
  dir: string
  isForced: boolean
  /** The README's heading; absent, the folder's name. */
  projectName: string | undefined
  isFill: boolean
}

/**
 * Splits what was typed into words. A quote keeps spaces together where it
 * opens a word or follows `=`; a backslash is a Windows path's own, never an escape.
 */
export const wordsOf = (args: string): string[] => {
  const words: string[] = []
  let word = ''
  let isOpen = false
  let quote = ''

  for (const char of args) {
    if (quote !== '') {
      if (char === quote) {
        quote = ''
      } else {
        word += char
      }
    } else if ((char === '"' || char === "'") && (!isOpen || word.endsWith('='))) {
      quote = char
      isOpen = true
    } else if (/\s/.test(char)) {
      if (isOpen) {
        words.push(word)
      }

      word = ''
      isOpen = false
    } else {
      word += char
      isOpen = true
    }
  }

  if (isOpen) {
    words.push(word)
  }

  return words
}

/** Reads the words into what was asked, or says what it could not read. */
export const askedOf = (args: string): Asked | { error: string } => {
  const asked: Asked = { dir: '', isForced: false, projectName: undefined, isFill: false }
  const dirs: string[] = []
  const words = wordsOf(args)

  for (let at = 0; at < words.length; at += 1) {
    const word = words[at] ?? ''

    if (word === '--force') {
      asked.isForced = true
    } else if (word === '--fill') {
      asked.isFill = true
    } else if (word === '--project-name') {
      const name = words[at + 1]

      if (name === undefined) {
        return { error: '--project-name needs a name.' }
      }

      asked.projectName = name
      at += 1
    } else if (word.startsWith('--project-name=')) {
      asked.projectName = word.slice('--project-name='.length)
    } else if (word.startsWith('--')) {
      return { error: `${word} is not an option.` }
    } else {
      dirs.push(word)
    }
  }

  if (dirs.length > 1) {
    return { error: 'one folder at a time (quote a path that has spaces).' }
  }

  if (asked.isFill && (asked.isForced || asked.projectName !== undefined)) {
    return { error: '--fill takes a folder and nothing else.' }
  }

  asked.dir = dirs[0] ?? ''

  return asked
}

const isAbsolute = (path: string) => /^(?:[A-Za-z]:[\\/]|[\\/])/.test(path)

/** The separator a path is written with: its first one, `/` when it has none. */
const separatorOf = (path: string) => /[\\/]/.exec(path)?.[0] ?? '/'

/** The path with `.`, `..` and doubled separators folded, in the separator it came with. */
export const folded = (path: string): string => {
  const separator = separatorOf(path)
  const drive = /^[A-Za-z]:(?=[\\/])/.exec(path)?.[0] ?? ''
  const rest = path.slice(drive.length)
  // A network path keeps both of its leading separators.
  const root = /^[\\/]{2}[^\\/]/.test(rest) ? separator + separator : /^[\\/]/.test(rest) ? separator : ''
  const kept: string[] = []

  for (const part of rest.split(/[\\/]+/)) {
    if (part === '..' && kept.length > 0 && kept[kept.length - 1] !== '..') {
      kept.pop()
    } else if (part === '..' && root !== '') {
      // Above the root there is only the root.
    } else if (part !== '' && part !== '.') {
      kept.push(part)
    }
  }

  return `${drive}${root}${kept.join(separator)}` || '.'
}

/** A name under a folder, joined by the folder's own separator. */
export const joined = (folder: string, name: string): string =>
  /[\\/]$/.test(folder) ? `${folder}${name}` : `${folder}${separatorOf(folder)}${name}`

/** The last part of a path: the folder's own name. */
export const leafOf = (path: string): string => path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''

/** Where the folder that was typed lands: absolute, under the session's when relative, `~` the home. */
const placedDir = async ($: EngineInterface, typed: string): Promise<string> => {
  const cwd = await $.session.cwd()

  if (typed === '') {
    return folded(cwd)
  }

  if (typed === '~' || /^~[\\/]/.test(typed)) {
    const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))

    if (home !== undefined && home !== '') {
      return folded(typed === '~' ? home : joined(home, typed.slice(2)))
    }
  }

  return folded(isAbsolute(typed) ? typed : joined(cwd, typed))
}

/** Writes the seven files, leaving what exists unless forced; one line per file. No model call. */
const scaffoldInto = async ($: EngineInterface, asked: Asked): Promise<string> => {
  const target = await placedDir($, asked.dir)
  const docs = docsOf(asked.projectName ?? leafOf(target))
  const width = Math.max(...docs.map(([name]) => name.length))
  const rows: string[] = []
  let written = 0

  for (const [name, content] of docs) {
    const path = joined(target, name)
    let outcome: string

    try {
      const existed = await $.fs.exists(path)

      if (existed && !asked.isForced) {
        outcome = 'skipped (exists)'
      } else {
        await $.fs.write(path, content)
        outcome = existed ? 'overwrote' : 'created'
        written += 1
      }
    } catch (error) {
      outcome = `failed: ${error instanceof Error ? error.message : String(error)}`
    }

    rows.push(`  ${name.padEnd(width)}  ${outcome}`)
  }

  const hint =
    written > 0
      ? `Next: /${COMMAND} --fill ${COST} has Claude fill in what it already knows (${LEGEND}).`
      : `Nothing written. --force overwrites what exists.`

  return [`Scaffold in ${target}`, ...rows, hint].join('\n')
}

/** What the person asks Claude for with --fill: their own words, since they typed the command. */
export const fillText = (target: string): string =>
  [
    `[${COMMAND}] Fill in the documentation scaffold in ${target} with the project facts you already know from this conversation and this repository.`,
    'When a fact could fit more than one file, place it by this precedence:',
    '1. GOSPEL.md for hard rules, constraints, workflows, and always/never behavior.',
    '2. APOSTLE.md for my preferences, decision style, priorities, taste, and product-owner expectations.',
    "3. SOUL.md for the agent's repo-specific operating identity.",
    '4. AGENTS.md for condensed navigation, current project state, and links to deeper docs.',
    'AGENTS.md stays the required starting point; CLAUDE.md stays a thin pointer to it and holds no project memory. CONTRIBUTING.md takes coding style and the canonical test commands; README.md takes the overview and setup.',
    'Keep every core file under 5000 lines. Create docs/ARCHITECTURE.md, docs/DECISIONS.md, docs/ROADMAP.md, docs/RUNBOOK.md, docs/GLOSSARY.md, docs/RESEARCH.md or docs/ASSETS.md only when one has real content.',
    'Invent nothing: leave the scaffold text where you know nothing, and say which sections you left.',
  ].join('\n')

/** Submits the request as the person's own words: they typed the command for it. */
const submitFill = async ($: EngineInterface, text: string) => {
  try {
    await $.prompt.submit({ text, asUser: true })
  } catch {
    $.ui.toast(`${COMMAND}: the prompt could not be submitted.`)
  }
}

/** Hands the main session the request to fill the scaffold in. Spends a turn. */
const askToFill = async ($: EngineInterface, asked: Asked): Promise<string> => {
  const target = await placedDir($, asked.dir)

  if (!(await $.fs.exists(joined(target, ENTRY)).catch(() => false))) {
    return `No scaffold in ${target} (${ENTRY} is missing). Run /${COMMAND}${asked.dir === '' ? '' : ` "${asked.dir}"`} first.`
  }

  // Not from inside the command's own dispatch: the turn it starts would wait on this hook.
  $.clock.after(SOON_MS, () => {
    void submitFill($, fillText(target))
  })

  return `Asked Claude to fill in the scaffold in ${target} (${LEGEND}).`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: `Write the AGENTS/CLAUDE/GOSPEL/SOUL/APOSTLE/CONTRIBUTING/README scaffold into a folder, no model turn. --fill ${COST} asks Claude to fill it in (${LEGEND})`,
      argumentHint: '[dir] [--force] [--project-name NAME] | --fill [dir]',
    })

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const asked = askedOf(e.args)

    if ('error' in asked) {
      return { text: `${asked.error}\n${USAGE}` }
    }

    return { text: asked.isFill ? await askToFill($, asked) : await scaffoldInto($, asked) }
  })
}
