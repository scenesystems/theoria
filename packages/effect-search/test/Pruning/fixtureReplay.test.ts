import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as Num, Ref, Result, Schema } from "effect"

import { makeReportRefs, recordReport } from "../../src/internal/optimization/runtime/controls.js"
import * as Pruning from "../../src/Pruning.js"
import {
  FixtureRegistryLive,
  loadFixture,
  PercentilePrunerFixture,
  PruningReportContractFixture
} from "../helpers/fixtures/index.js"
import { decodePruningTraceValue, makePruningEventRuntime, pruningReportTrace } from "../helpers/pruningScenarios.js"

describe("pruning fixture replay contracts", () => {
  it.effect("replays FM-12 Trial.report fixture contracts", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("pruning.report-contract").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknownEffect(PruningReportContractFixture)(loaded)

      yield* Effect.forEach(
        fixture.payload.cases,
        (entry, index) =>
          Effect.gen(function*() {
            const runtime = yield* makePruningEventRuntime
            const reportRefs = yield* makeReportRefs
            const trialNumber = Num.sum(400, index)

            yield* Effect.forEach(
              entry.initialReports,
              (initial) =>
                recordReport(
                  runtime,
                  reportRefs,
                  trialNumber,
                  Pruning.never,
                  initial.step,
                  decodePruningTraceValue(initial.value)
                ).pipe(Effect.asVoid),
              { discard: true }
            )

            const result = yield* Effect.result(
              recordReport(
                runtime,
                reportRefs,
                trialNumber,
                Pruning.never,
                entry.reportAttempt.step,
                decodePruningTraceValue(entry.reportAttempt.value)
              )
            )
            const reports = yield* Ref.get(reportRefs.reportsRef)
            const expectedReports = Arr.map(entry.expectedReports, (report) => ({
              step: report.step,
              value: decodePruningTraceValue(report.value)
            }))

            expect(pruningReportTrace(reports)).toEqual(expectedReports)

            Match.value(entry.expectedOutcome).pipe(
              Match.when("accepted", () => {
                expect(Result.isSuccess(result)).toBe(true)
              }),
              Match.when("duplicate-ignored", () => {
                expect(Result.isSuccess(result)).toBe(true)
              }),
              Match.orElse(() => {
                expect(Result.isFailure(result)).toBe(true)

                Result.mapError(result, (failure) => expect(failure._tag).toBe("effect-search/InvalidObjectiveReport"))
              })
            )
          }),
        { discard: true }
      )
    }))

  it.effect("replays FM-13 percentile-pruner boundary fixture contracts", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("pruning.percentile-pruner").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknownEffect(PercentilePrunerFixture)(loaded)

      yield* Effect.forEach(
        fixture.payload.cases,
        (entry) =>
          Effect.gen(function*() {
            const context = yield* Schema.decodeEffect(Pruning.PercentileContext)({
              direction: fixture.payload.direction,
              settings: entry.settings,
              trialNumber: entry.trialNumber,
              step: entry.step,
              history: Arr.map(entry.history, (trial) => ({
                trialNumber: trial.trialNumber,
                state: trial.state,
                reports: Arr.map(trial.reports, (report) => ({
                  step: report.step,
                  value: decodePruningTraceValue(report.value)
                }))
              })),
              currentReports: Arr.of({ step: entry.step, value: entry.currentValue })
            })
            const shouldPrune = Pruning.shouldPruneByPercentile(context)

            expect(shouldPrune).toBe(entry.expectedShouldPrune)
          }),
        { discard: true }
      )
    }))
})
