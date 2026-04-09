import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { SectionAppend, SectionUpsert } from "../../app/contracts/evidence/stream.js"
import {
  surfaceEvidenceSectionCountAtom,
  surfaceEvidenceSectionsAtom,
  surfaceEvidenceStoreAtom,
  surfaceEvidenceStreamAtom
} from "../../app/web/atoms/surface/evidence-store.js"
import { surfaceRunRuntimeTelemetryViewModelAtom } from "../../app/web/atoms/surface/run-telemetry.js"
import { surfaceAtom, surfaceRunDataAtom } from "../../app/web/atoms/surface/state.js"
import { programPreviewFixture, runDataFixture } from "../helpers/entry-fixtures.js"
import { runningRunState } from "../helpers/run-state.js"
import { succeededRunState } from "../helpers/run-state.js"

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
  })

describe("Surface Atoms", () => {
  it.effect("surfaceAtom returns initial state for each id", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()

      const textState = registry.get(surfaceAtom("effect-text"))
      expect(textState.id).toBe("effect-text")
      expect(textState.preload._tag).toBe("PreloadIdle")
      expect(textState.run._tag).toBe("RunIdle")
      expect(textState.stageTab).toBe("interactive")

      const searchState = registry.get(surfaceAtom("effect-search"))
      expect(searchState.id).toBe("effect-search")
    }))

  it.effect("surfaceAtom(id) returns same atom reference for same id", () =>
    Effect.gen(function*() {
      const a = surfaceAtom("effect-text")
      const b = surfaceAtom("effect-text")
      expect(a).toBe(b)
    }))

  it.effect("surfaceRunDataAtom derives null when no run data", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const runData = registry.get(surfaceRunDataAtom("effect-text"))
      expect(runData).toBeNull()
    }))

  it.effect("surfaceEvidenceStreamAtom derives an empty stream before any run", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const stream = registry.get(surfaceEvidenceStreamAtom("effect-text"))
      expect(stream.sections).toEqual([])
      expect(stream.complete).toBe(false)
      expect(stream.summary).toBeNull()
      expect(stream.meta).toBeNull()
    }))

  it.effect("surfaceRunDataAtom derives run data after successful run", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const fixture = runDataFixture("test run")

      registry.update(surfaceAtom("effect-text"), (s) => ({
        ...s,
        run: succeededRunState({ data: fixture })
      }))

      const runData = registry.get(surfaceRunDataAtom("effect-text"))
      expect(runData).not.toBeNull()
      expect(runData?.summary).toBe("test run")
    }))

  it.effect("surfaceRunDataAtom returns same atom reference via Atom.family", () =>
    Effect.gen(function*() {
      const a = surfaceRunDataAtom("effect-text")
      const b = surfaceRunDataAtom("effect-text")
      expect(a).toBe(b)
    }))

  it.effect("normalized evidence selectors keep section-count invalidation scoped to order changes", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const countUpdates = { current: 0 }
      const sectionUpdates = { current: 0 }
      const unsubscribeCount = registry.subscribe(
        surfaceEvidenceSectionCountAtom("effect-text"),
        () => {
          countUpdates.current = countUpdates.current + 1
        },
        { immediate: true }
      )
      const unsubscribeSections = registry.subscribe(
        surfaceEvidenceSectionsAtom("effect-text"),
        () => {
          sectionUpdates.current = sectionUpdates.current + 1
        },
        { immediate: true }
      )

      registry.update(surfaceEvidenceStoreAtom("effect-text"), (store) =>
        store.apply(
          new SectionAppend({
            section: {
              title: "Performance",
              items: [{ _tag: "Text", label: "Status", value: "streaming" }]
            }
          })
        ))
      registry.update(surfaceEvidenceStoreAtom("effect-text"), (store) =>
        store.apply(
          new SectionUpsert({
            section: {
              title: "Performance",
              items: [
                { _tag: "Text", label: "Status", value: "streaming" },
                { _tag: "Text", label: "Mode", value: "coalesced" }
              ]
            }
          })
        ))

      expect(countUpdates.current).toBe(2)
      expect(sectionUpdates.current).toBeGreaterThan(countUpdates.current)
      unsubscribeCount()
      unsubscribeSections()
    }))

  it.effect("surfaceRunRuntimeTelemetryViewModelAtom exposes lifecycle summary rows and ordered events", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const running = runningRunState({
        program: programPreviewFixture.program,
        startedAtMs: 100,
        sequence: 7,
        token: 3
      })

      registry.update(surfaceAtom("effect-text"), (state) => ({
        ...state,
        run: running
      }))

      const viewModel = registry.get(surfaceRunRuntimeTelemetryViewModelAtom("effect-text"))
      const rows = viewModel?.sections.flatMap((section) => section.rows) ?? []

      expect(viewModel).not.toBeNull()
      expect(rows.some((row) => row.label === "Run state" && row.value.includes("RunRunning"))).toBe(true)
      expect(rows.some((row) => row.label === "Ownership")).toBe(true)
      expect(rows.some((row) => row.label === "Run started")).toBe(true)
    }))
})
