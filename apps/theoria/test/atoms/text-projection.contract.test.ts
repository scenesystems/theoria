import type { Atom as AtomType } from "@effect-atom/atom"
import { Registry, Result } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Errors } from "@scenesystems/effect-text"
import { Effect, Ref } from "effect"
import type { TextProjection } from "../../app/contracts/text.js"

import { makeTextProjectionAtom, TextProjectionAuthority, TextProjectionKey } from "../../app/web/atoms/text.js"
import { prepareTextProjection, projectPreparedText } from "../../app/web/view/text/authority.js"

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
  })

/** Polls the atom until a projection is present. */
const waitForProjection = (
  registry: Registry.Registry,
  atom: AtomType.Atom<Result.Result<TextProjection, Errors.MeasurementFailed>>
): Effect.Effect<TextProjection, never, never> =>
  Effect.eventually(Effect.sync(() => registry.get(atom)).pipe(Effect.flatMap(Result.value)))

const makeAuthority = (prepareCalls: Ref.Ref<number>): TextProjectionAuthority =>
  new TextProjectionAuthority({
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
      const projectionAtom = makeTextProjectionAtom(makeAuthority(prepareCalls))
      const text = "The same prepared handle should survive width changes in the generic projection path."
      const at = (maxWidth: number) =>
        projectionAtom(new TextProjectionKey({ role: "row-label", variant: "compact", text, maxWidth }))

      const narrow = yield* waitForProjection(registry, at(120))
      const wide = yield* waitForProjection(registry, at(320))

      expect(yield* Ref.get(prepareCalls)).toBe(1)
      expect(narrow.layout.maxWidth).toBe(120)
      expect(wide.layout.maxWidth).toBe(320)
      expect(narrow.summary.lineCount).toBeGreaterThanOrEqual(wide.summary.lineCount)
    }))

  it.effect("a measurement failure reaches the surface as the failure, not as an absent projection", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const failing = new TextProjectionAuthority({
        prepare: (identity) =>
          Effect.fail(
            new Errors.MeasurementFailed({ fontFamily: "test", fontSize: 16, text: identity.text, reason: "no canvas" })
          ),
        project: ({ prepared, request, maxWidth }) => projectPreparedText({ prepared, request, maxWidth })
      })
      const projectionAtom = makeTextProjectionAtom(failing)(
        new TextProjectionKey({
          role: "row-label",
          variant: "compact",
          text: "Text that cannot be measured.",
          maxWidth: 320
        })
      )

      const failure = yield* Effect.eventually(
        Effect.sync(() => registry.get(projectionAtom)).pipe(Effect.flatMap(Result.error))
      )

      expect(failure.reason).toBe("no canvas")
    }))
})
