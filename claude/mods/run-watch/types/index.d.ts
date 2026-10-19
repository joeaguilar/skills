/**
 * One model loop other than the main one: a subagent the Agent tool started
 * (`agent`), or a loop no list names, such as a workflow's agent (`unlisted`).
 */
export type Run = {
  /** The loop's agent id, as its `tool.call` events carry it. */
  id: string
  label: string
  kind: 'agent' | 'unlisted'
  /** The model it runs on, '' while unknown. */
  model: string
  startedAt: number
  /** When it last started or finished a tool call. */
  lastAt: number
  /** The tool it is inside right now, '' between calls. */
  busyTool: string
  busyDetail: string
  status: 'running' | 'ended' | 'failed'
  /** 0 while running. */
  endedAt: number
  /** The quiet level it was last flagged at; 0 once it moves again. */
  alertLevel: number
  /** The quiet level the person last acted on: the band stays down until it is passed. */
  ackLevel: number
}

/** A background task that was in flight when the main loop last stopped. */
export type Parked = {
  id: string
  type: string
  label: string
  /** When a stop first reported it. */
  since: number
}

export type Pulse = {
  /** The time of the last measurement, what the drawings count from. */
  now: number
  /** When any loop last started or finished a tool call or a turn. */
  activeAt: number
  /** When the main loop went idle; 0 while a main turn runs. */
  idleSince: number
  /** The quiet level the whole session was last flagged at. */
  stallLevel: number
  /** The quiet level of the whole session the person last acted on. */
  stallAck: number
}

/** The run whose latest transcript the pane shows; `id` '' when none. */
export type Inspection = {
  id: string
  lines: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'run-watch': {
      runs: Run[]
      parked: Parked[]
      pulse: Pulse
      hasOpened: boolean
      inspection: Inspection
    }
  }
}
