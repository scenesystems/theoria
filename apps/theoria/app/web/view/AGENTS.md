---
description: Study workspace screen contract for app/web view composition
globs: "study/**/*.ts, study/**/*.tsx, surfaces/**/*.ts, surfaces/**/*.tsx"
alwaysApply: true
---

# view/ — Study Workspace Screen Contract

> Parent: [../../AGENTS.md](file:///Users/metis/Projects/hawalilabs/scenesystems/theoria/apps/theoria/app/AGENTS.md)
> Skills: `tailwind-v4`, `react-19`, `base-ui`, `effect-react-integration`

## Purpose

`view/` study surfaces own the target-state screen composition for Theoria. Build interaction and workflow as first-class study workspaces, not as dashboard panes, nested panel stacks, or demo-style composites.

## Source Of Truth

- `contracts/` is the single source of truth for shared screen meaning, defaults, parsers, transport payloads, and durable nouns.
- If a view needs a new type, default, or parser that is also used by atoms, runtime, or server, move it to `contracts/` first.
- Do not redefine workflow, interaction, evidence, or handoff shapes locally in `view/`.

## UI Owners

- New study workspace surfaces must compose from `web/ui/structure/*`, `web/ui/components/*`, and `web/ui/recipes/*`.
- Treat `web/ui/components/workspace/*` as the canonical owner for study workspace grammar.
- Treat `view/primitives/*` as legacy migration terrain; do not introduce new study-screen building blocks there.
- Keep screen composition in `view/`; move reusable visual seams down into `ui/` instead of inventing app-local wrappers in a screen file.

## State And Orchestration

- Study screens are pure projections over contract-owned data and atom-owned state.
- Read and write workflow or interaction state through `web/atoms/*` and `effect-atom`; do not introduce screen-local domain state.
- Do not author new domain defaults, handoff storage formats, or runtime lookup logic in `view/`.
- `view/` does not fetch, decode transport, or talk to server routes directly.

## Workspace Ownership

- `Interaction` owns the page when the user is reading traces, annotating evidence, pinning objectives, and preparing workflow handoff.
- `Workflow` owns the page when the user is shaping a run, executing it, and reading results.
- Handoff is a route-level transition with compact carried context, not an embedded copy of the prior workspace.
- Never compose one workspace inside another workspace.

## Screen Contracts

- Interaction screen = compact strip + dominant transcript canvas + contextual inspector + bottom composer.
- Workflow screen = compact strip + action bar + dominant setup/results canvas + contextual inspector.
- Source, evidence, diagnostics, and materials are contextual drill-down surfaces; they are not permanent peer slabs.
- Mobile preserves one dominant canvas; inspector content becomes a sheet or slide-over.

## Preferred Owners

- Screen composition should start from `WorkspacePane`, `WorkspaceStrip`, `WorkspaceSplitLayout`, `WorkspaceActionBar`, and `WorkspaceStatusRow`.
- Interaction screens should converge on `InteractionWorkspaceShell`, `InteractionTranscriptCanvas`, `InteractionInspector`, and `TraceAwareAgentComposer`.
- Workflow screens should converge on `WorkflowJourneyWorkspace`, `WorkflowActionBar`, `WorkflowInspector`, `SourceWorkspace`, `EvidencePanel`, `DiagnosticsInspector`, and `ResultInspector`.
- Keep screen files focused on route-level composition; extract reusable panes, inspectors, and canvas seams before a screen file becomes a grab bag.

## Visual Stance

- Build an editorial instrument panel: crisp borders, quiet fills, low shadow, dense rhythm.
- Headers are operational and compact; do not add hero blocks or promotional copy.
- Selection increases precision, not size.
- One pane owns scrolling; avoid nested scroll traps and competing scroll regions.

## Banned

- `Setup | Trace | Evidence` as the primary workflow frame.
- Permanent co-equal source panes in workflow.
- Nested cards, card stacks, or workspace-inside-workspace composition.
- Embedding the full interaction workspace inside the workflow screen.
- Tabs that hide workflow-critical information behind secondary navigation.
- Dashboard or marketing-page layout language for study screens.
- New study-screen composition built on `view/primitives/*` instead of `ui/*` owners.
- Local screen-owned copies of contract types, defaults, or narrowing helpers.
- Screen-owned state machines or ad hoc `useState`/`useEffect` orchestration for workflow or interaction behavior.

## Verification

Run from `apps/theoria/`:

- `bun run check:all`
- `bun run lint`
- `bun run test` when changing screen behavior, handoff behavior, or view-owned state wiring
