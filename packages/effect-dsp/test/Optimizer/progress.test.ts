/**
 * Optimizer progress formatting and semantic-summary contracts.
 */
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import * as Optimizer from "@scenesystems/effect-dsp/Optimizer"
import { Array as Arr, Effect, Number, Option, ParseResult, Ref, Schema, Stream } from "effect"
import { decodePayload } from "../../src/contracts/Payload.js"

const sampleMIPROEvents = Arr.make(
  Optimizer.MIPROv2Event.Phase3Started({ numTrials: 6 }),
  Optimizer.MIPROv2Event.TrialEvaluated({ trial: 0, score: 0.4 }),
  Optimizer.MIPROv2Event.FullEvalCompleted({ bestScore: 0.7 }),
  Optimizer.MIPROv2Event.TrialEvaluated({ trial: 1, score: 0.8 }),
  Optimizer.MIPROv2Event.Phase3Completed({ bestScore: 0.75, totalTrials: 6 })
)

const sampleGEPAEvents = Arr.make(
  Optimizer.GEPAEvent.IterationStarted({ iteration: 1, frontierSize: 1 }),
  Optimizer.GEPAEvent.MergeChecked({
    iteration: 1,
    attempted: true,
    accepted: false,
    mergeBudgetRemaining: 1
  }),
  Optimizer.GEPAEvent.MutationProposed({
    iteration: 1,
    parentId: "candidate-0",
    mutatedCandidateId: "candidate-1",
    predictorName: "debate-judge",
    instruction: "Prefer mechanism-grounded recommendations."
  }),
  Optimizer.GEPAEvent.AcceptanceEvaluated({
    iteration: 1,
    accepted: true,
    gate1Passed: true,
    fullValsetEvaluated: true,
    previousSubsampleSum: 1,
    mutatedSubsampleSum: 2
  }),
  Optimizer.GEPAEvent.ParetoUpdated({
    iteration: 1,
    frontierIndices: [0, 1],
    dominatedIndices: [2],
    parentWeights: [
      { candidateIndex: 0, weight: 0.75 },
      { candidateIndex: 1, weight: 0.25 }
    ]
  }),
  Optimizer.GEPAEvent.IterationCompleted({
    iteration: 1,
    acceptedCandidate: true,
    frontierSize: 2
  }),
  Optimizer.GEPAEvent.OptimizationCompleted({
    iterations: 1,
    bestCandidateId: "candidate-1",
    frontierSize: 2
  })
)

