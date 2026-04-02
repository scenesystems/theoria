---
description: UI application guidelines for apps/theoria
globs: "**/*.ts, **/*.tsx, **/*.css"
alwaysApply: true
---

# apps/theoria

React + Tailwind CSS v4 + effect-atom application showcasing Scene Systems packages.

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
3. **No `useState` for domain state** — use `Atom.make` at module level.
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

Use tmux to run the API server and Vite dev server in the background. Prefer the repo runbook `bun run app:theoria:tmux` from the repository root. The API server defaults to `http://127.0.0.1:3876` and the Vite dev server is fixed at `http://localhost:5175`.

When reading `apps/theoria/package.json`, treat `5175` as the only sanctioned frontend dev port. Do not infer Vite defaults or choose alternate ports unless the user explicitly asks you to change the checked-in configuration.

---

## Skills Reference

| Skill                            | When to Load                                           |
| -------------------------------- | ------------------------------------------------------ |
| `skill:tailwind-v4`              | Writing className, theming, dark mode, CSS config      |
| `skill:base-ui`                  | Composing headless UI components from `@base-ui/react` |
| `skill:effect-atom`              | State management, atoms, async data, mutations         |
| `skill:react-19`                 | React 19 patterns — refs, composition, performance     |
| `skill:effect-react-integration` | Wiring Effect services into React via atoms, streaming |
