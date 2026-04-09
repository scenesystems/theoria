import { Either, Option, Schema } from "effect"
import * as SearchStudyEvent from "effect-search/StudyEvent"
import type { StudyEvent } from "effect-search/StudyEvent"

import {
  EffectSearchStudyLaneTelemetry,
  EffectSearchStudySignal,
  EffectSearchStudyTelemetry
} from "./effect-search-study-telemetry.js"
import type { TrialPoint } from "./effect-search.js"

const CoordinateConfigSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number
})

const recentSignalLimit = 3

const formatObjectiveValue = (value: number | ReadonlyArray<number>): string =>
  typeof value === "number"
    ? value.toFixed(6)
    : Option.fromNullable(value.at(0)).pipe(
      Option.match({
        onNone: () => "—",
        onSome: (nextValue) => nextValue.toFixed(6)
      })
    )

const formatConfigPreview = (config: unknown): string =>
  Either.match(Schema.decodeUnknownEither(CoordinateConfigSchema)(config), {
    onLeft: () => "reserved config",
    onRight: ({ x, y }) => `x=${x.toFixed(4)} · y=${y.toFixed(4)}`
  })

const formatBestValue = (trialPoints: ReadonlyArray<TrialPoint>): string =>
  trialPoints.length === 0
    ? "—"
    : Math.min(...trialPoints.map((trialPoint) => trialPoint.value)).toFixed(6)

const signalForEvent = (event: StudyEvent): EffectSearchStudySignal =>
  EffectSearchStudySignal.make(
    SearchStudyEvent.matchStudyEvent({
      TrialStarted: ({ diagnostics, trialNumber, config }) =>
        Option.fromNullable(diagnostics).pipe(
          Option.match({
            onNone: () => ({
              label: `Trial started #${trialNumber}`,
              value: formatConfigPreview(config)
            }),
            onSome: (nextDiagnostics) => ({
              label: `Trial started #${trialNumber}`,
              value: `${formatConfigPreview(config)} · prepared ${
                nextDiagnostics.reusedPreparedState ? "reused" : "fresh"
              }`
            })
          })
        ),
      TrialReported: ({ decision, step, trialNumber, value }) => ({
        label: `Trial reported #${trialNumber}`,
        value: `${value.toFixed(6)} · step ${step} · ${decision._tag}`
      }),
      TrialCompleted: ({ trialNumber, value }) => ({
        label: `Trial completed #${trialNumber}`,
        value: formatObjectiveValue(value)
      }),
      TrialCosted: ({ cost, cumulativeCost, trialNumber }) => ({
        label: `Trial costed #${trialNumber}`,
        value: `${cost.toFixed(3)} cost · ${cumulativeCost.toFixed(3)} cumulative`
      }),
      TrialPruned: ({ policy, reason, step, trialNumber }) => ({
        label: `Trial pruned #${trialNumber}`,
        value: `${policy} · step ${step} · ${reason}`
      }),
      TrialRetried: ({ attempt, error, trialNumber }) => ({
        label: `Trial retried #${trialNumber}`,
        value: `attempt ${attempt} · ${error.message}`
      }),
      TrialCancelled: ({ reason, trialNumber }) => ({
        label: `Trial cancelled #${trialNumber}`,
        value: reason
      }),
      TrialFailed: ({ error, trialNumber }) => ({
        label: `Trial failed #${trialNumber}`,
        value: error.message
      }),
      BestUpdated: ({ trialNumber, value }) => ({
        label: `Best updated #${trialNumber}`,
        value: value.toFixed(6)
      }),
      StudyStopRequested: ({ mode, reason, requestedByTrialNumber }) => ({
        label: `Stop requested by #${requestedByTrialNumber}`,
        value: `${mode} · ${reason}`
      }),
      BracketStarted: ({ bracketIndex, configs, minResource }) => ({
        label: `Bracket started #${bracketIndex}`,
        value: `${configs} configs · min ${minResource}`
      }),
      RoundStarted: ({ bracketIndex, nConfigs, resource, roundIndex }) => ({
        label: `Round started ${bracketIndex}.${roundIndex}`,
        value: `${nConfigs} configs · resource ${resource}`
      }),
      RoundCompleted: ({ bracketIndex, completed, nConfigs, resource, roundIndex }) => ({
        label: `Round completed ${bracketIndex}.${roundIndex}`,
        value: `${completed}/${nConfigs} complete · resource ${resource}`
      }),
      BracketCompleted: ({ bestValue, bracketIndex, rounds }) =>
        Option.fromNullable(bestValue).pipe(
          Option.match({
            onNone: (): EffectSearchStudySignal => ({
              label: `Bracket completed #${bracketIndex}`,
              value: `${rounds} rounds`
            }),
            onSome: (nextBestValue): EffectSearchStudySignal => ({
              label: `Bracket completed #${bracketIndex}`,
              value: `${rounds} rounds · best ${nextBestValue.toFixed(6)}`
            })
          })
        ),
      StudyCompleted: ({ completionReason }) => ({
        label: "Study completed",
        value: completionReason
      })
    })(event)
  )

const laneTelemetry = ({
  events,
  trialPoints
}: {
  readonly events: ReadonlyArray<StudyEvent>
  readonly trialPoints: ReadonlyArray<TrialPoint>
}): EffectSearchStudyLaneTelemetry =>
  EffectSearchStudyLaneTelemetry.make({
    completedTrials: trialPoints.length,
    eventCount: events.length,
    lastSignal: Option.fromNullable(events.at(-1)).pipe(
      Option.match({
        onNone: () => "No study events yet",
        onSome: (event) => signalForEvent(event).label
      })
    ),
    bestValue: formatBestValue(trialPoints),
    recentSignals: events.slice(-recentSignalLimit).map(signalForEvent)
  })

export const projectEffectSearchStudyTelemetry = ({
  randomEvents,
  randomTrialPoints,
  trialBudget,
  tpeEvents,
  tpeTrialPoints
}: {
  readonly randomEvents: ReadonlyArray<StudyEvent>
  readonly randomTrialPoints: ReadonlyArray<TrialPoint>
  readonly trialBudget: number
  readonly tpeEvents: ReadonlyArray<StudyEvent>
  readonly tpeTrialPoints: ReadonlyArray<TrialPoint>
}): EffectSearchStudyTelemetry =>
  EffectSearchStudyTelemetry.make({
    trialBudget,
    tpe: laneTelemetry({ events: tpeEvents, trialPoints: tpeTrialPoints }),
    random: laneTelemetry({ events: randomEvents, trialPoints: randomTrialPoints })
  })
