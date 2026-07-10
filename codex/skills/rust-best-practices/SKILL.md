---
name: rust-best-practices
description: "Use for Rust or Cargo reviews, implementations, and refactors where idiomatic ownership, lifetimes, error handling, traits, API design, async/Tokio, testing, Clippy, performance, or unsafe-code discipline matter. Do not use as a generic language-independent review checklist."
---

# Rust Best Practices

Use this skill to keep Rust work aligned with the compiler, the standard
ecosystem, and pragmatic production quality. Default to simple, idiomatic code
first; tighten types, lifetimes, allocation behavior, and concurrency only where
the task or evidence justifies it.

## Reference Routing

The detailed standards live in
`references/rust-best-practices.md`. Read the relevant sections before making
non-trivial Rust design, review, or refactor decisions.

- Ownership, borrow checker, lifetimes: read the ownership section.
- Error strategy, `unwrap`, `anyhow`, `thiserror`: read the error handling
  section.
- Public APIs, newtypes, builders, traits, enums: read the API design section.
- Performance, allocations, smart pointers: read the performance and memory
  sections.
- Async Rust, Tokio, actors, cancellation, channels: read the concurrency
  section.
- Module layout, tests, Clippy, CI: read the tooling section.

Use `rg -n "^##|^###|keyword" references/rust-best-practices.md` to jump to the
needed section instead of loading unrelated detail.

## Working Rules

1. Inspect the Rust context first: `Cargo.toml`, workspace layout,
   `rust-toolchain*`, `.cargo/config*`, CI config, source modules, and existing
   test/lint conventions.
2. Preserve the repo's local style unless it conflicts with correctness or an
   explicit user goal.
3. Pick the appropriate rigor level:
   - Prototype: accept local `clone()`/`expect()` when it keeps the path clear.
   - Correct: use borrowed parameters, owned data in structs, `?` with context,
     domain error types where callers need to match, and meaningful tests.
   - Optimized: require profiling or a clear hot path before adding lifetimes,
     `Cow`, custom allocators, or complex zero-copy designs.
4. Treat borrow-checker friction as design feedback first. Prefer ownership
   restructuring, temporary variables, `entry`, `mem::take`, or field-level
   borrowing before adding interior mutability.
5. Use smart pointers deliberately: `Box` for heap ownership, `Rc` for
   single-threaded sharing, `Arc` for cross-task/thread sharing, and
   `Mutex`/`RwLock` only around the smallest coherent shared state.
6. In async code, avoid holding locks across `.await`, use bounded channels, and
   move CPU-heavy work to `spawn_blocking` or Rayon.
7. Keep `unsafe` rare, small, documented with `SAFETY:` invariants, and covered
   by tests or Miri when practical.

## Review Checklist

When reviewing Rust code, lead with concrete bugs and risks. Check:

- API flexibility: `&str`, `&[T]`, `&Path`, `impl AsRef<Path>`, or
  `impl Into<String>` where they improve callers without bloating internals.
- Error boundaries: `anyhow` at application edges; explicit enums for reusable
  modules and libraries; no `unwrap()` on I/O, user input, network, or library
  paths.
- Data modeling: newtypes for validated values, enums for closed state, traits
  for open extension points, and typestate only when misuse is genuinely costly.
- Async safety: no blocking work on the runtime, no unbounded queues by default,
  and cancellation-sensitive `select!` branches are intentional.
- Tests: unit tests for private logic, integration tests for public behavior,
  doctests for examples, property tests for broad input spaces, and snapshots
  for CLI output when useful.
- Tooling: `cargo fmt --check`, `cargo clippy -- -D warnings`, and
  `cargo test --workspace` are the default quality gate; add `cargo deny check`,
  `cargo nextest`, `cargo audit`, or semver/MSRV checks when the project already
  uses them or the task asks for hardening.

## Verification

Prefer read-only checks first. Run the narrowest meaningful command for the
change, then the repo's normal Rust gate when practical. Use `cargo fmt --check`
before formatting; only run mutating formatters when formatting is requested or
the edit scope makes project-wide formatting acceptable.
