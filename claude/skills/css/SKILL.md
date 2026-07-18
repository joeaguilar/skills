---
name: css
description: Expert CSS guidance across two lenses — Mastery (Grid/Flex, container queries, subgrid, @layer, :has(), logical properties, cascade architecture, ITCSS/CUBE/BEM, containment/content-visibility performance) and Motion (keyframes, cubic-bezier easing, 60fps/GPU compositing, prefers-reduced-motion, Three.js). Trigger when the user types /css, or asks "why is my grid/flex doing X", "make this animation smooth/60fps", "container vs media queries", "is this CSS performant", "advanced CSS technique for…", or wants deep CSS or motion expertise. Do NOT trigger for designing a whole component/page/app (use the frontend-design skill), for trivial styling tweaks inside a larger build, or for non-CSS UI-framework questions.
---

# css

Deep CSS and motion expertise — the architectural "why" behind a solution, not just syntax that happens to work. Two lenses; use whichever the question calls for.

## Lens 1 — Mastery (layout, features, performance, architecture)

- **Modern layout & features:** container queries, subgrid, `@layer` cascade layers, `:has()`, logical properties, custom properties for theming; Grid edge cases (implicit vs explicit, `grid-auto-flow: dense`, `fr` + `minmax()`).
- **Performance:** CSS containment, `content-visibility`, GPU acceleration, avoiding layout thrash.
- **Architecture:** when to embrace vs control the cascade; ITCSS / CUBE CSS / BEM and their appropriate use cases; zero-runtime alternatives to CSS-in-JS.
- **Anti-patterns to flag:** magic numbers, z-index wars, overqualified selectors, `transition: all`.

## Lens 2 — Motion (animation & interaction)

- **60fps or it shouldn't exist:** prefer `transform`/`opacity` over animating layout properties; use `will-change` deliberately; keep work on the compositor.
- **Easing with intent:** specific `cubic-bezier` curves chosen for the emotional effect; semantic keyframe names.
- **Accessibility:** always honor `prefers-reduced-motion`; motion must have purpose, not decoration.
- **Reach for Three.js** only when CSS/WebGL genuinely warrants it (particle systems, 3D interaction).

## When responding

1. **Check current support** — caniuse / context7 for browser support and the latest spec before recommending a cutting-edge feature.
2. **Explain the why** — reveal the underlying mechanics, including historical context when it clarifies.
3. **Performance + a11y, always** — name the cost and the inclusive-design implication.
4. **Show code** — concrete, minimal examples; distinguish approaches for different contexts (component library vs marketing site).

## Principles

- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes. Advice-only answers land no files — nothing to commit; when a run does edit stylesheets or code, commit the change.

## Don't

- Don't animate layout-triggering properties (`top`/`left`/`width`/`height`) when `transform` will do.
- Don't ship `transition: all`, magic numbers, or escalating z-index.
- Don't ignore reduced-motion preferences.
