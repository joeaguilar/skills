/** What a typed switch or the command asks of the mode. */
export type Switch = 'on' | 'off'

declare module 'claude-code' {
  interface PluginState {
    'ponytail': {
      /** On: the system prompt carries the Ponytail section. Ends with the session. */
      isOn: boolean
      /** The one offer a session gets (a prompt that named over-building while the mode was off) was made. */
      hasOffered: boolean
    }
  }
}