describe("Optimizer progress", () => {
  it.effect("formats MIPROv2 events as stable progress lines", () =>
    Effect.sync(() => {
      const line = Optimizer.formatMIPROv2Event(
        Optimizer.MIPROv2Event.Phase3Completed({
          bestScore: 0.75,
          totalTrials: 6
        })
      )

      expect(line.tag).toBe("Phase3Completed")
      expect(line.details).toBe("bestScore=0.75 totalTrials=6")
      expect(line.text).toBe("Phase3Completed bestScore=0.75 totalTrials=6")
    }))

  it.effect("summarizes MIPROv2 events with semantic trial counters", () =>
    Effect.sync(() => {
      const summary = Optimizer.summarizeMIPROv2Events(sampleMIPROEvents)

      expect(summary.totalEvents).toBe(Arr.length(sampleMIPROEvents))
      expect(summary.phase3StartedSeen).toBe(true)
      expect(summary.phase3ConfiguredTrials).toBe(6)
      expect(summary.trialEvaluatedCount).toBe(2)
      expect(summary.fullEvalCompletedCount).toBe(1)
      expect(summary.phase3CompletedSeen).toBe(true)
      expect(summary.phase3CompletedTrials).toBe(6)
      expect(summary.phase3BestScoreSeen).toBe(true)
      expect(summary.phase3BestScore).toBe(0.8)
    }))

  it.effect("taps MIPROv2 progress without altering stream events", () =>
    Effect.gen(function*() {
      const linesRef = yield* Ref.make(Arr.empty<string>())
      const collectedChunk = yield* Stream.fromIterable(sampleMIPROEvents).pipe(
        Optimizer.tapMIPROv2Progress((line) => Ref.update(linesRef, (lines) => Arr.append(lines, line.text))),
        Stream.runCollect
      )
      const collectedEvents = Arr.fromIterable(collectedChunk)
      const progressLines = yield* Ref.get(linesRef)

      expect(collectedEvents).toEqual(sampleMIPROEvents)
      expect(Arr.length(progressLines)).toBe(Arr.length(sampleMIPROEvents))
      expect(Option.getOrElse(Arr.head(progressLines), () => "")).toEqual("Phase3Started numTrials=6")
    }))

  it.effect("formats GEPA events as stable progress lines", () =>
    Effect.sync(() => {
      const line = Optimizer.formatGEPAEvent(
        Optimizer.GEPAEvent.OptimizationCompleted({
          iterations: 3,
          bestCandidateId: "candidate-7",
          frontierSize: 4
        })
      )

      expect(line.tag).toBe("OptimizationCompleted")
      expect(line.details).toBe("iterations=3 bestCandidateId=candidate-7 frontierSize=4")
      expect(line.text).toBe("OptimizationCompleted iterations=3 bestCandidateId=candidate-7 frontierSize=4")
    }))

  it.effect("summarizes GEPA events with acceptance and frontier semantics", () =>
    Effect.sync(() => {
      const summary = Optimizer.summarizeGEPAEvents(sampleGEPAEvents)

      expect(summary.totalEvents).toBe(Arr.length(sampleGEPAEvents))
      expect(summary.iterationStartedCount).toBe(1)
      expect(summary.mergeCheckedCount).toBe(1)
      expect(summary.mutationProposedCount).toBe(1)
      expect(summary.acceptanceEvaluatedCount).toBe(1)
      expect(summary.acceptanceAcceptedCount).toBe(1)
      expect(summary.gate1PassedCount).toBe(1)
      expect(summary.fullValsetEvaluatedCount).toBe(1)
      expect(summary.paretoUpdatedCount).toBe(1)
      expect(summary.iterationWithAcceptedCandidateCount).toBe(1)
      expect(summary.parentWeightEntriesObserved).toBe(2)
      expect(summary.optimizationCompletedSeen).toBe(true)
      expect(summary.optimizationBestCandidateId).toBe("candidate-1")
      expect(summary.optimizationFrontierSize).toBe(2)
      expect(summary.maxFrontierSize).toBe(2)
    }))

  it.effect("taps GEPA progress without altering stream events", () =>
    Effect.gen(function*() {
      const linesRef = yield* Ref.make(Arr.empty<string>())
      const collectedChunk = yield* Stream.fromIterable(sampleGEPAEvents).pipe(
        Optimizer.tapGEPAProgress((line) => Ref.update(linesRef, (lines) => Arr.append(lines, line.text))),
        Stream.runCollect
      )
      const collectedEvents = Arr.fromIterable(collectedChunk)
      const progressLines = yield* Ref.get(linesRef)

      expect(collectedEvents).toEqual(sampleGEPAEvents)
      expect(Arr.length(progressLines)).toBe(Arr.length(sampleGEPAEvents))
      expect(Option.getOrElse(Arr.last(progressLines), () => "")).toEqual(
        "OptimizationCompleted iterations=1 bestCandidateId=candidate-1 frontierSize=2"
      )
    }))

  it.effect("projects outcome summaries from baseline, optimized, and event semantics", () =>
    Effect.sync(() => {
      const miproSummary = Optimizer.summarizeMIPROv2Outcome({
        baselineExactMatch: 0.2,
        optimizedExactMatch: 0.6,
        demoCountBeforeOptimization: 1,
        demoCountAfterOptimization: 3,
        eventSummary: Optimizer.summarizeMIPROv2Events(sampleMIPROEvents)
      })
      const miproObservability = Optimizer.summarizeMIPROv2OptimizationObservability({
        baselineScore: 0.2,
        optimizedScore: 0.6,
        eventSummary: Optimizer.summarizeMIPROv2Events(sampleMIPROEvents)
      })
      const gepaSummary = Optimizer.summarizeGEPAOutcome({
        baselineExactMatch: 0.5,
        optimizedExactMatch: 0.5,
        instructionBeforeOptimization: "Choose by rhetorical quality.",
        instructionAfterOptimization: "Choose by mechanism-level fit.",
        eventSummary: Optimizer.summarizeGEPAEvents(sampleGEPAEvents)
      })

      expect(miproSummary.scoreDelta).toBeCloseTo(0.4, 15)
      expect(miproSummary.demosLearnedDuringMIPROv2).toBe(2)
      expect(miproObservability.searchGain).toBeCloseTo(0.6, 15)
      expect(miproObservability.retainedGain).toBeCloseTo(0.4, 15)
      expect(miproObservability.retainedVsSearchGap).toBeCloseTo(0.2, 15)
      expect(miproObservability.searchImprovedButRetainedFlat).toBe(false)
      expect(gepaSummary.scoreDelta).toBe(0)
      expect(gepaSummary.instructionChanged).toBe(true)
      expect(gepaSummary.instructionLengthBeforeOptimization).toBeGreaterThan(0)
      expect(gepaSummary.instructionLengthAfterOptimization).toBeGreaterThan(0)
    }))

  it.effect("separates search quality from retained gain when final eval stays flat", () =>
    Effect.sync(() => {
      const observability = Optimizer.summarizeMIPROv2OptimizationObservability({
        baselineScore: 0.5,
        optimizedScore: 0.5,
        eventSummary: Optimizer.summarizeMIPROv2Events(sampleMIPROEvents)
      })

      expect(observability.searchBestScoreSeen).toBe(true)
      expect(observability.searchBestScore).toBeCloseTo(0.8, 15)
      expect(observability.searchGain).toBeCloseTo(0.3, 15)
      expect(observability.retainedGain).toBe(0)
      expect(observability.retainedVsSearchGap).toBeCloseTo(0.3, 15)
      expect(observability.searchImprovedButRetainedFlat).toBe(true)
    }))

  it.effect("falls back to optimized score when phase-3 best score was not observed", () =>
    Effect.sync(() => {
      const eventSummary = Optimizer.summarizeMIPROv2Events(
        Arr.make(
          Optimizer.MIPROv2Event.Phase1Started({ numCandidates: 1 }),
          Optimizer.MIPROv2Event.Phase3Started({ numTrials: 2 }),
          Optimizer.MIPROv2Event.Phase3Completed({ bestScore: 0, totalTrials: 2 })
        )
      )
      const observability = Optimizer.summarizeMIPROv2OptimizationObservability({
        baselineScore: 0.25,
        optimizedScore: 0.5,
        eventSummary: {
          ...eventSummary,
          phase3BestScoreSeen: false,
          phase3BestScore: 0
        }
      })

      expect(observability.searchBestScoreSeen).toBe(false)
      expect(observability.searchBestScore).toBe(0.5)
      expect(observability.searchGain).toBeCloseTo(0.25, 15)
      expect(observability.retainedGain).toBeCloseTo(0.25, 15)
      expect(observability.retainedVsSearchGap).toBe(0)
      expect(observability.searchImprovedButRetainedFlat).toBe(false)
    }))

  it.effect("projects Bootstrap optimizer envelopes and decodes wrapped Bootstrap events", () =>
    Effect.gen(function*() {
      const event = Optimizer.BootstrapEvent.BootstrapFallbackActivated({
        threshold: 1,
        roundsAttempted: 2,
        acceptedTraces: 0,
        rejectedTraces: 6,
        bestScoreSeen: true,
        bestScore: Number.unsafeDivide(1, 3),
        averageScore: Number.unsafeDivide(1, 6),
        fallbackLabeledDemoCount: 3
      })
      const envelope = yield* Optimizer.bootstrapEventEnvelope(event)
      const decoded = yield* Schema.decodeUnknown(Optimizer.OptimizerEventSchema)({
        _tag: "Bootstrap",
        event
      })

      expect(envelope.optimizer).toBe("bootstrapFewShot")
      expect(envelope.eventTag).toBe("BootstrapFallbackActivated")
      expect(yield* decodePayload(Optimizer.BootstrapEventSchema, envelope.payload)).toEqual(event)
      expect(decoded._tag).toBe("Bootstrap")
    }))

  it.effect("projects GEPA optimizer envelopes and decodes wrapped GEPA events", () =>
    Effect.gen(function*() {
      const event = Optimizer.GEPAEvent.OptimizationCompleted({
        iterations: 3,
        bestCandidateId: "candidate-9",
        frontierSize: 2
      })
      const envelope = yield* Optimizer.gepaEventEnvelope(event)
      const decoded = yield* Schema.decodeUnknown(Optimizer.OptimizerEventSchema)({
        _tag: "GEPA",
        event
      })

      expect(envelope.optimizer).toBe("gepa")
      expect(envelope.eventTag).toBe("OptimizationCompleted")
      expect(yield* decodePayload(Optimizer.GEPAEventSchema, envelope.payload)).toEqual(event)
      expect(decoded._tag).toBe("GEPA")
    }))

  it.effect("round-trips MIPRO envelopes and rejects lossy event encoding as a checked error", () =>
    Effect.gen(function*() {
      const event = Optimizer.MIPROv2Event.TrialEvaluated({ trial: 2, score: 0.75 })
      const envelope = yield* Optimizer.miprov2EventEnvelope(event)
      expect(yield* decodePayload(Optimizer.MIPROv2EventSchema, envelope.payload)).toEqual(event)
      const encoding = Optimizer.miprov2EventEnvelope(
        Optimizer.MIPROv2Event.TrialEvaluated({ trial: 2, score: Number.unsafeDivide(1, 0) })
      )
      expectTypeOf<Effect.Effect.Error<typeof encoding>>().toEqualTypeOf<ParseResult.ParseError>()
      expect(yield* Effect.flip(encoding)).toBeInstanceOf(ParseResult.ParseError)
    }))
})
