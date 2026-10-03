import { describe, expect, it } from "@effect/vitest"
import { PreparationKey, TextMeasurer } from "@scenesystems/effect-text"
import { Effect, Ref } from "effect"
import { AtomRegistry as Registry } from "effect/reactivity"
import type { AsyncResult as Result } from "effect/reactivity"
import type * as AtomType from "effect/reactivity/Atom"
import type { TextProjection } from "../../app/contracts/text.js"

import { fontReadinessRevisionAtom, textLayoutLayerAtom } from "../../app/web/atoms/text-layout.js"
import {
  makeTextProjectionAtom,
  TextProjectionAuthority,
  type TextProjectionError,
  TextProjectionKey
} from "../../app/web/atoms/text.js"
import { deterministicTextLayoutLive } from "../../app/web/text/browserTextLayout.js"
import {
  prepareTextProjection,
  projectPreparedText,
  ProjectPreparedTextOptions
} from "../../app/web/view/text/authority.js"

/** happy-dom has no canvas, so the registry measures with the deterministic layer. */
const makeTestRegistry = (): Registry.AtomRegistry =>
  Registry.make({
    initialValues: [[textLayoutLayerAtom, deterministicTextLayoutLive]]
  })

const testRegistry = Effect.acquireRelease(
  Effect.sync(makeTestRegistry),
  (registry) => Effect.sync(() => registry.dispose())
)

/** Polls the atom until a projection is present. */
const waitForProjection = (
  registry: Registry.AtomRegistry,
  atom: AtomType.Atom<Result.AsyncResult<TextProjection, TextProjectionError>>
): Effect.Effect<TextProjection, never, never> => Registry.getResult(registry, atom).pipe(Effect.orDie)

const makeAuthority = (prepareCalls: Ref.Ref<number>): TextProjectionAuthority =>
  new TextProjectionAuthority({
    prepare: (identity) =>
      Ref.update(prepareCalls, (count) => count + 1).pipe(
        Effect.andThen(prepareTextProjection(identity))
      ),
    project: ({ prepared, request, maxWidth }) =>
      projectPreparedText(new ProjectPreparedTextOptions({ prepared, request, maxWidth }))
  })

describe("text projection contracts", () => {
  it.effect("generic text projection reuses a prepared handle across width changes", () =>
    Effect.gen(function*() {
      const prepareCalls = yield* Ref.make(0)
      const registry = yield* testRegistry
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

  it.effect("the faces' arrival prepares the text again: a prepared handle is the revision's, not the page's", () =>
    Effect.gen(function*() {
      const prepareCalls = yield* Ref.make(0)
      const registry = yield* testRegistry
      const projectionAtom = makeTextProjectionAtom(makeAuthority(prepareCalls))(
        new TextProjectionKey({
          role: "row-label",
          variant: "compact",
          text: "Measured in the stand-in, then in the served face.",
          maxWidth: 320
        })
      )
      const unmount = registry.mount(projectionAtom)
      yield* waitForProjection(registry, projectionAtom)
      expect(yield* Ref.get(prepareCalls)).toBe(1)

      registry.set(fontReadinessRevisionAtom, PreparationKey.nextRevision(registry.get(fontReadinessRevisionAtom)))
      yield* Effect.repeat(Ref.get(prepareCalls), { until: (count) => count >= 2 })
      yield* waitForProjection(registry, projectionAtom)

      expect(yield* Ref.get(prepareCalls)).toBe(2)
      unmount()
    }))

  it.effect("a measurement failure reaches the surface as the failure, not as an absent projection", () =>
    Effect.gen(function*() {
      const registry = yield* testRegistry
      const failing = new TextProjectionAuthority({
        prepare: (identity) =>
          Effect.fail(
            new TextMeasurer.Failed({
              fontFamily: "test",
              fontSize: 16,
              text: identity.prepare.text,
              reason: "no canvas"
            })
          ),
        project: ({ prepared, request, maxWidth }) =>
          projectPreparedText(new ProjectPreparedTextOptions({ prepared, request, maxWidth }))
      })
      const projectionAtom = makeTextProjectionAtom(failing)(
        new TextProjectionKey({
          role: "row-label",
          variant: "compact",
          text: "Text that cannot be measured.",
          maxWidth: 320
        })
      )

      const failure = yield* Effect.flip(Registry.getResult(registry, projectionAtom))

      expect(failure).toBeInstanceOf(TextMeasurer.Failed)
      expect(failure).toMatchObject({ reason: "no canvas" })
    }))
})
