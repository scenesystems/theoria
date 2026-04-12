import { RegistryProvider } from "@effect-atom/atom-react"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Option } from "effect"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { FailureEnvelope, Metadata } from "../../app/contracts/envelope.js"
import {
  OpenAgentTraceConsumerArtifactCatalogSuccessEnvelope,
  type OpenAgentTraceRegistryEntry,
  OpenAgentTraceRegistrySuccessEnvelope,
  OpenAgentTraceWorkflowHookupCatalogSuccessEnvelope
} from "../../app/contracts/study/workflow/open-agent-trace.js"
import { loadOpenAgentTraceRegistry } from "../../app/server/study/workflow/open-agent-trace/registry.js"
import { LiveDspEvaluation } from "../../app/web/view/deep/LiveDspEvaluation.js"

const responseMeta = Metadata.make({
  requestId: "req-open-agent-trace-consumer",
  buildSha: "build-open-agent-trace-consumer",
  durationMs: 1
})

const firstWorkflowPrompt = (entry: OpenAgentTraceRegistryEntry): string =>
  entry.workflowProjection.workflowRecord.evaluation.cases[0]?.prompt ?? ""

const firstWorkflowSignal = (entry: OpenAgentTraceRegistryEntry): string =>
  entry.workflowProjection.workflowRecord.evaluation.cases[0]?.expectedSignals[0] ?? ""

const firstWorkflowNodeId = (entry: OpenAgentTraceRegistryEntry): string =>
  entry.workflowProjection.workflowRecord.graph.nodes[0]?.nodeId ?? ""

const firstUsageModel = (entry: OpenAgentTraceRegistryEntry): string =>
  entry.workflowProjection.usageProvenance[0]?.model ?? ""

const requiredRegistryEntry = (
  entry: OpenAgentTraceRegistryEntry | undefined,
  label: string
): Effect.Effect<OpenAgentTraceRegistryEntry> =>
  Option.match(Option.fromNullable(entry), {
    onNone: () => Effect.die(`${label} registry entry missing`),
    onSome: Effect.succeed
  })

const jsonResponse = (body: unknown) => Effect.runPromise(Effect.succeed(Response.json(body)))

const withOpenAgentTraceFetchMock = <A, E, R>(
  registry: ReadonlyArray<OpenAgentTraceRegistryEntry>,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => {
  const previousFetch = globalThis.fetch
  const consumerArtifacts = registry.map((entry) => entry.consumerArtifact)
  const workflowHookups = registry.map((entry) => entry.workflowHookup)

  return Effect.gen(function*() {
    yield* Effect.sync(() => {
      Reflect.set(globalThis, "fetch", (input: string | URL | Request) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url

        return Match.value(url).pipe(
          Match.when((value) => value.includes("/api/open-agent-trace/registry"), () =>
            jsonResponse(OpenAgentTraceRegistrySuccessEnvelope.ok(responseMeta, registry))),
          Match.when((value) => value.includes("/api/open-agent-trace/consumer-artifacts"), () =>
            jsonResponse(
              OpenAgentTraceConsumerArtifactCatalogSuccessEnvelope.ok(responseMeta, consumerArtifacts)
            )),
          Match.when((value) => value.includes("/api/open-agent-trace/workflow-hookups"), () =>
            jsonResponse(
              OpenAgentTraceWorkflowHookupCatalogSuccessEnvelope.ok(responseMeta, workflowHookups)
            )),
          Match.orElse(() =>
            jsonResponse(
              FailureEnvelope.fromError(responseMeta, {
                code: "route-not-found",
                message: `Unexpected fetch: ${url}`,
                retryable: false
              })
            ))
        )
      })
    })

    return yield* effect
  }).pipe(
    Effect.ensuring(
      Effect.sync(() => {
        Reflect.set(globalThis, "fetch", previousFetch)
      })
    )
  )
}

describe("web/open-agent-trace-consumer", () => {
  it.live("renders the corpus lane inside the shared effect-dsp study surface instead of a standalone page", () =>
    Effect.gen(function*() {
      const registry = yield* loadOpenAgentTraceRegistry
      const taskFirst = yield* requiredRegistryEntry(registry[0], "task-first")
      const chatContinuation = yield* requiredRegistryEntry(registry[1], "chat-continuation")

      return yield* withOpenAgentTraceFetchMock(
        registry,
        Effect.gen(function*() {
          const container = document.createElement("div")
          document.body.appendChild(container)
          const root = createRoot(container)

          yield* Effect.sync(() => {
            root.render(
              <StrictMode>
                <RegistryProvider defaultIdleTTL={400}>
                  <LiveDspEvaluation />
                </RegistryProvider>
              </StrictMode>
            )
          })

          yield* Effect.ensuring(
            Effect.gen(function*() {
              yield* Effect.sleep("2 seconds")

              const content = container.textContent ?? ""

              expect(content).toContain("Open-agent-trace corpus lane")
              expect(content).toContain(taskFirst.title)
              expect(content).toContain(firstWorkflowPrompt(taskFirst))
              expect(content).toContain(firstWorkflowSignal(taskFirst))
              expect(content).toContain(firstWorkflowNodeId(taskFirst))
              expect(content).toContain(firstUsageModel(taskFirst))
              expect(content).toContain(chatContinuation.title)
            }),
            Effect.sync(() => {
              root.unmount()
              container.remove()
            })
          )
        })
      )
    }).pipe(Effect.provide(BunContext.layer)))
})
