import { Registry, Result } from "@effect-atom/atom"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import {
  canonicalAmpThreadSourceUrl,
  OpenAgentTraceCatalog
} from "../../app/contracts/study/workflow/open-agent-trace.js"
import { AmpThreadImportKernel } from "../../app/server/kernel/amp-thread-import/service.js"
import { importAmpThread } from "../../app/server/study/workflow/open-agent-trace/import/amp-thread.js"
import { loadOpenAgentTraceRegistry } from "../../app/server/study/workflow/open-agent-trace/registry.js"
import {
  ampThreadImportDraftAtom,
  importAmpThreadAtom,
  importedCatalogAtom,
  openAgentTracePanelAtom,
  setAmpThreadImportDraftAtom
} from "../../app/web/atoms/workflow/open-agent-trace.js"
import {
  ampThreadExportSnapshotFixture,
  ampThreadImportRequestFixture,
  secondAmpThreadExportSnapshotFixture,
  secondAmpThreadImportRequestFixture
} from "../helpers/open-agent-trace-amp-thread-fixture.js"

const responseMeta = {
  requestId: "req-open-agent-trace-atom-import",
  buildSha: "build-open-agent-trace-atom-import",
  durationMs: 1
}

const ampThreadImportKernelTest: AmpThreadImportKernel = {
  _tag: "theoria/server/kernel/AmpThreadImportKernel",
  exportSnapshot: () => Effect.succeed(ampThreadExportSnapshotFixture)
}

const makeAsyncTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      queueMicrotask(f)
    }
  })

const waitFor = <A>(effect: Effect.Effect<A, string, never>) => Effect.eventually(effect).pipe(Effect.orDie)

const waitForImportSuccess = (registry: Registry.Registry) =>
  waitFor(
    Effect.sync(() => registry.get(importAmpThreadAtom)).pipe(
      Effect.flatMap((result) =>
        Result.match(result, {
          onInitial: () => Effect.fail("waiting-for-import"),
          onFailure: (failure) => Effect.die(failure.cause),
          onSuccess: (success) => success.waiting ? Effect.fail("waiting-for-import") : Effect.succeed(success.value)
        })
      )
    )
  )

const waitForPanelSuccess = (registry: Registry.Registry) =>
  waitFor(
    Effect.sync(() => registry.get(openAgentTracePanelAtom)).pipe(
      Effect.flatMap((result) =>
        Result.match(result, {
          onInitial: () => Effect.fail("waiting-for-panel"),
          onFailure: (failure) => Effect.die(failure.cause),
          onSuccess: (success) => success.waiting ? Effect.fail("waiting-for-panel") : Effect.succeed(success.value)
        })
      )
    )
  )

/* eslint-disable no-restricted-syntax */
const mockJsonResponse = <A>(body: A) => ({
  json: () => Effect.runPromise(Effect.succeed(body))
})

