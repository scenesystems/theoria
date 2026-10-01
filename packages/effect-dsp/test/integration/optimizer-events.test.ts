import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import * as BootstrapFewShot from "@scenesystems/effect-dsp/BootstrapFewShot"
import * as GEPA from "@scenesystems/effect-dsp/GEPA"
import * as MIPROv2 from "@scenesystems/effect-dsp/MIPROv2"
import * as OptimizerEvent from "@scenesystems/effect-dsp/OptimizerEvent"
import * as Payload from "@scenesystems/effect-dsp/Payload"
import { Effect, Number, ParseResult, Schema } from "effect"

describe("integration/optimizer events", () => {
  it.effect("wraps canonical optimizer events and preserves their owners", () =>
    Effect.gen(function*() {
      const bootstrap = BootstrapFewShot.events.RoundStarted({ round: 1, maxRounds: 2 })
      const mipro = MIPROv2.events.Phase3Started({ numTrials: 4 })
      const gepa = GEPA.events.OptimizationCompleted({
        iterations: 3,
        bestCandidateId: "candidate-2",
        frontierSize: 2
      })

      const bootstrapEnvelope = yield* OptimizerEvent.fromBootstrap(bootstrap)
      const miproEnvelope = yield* OptimizerEvent.fromMIPROv2(mipro)
      const gepaEnvelope = yield* OptimizerEvent.fromGEPA(gepa)
      expect(bootstrapEnvelope.optimizer).toBe("bootstrapFewShot")
      expect(miproEnvelope.optimizer).toBe("miprov2")
      expect(gepaEnvelope.optimizer).toBe("gepa")
      expect(yield* Payload.decode(BootstrapFewShot.Event, bootstrapEnvelope.payload)).toEqual(bootstrap)
      expect(yield* Payload.decode(MIPROv2.Event, miproEnvelope.payload)).toEqual(mipro)
      expect(yield* Payload.decode(GEPA.Event, gepaEnvelope.payload)).toEqual(gepa)
      expect(
        yield* Schema.decodeUnknown(OptimizerEvent.OptimizerEvent)(
          OptimizerEvent.events.GEPA({ event: gepa })
        )
      ).toEqual({ _tag: "GEPA", event: gepa })
    }))

  it.effect("rejects lossy event payload encoding in the checked error channel", () =>
    Effect.gen(function*() {
      const encoding = OptimizerEvent.fromMIPROv2(
        MIPROv2.events.TrialEvaluated({ trial: 2, score: Number.unsafeDivide(1, 0) })
      )
      expectTypeOf<Effect.Effect.Error<typeof encoding>>().toEqualTypeOf<ParseResult.ParseError>()
      expect(yield* Effect.flip(encoding)).toBeInstanceOf(ParseResult.ParseError)
    }))
})
