/**
 * Error model: Schema.TaggedError yieldability, discrimination, and union.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, Option, Schema } from "effect"
import {
  AllTrialsFailed,
  BootstrapFailed,
  CompositionError,
  DspError,
  EvaluationFailed,
  InstructionProposalFailed,
  MergeRejected,
  MetricError,
  ParseOutputError,
  SaveLoadError,
  SignatureError,
  TraceError
} from "effect-dsp/Errors"

const expectSchemaRoundTrip = <A, I>(
  schema: Schema.Schema<A, I, never>,
  value: A
): void => {
  const encoded = Schema.encodeSync(schema)(value)
  const decoded = Schema.decodeUnknownSync(schema)(encoded)
  const reEncoded = Schema.encodeSync(schema)(decoded)

  expect(reEncoded).toEqual(encoded)
}

describe("Errors", () => {
  describe("Schema.TaggedError yieldability", () => {
    it.effect("SignatureError is yieldable", () =>
      Effect.gen(function*() {
        const exit = yield* Effect.exit(
          Effect.gen(function*() {
            return yield* new SignatureError({ reason: "empty fields" })
          })
        )
        expect(Exit.isFailure(exit)).toBe(true)
      }))

    it.effect("ParseOutputError is yieldable", () =>
      Effect.gen(function*() {
        const exit = yield* Effect.exit(
          Effect.gen(function*() {
            return yield* new ParseOutputError({
              message: "bad json",
              moduleName: "qa",
              rawOutput: Option.none(),
              retryCount: Option.none()
            })
          })
        )
        expect(Exit.isFailure(exit)).toBe(true)
      }))

    it.effect("BootstrapFailed is yieldable", () =>
      Effect.gen(function*() {
        const exit = yield* Effect.exit(
          Effect.gen(function*() {
            return yield* new BootstrapFailed({
              message: "no demos",
              roundsAttempted: 5,
              totalTraces: 0,
              threshold: 1,
              acceptedTraces: 0,
              rejectedTraces: 0,
              evaluatedExamples: 0,
              bestScoreSeen: false,
              bestScore: 0,
              averageScore: 0
            })
          })
        )
        expect(Exit.isFailure(exit)).toBe(true)
      }))
  })

  describe("_tag discrimination", () => {
    it("SignatureError has correct _tag", () => {
      const err = new SignatureError({ reason: "test" })
      expect(err._tag).toBe("SignatureError")
    })

    it("ParseOutputError has correct _tag", () => {
      const err = new ParseOutputError({
        message: "test",
        moduleName: "qa",
        rawOutput: Option.none(),
        retryCount: Option.none()
      })
      expect(err._tag).toBe("ParseOutputError")
    })

    it("CompositionError has correct _tag", () => {
      const err = new CompositionError({ message: "test" })
      expect(err._tag).toBe("CompositionError")
    })

    it("BootstrapFailed has correct _tag", () => {
      const err = new BootstrapFailed({
        message: "test",
        roundsAttempted: 1,
        totalTraces: 0,
        threshold: 1,
        acceptedTraces: 0,
        rejectedTraces: 1,
        evaluatedExamples: 1,
        bestScoreSeen: true,
        bestScore: 0,
        averageScore: 0
      })
      expect(err._tag).toBe("BootstrapFailed")
    })

    it("InstructionProposalFailed has correct _tag", () => {
      const err = new InstructionProposalFailed({ message: "test", predictorIndex: 0 })
      expect(err._tag).toBe("InstructionProposalFailed")
    })

    it("AllTrialsFailed has correct _tag", () => {
      const err = new AllTrialsFailed({ message: "test", trialCount: 10 })
      expect(err._tag).toBe("AllTrialsFailed")
    })

    it("MergeRejected has correct _tag", () => {
      const err = new MergeRejected({ message: "test", parentA: "a", parentB: "b" })
      expect(err._tag).toBe("MergeRejected")
    })

    it("MetricError has correct _tag", () => {
      const err = new MetricError({ message: "test", metricName: "f1" })
      expect(err._tag).toBe("MetricError")
    })

    it("EvaluationFailed has correct _tag", () => {
      const err = new EvaluationFailed({ message: "test", index: 0 })
      expect(err._tag).toBe("EvaluationFailed")
    })

    it("TraceError has correct _tag", () => {
      const err = new TraceError({ message: "test" })
      expect(err._tag).toBe("TraceError")
    })

    it("SaveLoadError has correct _tag", () => {
      const err = new SaveLoadError({ message: "test", operation: "save" })
      expect(err._tag).toBe("SaveLoadError")
    })
  })

  describe("catchTag discrimination", () => {
    it.effect("can catch SignatureError by tag", () =>
      Effect.gen(function*() {
        const result = yield* Effect.gen(function*() {
          return yield* new SignatureError({ reason: "test" })
        }).pipe(
          Effect.catchTag("SignatureError", (e) => Effect.succeed(e.reason))
        )
        expect(result).toBe("test")
      }))

    it.effect("can catch BootstrapFailed by tag", () =>
      Effect.gen(function*() {
        const result = yield* Effect.gen(function*() {
          return yield* new BootstrapFailed({
            message: "no demos",
            roundsAttempted: 3,
            totalTraces: 0,
            threshold: 1,
            acceptedTraces: 0,
            rejectedTraces: 1,
            evaluatedExamples: 1,
            bestScoreSeen: true,
            bestScore: 0,
            averageScore: 0
          })
        }).pipe(
          Effect.catchTag("BootstrapFailed", (e) => Effect.succeed(e.roundsAttempted))
        )
        expect(result).toBe(3)
      }))
  })

  describe("DspError union", () => {
    it("DspError union schema is defined", () => {
      expect(DspError).toBeDefined()
    })
  })

  describe("Schema round-trip", () => {
    it("round-trips SignatureError", () => {
      expectSchemaRoundTrip(
        SignatureError,
        new SignatureError({ reason: "invalid fields", field: "question" })
      )
    })

    it("round-trips ParseOutputError", () => {
      expectSchemaRoundTrip(
        ParseOutputError,
        new ParseOutputError({
          message: "invalid output",
          moduleName: "qa",
          rawOutput: Option.some("bad"),
          retryCount: Option.some(2)
        })
      )
    })

    it("round-trips CompositionError", () => {
      expectSchemaRoundTrip(
        CompositionError,
        new CompositionError({
          message: "submodule conflict",
          moduleName: "pipeline"
        })
      )
    })

    it("round-trips BootstrapFailed", () => {
      expectSchemaRoundTrip(
        BootstrapFailed,
        new BootstrapFailed({
          message: "no accepted traces",
          roundsAttempted: 4,
          totalTraces: 0,
          threshold: 1,
          acceptedTraces: 0,
          rejectedTraces: 4,
          evaluatedExamples: 4,
          bestScoreSeen: true,
          bestScore: 0,
          averageScore: 0
        })
      )
    })

    it("round-trips InstructionProposalFailed", () => {
      expectSchemaRoundTrip(
        InstructionProposalFailed,
        new InstructionProposalFailed({
          message: "meta model failed",
          predictorIndex: 1
        })
      )
    })

    it("round-trips AllTrialsFailed", () => {
      expectSchemaRoundTrip(
        AllTrialsFailed,
        new AllTrialsFailed({
          message: "all evaluations failed",
          trialCount: 16
        })
      )
    })

    it("round-trips MergeRejected", () => {
      expectSchemaRoundTrip(
        MergeRejected,
        new MergeRejected({
          message: "merge below threshold",
          parentA: "program-a",
          parentB: "program-b"
        })
      )
    })

    it("round-trips MetricError", () => {
      expectSchemaRoundTrip(
        MetricError,
        new MetricError({
          message: "invalid score",
          metricName: "f1"
        })
      )
    })

    it("round-trips EvaluationFailed", () => {
      expectSchemaRoundTrip(
        EvaluationFailed,
        new EvaluationFailed({
          message: "example failed",
          index: 7
        })
      )
    })

    it("round-trips TraceError", () => {
      expectSchemaRoundTrip(
        TraceError,
        new TraceError({
          message: "trace serialization failed",
          moduleName: "qa"
        })
      )
    })

    it("round-trips SaveLoadError", () => {
      expectSchemaRoundTrip(
        SaveLoadError,
        new SaveLoadError({
          message: "load failed",
          operation: "load",
          path: "/tmp/state.json"
        })
      )
    })
  })
})
