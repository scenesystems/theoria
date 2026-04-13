/**
 * Rubric metric for the implementation-strategy coding surface.
 *
 * @since 0.2.0
 */
import { Array as Arr, Effect, Option, Predicate } from "effect"

import * as Metric from "../../../Metric/index.js"
import * as Execution from "../execution/index.js"

type Signal = Readonly<{
  readonly label: string
  readonly fragments: ReadonlyArray<string>
}>

const normalize = (text: string): string => text.toLowerCase()

const labels = (signals: ReadonlyArray<Signal>): string => Arr.join(Arr.map(signals, (signal) => signal.label), ", ")

const includesAny = (text: string, fragments: ReadonlyArray<string>): boolean =>
  Arr.some(fragments, (fragment) => text.includes(fragment))

const fieldText = (record: Readonly<Record<string, unknown>>, field: string): string =>
  Option.getOrElse(
    Option.fromNullable(record[field]).pipe(Option.filter(Predicate.isString)),
    () => ""
  )

const fixtureIdFromMetadata = (record: Readonly<Record<string, unknown>>): Option.Option<string> =>
  Option.fromNullable(record.fixtureId).pipe(Option.filter(Predicate.isString))

const requiredSignals: ReadonlyArray<Signal> = [
  { label: "source of truth", fragments: Arr.make("source of truth") },
  { label: "exact product derivation", fragments: Arr.make("exact product", "exact products") },
  { label: "real authority seam", fragments: Arr.make("real seam", "noun and mechanism", "noun/mechanism") },
  { label: "anti-widening guidance", fragments: Arr.make("avoid widening", "do not widen") },
  { label: "anti-helper guidance", fragments: Arr.make("avoid helper", "no helper", "helper indirection") },
  { label: "anti-witness guidance", fragments: Arr.make("sidecar witness", "avoid witness", "witnesses") }
]

const forbiddenSignals: ReadonlyArray<Signal> = [
  { label: "helper alias plan", fragments: Arr.make("introduce helper", "helper aliases") },
  { label: "witness type plan", fragments: Arr.make("witness type", "witness symbol") },
  { label: "broadening plan", fragments: Arr.make("broaden declarations", "shared record families") },
  { label: "overload detour", fragments: Arr.make("add overload", "overload dispatch") },
  {
    label: "intermediate authority layer",
    fragments: Arr.make("intermediate runtime product", "intermediate authority", "intermediate representation")
  }
]

/**
 * Extracts the canonical `strategy` field text from a metric payload.
 *
 * @since 0.2.0
 * @category constructors
 */
export const strategyText = (record: Readonly<Record<string, unknown>>): string => fieldText(record, "strategy")

const missingRequiredSignals = (predictedStrategy: string): ReadonlyArray<Signal> =>
  Arr.filter(requiredSignals, (signal) => !includesAny(predictedStrategy, signal.fragments))

const forbiddenSignalHits = (predictedStrategy: string): ReadonlyArray<Signal> =>
  Arr.filter(forbiddenSignals, (signal) => includesAny(predictedStrategy, signal.fragments))

/**
 * Rubric metric for canonical implementation-strategy outputs.
 *
 * @since 0.2.0
 * @category constructors
 */
export const rubricMetric = Metric.fromEffect("strategy-rubric", (prediction, expected) =>
  Effect.sync(() => {
    const predictedStrategy = normalize(strategyText(prediction))
    const expectedStrategy = strategyText(expected)
    const missingSignals = missingRequiredSignals(predictedStrategy)
    const forbiddenHits = forbiddenSignalHits(predictedStrategy)
    const alignment = (requiredSignals.length - missingSignals.length) / requiredSignals.length
    const penalty = forbiddenHits.length / forbiddenSignals.length
    const score = Math.max(0, Math.min(1, alignment * (1 - penalty)))
    const feedbackSegments = Arr.append(
      Arr.appendAll(
        missingSignals.length === 0 ? Arr.empty<string>() : Arr.make(`Missing: ${labels(missingSignals)}`),
        forbiddenHits.length === 0 ? Arr.empty<string>() : Arr.make(`Forbidden moves: ${labels(forbiddenHits)}`)
      ),
      `Target strategy: ${expectedStrategy}`
    )

    return new Metric.Result({
      score,
      feedback: Arr.join(feedbackSegments, " | ")
    })
  }))

/**
 * Execution-backed implementation-strategy metric using checked-in repo fixtures.
 *
 * @since 0.2.0
 * @category constructors
 */
export const executionBackedMetric = Metric.fromEffectContextual(
  "strategy-execution",
  (context) =>
    Effect.gen(function*() {
      const predictedStrategy = normalize(strategyText(context.prediction))
      const rubricResult = yield* rubricMetric.scoreContext(context)
      const fixtureId = Option.getOrElse(
        fixtureIdFromMetadata(context.metadata),
        () => Execution.COUNTER_ITEMS_EXECUTION_FIXTURE_ID
      )
      const shouldApplyPatch = missingRequiredSignals(predictedStrategy).length === 0 &&
        forbiddenSignalHits(predictedStrategy).length === 0
      const harness = yield* Execution.runCodingExecutionReplayHarness({
        fixtureId,
        applyPatch: shouldApplyPatch
      })

      return new Metric.Result({
        score: harness.judge.score,
        feedback: Arr.join(
          Arr.append(
            shouldApplyPatch
              ? Arr.make(harness.judge.feedback)
              : Arr.make(`Strategy not execution-ready | ${harness.judge.feedback}`),
            rubricResult.feedback ?? ""
          ).filter((segment) => segment.length > 0),
          " | "
        )
      })
    })
)
