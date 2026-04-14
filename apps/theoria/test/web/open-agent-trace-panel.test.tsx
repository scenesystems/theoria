import { RegistryProvider } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { createRoot } from "react-dom/client"

import { WorkflowStudyRoute } from "../../app/contracts/presentation/path.js"
import { ConsumerArtifact } from "../../app/contracts/study/workflow/consumer-artifact.js"
import {
  AmpThreadImportPayload,
  OpenAgentTraceThreadImportRoute,
  OpenAgentTraceRegistryEntry
} from "../../app/contracts/study/workflow/open-agent-trace.js"
import { WorkflowHookup } from "../../app/contracts/study/workflow/workflow-hookup.js"
import { OpenAgentTracePanel } from "../../app/web/view/study/open-agent-trace/OpenAgentTracePanel.js"
import { loadOpenAgentTraceRegistry } from "../../app/server/study/workflow/open-agent-trace/registry.js"
import { ampThreadImportRequestFixture } from "../helpers/open-agent-trace-amp-thread-fixture.js"

const responseMeta = {
  requestId: "req-open-agent-trace-panel",
  buildSha: "build-open-agent-trace-panel",
  durationMs: 1
}

const renderPanel = () =>
  Effect.sync(() => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    root.render(
      <RegistryProvider defaultIdleTTL={400}>
        <OpenAgentTracePanel />
      </RegistryProvider>
    )

    return { container, root }
  })

const waitFor = <A,>(effect: Effect.Effect<A, string, never>) => Effect.eventually(effect).pipe(Effect.orDie)

const waitForInput = (container: HTMLDivElement) =>
  waitFor(
    Effect.sync(() => container.querySelector('input[type="search"]')).pipe(
      Effect.flatMap((element) =>
        element instanceof HTMLInputElement ? Effect.succeed(element) : Effect.fail("waiting-for-import-input")
      )
    )
  )

const waitForButton = (container: HTMLDivElement, label: string) =>
  waitFor(
    Effect.sync(() =>
      Array.from(container.querySelectorAll("button")).find(
        (button): button is HTMLButtonElement => button.textContent?.includes(label) === true && button.disabled === false
      )
    ).pipe(
      Effect.flatMap((button) => button === undefined ? Effect.fail(`waiting-for-${label}`) : Effect.succeed(button))
    )
  )

const waitForInspectButton = (container: HTMLDivElement) =>
  waitFor(
    Effect.sync(() =>
      Array.from(container.querySelectorAll("button")).find(
        (button): button is HTMLButtonElement => button.getAttribute("aria-label")?.startsWith("Inspect ") === true
      )
    ).pipe(
      Effect.flatMap((button) => button === undefined ? Effect.fail("waiting-for-inspect-button") : Effect.succeed(button))
    )
  )

const waitForLink = (container: HTMLDivElement, label: string) =>
  waitFor(
    Effect.sync(() =>
      Array.from(container.querySelectorAll("a")).find(
        (link): link is HTMLAnchorElement => link.textContent?.includes(label) === true
      )
    ).pipe(
      Effect.flatMap((link) => link === undefined ? Effect.fail(`waiting-for-link-${label}`) : Effect.succeed(link))
    )
  )

const waitForLinks = (container: HTMLDivElement, label: string) =>
  waitFor(
    Effect.sync(() =>
      Array.from(container.querySelectorAll("a")).filter(
        (link): link is HTMLAnchorElement => link.textContent?.includes(label) === true
      )
    ).pipe(
      Effect.flatMap((links) => links.length === 0 ? Effect.fail(`waiting-for-links-${label}`) : Effect.succeed(links))
    )
  )

const waitForText = (container: HTMLDivElement, text: string) =>
  waitFor(
    Effect.sync(() => container.textContent?.includes(text) === true).pipe(
      Effect.flatMap((present) => present ? Effect.succeed(text) : Effect.fail(`waiting-for-${text}`))
    )
  )

