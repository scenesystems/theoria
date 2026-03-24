import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Ref, Schema } from "effect"

import * as Study from "../../../src/Study/index.js"
import { makeReportRefs, recordIntermediateReport } from "../../../src/Study/runtime/controls.js"
import {
  FixtureRegistryLive,
  loadFixture,
  PercentilePrunerFixtureSchema,
  PruningReportContractFixtureSchema
} from "../../helpers/fixtures.js"
import { decodeTraceValue, makeFixtureEventRuntime, reportSnapshot } from "./helpers.js"

describe("pruning fixture replay contracts", () => {
  it.effect("replays FM-12 Trial.report fixture contracts", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("pruning.report-contract").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknown(PruningReportContractFixtureSchema)(loaded)

      yield* Effect.forEach(
        fixture.payload.cases,
        (entry, index) =>
          Effect.gen(function*() {
            const runtime = yield* makeFixtureEventRuntime()
            const reportRefs = yield* makeReportRefs
            const trialNumber = 400 + index

            yield* Effect.forEach(
              entry.initialReports,
              (initial) =>
                recordIntermediateReport(
                  runtime,
                  reportRefs,
                  trialNumber,
                  Study.neverPruningPolicy,
                  initial.step,
                  decodeTraceValue(initial.value)
                ).pipe(Effect.asVoid),
              { discard: true }
            )

            const result = yield* Effect.either(
              recordIntermediateReport(
                runtime,
                reportRefs,
                trialNumber,
                Study.neverPruningPolicy,
                entry.reportAttempt.step,
                decodeTraceValue(entry.reportAttempt.value)
              )
            )
            const reports = yield* Ref.get(reportRefs.reportsRef)
            const expectedReports = entry.expectedReports.map((report) => ({
              step: report.step,
              value: decodeTraceValue(report.value)
            }))

            expect(reportSnapshot(reports)).toEqual(expectedReports)

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
      const fixture = yield* Schema.decodeUnknown(PercentilePrunerFixtureSchema)(loaded)

      yield* Effect.forEach(
        fixture.payload.cases,
        (entry) =>
          Effect.sync(() => {
            const context = Schema.decodeUnknownSync(Study.PercentilePrunerContextSchema)({
              direction: fixture.payload.direction,
              settings: entry.settings,
              trialNumber: entry.trialNumber,
              step: entry.step,
              history: entry.history.map((trial) => ({
                trialNumber: trial.trialNumber,
                state: trial.state,
                reports: trial.reports.map((report) => ({
                  step: report.step,
                  value: decodeTraceValue(report.value)
                }))
              })),
              currentReports: [{ step: entry.step, value: entry.currentValue }]
            })
            const shouldPrune = Study.shouldPruneByPercentile(context)

            expect(shouldPrune).toBe(entry.expectedShouldPrune)
          }),
        { discard: true }
      )
    }))
})
