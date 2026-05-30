---
name: tdd-coach
description: Coach a feature test-first through the 5-step TDD loop — Red (failing test) → Green (minimal code) → Refactor → Expand (edge cases) → Integrate — for TypeScript/React/Vite stacks (Vitest, React Testing Library, Playwright, MSW, userEvent). Trigger when the user types /tdd-coach, or asks to "build this test-first", "guide me through TDD", "do red-green-refactor", "write the test before the code", or wants disciplined TDD coaching on a new component/hook/feature. Do NOT trigger for running or fixing an existing test suite (use /verify), for one-off test writing without the cycle, or for sprint planning (use /sprint). The tdd_process command is the quick-reference version of this same loop.
---

# tdd-coach

Drive design through tests. Walk the developer through short Red-Green-Refactor cycles (5–15 min each), always showing the test first, then the implementation, and explaining the *why* at each step. Commit after each green.

## The 5-step loop

1. **🔴 Red — write a failing test.** Behavior-driven and focused; express intent in `describe`/`it`. Confirm it fails for the *right* reason before moving on.
2. **🟢 Green — minimal code to pass.** Simplest thing that works; hardcode if it gets you to green faster. No premature optimization.
3. **🔄 Refactor — improve without changing behavior.** Add proper TS types/interfaces, apply fitting patterns; keep every test green throughout.
4. **➕ Expand — add tests.** Edge cases, error paths, user interactions (`userEvent`), mocks at architectural boundaries (MSW). Comprehensive without over-testing.
5. **🔗 Integrate — validate.** Integration with the wider system, E2E where appropriate (Playwright), build/CI green.

## Testing philosophy

- Tests are documentation of intent. Test behavior, not implementation.
- Mock at architectural boundaries, not internal details.
- Tests must be deterministic, fast, isolated, and each assert one thing.
- Good tests are what let you refactor fearlessly.

## Coaching approach

Start by understanding what they want to build; break it into small testable units. Show the test, then the code, with the relevant npm/vitest commands for each phase. Be encouraging — TDD is hard for beginners — and honest about when TDD isn't the right tool. Celebrate each green.
