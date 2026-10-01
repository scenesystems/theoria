/**
 * Optimization round execution: suggest, evaluate, and promote trials within a bracket.
 *
 * @since 0.1.0
 */
import { Array as Arr, Chunk, Effect, Iterable, Match, Number as Num, Option, Order, Ref, Tuple } from "effect"

import type { Direction } from "../../../../../Direction.js"
import * as OptimizationEvent from "../../../../../OptimizationEvent.js"
import type { Policy } from "../../../../../Pruning.js"
import * as Scheduler from "../../../../../Scheduler.js"
import type { SearchError } from "../../../../../SearchError.js"
import type * as SearchSpace from "../../../../../SearchSpace.js"
import type * as Trial from "../../../../../Trial.js"
import { isNumericCompletedTrialWithConfig, pickBestTrial } from "../../../best.js"
import { appendEvent } from "../../../events.js"
import type { OptimizePlan, OptimizeSettings } from "../../../options/plan.js"
import { type OptimizationRuntime } from "../../bootstrap.js"
import { runConfiguredTrial } from "../../trialExecution.js"
import { suggestByMode } from "../suggest.js"

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
  completed: Iterable<Trial.NumericCompletedTrial<Config>>
) =>
  Arr.sort(
    completed,
    Order.mapInput(directionOrder(direction), (trial: Trial.NumericCompletedTrial<Config>) => trial.state.value)
  )

const replenishmentSlots = (count: number) =>
  Match.value(Num.lessThanOrEqualTo(count, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.makeBy(count, (index) => index))
  )

const roundSummary = <Config>(
  direction: Direction,
  bracketIndex: number,
  roundIndex: number,
  round: Scheduler.Round,
  numericCompleted: Iterable<Trial.NumericCompletedTrial<Config>>
): Scheduler.RoundSummary =>
  new Scheduler.RoundSummary({
    bracketIndex,
    roundIndex,
    nConfigs: round.nConfigs,
    resource: round.resource,
    completed: Iterable.size(numericCompleted),
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
  runtime: OptimizationRuntime<ConfigFor<Space>>,
  pruningPolicy: Policy,
  bracket: Scheduler.Bracket,
  roundIndex: number,
  round: Scheduler.Round,
  configs: Iterable<ConfigFor<Space>>,
  nextRoundSize: number,
  scheduler: Scheduler.Plan,
  trialNumberRef: Ref.Ref<number>,
  completedCountRef: Ref.Ref<number>
) =>
  Effect.gen(function*() {
    yield* appendEvent(
      runtime,
      OptimizationEvent.RoundStarted({
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

    yield* Ref.update(completedCountRef, Num.sum(Arr.length(numericCompleted)))

    const summary = roundSummary(direction, bracket.index, roundIndex, round, numericCompleted)
    const ranked = sortByDirection(direction, numericCompleted)
    const selected = Arr.map(Arr.take(ranked, nextRoundSize), (trial) => trial.config)
    const missing = Num.max(0, Num.subtract(nextRoundSize, Arr.length(selected)))
    const replenishment = yield* Effect.forEach(
      replenishmentSlots(missing),
      () => suggestByMode(options, settings, scheduler, runtime, trialNumberRef, completedCountRef)
    )

    yield* appendEvent(
      runtime,
      OptimizationEvent.RoundCompleted({
        bracketIndex: bracket.index,
        roundIndex,
        nConfigs: round.nConfigs,
        resource: round.resource,
        completed: Arr.length(numericCompleted)
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
  runtime: OptimizationRuntime<ConfigFor<Space>>,
  pruningPolicy: Policy,
  scheduler: Scheduler.Plan,
  bracket: Scheduler.Bracket,
  configs: Iterable<ConfigFor<Space>>,
  roundIndex: number,
  summaries: Chunk.Chunk<Scheduler.RoundSummary>,
  trialNumberRef: Ref.Ref<number>,
  completedCountRef: Ref.Ref<number>
): Effect.Effect<Chunk.Chunk<Scheduler.RoundSummary>, SearchError> =>
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
          completedCountRef
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
              Chunk.append(summaries, summary),
              trialNumberRef,
              completedCountRef
            )
          )
        )
      }
    })
  )
