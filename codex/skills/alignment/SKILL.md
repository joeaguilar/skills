---
name: alignment
description: "Alignment interview: stress-test plan/design/agent workflow, resolve assumptions, decision branches, user-agent expectations."
---

# Alignment

Interview the user until the plan or design is precise enough to act on without hidden assumptions.

## Workflow

1. Restate the objective and the biggest unknowns in a short paragraph.
2. Walk down the decision tree one branch at a time. Resolve dependent decisions before moving to downstream choices.
3. Ask one question at a time unless two questions are tightly coupled.
4. For each question, include a recommended answer and the reasoning behind it.
5. Track settled decisions and unresolved risks as the interview progresses.
6. When the major branches are resolved, summarize the agreed plan, remaining assumptions, and any next action.

## Asking Questions

- For simple questions with 2-3 mutually exclusive options, use Codex's `request_user_input` tool when it is available. Put the recommended option first and mark it as recommended.
- For nuanced questions, ask directly in the conversation and wait for the user's answer.
- Keep pressing on ambiguous terms, missing constraints, unstated acceptance criteria, and places where the user's expectation of the agent could diverge from the implementation plan.
