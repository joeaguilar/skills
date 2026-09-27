---
name: unity-bridge
description: "Use to compile, test, inspect, or capture a running Unity project that already contains com.blue.claude-bridge and tools/unity.ps1. Not for projects without the bridge or ordinary headless CI builds."
---

# Unity Bridge

Operate the installed bridge through the project's PowerShell wrapper. The
package and `.claude-bridge` directory names are protocol identifiers; do not
rename them for Codex. Inspect `tools/unity.ps1` and available commands when its
interface differs from these examples.

```powershell
.\tools\unity.ps1 ping
.\tools\unity.ps1 commands
.\tools\unity.ps1 status
```

A timed-out command can still be queued and execute after the editor resumes.
Check status and the wrapper's queue/result handling before retrying a mutation.
Do not repeatedly enqueue play toggles or menu operations on a timeout.

After a coherent batch of C# edits, run `sync` to import/recompile and inspect its
reported errors. A successful sync proves compilation, not gameplay behavior.

```powershell
.\tools\unity.ps1 sync
.\tools\unity.ps1 test
.\tools\unity.ps1 test -CmdArgs @{ mode='play' }
.\tools\unity.ps1 test -CmdArgs @{ filter='Namespace.TestName' }
.\tools\unity.ps1 hierarchy -CmdArgs @{ depth=3 }
.\tools\unity.ps1 inspect -CmdArgs @{ path='Main Camera' }
.\tools\unity.ps1 console -CmdArgs @{ type='Error'; count=20 }
```

Prefer the wrapper's test command to hand-written polling. If it returns a run
ID, follow that run to completion rather than starting another test run. Results
may live at `.claude-bridge/tests/<runId>.json`. Report compile and test outcomes
separately. Use `-Raw` or `-TimeoutSec` only when supported by the wrapper.

## Visual and play-mode checks

```powershell
.\tools\unity.ps1 screenshot -CmdArgs @{ mode='game'; path='.claude-bridge/shots/check.png' }
.\tools\unity.ps1 play
.\tools\unity.ps1 status
```

Read the returned screenshot as an image. A camera RenderTexture capture can
omit Screen Space Overlay UI; use an available editor/window capture instead of
changing the production canvas mode just to produce a screenshot.

Play/stop responses may precede the actual state change across a domain reload.
Confirm `isPlaying` with status. If transitions stall in the background, identify
the exact project's editor and use an available authorized focus mechanism;
never focus an arbitrary Unity process or claim a transition from the reply alone.

For a dead bridge, inspect `.claude-bridge/bridge-alive.json`, compiler output,
and the relevant Unity Editor log. Windows commonly uses
`%LOCALAPPDATA%/Unity/Editor/Editor.log`. Console history can reset after reload;
missing older messages is not evidence they never occurred. If domain reload is
disabled, inspect persistent static state when reproducing repeated-play bugs.

When the task requires changing the bridge itself, establish a log-based recovery
path first: a bridge compile error can disable its own control channel. Add a
handler only when required by the task. Return plain serializable values rather
than `UnityEngine.Object` graphs. Do not install or modify the package just because
this skill is available.
