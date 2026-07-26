# Mission A/B prompt

Both valid arms use Claude Sonnet 5, medium effort, automatic permissions,
project-only settings, an existing `itr` tracker, and an externally enforced
USD 2 maximum.

Invocation shape (with each arm's isolated working directory and identical
prompt substituted):

```text
claude -p --model sonnet --effort medium --permission-mode auto \
  --setting-sources project --max-budget-usd 2 --output-format json PROMPT
```

```text
/mission --tracker itr --verify "python3 -m unittest -v" Build a greenfield Python CLI named wordfreq. A user runs `python3 wordfreq.py FILE --top N` and sees the N most common words. Count case-insensitively, ignore punctuation, sort by count descending then word ascending, use only the Python standard library, give helpful errors for a missing or unreadable file and invalid `--top`, verify with unittest plus real CLI smoke commands, use the existing issue tracker, and commit the finished result. The requirements are complete; do not ask clarifying questions.
```