const withMockOpenAgentTraceFetch = <A>(effect: Effect.Effect<A, never, never>) => {
  const previousFetch = globalThis.fetch

  return Effect.gen(function*() {
    const importedPayload = yield* importAmpThread(ampThreadImportRequestFixture).pipe(
      Effect.provideService(AmpThreadImportKernel, ampThreadImportKernelTest),
      Effect.provide(BunContext.layer)
    )
    const fixtureRegistry = yield* loadOpenAgentTraceRegistry.pipe(Effect.orDie)
    const secondImportedPayload = yield* importAmpThread(secondAmpThreadImportRequestFixture).pipe(
      Effect.provideService(AmpThreadImportKernel, {
        _tag: "theoria/server/kernel/AmpThreadImportKernel",
        exportSnapshot: () => Effect.succeed(secondAmpThreadExportSnapshotFixture)
      }),
      Effect.provide(BunContext.layer)
    )
    const fixtureOnlyCatalog = OpenAgentTraceCatalog.fromParts({
      consumerArtifacts: fixtureRegistry.map((entry) => entry.consumerArtifact),
      registry: fixtureRegistry,
      workflowHookups: fixtureRegistry.map((entry) => entry.workflowHookup)
    })
    const importCalls: Array<string> = []

    yield* Effect.sync(() => {
      Reflect.set(globalThis, "fetch", (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url

        if (url.includes("/api/open-agent-trace/consumer-artifacts")) {
          return Effect.runPromise(
            Effect.succeed(
              mockJsonResponse({ ok: true, meta: responseMeta, data: fixtureOnlyCatalog.consumerArtifacts })
            )
          )
        }

        if (url.includes("/api/open-agent-trace/workflow-hookups")) {
          return Effect.runPromise(
            Effect.succeed(
              mockJsonResponse({ ok: true, meta: responseMeta, data: fixtureOnlyCatalog.workflowHookups })
            )
          )
        }

        if (url.includes("/api/open-agent-trace/registry")) {
          return Effect.runPromise(
            Effect.succeed(
              mockJsonResponse({ ok: true, meta: responseMeta, data: fixtureOnlyCatalog.registry })
            )
          )
        }

        if (url.includes("/api/open-agent-trace/imports/amp-thread") && init?.method === "POST") {
          const nextPayload = importCalls.length === 0
            ? importedPayload
            : secondImportedPayload
          importCalls.push(
            importCalls.length === 0
              ? ampThreadImportRequestFixture.threadId
              : secondAmpThreadImportRequestFixture.threadId
          )

          return Effect.runPromise(
            Effect.succeed(mockJsonResponse({ ok: true, meta: responseMeta, data: nextPayload }))
          )
        }

        return Effect.runPromise(
          Effect.succeed(
            mockJsonResponse({
              ok: false,
              meta: responseMeta,
              error: {
                code: "route-not-found",
                message: `Unexpected fetch: ${url}`,
                retryable: false
              }
            })
          )
        )
      })
    })

    return yield* effect.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(importCalls).toEqual([
            ampThreadImportRequestFixture.threadId,
            secondAmpThreadImportRequestFixture.threadId
          ])
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
/* eslint-enable no-restricted-syntax */

describe("atoms/open-agent-trace-import", () => {
  it.effect("keeps imported Amp threads browser-session scoped and additive to the read-only registry payload", () =>
    withMockOpenAgentTraceFetch(
      Effect.gen(function*() {
        const importingRegistry = makeAsyncTestRegistry()
        const freshRegistry = makeAsyncTestRegistry()

        importingRegistry.mount(importAmpThreadAtom)
        importingRegistry.mount(openAgentTracePanelAtom)
        freshRegistry.mount(openAgentTracePanelAtom)

        importingRegistry.set(setAmpThreadImportDraftAtom, ampThreadImportRequestFixture.sourceUrl)
        importingRegistry.set(importAmpThreadAtom, undefined)

        const importedPayload = yield* waitForImportSuccess(importingRegistry)

        importingRegistry.set(
          setAmpThreadImportDraftAtom,
          canonicalAmpThreadSourceUrl(secondAmpThreadImportRequestFixture.threadId)
        )
        importingRegistry.set(importAmpThreadAtom, undefined)

        const secondImportedPayload = yield* waitForImportSuccess(importingRegistry)
        const importingPanel = yield* waitForPanelSuccess(importingRegistry)
        const freshPanel = yield* waitForPanelSuccess(freshRegistry)
        const importedCatalog = importingRegistry.get(importedCatalogAtom)
        const freshImportedCatalog = freshRegistry.get(importedCatalogAtom)
        const importingMaterialCounts = importingPanel.studyMaterials.map((studyMaterial) => studyMaterial.items.length)
        const freshMaterialCounts = freshPanel.studyMaterials.map((studyMaterial) => studyMaterial.items.length)

        expect(importingRegistry.get(ampThreadImportDraftAtom)).toBe("")
        expect(importedCatalog.registry).toHaveLength(2)
        expect(importedCatalog.registry[0]?.entryId).toBe(importedPayload.registryEntry.entryId)
        expect(importedCatalog.registry[1]?.entryId).toBe(secondImportedPayload.registryEntry.entryId)
        expect(importingPanel.registry).toHaveLength(freshPanel.registry.length + 2)
        expect(importingMaterialCounts).toEqual(freshMaterialCounts.map((count) => count + 2))
        expect(importingPanel.registry.some((entry) => entry.entryId === importedPayload.registryEntry.entryId)).toBe(
          true
        )
        expect(
          importingPanel.registry.some((entry) => entry.entryId === secondImportedPayload.registryEntry.entryId)
        ).toBe(true)
        expect(freshImportedCatalog).toEqual(OpenAgentTraceCatalog.empty())
        expect(freshPanel.registry.some((entry) => entry.entryId === importedPayload.registryEntry.entryId)).toBe(false)
      })
    ))
})
