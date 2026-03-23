/**
 * Objective projection seams from Evaluate reports to effect-search objective values.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"
import * as Contracts from "effect-dsp/contracts"
import * as Evaluate from "effect-dsp/Evaluate"

const makeReport = () =>
  new Evaluate.Report({
    overallScores: {
      accuracy: 0.8,
      faithfulness: 0.6
    },
    results: [
      new Evaluate.ExampleResult({
        index: 0,
        scores: {
          accuracy: 1,
          faithfulness: 0.5
        },
        failure: Option.none(),
        durationMs: 10
      }),
      new Evaluate.ExampleResult({
        index: 1,
        scores: {},
        failure: Option.some(
          new Evaluate.ExampleFailure({
            index: 1,
            tag: "MetricError",
            message: "Judge failed"
          })
        ),
        durationMs: 20
      })
    ],
    failures: [
      new Evaluate.ExampleFailure({
        index: 1,
        tag: "MetricError",
        message: "Judge failed"
      })
    ],
    totalExamples: 2,
    successCount: 1,
    failureCount: 1
  })

describe("contracts/ObjectiveProjection", () => {
  it.effect("projects deterministic single-objective payloads with telemetry", () =>
    Effect.gen(function*() {
      const report = makeReport()
      const projectedA = yield* Contracts.projectSingleObjective(report)
      const projectedB = yield* Contracts.projectSingleObjective(report)

      expect(projectedA).toEqual(projectedB)
      expect(projectedA.objective).toBe(0.8)
      expect(projectedA.telemetry.totalExamples).toBe(2)
      expect(projectedA.telemetry.failureCount).toBe(1)
      expect(projectedA.telemetry.averageDurationMs).toBe(15)
      expect(projectedA.telemetry.failures[0]?.tag).toBe("MetricError")
    }))

  it.effect("projects deterministic multi-objective vectors with schema round-trip", () =>
    Effect.gen(function*() {
      const report = makeReport()
      const projected = yield* Contracts.projectMultiObjective(report, ["faithfulness", "accuracy"])
      const encoded = yield* Schema.encode(Contracts.ObjectiveProjection)(projected)
      const decoded = yield* Schema.decode(Contracts.ObjectiveProjection)(encoded)

      expect(projected.objective).toEqual([0.6, 0.8])
      expect(decoded).toEqual(projected)
    }))
})
