import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { SectionAppend, SectionUpsert } from "../../app/contracts/evidence/stream.js"
import {
  deepDiveEvidenceAtom,
  deepDiveStatusAtom,
  deepDiveSurfaceFrameAtom,
  deepDiveSurfaceStageFrameAtom,
  presentedRunAtom,
  surfaceViewModelAtom,
  viewModelKey
} from "../../app/web/atoms/derived.js"
import { surfaceEvidenceStoreAtom } from "../../app/web/atoms/surface/evidence-store.js"
import { surfaceAtom } from "../../app/web/atoms/surface/state.js"
import { programPreviewFixture, runDataFixture } from "../helpers/entry-fixtures.js"
import { runningRunState, succeededRunState } from "../helpers/run-state.js"

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
  })

describe("Derived Atoms", () => {
  it.effect("surfaceViewModelAtom returns null for unknown id", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const atom = surfaceViewModelAtom(viewModelKey("effect-text", "compact"))
      const vm = registry.get(atom)
      expect(vm).not.toBeNull()
      expect(vm?.statusTone).toBe("panel")
    }))

  it.effect("surfaceViewModelAtom returns same atom for same key", () =>
    Effect.gen(function*() {
      const a = surfaceViewModelAtom(viewModelKey("effect-text", "compact"))
      const b = surfaceViewModelAtom(viewModelKey("effect-text", "compact"))
      expect(a).toBe(b)
    }))

  it.effect("surfaceViewModelAtom returns different atoms for different variants", () =>
    Effect.gen(function*() {
      const compact = surfaceViewModelAtom(viewModelKey("effect-text", "compact"))
      const expanded = surfaceViewModelAtom(viewModelKey("effect-text", "expanded"))
      expect(compact).not.toBe(expanded)
    }))

  it.effect("surfaceViewModelAtom reacts to state changes", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const atom = surfaceViewModelAtom(viewModelKey("effect-text", "expanded"))

      const before = registry.get(atom)
      expect(before?.status).toContain("Run the study")

      const fixture = runDataFixture("evidence collected")
      registry.update(surfaceAtom("effect-text"), (s) => ({
        ...s,
        run: succeededRunState({ data: fixture })
      }))

      const after = registry.get(atom)
      expect(after?.status).toBe("evidence collected")
    }))

  it.effect("presentedRunAtom derives null before run", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const result = registry.get(presentedRunAtom("effect-text"))
      expect(result).toBeNull()
    }))

  it.effect("presentedRunAtom derives sections after successful run", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const fixture = runDataFixture("presented")

      registry.update(surfaceAtom("effect-text"), (s) => ({
        ...s,
        run: succeededRunState({ data: fixture })
      }))

      const result = registry.get(presentedRunAtom("effect-text"))
      expect(result).not.toBeNull()
      expect(result?.summary).toBe("presented")
      expect(result?.sections.length).toBe(2)
    }))

  it.effect("presentedRunAtom returns same atom via Atom.family", () =>
    Effect.gen(function*() {
      const a = presentedRunAtom("effect-text")
      const b = presentedRunAtom("effect-text")
      expect(a).toBe(b)
    }))

  it.effect("deepDiveSurfaceFrameAtom ignores evidence-stream-only updates", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const frameUpdates = { current: 0 }
      const unsubscribe = registry.subscribe(
        deepDiveSurfaceFrameAtom("effect-search"),
        () => {
          frameUpdates.current = frameUpdates.current + 1
        },
        { immediate: true }
      )

      registry.update(surfaceEvidenceStoreAtom("effect-search"), (store) =>
        store.apply(
          new SectionAppend({
            section: {
              title: "Trial Positions",
              items: [{ _tag: "Text", label: "Status", value: "streaming" }]
            }
          })
        ))

      expect(frameUpdates.current).toBe(1)
      unsubscribe()
    }))

  it.effect("deepDiveSurfaceStageFrameAtom stays stable while deepDiveEvidenceAtom reacts to stream-only updates", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const frameUpdates = { current: 0 }
      const evidenceUpdates = { current: 0 }
      const unsubscribeFrame = registry.subscribe(
        deepDiveSurfaceStageFrameAtom("effect-search"),
        () => {
          frameUpdates.current = frameUpdates.current + 1
        },
        { immediate: true }
      )
      const unsubscribeEvidence = registry.subscribe(
        deepDiveEvidenceAtom("effect-search"),
        () => {
          evidenceUpdates.current = evidenceUpdates.current + 1
        },
        { immediate: true }
      )

      registry.update(surfaceEvidenceStoreAtom("effect-search"), (store) =>
        store.apply(
          new SectionAppend({
            section: {
              title: "Trial Positions",
              items: [{ _tag: "Text", label: "Status", value: "streaming" }]
            }
          })
        ))

      expect(frameUpdates.current).toBe(1)
      expect(evidenceUpdates.current).toBeGreaterThan(1)
      unsubscribeFrame()
      unsubscribeEvidence()
    }))

  it.effect("deepDiveStatusAtom stays quiet on section-content upserts while deepDiveEvidenceAtom reacts", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      registry.update(surfaceAtom("effect-search"), (surface) => ({
        ...surface,
        run: runningRunState({ program: programPreviewFixture.program })
      }))

      const statusUpdates = { current: 0 }
      const evidenceUpdates = { current: 0 }
      const unsubscribeStatus = registry.subscribe(
        deepDiveStatusAtom("effect-search"),
        () => {
          statusUpdates.current = statusUpdates.current + 1
        },
        { immediate: true }
      )
      const unsubscribeEvidence = registry.subscribe(
        deepDiveEvidenceAtom("effect-search"),
        () => {
          evidenceUpdates.current = evidenceUpdates.current + 1
        },
        { immediate: true }
      )

      registry.update(surfaceEvidenceStoreAtom("effect-search"), (store) =>
        store.apply(
          new SectionAppend({
            section: {
              title: "Trial Positions",
              items: [{ _tag: "Text", label: "Status", value: "streaming" }]
            }
          })
        ))
      registry.update(surfaceEvidenceStoreAtom("effect-search"), (store) =>
        store.apply(
          new SectionUpsert({
            section: {
              title: "Trial Positions",
              items: [
                { _tag: "Text", label: "Status", value: "streaming" },
                { _tag: "Text", label: "Window", value: "8 rows" }
              ]
            }
          })
        ))

      expect(statusUpdates.current).toBe(2)
      expect(evidenceUpdates.current).toBeGreaterThan(statusUpdates.current)
      unsubscribeStatus()
      unsubscribeEvidence()
    }))
})
