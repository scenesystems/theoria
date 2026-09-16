import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Ref, Schema } from "effect"

import { makeReportRefs, recordReport } from "../../src/internal/study/runtime/controls.js"
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
      const fixture = yield* Schema.decodeUnknown(PruningReportContractFixture)(loaded)

      yield* Effect.forEach(
        fixture.payload.cases,
        (entry, index) =>
          Effect.gen(function*() {
            const runtime = yield* makePruningEventRuntime()
            const reportRefs = yield* makeReportRefs
            const trialNumber = 400 + index

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

            const result = yield* Effect.either(
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
            const expectedReports = entry.expectedReports.map((report) => ({
              step: report.step,
              value: decodePruningTraceValue(report.value)
            }))

            expect(pruningReportTrace(reports)).toEqual(expectedReports)

            Match.value(entry.expectedOutcome).pipe(
              Match.when("accepted", () => {
                expect(result._tag).toBe("Right")
              }),
              Match.when("duplicate-ignored", () => {
                expect(result._tag).toBe("Right")
              }),
              Match.orElse(() => {
                expect(result._tag).toBe("Left")

                if (result._tag === "Left") {
                  expect(result.left._tag).toBe("effect-search/InvalidObjectiveReport")
                }
              })
            )
          }),
        { discard: true }
      )
    }))

  it.effect("replays FM-13 percentile-pruner boundary fixture contracts", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("pruning.percentile-pruner").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknown(PercentilePrunerFixture)(loaded)

      yield* Effect.forEach(
        fixture.payload.cases,
        (entry) =>
          Effect.gen(function*() {
            const context = yield* Schema.decodeUnknown(Pruning.PercentileContext)({
              direction: fixture.payload.direction,
              settings: entry.settings,
              trialNumber: entry.trialNumber,
              step: entry.step,
              history: entry.history.map((trial) => ({
                trialNumber: trial.trialNumber,
                state: trial.state,
                reports: trial.reports.map((report) => ({
                  step: report.step,
                  value: decodePruningTraceValue(report.value)
                }))
              })),
              currentReports: [{ step: entry.step, value: entry.currentValue }]
            })
            const shouldPrune = Pruning.shouldPruneByPercentile(context)

            expect(shouldPrune).toBe(entry.expectedShouldPrune)
          }),
        { discard: true }
      )
    }))
})
