/**
 * Contract for contextual metric scoring.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Experimental from "effect-dsp/experimental"
import * as Metric from "effect-dsp/Metric"

const Execution = Experimental.OpenAgentTrace.Execution

describe("Metric/contextual", () => {
  it.effect("proves a metric can read input, prediction, expected, and package-owned execution metadata", () =>
    Effect.gen(function*() {
      const fixtureId = Execution.COUNTER_ITEMS_EXECUTION_FIXTURE_ID
      const metric = Metric.fromEffectContextual("contextual", (context) =>
        Effect.succeed(
          new Metric.Result({
            score: context.input.task === "Patch the checked-in fixture" &&
                context.prediction.strategy === context.expected.strategy &&
                context.metadata.fixtureId === fixtureId
              ? 1
              : 0,
            feedback: `${context.metadata.fixtureId}:${context.input.task}`
          })
        ))
      const result = yield* metric.scoreContext(
        Metric.MetricContext.of({
          input: { task: "Patch the checked-in fixture" },
          prediction: { strategy: "Use the checked-in patch" },
          expected: { strategy: "Use the checked-in patch" },
          metadata: Execution.CodingExecutionMetricMetadata.of(fixtureId)
        })
      )
      const legacyResult = yield* metric.score(
        { strategy: "Use the checked-in patch" },
        { strategy: "Use the checked-in patch" }
      )

      expect(result.score).toBe(1)
      expect(result.feedback).toBe(`${fixtureId}:Patch the checked-in fixture`)
      expect(legacyResult.score).toBe(0)
    }))
})
