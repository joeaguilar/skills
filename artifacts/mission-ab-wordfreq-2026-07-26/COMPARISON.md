# Mission skill A/B: `wordfreq`

Date: 2026-07-26

## Verdict

The rewrite made a meaningful, user-visible difference in this controlled
forward test. Both arms produced a working CLI and passed their own tests, but
the original failed an independent requirement check for punctuation. The
rewrite passed every independent check.

The rewrite also reached production code 35 seconds earlier and eliminated the
original's pre-code premise document, two extra tracker records, two extra
commits, and two mission-only documentation files.

This is not evidence that the rewrite is universally cheaper or faster. In
this small trial it took 11 seconds longer and cost $0.0785 more because it
performed an independent whole-diff review. That review found the punctuation
defect before completion and caused Claude to fix it and add a regression
test. The measured trade was slightly more wall time and money for a correct
result with less process ceremony.

## Controlled setup

The two arms started from separate clean repositories with the same baseline,
the same prompt, the same existing `itr` tracker, and the same external
conditions:

- Claude Sonnet 5
- medium effort
- automatic permissions
- project-only settings
- externally enforced USD 2 cap
- `python3 -m unittest -v` as the requested verification command

The complete prompt is in [PROMPT.md](PROMPT.md). The exact skill text loaded
by each arm is preserved in `original/input-skill.md` and
`rewrite/input-skill.md`.

| Input | Original | Rewrite |
|---|---:|---:|
| SHA-256 | `944ad2f5...b668f` | `6101bc57...28882` |
| Skill words | 3,939 | 1,497 |

The rewrite is 62.0% shorter by word count.

## Measured outcomes

| Measure | Original | Rewrite | Observed difference |
|---|---:|---:|---:|
| First production-code write | 59 s | 24 s | rewrite 35 s earlier |
| Total duration | 140.1 s | 151.4 s | rewrite 11.2 s longer |
| Claude-reported cost | $0.6208 | $0.6993 | rewrite $0.0785 more |
| Cache-read input tokens | 993,584 | 863,044 | rewrite 13.1% fewer |
| Output tokens | 7,403 | 7,104 | rewrite 4.0% fewer |
| Bash calls | 15 | 13 | rewrite 2 fewer |
| Tracker records | 3 | 1 | rewrite 2 fewer |
| Commits after baseline | 3 | 1 | rewrite 2 fewer |
| Mission-only ceremony files | 2 | 0 | rewrite 2 fewer |
| Generated unit tests | 13 | 16 | rewrite 3 more |
| Independent final reviewer | no | yes | reviewer found a real defect |
| Independent requirement gate | fail | pass | rewrite wins |

The original's first write at 35 seconds was not product code. It was
`missions/wordfreq/chains/1/premise.md`; `wordfreq.py` followed at 59 seconds.
The rewrite's first write was `wordfreq.py` at 24 seconds.

Raw run metrics are in `original/result.json` and `rewrite/result.json`.
Tracker outcomes are in each arm's `tracker.json`. Both generated programs and
their own test suites are preserved under each arm's `output/` directory.

## Independent verification

The verifier does not trust either generated test suite as the sole oracle. It
runs each suite, then applies the same external CLI checks to both programs.
The discriminating input is:

```text
Red red BLUE blue alpha_beta.
```

The prompt requires punctuation to be ignored. The expected tokens are
`alpha` and `beta`, not `alpha_beta`.

The original produced:

```text
blue: 2
red: 2
alpha_beta: 1
```

The rewrite produced:

```text
blue    2
red     2
alpha   1
beta    1
```

The original used Python's `\w+`, which includes underscore, and its own 13
tests did not expose the problem. The rewrite initially had a different
punctuation edge case. Its whole-diff reviewer identified that defect, Claude
reproduced it, fixed the tokenizer, and added a regression test before
completion. Its final 16-test suite and the independent checks pass.

The complete verifier result is [verification.json](verification.json). Rerun
it from the repository root:

```bash
python3 artifacts/mission-ab-wordfreq-2026-07-26/verify_outcomes.py
```

The acceptance language—case-insensitive counting, ignoring punctuation,
deterministic sorting, helpful errors, and real CLI checks—was fixed in the
shared prompt before either run. The exact underscore probe was added after
the runs while building the common verifier. It is therefore a post-run test
of a pre-existing requirement, not a preregistered test vector. That limits
the strength of the general claim, but it does not change that the same
requirement check is applied to both preserved outputs.

## Preserved calibration runs

Two earlier attempts are retained rather than discarded:

- `calibration-global-resolution/` is invalid as an A/B arm because Claude
  resolved the globally installed rewritten skill instead of the intended
  original.
- `calibration-git-parent-original/` is invalid as the designated original
  because the historical Git parent differs by one line from
  `claude/skills/old-mission-skill-ab/SKILL.md`.

They remain useful evidence about skill resolution and experimental setup, but
they are excluded from the comparison table and verdict.

## What this test establishes

This single trial establishes that the rewritten instructions can materially
change both process and output under identical task conditions: earlier
product work, less ceremony, and a final artifact that survives an external
requirement check the original misses.

It does not establish a general cost or latency advantage. That claim would
require repeated tasks and multiple seeds. The defensible conclusion from this
trial is narrower: the rewrite bought better final correctness and a leaner
work trail, not lower total spend.
