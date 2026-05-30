---
name: cpp-review
description: Apply uncompromising modern-C++ (C++20/23) review standards — RAII, zero-cost abstractions, const-correctness, smart-pointer ownership, concepts, std::expected/optional, STL-first, and the C++ Core Guidelines — as a FAANG-grade checklist that augments a code review. Trigger when the user types /cpp-review, or asks to "review this C++", "check my C++ against best practices", or wants modern-C++ standards enforced on a function/class/module. Do NOT trigger for non-C++ code, or for a generic cross-language diff review (use /code-review).
---

# cpp-review

The modern-C++ standards to enforce when reviewing C++20/23. Pair with `/code-review` for the review act; this skill is the **checklist**. Brutally honest by design — in C++ every line has performance, compile-time, and binary-size implications.

## Non-negotiable principles

- **Zero-cost abstractions** — if it generates worse assembly than hand-written C, it's wrong.
- **RAII for everything** — manual resource management is a defect.
- **Const-correctness** — if it doesn't mutate, it's `const`. `constexpr` everything possible. West const (`const T`).
- **Rule of Zero/Five** — no custom destructor unless you implement all five.
- **≥90% coverage** on critical paths.

## Standards

**Memory** — no owning raw pointers; `unique_ptr` for single ownership, `shared_ptr` only with proven need (`weak_ptr` for cycles); `make_unique`/`make_shared`, never `new`/`delete`.
**Errors** — `std::expected`/`std::optional` for recoverable; exceptions only for the exceptional; `noexcept` on anything that can't throw.
**Templates** — concepts on all template params (no SFINAE); metaprogramming justified by benchmarks.
**Modules/organization** — modules over headers; one class per header/impl pair; no circular deps; `#pragma once`.
**Types** — no C-style casts; `auto` for obvious types only; `enum class` only; `explicit` constructors; strong types over primitives.
**STL** — algorithms over raw loops; `string_view` for non-owning string params; `span` for arrays; `'\n'` not `std::endl`.
**Performance** — move semantics for non-trivial types; perfect forwarding; `reserve()` when size known; `emplace_back`.
**Modern features** — structured bindings, `std::variant` over unions, if/switch initializers, `<=>` where applicable.
**Naming** — Classes `PascalCase`, functions/vars `snake_case`, constants `SCREAMING_SNAKE_CASE`, private members `trailing_`; no abbreviations. Functions ≤40 lines, `[[nodiscard]]` on value returns.

## Flag immediately

`using namespace std`, manual memory management, C-style arrays, macros (except guards), `NULL`/`0` over `nullptr`, magic numbers, global mutable state, `goto`, `const_cast`/unjustified `reinterpret_cast`, >5 params, boolean params, index-based loops, uninitialized vars, signed/unsigned comparison, virtual without `override`/`final`, commented-out code, TODO without a tracker reference.

## Output (per finding)

**Severity** (Critical/High/Medium) · **Issue** · **Location** (file:line) · **Fix** (exact change) · **Rationale** (perf/safety/maintainability) · **Standard** (which Core Guideline it violates).

If the code wouldn't survive review on a FAANG systems team, it's not good enough.
