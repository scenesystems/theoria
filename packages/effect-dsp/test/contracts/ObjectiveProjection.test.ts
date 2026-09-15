/**
 * Objective projection seams from Evaluate reports to effect-search objective values.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Contracts from "@scenesystems/effect-dsp/contracts"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import { Array as Arr, Effect, Option, Record, Schema } from "effect"

const makeReport = () =>
  new Evaluate.Report({
    overallScores: {
      faithfulness: 0.6,
      accuracy: 0.8
    },
    results: Arr.make(
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
        scores: Record.empty(),
        failure: Option.some(
          new Evaluate.ExampleFailure({
            index: 1,
            tag: "MetricError",
            message: "Judge failed"
          })
        ),
        durationMs: 20
      })
    ),
    failures: Arr.make(
      new Evaluate.ExampleFailure({
        index: 1,
        tag: "MetricError",
        message: "Judge failed"
      })
    ),
    totalExamples: 2,
    successCount: 1,
    failureCount: 1
  })

describe("contracts/ObjectiveProjection", () => {
  it.effect("projects deterministic single-objective payloads with telemetry", () =>
    Effect.gen(function*() {
      const report = makeReport()
      const projectedA = yield* Contracts.projectSingleObjective(report, Option.none())
      const projectedB = yield* Contracts.projectSingleObjective(report, Option.none())

      expect(projectedA).toEqual(projectedB)
      expect(projectedA.objective).toBe(0.8)
      expect(projectedA.telemetry.totalExamples).toBe(2)
      expect(projectedA.telemetry.failureCount).toBe(1)
      expect(projectedA.telemetry.averageDurationMs).toBe(15)
      expect((yield* Arr.head(projectedA.telemetry.failures)).tag).toBe("MetricError")
    }))

  it.effect("projects deterministic multi-objective vectors with schema round-trip", () =>
    Effect.gen(function*() {
      const report = makeReport()
      const projected = yield* Contracts.projectMultiObjective(report, Arr.make("faithfulness", "accuracy"))
      const encoded = yield* Schema.encode(Contracts.ObjectiveProjection)(projected)
      const decoded = yield* Schema.decode(Contracts.ObjectiveProjection)(encoded)

      expect(projected.objective).toEqual(Arr.make(0.6, 0.8))
      expect(decoded).toEqual(projected)
    }))

  it.effect("preserves mode selection, missing metric defaults, duplicates, and explicit empty vectors", () =>
    Effect.gen(function*() {
      const report = makeReport()
      const names = Arr.make("faithfulness", "missing", "accuracy", "faithfulness")
      expect((yield* Contracts.projectObjective({ report, mode: "single", metricNames: names })).objective).toBe(0.6)
      expect((yield* Contracts.projectObjective({ report, mode: "multi", metricNames: names })).objective).toEqual(
        Arr.make(0.6, 0, 0.8, 0.6)
      )
      expect((yield* Contracts.projectObjective({ report, mode: "multi" })).objective).toEqual(Arr.make(0.8, 0.6))
      expect((yield* Contracts.projectObjective({ report, mode: "multi", metricNames: Arr.empty() })).objective)
        .toEqual(Arr.empty())
      expect((yield* Contracts.projectSingleObjective(report, Option.some("missing"))).objective).toBe(0)
      const empty = new Evaluate.Report({
        overallScores: Record.empty(),
        results: Arr.empty(),
        failures: Arr.empty(),
        totalExamples: 0,
        successCount: 0,
        failureCount: 0
      })
      const projection = yield* Contracts.projectObjective({ report: empty, mode: "single" })
      expect(projection.objective).toBe(0)
      expect(projection.telemetry.averageDurationMs).toBe(0)
      expect(projection.telemetry.metricScores).toEqual(Arr.empty())
    }))
})
