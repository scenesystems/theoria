---
description: UI application guidelines for apps/theoria
globs: "**/*.ts, **/*.tsx, **/*.css"
alwaysApply: true
---

# apps/theoria

React + Tailwind CSS v4 + effect-atom application showcasing Scene Systems packages.

## Experience And Identity

- Theoria has its own established visual identity across homepage and docs:
  Figtree and its cool light/blue-black dark palette family. Do not import
  Scene's theme, replace the font or base palette, or reinterpret an immersive
  brief as a new brand. Improve type, spacing, tonal relationships, component
  geometry, illustration, and motion through the shared Theoria foundations.
- The homepage has a distinct aesthetic hero and a real interactive imagined-
  place demonstration. Preserve both purposes. The package catalog belongs at
  the docs entry, not in place of the demo. Stories are coherent imaginative
  content, not implementation narration or pretexts for changing the page theme.
- Let real operations, feedback, and visible outcomes explain the demonstration.
  Remove repeated story fragments, confusing bylines, arbitrary metrics, and
  stacked explanatory cards. Keep useful code/package learning reachable after
  the walkthrough; keep proprietary Scene content out of public examples.
- Docs use Theoria's identity, useful guides, readable highlighted/copyable code,
  meaningful API hierarchy, and working search/navigation. Do not substitute a
  signature dump or headers explaining that this is a documentation site.
- Content popovers, including code and provenance, open on click/touch and
  keyboard activation, not hover. Preserve readable layering, dismissal, focus
  return, and compact geometry. Actual tooltips are noninteractive supplements.
- Keep loading geometry stable, drawings coherent with the shown state, controls
  stationary, and transitions smooth through resize, repeated input, and reduced
  motion. Recheck mobile, tablet, desktop, wide, and short-height compositions in
  supported themes; full-page screenshots alone do not review these behaviors.

---

## Stack

| Layer      | Technology                                                   |
| ---------- | ------------------------------------------------------------ |
| Framework  | React 19                                                     |
| Styling    | Tailwind CSS v4 (CSS-first, `@theme inline`)                 |
| Components | Base UI (`@base-ui/react`) — headless, unstyled              |
| State      | effect-atom (`@effect-atom/atom`, `@effect-atom/atom-react`) |
| Runtime    | Effect-TS — all code Effect-native                           |
| Icons      | `@heroicons/react`                                           |

---

## Rules

1. **Effect-native only** — no `async/await`, `throw`, `try/catch`, `let`, `for/while`, `switch`, `console.*`. See root AGENTS.md.
2. **No `useEffect`** — effect-atom handles all subscriptions, side effects, and cleanup.
3. **Atom owns all reactive state and lifetime** — no `useState` escape hatch for
   domain, view, transient, or element-observation state. Use native Atom
   composition with the lifetime the value requires; research unresolved
   framework integration rather than granting a local exception.
4. **No raw HTML** — use layout primitives (Stack, Cluster, Layer, Section) and SemanticText for all text.
5. **No hardcoded colors** — all from theme tokens via CSS variables.
6. **No dynamic Tailwind class construction** — `bg-${x}-500` is BANNED. Use `Match.exhaustive` with full literal strings.
7. **No `dark:` utility classes for color theming** — CSS variable swap handles dark mode automatically.
8. **No inline styles for colors** — use CSS vars via className: `bg-(--my-var)`.
9. **No `forwardRef`** — React 19: `ref` is a prop.
10. **Schema is single source of truth** — all types derive from Schema. No `as` assertions, no `satisfies`.

---

## Commands

**Read `apps/theoria/package.json` for the canonical script list.** Run from `apps/theoria/` or use `bun run --filter @theoria/theoria-app <script>` from repo root.

## Dev Servers

On a local machine, use the repository's `bun run app:theoria:tmux` runbook.
In an Amp orb, use supervised orb services instead: tmux does not preserve
servers across Amp updates or pause/resume. Keep the API port at `3876` and
Vite at `5175`, and expose a portal for user access rather than a loopback URL.

When reading `apps/theoria/package.json`, treat `5175` as the only sanctioned frontend dev port. Do not infer Vite defaults or choose alternate ports unless the user explicitly asks you to change the checked-in configuration.

---

## Workflow References

Use the consolidated `composing-ui` workflow for design, shared components,
accessibility, responsive behavior, and rendered review; use `idiomatic-effect`
for Atom state/lifetime and native computation. Read exact installed Tailwind,
Base UI, React, and Atom public contracts when integrating them. This checkout
does not bundle library-specific skills; do not invent their availability.
Missing tooling never relaxes the root or application requirements.
