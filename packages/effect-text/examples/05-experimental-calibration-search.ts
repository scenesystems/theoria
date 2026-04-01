/**
 * Experimental Calibration Search — optimize an engine profile with effect-search.
 *
 * What this shows: `Experimental.Calibration.optimizeProfile` composes the
 * calibration corpus with `effect-search` while keeping the core Text APIs
 * unchanged.
 *
 * Feature Type Links:
 * - {@link Experimental.Calibration.optimizeProfile}
 * - {@link Experimental.Calibration.CalibrationReportType}
 * - {@link Sampler.Sampler}
 *
 * Run: bun run packages/effect-text/examples/05-experimental-calibration-search.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { BunContext } from "@effect/platform-bun"
import { Effect, Layer } from "effect"
import { Sampler } from "effect-search"

import { Contracts, Experimental, Text } from "effect-text"

const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
  measure: (_font, text: string) => Effect.succeed(text.length * 5)
})

const services = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
)

const program = Effect.gen(function*() {
  const optimized = yield* Experimental.Calibration.optimizeProfile({
    cases: [{
      name: "tab-advance",
      prepare: {
        text: "a\tb",
        font: { family: "Mono", size: 10 },
        whiteSpace: "pre-wrap"
      },
      layout: { maxWidth: 100, lineHeight: 12 },
      expected: {
        lineCount: 1,
        maxLineWidth: 15,
        lines: [{ text: "a\tb", width: 15 }]
      }
    }],
    services,
    trials: 8,
    sampler: Sampler.tpe({ seed: 7 }),
    searchSpaceSpec: {
      lineFitEpsilon: { low: 0.005, high: 0.005, step: 0.001 },
      tabWidth: { low: 2, high: 4, step: 2 }
    }
  })

  yield* Effect.log("experimental calibration search", {
    bestProfile: optimized.bestProfile,
    bestReport: optimized.bestReport,
    bestValue: optimized.studyResult.bestTrial.state.value
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
