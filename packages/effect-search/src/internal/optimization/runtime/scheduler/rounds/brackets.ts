/**
 * Bracket-based optimization execution for Hyperband-style scheduling.
 *
 * @since 0.1.0
 */
import { Array as Arr, Chunk, Effect, Match, Number as Num, Option, Ref } from "effect"

import type { Direction } from "../../../../../Direction.js"
import * as OptimizationEvent from "../../../../../OptimizationEvent.js"
import type { Policy } from "../../../../../Pruning.js"
import * as Scheduler from "../../../../../Scheduler.js"
import type { SearchError } from "../../../../../SearchError.js"
import type * as SearchSpace from "../../../../../SearchSpace.js"
import { betterByDirection } from "../../../best.js"
import { appendEvent } from "../../../events.js"
import type { OptimizePlan, OptimizeSettings } from "../../../options/plan.js"
import { type OptimizationRuntime } from "../../bootstrap.js"
import { suggestByMode } from "../suggest.js"
import { type ConfigFor, runBracketRounds } from "./roundExecution.js"

const bestValueFromSummary = (
  direction: Direction,
  summary: Scheduler.BracketSummary
): Option.Option<number> =>
  Chunk.reduce(
    summary.rounds,
    Option.none<number>(),
    (best, roundSummaryEntry) =>
      Option.fromNullable(roundSummaryEntry.bestValue).pipe(
        Option.flatMap((candidate) =>
          Option.match(best, {
            onNone: () => Option.some(candidate),
            onSome: (currentBest) =>
              Match.value(betterByDirection(direction, candidate, currentBest)).pipe(
                Match.when(true, () => Option.some(candidate)),
                Match.orElse(() => Option.some(currentBest))
              )
          })
        ),
        Option.orElse(() => best)
      )
  )

const runBracketsByIndex = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  direction: Direction,
  runtime: OptimizationRuntime<ConfigFor<Space>>,
  pruningPolicy: Policy,
  scheduler: Scheduler.Plan,
  bracketIndex: number,
  summaries: Chunk.Chunk<Scheduler.BracketSummary>,
  trialNumberRef: Ref.Ref<number>,
  completedCountRef: Ref.Ref<number>
): Effect.Effect<Chunk.Chunk<Scheduler.BracketSummary>, SearchError> =>
  Chunk.get(scheduler.brackets, bracketIndex).pipe(
    Option.match({
      onNone: () => Effect.succeed(summaries),
      onSome: (bracket) =>
        Effect.gen(function*() {
          yield* appendEvent(
            runtime,
            OptimizationEvent.BracketStarted({
              bracketIndex: bracket.index,
              configs: bracket.configs,
              minResource: bracket.minResource
            })
          )

          const initialConfigs = yield* Effect.forEach(
            Arr.makeBy(bracket.configs, (index) => index),
            () => suggestByMode(options, settings, scheduler, runtime, trialNumberRef, completedCountRef)
          )

          const bracketRounds = yield* runBracketRounds(
            options,
            settings,
            direction,
            runtime,
            pruningPolicy,
            scheduler,
            bracket,
            initialConfigs,
            0,
            Chunk.empty(),
            trialNumberRef,
            completedCountRef
          )

          const bracketSummary = new Scheduler.BracketSummary({
            bracketIndex: bracket.index,
            rounds: bracketRounds
          })

          yield* appendEvent(
            runtime,
            OptimizationEvent.BracketCompleted({
              bracketIndex: bracket.index,
              rounds: Chunk.size(bracketRounds),
              ...bestValueFromSummary(direction, bracketSummary).pipe(
                Option.match({
                  onNone: () => ({}),
                  onSome: (bestValue) => ({ bestValue })
                })
              )
            })
          )

          return yield* runBracketsByIndex(
            options,
            settings,
            direction,
            runtime,
            pruningPolicy,
            scheduler,
            Num.increment(bracketIndex),
            Chunk.append(summaries, bracketSummary),
            trialNumberRef,
            completedCountRef
          )
        })
    })
  )

/**
 * Runs all scheduler brackets sequentially, collecting bracket summaries for the final scheduler outcome.
 *
 * @since 0.1.0
 * @category utils
 */
export const runBrackets = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  direction: Direction,
  runtime: OptimizationRuntime<ConfigFor<Space>>,
  pruningPolicy: Policy,
  scheduler: Scheduler.Plan,
  startTrialNumber: number
): Effect.Effect<Chunk.Chunk<Scheduler.BracketSummary>, SearchError> =>
  Effect.gen(function*() {
    const trialNumberRef = yield* Ref.make(startTrialNumber)
    const completedCountRef = yield* Ref.make(0)

    return yield* runBracketsByIndex(
      options,
      settings,
      direction,
      runtime,
      pruningPolicy,
      scheduler,
      0,
      Chunk.empty(),
      trialNumberRef,
      completedCountRef
    )
  })
