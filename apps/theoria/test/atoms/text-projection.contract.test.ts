import type { Atom as AtomType } from "@effect-atom/atom"
import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Ref } from "effect"
import type { TextProjection } from "../../app/contracts/text.js"

import { elementWidthAtom, makeElementWidthSlot } from "../../app/web/atoms/element-observation.js"
import { makeTextProjectionAtom, type TextProjectionAuthority } from "../../app/web/atoms/text.js"
import { prepareTextProjection, projectPreparedText } from "../../app/web/view/text/authority.js"

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
  })

const waitForProjection = (
  registry: Registry.Registry,
  atom: AtomType.Atom<TextProjection | null>
): Effect.Effect<TextProjection, never, never> =>
  Effect.eventually(
    Effect.sync(() => registry.get(atom)).pipe(
      Effect.filterOrFail((projection): projection is TextProjection => projection !== null, () =>
        "waiting-for-projection")
    )
  ).pipe(Effect.orDie)

const makeAuthority = (prepareCalls: Ref.Ref<number>): TextProjectionAuthority => ({
  prepare: (identity) =>
    Ref.update(prepareCalls, (count) => count + 1).pipe(
      Effect.zipRight(prepareTextProjection(identity))
    ),
  project: ({ prepared, request, maxWidth }) => projectPreparedText({ prepared, request, maxWidth })
})

describe("text projection contracts", () => {
  it.effect("generic text projection reuses a prepared handle across width changes", () =>
    Effect.gen(function*() {
      const prepareCalls = yield* Ref.make(0)
      const registry = makeTestRegistry()
      const widthSlot = makeElementWidthSlot()
      const projectionAtom = makeTextProjectionAtom(makeAuthority(prepareCalls))({
        role: "row-label",
        variant: "compact",
        text: "The same prepared handle should survive width changes in the generic projection path.",
        widthSlot
      })

      registry.set(elementWidthAtom(widthSlot), 120)
      const narrow = yield* waitForProjection(registry, projectionAtom)

      registry.set(elementWidthAtom(widthSlot), 320)
      const wide = yield* Effect.eventually(
        Effect.sync(() => registry.get(projectionAtom)).pipe(
          Effect.filterOrFail(
            (projection): projection is TextProjection => projection !== null && projection.layout.maxWidth === 320,
            () => "waiting-for-wide-projection"
          )
        )
      ).pipe(Effect.orDie)

      expect(yield* Ref.get(prepareCalls)).toBe(1)
      expect(narrow.layout.maxWidth).toBe(120)
      expect(wide.layout.maxWidth).toBe(320)
      expect(narrow.summary.lineCount).toBeGreaterThanOrEqual(wide.summary.lineCount)
    }))

  it.effect("generic text projection does not call prepare again when only width changes", () =>
    Effect.gen(function*() {
      const prepareCalls = yield* Ref.make(0)
      const registry = makeTestRegistry()
      const widthSlot = makeElementWidthSlot()
      const projectionAtom = makeTextProjectionAtom(makeAuthority(prepareCalls))({
        role: "row-label",
        variant: "compact",
        text: "Width-only changes must stay on pure projection after the initial prepare boundary.",
        widthSlot
      })

      registry.set(elementWidthAtom(widthSlot), 96)
      yield* waitForProjection(registry, projectionAtom)

      registry.set(elementWidthAtom(widthSlot), 180)
      yield* Effect.eventually(
        Effect.sync(() => registry.get(projectionAtom)).pipe(
          Effect.filterOrFail(
            (projection) => projection !== null && projection.layout.maxWidth === 180,
            () => "waiting-for-mid-projection"
          )
        )
      ).pipe(Effect.orDie)

      registry.set(elementWidthAtom(widthSlot), 240)
      yield* Effect.eventually(
        Effect.sync(() => registry.get(projectionAtom)).pipe(
          Effect.filterOrFail(
            (projection) => projection !== null && projection.layout.maxWidth === 240,
            () => "waiting-for-wide-projection"
          )
        )
      ).pipe(Effect.orDie)

      expect(yield* Ref.get(prepareCalls)).toBe(1)
    }))
})
