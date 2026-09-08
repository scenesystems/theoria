import { Registry, Result } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, MutableRef, Option } from "effect"

import type { PlaceBuild } from "../../app/contracts/imagined-place-result.js"
import {
  placeBuildAtom,
  placeBuildEnvelopeAtom,
  placeBuiltAtom,
  placeClientLayerAtom
} from "../../app/web/atoms/imagined-place.js"
import { SuccessEnvelopeData } from "../../app/web/services/envelopeRequest.js"
import { ImaginedPlaceClient } from "../../app/web/services/ImaginedPlaceClient.js"
import { onStage } from "../helpers/place-on-stage.js"

/**
 * The build the page has is a fact apart from the request for the next one:
 * while a rebuild is on its way the server's answer is the same build,
 * waiting, and nothing that draws or answers from the build may start over
 * for that. Only another build is a change.
 */

const envelopeOf = (build: PlaceBuild): SuccessEnvelopeData<PlaceBuild> =>
  new SuccessEnvelopeData({ data: build, meta: { requestId: "r", buildSha: "abc", durationMs: 1 } })

/** A client whose answer never comes, so a rebuild stays on its way. */
const holdingClient: Layer.Layer<ImaginedPlaceClient> = Layer.succeed(
  ImaginedPlaceClient,
  ImaginedPlaceClient.make({ build: () => Effect.never })
)

describe("the build the page has", () => {
  it.effect("a rebuild on its way is the same build, and is not a change", () =>
    Effect.gen(function*() {
      const { build } = yield* onStage
      const registry = Registry.make({
        initialValues: [
          [placeClientLayerAtom, holdingClient],
          [placeBuildEnvelopeAtom, Result.success(envelopeOf(build))]
        ],
        scheduleTask: (task) => {
          task()
        }
      })
      expect(registry.get(placeBuiltAtom)).toEqual(Option.some(build))
      const changes = MutableRef.make(0)
      const answers = MutableRef.make(0)
      const unsubscribe = registry.subscribe(placeBuiltAtom, () => {
        MutableRef.increment(changes)
      })
      const unsubscribeAnswers = registry.subscribe(placeBuildAtom, () => {
        MutableRef.increment(answers)
      })

      // Asked to build again: the server's answer changes — it is waiting — and the build does not.
      registry.refresh(placeBuildEnvelopeAtom)
      expect(Result.isWaiting(registry.get(placeBuildAtom))).toBe(true)
      expect(MutableRef.get(answers)).toBe(1)
      expect(registry.get(placeBuiltAtom)).toEqual(Option.some(build))
      expect(MutableRef.get(changes)).toBe(0)
      unsubscribe()
      unsubscribeAnswers()
    }))
})
