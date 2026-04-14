import type { Atom as AtomType } from "@effect-atom/atom"
import { RegistryProvider } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { createRoot } from "react-dom/client"

import {
  TraceSelection,
  TraceSelectionAnchor,
  WorkflowHandoffDraft
} from "../../app/contracts/presentation/interactions.js"
import { WorkflowStudyInput } from "../../app/contracts/study/workflow/input.js"
import { WorkflowWorkspace } from "../../app/web/features/workflow/WorkflowWorkspace.js"
import { surfaceAtom } from "../../app/web/atoms/surface/state.js"
import { initialSurfaceState } from "../../app/web/state/surface/state.js"

const renderWorkflowWorkspace = (
  initialValues: ReadonlyArray<readonly [AtomType.Atom<unknown>, unknown]> = []
): Effect.Effect<{ readonly container: HTMLDivElement; readonly root: ReturnType<typeof createRoot> }, never, never> =>
  Effect.sync(() => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    root.render(
      <RegistryProvider defaultIdleTTL={400} initialValues={initialValues}>
        <WorkflowWorkspace />
      </RegistryProvider>
    )

    return { container, root }
  })

const waitForText = (container: HTMLDivElement, text: string): Effect.Effect<string, never, never> =>
  Effect.eventually(
    Effect.sync(() => container.textContent?.includes(text) === true).pipe(
      Effect.flatMap((present) => present ? Effect.succeed(text) : Effect.fail(`waiting-for-${text}`))
    )
  ).pipe(Effect.orDie)

const buttonWithLabel = (container: HTMLDivElement, label: string): HTMLButtonElement | null =>
  Array.from(container.querySelectorAll("button")).find(
    (button): button is HTMLButtonElement => button.textContent?.includes(label) === true
  ) ?? null

const workflowHandoffDraftFixture = WorkflowHandoffDraft.make({
  annotationIds: ["annotation:trace:item:note"],
  objectiveIds: ["objective:trace:item"],
  selection: TraceSelection.make({
    anchor: TraceSelectionAnchor.make({
      itemId: "trace:item",
      transcriptEntryId: "trace:entry",
      turnId: "turn:1"
    }),
    contextLabel: "Imported thread",
    itemKind: "message",
    quote: "Program preview ready. Run to generate live evidence.",
    summary: "Program preview is ready and grounded in the imported trace."
  }),
  status: "ready",
  summary: "Carry the selected failure into workflow design.",
  transcriptEntryId: "trace:entry",
  title: "Trace-grounded workflow handoff"
})

describe("workflow workspace", () => {
  it.effect("renders the workflow study as strip plus action bar plus dominant canvas plus contextual inspector", () =>
    Effect.gen(function*() {
      const { container, root } = yield* renderWorkflowWorkspace()

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitForText(container, "Workflow journey workspace")
          yield* waitForText(container, "Shape workflow run")
          yield* waitForText(container, "Source workspace")

          const setupButton = buttonWithLabel(container, "Setup")
          const resultsButton = buttonWithLabel(container, "Results")
          const sourceButton = buttonWithLabel(container, "Source")

          expect(buttonWithLabel(container, "Run Study")).not.toBeNull()
          expect(setupButton?.getAttribute("aria-pressed")).toBe("true")
          expect(resultsButton?.disabled).toBe(true)
          expect(sourceButton?.getAttribute("aria-pressed")).toBe("true")
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))

  it.effect("shows carried handoff context without embedding the interaction workspace", () =>
    Effect.gen(function*() {
      const workflowSurfaceState = initialSurfaceState("workflow")
      const { container, root } = yield* renderWorkflowWorkspace([
        [
          surfaceAtom("workflow"),
          {
            ...workflowSurfaceState,
            draft: {
              ...workflowSurfaceState.draft,
              input: WorkflowStudyInput.withHandoff(workflowHandoffDraftFixture)
            }
          }
        ]
      ])

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitForText(container, "Trace-grounded workflow handoff")
          yield* waitForText(container, "Carry the selected failure into workflow design.")
          yield* waitForText(container, "Program preview is ready and grounded in the imported trace.")

          expect(container.textContent?.includes("Trace-native interaction study")).toBe(false)
          expect(container.textContent?.includes("Read imported traces as the primary study surface")).toBe(false)
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))
})
