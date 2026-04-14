import { Tooltip } from "@base-ui-components/react/tooltip"
import { RegistryProvider } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import type { EntryId } from "../../app/contracts/entry/id.js"
import { EntryPresentation } from "../../app/contracts/entry/routing.js"
import { canonicalStepEvent, encodeEvidenceEventJson, StreamComplete } from "../../app/contracts/evidence/stream.js"
import { PageMetadata } from "../../app/contracts/presentation/metadata.js"
import { taskBriefingWorkflowSessionId } from "../../app/contracts/study/workflow/fixture-manifest.js"
import { WorkflowCanonicalStep } from "../../app/contracts/study/workflow/step.js"
import { EntryPage } from "../../app/web/view/entry/EntryPage.js"
import { programPreviewFixture } from "../helpers/entry-fixtures.js"

type EventListener = (event: Event | MessageEvent<string>) => void

class MockEventSource {
  static instances: ReadonlyArray<MockEventSource> = []

  readonly listeners: Record<string, ReadonlyArray<EventListener>> = {}
  readonly url: string
  closed = false

  constructor(url: string) {
    this.url = url
    MockEventSource.instances = [...MockEventSource.instances, this]
  }

  addEventListener(type: string, listener: EventListener): void {
    this.listeners[type] = [...(this.listeners[type] ?? []), listener]
  }

  close(): void {
    this.closed = true
  }

  emitEvidence(data: string): void {
    ;(this.listeners.evidence ?? []).forEach((listener) => listener(new MessageEvent("evidence", { data })))
  }
}

const preloadMeta = {
  requestId: "req-preload",
  buildSha: "build-preload",
  durationMs: 1
}

const streamMeta = {
  requestId: "req-stream",
  buildSha: "build-stream",
  durationMs: 1
}

const renderEntryPage = (id: EntryId): Effect.Effect<{ readonly container: HTMLDivElement; readonly root: ReturnType<typeof createRoot> }, never, never> =>
  Effect.sync(() => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    root.render(
      <StrictMode>
        <RegistryProvider defaultIdleTTL={400}>
          <Tooltip.Provider>
            <EntryPage entry={EntryPresentation.fromEntryId(id)} metadata={PageMetadata.fromEntryId(id)} />
          </Tooltip.Provider>
        </RegistryProvider>
      </StrictMode>
    )

    return { container, root }
  })

const buttonWithLabel = (label: string): HTMLButtonElement | null =>
  Arr.findFirst(
    Array.from(document.querySelectorAll("button")),
    (button): button is HTMLButtonElement => button.textContent?.includes(label) === true
  ).pipe(
    (option) => option._tag === "Some" ? option.value : null
  )

const openSources = (): ReadonlyArray<MockEventSource> =>
  Arr.filter(MockEventSource.instances, (source): source is MockEventSource => source.closed === false)

const waitForButton = (label: string): Effect.Effect<HTMLButtonElement, never, never> =>
  Effect.eventually(
    Effect.sync(() => buttonWithLabel(label)).pipe(
      Effect.flatMap((button) => button === null ? Effect.fail(`waiting-for-${label}`) : Effect.succeed(button))
    )
  ).pipe(Effect.orDie)

const waitForButtonWithin = (
  label: string,
  phase: string
): Effect.Effect<HTMLButtonElement, never, never> =>
  Effect.raceFirst(
    waitForButton(label),
    Effect.sleep("10 seconds").pipe(Effect.zipRight(Effect.die(`timed-out-${phase}`)))
  )

const withMockNetwork = <A,>(effect: Effect.Effect<A, never, never>): Effect.Effect<A, never, never> => {
  const previousEventSource = globalThis.EventSource
  const previousFetch = globalThis.fetch

  return Effect.gen(function*() {
    yield* Effect.sync(() => {
      MockEventSource.instances = []
      Reflect.set(globalThis, "EventSource", MockEventSource)
      Reflect.set(globalThis, "fetch", (_input: string | URL | Request) =>
        Promise.resolve({
          json: () => Promise.resolve({
            ok: true,
            meta: preloadMeta,
            data: {
              ...programPreviewFixture,
              id: "workflow"
            }
          })
        })
      )
    })

    return yield* effect
  }).pipe(
    Effect.ensuring(
      Effect.sync(() => {
        MockEventSource.instances = []
        Reflect.set(globalThis, "EventSource", previousEventSource)
        Reflect.set(globalThis, "fetch", previousFetch)
      })
    )
  )
}

describe("live run controls", () => {
  it.effect(
    "StrictMode pause-resume returns the rendered UI to Run after completion",
    () =>
      withMockNetwork(
        Effect.gen(function*() {
          const { container, root } = yield* renderEntryPage("workflow")

          yield* Effect.ensuring(
            Effect.gen(function*() {
              const runButton = yield* waitForButtonWithin("Run", "initial-run-button")
              yield* Effect.sync(() => {
                runButton.click()
              })

              const pauseButton = yield* waitForButtonWithin("Pause", "pause-button")
              yield* Effect.sync(() => {
                pauseButton.click()
              })

              const resumeButton = yield* waitForButtonWithin("Resume", "resume-button")
              expect(resumeButton.textContent?.includes("Resume")).toBe(true)

              yield* Effect.sync(() => {
                resumeButton.click()
              })

              const resumedPauseButton = yield* waitForButtonWithin("Pause", "resumed-pause-button")
              expect(resumedPauseButton.textContent?.includes("Pause")).toBe(true)

              yield* Effect.sync(() => {
                const stepEvent = encodeEvidenceEventJson(
                  canonicalStepEvent(
                    WorkflowCanonicalStep.make({
                      seedId: taskBriefingWorkflowSessionId,
                      workflowKind: "task-first",
                      variant: "baseline",
                      nodeId: "planner-task",
                      nodeKind: "planner",
                      runtimeRole: "task",
                      stepIndex: 1,
                      stepCount: 3,
                      lineage: ["planner-task"],
                      activeStateLanes: ["conversation"],
                      outputText: "Workflow smoke test progressed to the first authored step.",
                      aggregateScore: 0.67
                    })
                  )
                )
                const completionEvent = encodeEvidenceEventJson(
                  StreamComplete.make({ summary: "UI smoke complete.", meta: streamMeta })
                )

                openSources().forEach((source) => {
                  source.emitEvidence(stepEvent)
                  source.emitEvidence(completionEvent)
                })
              })

              const finalRunButton = yield* waitForButtonWithin("Run", "final-run-button")
              expect(finalRunButton.textContent?.includes("Run")).toBe(true)
            }),
            Effect.sync(() => {
              root.unmount()
              container.remove()
            })
          )
        })
      ),
    60_000
  )

})