const setInputValue = (input: HTMLInputElement, value: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")

  descriptor?.set?.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

const importedPayloadFromRegistry = (entry: OpenAgentTraceRegistryEntry) =>
  AmpThreadImportPayload.single(
    OpenAgentTraceRegistryEntry.make({
      ...entry,
      consumerArtifact: ConsumerArtifact.make({
        ...entry.consumerArtifact,
        sourceKind: "amp-thread",
        sourceLabel: `Amp thread ${ampThreadImportRequestFixture.threadId}`,
        sourceUrl: ampThreadImportRequestFixture.sourceUrl,
        title: `Imported ${entry.title}`
      }),
      title: `Imported ${entry.title}`,
      workflowHookup: WorkflowHookup.make({
        ...entry.workflowHookup,
        transport: "import"
      })
    })
  )

const withMockOpenAgentTraceFetch = <A,>(effect: Effect.Effect<A, never, never>) => {
  const previousFetch = globalThis.fetch

  return Effect.gen(function*() {
    const registry = yield* loadOpenAgentTraceRegistry.pipe(Effect.orDie)
    const importedPayload = importedPayloadFromRegistry(registry[0]!)
    const importCalls: Array<string> = []

    yield* Effect.sync(() => {
      Reflect.set(globalThis, "fetch", (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url

        if (url.includes("/api/open-agent-trace/consumer-artifacts")) {
          return Promise.resolve({
            json: () => Promise.resolve({ ok: true, meta: responseMeta, data: registry.map((entry) => entry.consumerArtifact) })
          })
        }

        if (url.includes("/api/open-agent-trace/workflow-hookups")) {
          return Promise.resolve({
            json: () => Promise.resolve({ ok: true, meta: responseMeta, data: registry.map((entry) => entry.workflowHookup) })
          })
        }

        if (url.includes("/api/open-agent-trace/registry")) {
          return Promise.resolve({
            json: () => Promise.resolve({ ok: true, meta: responseMeta, data: registry })
          })
        }

        if (url.includes(OpenAgentTraceThreadImportRoute.pathname()) && init?.method === "POST") {
          const body = typeof init.body === "string" ? JSON.parse(init.body) : { threadId: "missing" }

          importCalls.push(body.threadId)

          return Promise.resolve({
            json: () => Promise.resolve({ ok: true, meta: responseMeta, data: importedPayload })
          })
        }

        return Promise.resolve({
          json: () => Promise.resolve({
            ok: false,
            meta: responseMeta,
            error: {
              code: "route-not-found",
              message: `Unexpected fetch: ${url}`,
              retryable: false
            }
          })
        })
      })
    })

    return yield* effect.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(importCalls).toEqual([ampThreadImportRequestFixture.threadId])
        })
      )
    )
  }).pipe(
    Effect.ensuring(
      Effect.sync(() => {
        Reflect.set(globalThis, "fetch", previousFetch)
      })
    )
  )
}

describe("web/open-agent-trace-panel", () => {
  it.effect("imports an Amp thread link or id and renders workflow handoff links for the imported routeable workflow", () =>
    withMockOpenAgentTraceFetch(
      Effect.gen(function*() {
        const { container, root } = yield* renderPanel()
        const registry = yield* loadOpenAgentTraceRegistry.pipe(Effect.orDie)
        const importedPayload = importedPayloadFromRegistry(registry[0]!)
        const importedWorkflowPath = WorkflowStudyRoute.fromSessionId(
          importedPayload.registryEntry.workflowProjection.workflowRecord.session.sessionId
        ).path()

        yield* Effect.ensuring(
          Effect.gen(function*() {
            const input = yield* waitForInput(container)

            yield* Effect.sync(() => {
              setInputValue(input, ampThreadImportRequestFixture.sourceUrl)
            })

            const importButton = yield* waitForButton(container, "Import thread")

            yield* Effect.sync(() => {
              importButton.click()
            })

            yield* waitForText(container, "Imported")
            yield* waitForText(container, "Imported Pi-mono Task-First Runtime Trace")
            yield* waitForText(container, "Select a message or tool action to inspect its payload, timing, and workflow relevance.")

            const openImportedWorkflowLink = yield* waitForLink(container, "Open imported workflow")
            const openWorkflowLinks = yield* waitForLinks(container, "Open in workflow")
            const inspectButton = yield* waitForInspectButton(container)

            yield* Effect.sync(() => {
              expect(openImportedWorkflowLink.getAttribute("href")).toBe(importedWorkflowPath)
              expect(openWorkflowLinks.map((link) => link.getAttribute("href"))).toContain(importedWorkflowPath)
              inspectButton.click()
            })

            yield* waitFor(
              Effect.sync(() => inspectButton.getAttribute("aria-pressed") === "true").pipe(
                Effect.flatMap((selected) => selected ? Effect.succeed(inspectButton) : Effect.fail("waiting-for-selection"))
              )
            )
          }),
          Effect.sync(() => {
            root.unmount()
            container.remove()
          })
        )
      })
    ))
})
