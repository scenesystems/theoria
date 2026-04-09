/**
 * Bracket-based successive halving execution for Hyperband-style scheduling.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Match, Number as Num, Option, Ref } from "effect"

import type { Direction } from "../../../../contracts/Direction.js"
import type { SearchError } from "../../../../Errors/index.js"
import * as Scheduler from "../../../../Scheduler/index.js"
import type * as SearchSpace from "../../../../SearchSpace/index.js"
import * as StudyEvent from "../../../../StudyEvent/index.js"
import { betterByDirection } from "../../../best.js"
import { appendEvent } from "../../../events.js"
import type { ObjectiveEvaluator } from "../../../objectiveEvaluator.js"
import type { OptimizePlan, OptimizeSettings } from "../../../options.js"
import type { PruningPolicy } from "../../pruning.js"
import { type StudyClock, type StudyRuntime } from "../../runtimeState.js"
import type { SchedulerObservation } from "../suggest.js"
import { suggestByMode } from "../suggest.js"
import { type ConfigFor, runBracketRounds } from "./roundExecution.js"

const bestValueFromSummary = (
  direction: Direction,
  summary: Scheduler.BracketSummary
): Option.Option<number> =>
  Arr.reduce(
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
  runtime: StudyRuntime<ConfigFor<Space>>,
  pruningPolicy: PruningPolicy,
  scheduler: Scheduler.Scheduler,
  bracketIndex: number,
  summaries: ReadonlyArray<Scheduler.BracketSummary>,
  trialNumberRef: Ref.Ref<number>,
  observationRef: Ref.Ref<Array<SchedulerObservation<ConfigFor<Space>>>>
): Effect.Effect<ReadonlyArray<Scheduler.BracketSummary>, SearchError, StudyClock | ObjectiveEvaluator> =>
  Arr.get(scheduler.brackets, bracketIndex).pipe(
    Option.match({
      onNone: () => Effect.succeed(summaries),
      onSome: (bracket) =>
        Effect.gen(function*() {
          yield* appendEvent(
            runtime,
            StudyEvent.BracketStarted.make({
              bracketIndex: bracket.index,
              configs: bracket.configs,
              minResource: bracket.minResource
            })
          )

          const initialConfigs = yield* Effect.forEach(
            Arr.makeBy(bracket.configs, (index) => index),
            () => suggestByMode(options, settings, scheduler, runtime, trialNumberRef, observationRef)
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
            Arr.empty<Scheduler.RoundSummary>(),
            trialNumberRef,
            observationRef
          )

          const bracketSummary = new Scheduler.BracketSummary({
            bracketIndex: bracket.index,
            rounds: bracketRounds
          })

          yield* appendEvent(
            runtime,
            StudyEvent.BracketCompleted.make({
              bracketIndex: bracket.index,
              rounds: bracketRounds.length,
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
            Arr.append(summaries, bracketSummary),
            trialNumberRef,
            observationRef
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
  runtime: StudyRuntime<ConfigFor<Space>>,
  pruningPolicy: PruningPolicy,
  scheduler: Scheduler.Scheduler,
  startTrialNumber: number
): Effect.Effect<ReadonlyArray<Scheduler.BracketSummary>, SearchError, StudyClock | ObjectiveEvaluator> =>
  Effect.gen(function*() {
    const trialNumberRef = yield* Ref.make(startTrialNumber)
    const observationRef = yield* Ref.make(Arr.empty<SchedulerObservation<ConfigFor<Space>>>())

    return yield* runBracketsByIndex(
      options,
      settings,
      direction,
      runtime,
      pruningPolicy,
      scheduler,
      0,
      Arr.empty<Scheduler.BracketSummary>(),
      trialNumberRef,
      observationRef
    )
  })
