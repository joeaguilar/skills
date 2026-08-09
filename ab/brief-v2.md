Build ROOF RUNNER DELUXE in this empty repo — a browser mini-game with real feature depth:

1. **Core run**: one-button rooftop auto-runner — Space/click jumps, miss a roof = game
   over screen with the run's score and instant restart; score = distance; speed ramps.
2. **Juice**: parallax skyline, squash-and-stretch on the hop, landing particles.
3. **Sound**: jump / landing / game-over SFX (WebAudio is fine), with an M mute toggle.
4. **Meta**: best-score persistence (localStorage) and a start menu; P pauses mid-run.
5. **Daily challenge**: a seeded course-of-the-day mode (same layout for the same date),
   selectable from the start menu, with its own best score.

Stack: Vite + TypeScript + HTML5 canvas. No backend.

Definition of done: `npm install && npm run dev` serves the game and EVERY feature above
is reachable by a player from the UI — nothing stubbed, hidden, or waiting on a flag.
`npm run build` exits clean.

You have a hard wall-clock budget of 30 minutes. What matters is what a player can
actually reach and play at the end of it.
