/**
 * Single round execution: suggest, evaluate, and promote trials within a bracket.
 *
 * @since 0.1.0
 */
import { Array as Arr, Chunk, Effect, Match, Number as Num, Option, Order, Ref, Tuple } from "effect"

import type { Direction } from "../../../../../Direction.js"
import type { Policy } from "../../../../../Pruning.js"
import * as Scheduler from "../../../../../Scheduler.js"
import type { SearchError } from "../../../../../SearchError.js"
import type * as SearchSpace from "../../../../../SearchSpace.js"
import * as StudyEvent from "../../../../../StudyEvent.js"
import type * as Trial from "../../../../../Trial.js"
import { isNumericCompletedTrialWithConfig, pickBestTrial } from "../../../best.js"
import { appendEvent } from "../../../events.js"
import type { OptimizePlan, OptimizeSettings } from "../../../options/plan.js"
import { type StudyRuntime } from "../../runtimeState.js"
import { runConfiguredTrial } from "../../trialExecution.js"
import { SchedulerObservation, suggestByMode } from "../suggest.js"

/**
 * @since 0.1.0
 * @category type-level
 */
export type ConfigFor<Space extends SearchSpace.SearchSpace> = SearchSpace.Type<Space>

const directionOrder = (direction: Direction): Order.Order<number> =>
  Match.value(direction).pipe(
    Match.when("minimize", () => Order.number),
    Match.when("maximize", () => Order.reverse(Order.number)),
    Match.exhaustive
  )

const nextTrialNumber = (ref: Ref.Ref<number>): Effect.Effect<number> =>
  Ref.modify(ref, (current) => Tuple.make(current, Num.increment(current)))

const sortByDirection = <Config>(
  direction: Direction,
  completed: ReadonlyArray<Trial.NumericCompletedTrial<Config>>
): ReadonlyArray<Trial.NumericCompletedTrial<Config>> =>
  Arr.sort(
    completed,
    Order.mapInput(directionOrder(direction), (trial: Trial.NumericCompletedTrial<Config>) => trial.state.value)
  )

const replenishmentSlots = (count: number): ReadonlyArray<number> =>
  Match.value(Num.lessThanOrEqualTo(count, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.makeBy(count, (index) => index))
  )

const roundSummary = <Config>(
  direction: Direction,
  bracketIndex: number,
  roundIndex: number,
  round: Scheduler.Round,
  numericCompleted: ReadonlyArray<Trial.NumericCompletedTrial<Config>>
): Scheduler.RoundSummary =>
  new Scheduler.RoundSummary({
    bracketIndex,
    roundIndex,
    nConfigs: round.nConfigs,
    resource: round.resource,
    completed: numericCompleted.length,
    ...pickBestTrial(direction, numericCompleted).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (trial) => ({ bestValue: trial.state.value })
      })
    )
  })

const runRound = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  direction: Direction,
  runtime: StudyRuntime<ConfigFor<Space>>,
  pruningPolicy: Policy,
  bracket: Scheduler.Bracket,
  roundIndex: number,
  round: Scheduler.Round,
  configs: ReadonlyArray<ConfigFor<Space>>,
  nextRoundSize: number,
  scheduler: Scheduler.Plan,
  trialNumberRef: Ref.Ref<number>,
  observationRef: Ref.Ref<Array<SchedulerObservation<ConfigFor<Space>>>>
): Effect.Effect<
  readonly [Scheduler.RoundSummary, ReadonlyArray<ConfigFor<Space>>],
  SearchError,
  never
> =>
  Effect.gen(function*() {
    yield* appendEvent(
      runtime,
      StudyEvent.roundStarted({
        bracketIndex: bracket.index,
        roundIndex,
        nConfigs: round.nConfigs,
        resource: round.resource
      })
    )

    const finalizedTrials = yield* Effect.forEach(configs, (config) =>
      Effect.gen(function*() {
        const trialNumber = yield* nextTrialNumber(trialNumberRef)
        return yield* runConfiguredTrial(
          options,
          settings,
          pruningPolicy,
          trialNumber,
          config,
          runtime,
          Option.some(round.resource)
        )
      }), { concurrency: settings.concurrency })

    const executedTrials = Arr.filterMap(finalizedTrials, (trialOption) => trialOption)
    const numericCompleted = Arr.filter(
      executedTrials,
      (trial): trial is Trial.NumericCompletedTrial<ConfigFor<Space>> => isNumericCompletedTrialWithConfig(trial)
    )

    yield* Ref.update(observationRef, (existing) =>
      Arr.appendAll(
        existing,
        Arr.map(
          numericCompleted,
          (trial) =>
            new SchedulerObservation({
              trialNumber: trial.trialNumber,
              config: trial.config,
              value: trial.state.value,
              resource: round.resource
            })
        )
      ))

    const summary = roundSummary(direction, bracket.index, roundIndex, round, numericCompleted)
    const ranked = sortByDirection(direction, numericCompleted)
    const selected = Arr.map(Arr.take(ranked, nextRoundSize), (trial) => trial.config)
    const missing = Num.max(0, nextRoundSize - selected.length)
    const replenishment = yield* Effect.forEach(
      replenishmentSlots(missing),
      () => suggestByMode(options, settings, scheduler, runtime, trialNumberRef, observationRef)
    )

    yield* appendEvent(
      runtime,
      StudyEvent.roundCompleted({
        bracketIndex: bracket.index,
        roundIndex,
        nConfigs: round.nConfigs,
        resource: round.resource,
        completed: numericCompleted.length
      })
    )

    return Tuple.make(summary, Arr.appendAll(selected, replenishment))
  })

/**
 * Recursively executes rounds within a bracket, promoting the top-performing configs to the next round.
 *
 * @since 0.1.0
 * @category utils
 */
export const runBracketRounds = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  direction: Direction,
  runtime: StudyRuntime<ConfigFor<Space>>,
  pruningPolicy: Policy,
  scheduler: Scheduler.Plan,
  bracket: Scheduler.Bracket,
  configs: ReadonlyArray<ConfigFor<Space>>,
  roundIndex: number,
  summaries: ReadonlyArray<Scheduler.RoundSummary>,
  trialNumberRef: Ref.Ref<number>,
  observationRef: Ref.Ref<Array<SchedulerObservation<ConfigFor<Space>>>>
): Effect.Effect<ReadonlyArray<Scheduler.RoundSummary>, SearchError> =>
  Chunk.get(bracket.rounds, roundIndex).pipe(
    Option.match({
      onNone: () => Effect.succeed(summaries),
      onSome: (round) => {
        const nextRoundSize = Chunk.get(bracket.rounds, Num.increment(roundIndex)).pipe(
          Option.match({
            onNone: () => 0,
            onSome: (nextRound) => nextRound.nConfigs
          })
        )

        return runRound(
          options,
          settings,
          direction,
          runtime,
          pruningPolicy,
          bracket,
          roundIndex,
          round,
          configs,
          nextRoundSize,
          scheduler,
          trialNumberRef,
          observationRef
        ).pipe(
          Effect.flatMap(([summary, nextConfigs]) =>
            runBracketRounds(
              options,
              settings,
              direction,
              runtime,
              pruningPolicy,
              scheduler,
              bracket,
              nextConfigs,
              Num.increment(roundIndex),
              Arr.append(summaries, summary),
              trialNumberRef,
              observationRef
            )
          )
        )
      }
    })
  )
