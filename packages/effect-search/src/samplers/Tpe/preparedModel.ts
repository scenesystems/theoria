/**
 * Prepared model context for TPE model-driven suggestion.
 *
 * @since 0.3.0
 */
import { Array as Arr, Data, Effect, Equal, Option, Tuple } from "effect"
import type { PrimitiveChoice } from "../../contracts/Distribution.js"
import type { TrialSplit } from "../../internal/tpe/splitTrials.js"

import { type SuggestCompletedTrial, type SuggestContext } from "../../Sampler/index.js"
import { PreparedSuggestionState, SuggestionDiagnostics } from "../../Sampler/preparation.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import { enrichCompletedTrialsWithConstraints } from "./constraints/enrich.js"
import { numericValuesForParameter, primitiveValuesForParameter } from "./dimensions/values.js"
import type { TpeConstraintEvaluator } from "./options.js"
import { splitByObjectiveSpec } from "./split/index.js"

const PREPARED_TPE_STATE_KIND = "effect-search/tpe/model-context"

/**
 * Parameter-local observation summaries reused across prepared TPE asks.
 *
 * @since 0.3.0
 * @category models
 */
export class PreparedTpeParameterObservations extends Data.Class<{
  readonly name: string
  readonly belowNumeric: ReadonlyArray<number>
  readonly aboveNumeric: ReadonlyArray<number>
  readonly belowPrimitive: ReadonlyArray<PrimitiveChoice>
  readonly abovePrimitive: ReadonlyArray<PrimitiveChoice>
}> {}

/**
 * Prepared TPE model inputs derived from one materialized suggestion context.
 *
 * @since 0.3.0
 * @category models
 */
export class PreparedTpeModelContext extends Data.Class<{
  readonly completed: ReadonlyArray<SuggestCompletedTrial>
  readonly split: TrialSplit
  readonly parameterObservations: ReadonlyArray<PreparedTpeParameterObservations>
}> {}

const isPreparedTpeModelContext = (value: unknown): value is PreparedTpeModelContext =>
  value instanceof PreparedTpeModelContext

const diagnosticsForPreparedContext = (
  context: SuggestContext,
  split: TrialSplit,
  reusedPreparedState: boolean
): SuggestionDiagnostics =>
  SuggestionDiagnostics.fromContext(
    "Tpe",
    PREPARED_TPE_STATE_KIND,
    reusedPreparedState,
    context,
    split.below.length,
    split.above.length
  )

const sameCompletedObservation = (
  left: SuggestCompletedTrial,
  right: SuggestCompletedTrial
): boolean =>
  Equal.equals(left.trialNumber, right.trialNumber) &&
  Equal.equals(left.config, right.config) &&
  Equal.equals(left.value, right.value) &&
  Equal.equals(Option.fromNullable(left.observationWeight), Option.fromNullable(right.observationWeight)) &&
  Equal.equals(Option.fromNullable(left.cost), Option.fromNullable(right.cost)) &&
  Equal.equals(Option.fromNullable(left.variance), Option.fromNullable(right.variance))

const reusePreparedCompletedTrial = (
  prepared: PreparedTpeModelContext,
  trial: SuggestCompletedTrial
): SuggestCompletedTrial =>
  Arr.findFirst(prepared.completed, (candidate) => sameCompletedObservation(candidate, trial)).pipe(
    Option.getOrElse(() => trial)
  )

const parameterObservationsForSplit = (
  space: SearchSpace.SearchSpace,
  split: TrialSplit
): ReadonlyArray<PreparedTpeParameterObservations> =>
  Arr.map(
    space.params,
    (parameter) =>
      new PreparedTpeParameterObservations({
        name: parameter.name,
        belowNumeric: numericValuesForParameter(parameter, split.below),
        aboveNumeric: numericValuesForParameter(parameter, split.above),
        belowPrimitive: primitiveValuesForParameter(parameter, split.below),
        abovePrimitive: primitiveValuesForParameter(parameter, split.above)
      })
  )

const buildPreparedTpeModelContext = (
  space: SearchSpace.SearchSpace,
  context: SuggestContext,
  completed: ReadonlyArray<SuggestCompletedTrial>
): PreparedTpeModelContext => {
  const split = splitByObjectiveSpec(completed, context.objectiveSpec, context.epsilon)

  return new PreparedTpeModelContext({
    completed,
    split,
    parameterObservations: parameterObservationsForSplit(space, split)
  })
}

const rebuildPreparedTpeModelContext = (
  space: SearchSpace.SearchSpace,
  context: SuggestContext,
  constraints: ReadonlyArray<TpeConstraintEvaluator>,
  previousPrepared: Option.Option<PreparedTpeModelContext>
): Effect.Effect<PreparedTpeModelContext, never> =>
  enrichCompletedTrialsWithConstraints(
    Option.match(previousPrepared, {
      onNone: () => context.completed,
      onSome: (prepared) => Arr.map(context.completed, (trial) => reusePreparedCompletedTrial(prepared, trial))
    }),
    constraints
  ).pipe(
    Effect.map((completed) => buildPreparedTpeModelContext(space, context, completed))
  )

/**
 * Prepares model-driven TPE inputs from the current suggestion context.
 *
 * @since 0.3.0
 * @category constructors
 */
export const prepareTpeModelContext = (
  space: SearchSpace.SearchSpace,
  context: SuggestContext,
  constraints: ReadonlyArray<TpeConstraintEvaluator>,
  previous: Option.Option<PreparedSuggestionState>
): Effect.Effect<readonly [PreparedSuggestionState, SuggestionDiagnostics], never> =>
  Option.filter(
    previous,
    (candidate) => candidate.kind === PREPARED_TPE_STATE_KIND && isPreparedTpeModelContext(candidate.state)
  ).pipe(
    Option.match({
      onNone: () =>
        rebuildPreparedTpeModelContext(space, context, constraints, Option.none()).pipe(
          Effect.map((prepared) =>
            Tuple.make(
              new PreparedSuggestionState({
                kind: PREPARED_TPE_STATE_KIND,
                context,
                state: prepared
              }),
              diagnosticsForPreparedContext(context, prepared.split, false)
            )
          )
        ),
      onSome: (candidate) =>
        preparedTpeModelContext(candidate).pipe(
          Option.match({
            onNone: () => Effect.dieMessage("tpe prepared suggestion state narrowed to a non-TPE payload unexpectedly"),
            onSome: (prepared) =>
              Equal.equals(candidate.context, context)
                ? Effect.succeed(Tuple.make(
                  candidate,
                  diagnosticsForPreparedContext(context, prepared.split, true)
                ))
                : rebuildPreparedTpeModelContext(space, context, constraints, Option.some(prepared)).pipe(
                  Effect.map((rebuilt) =>
                    Tuple.make(
                      new PreparedSuggestionState({
                        kind: PREPARED_TPE_STATE_KIND,
                        context,
                        state: rebuilt
                      }),
                      diagnosticsForPreparedContext(context, rebuilt.split, true)
                    )
                  )
                )
          })
        )
    })
  )

/**
 * Extracts the prepared TPE model context when a sampler-prepared state matches the TPE driver.
 *
 * @since 0.3.0
 * @category guards
 */
export const preparedTpeModelContext = (
  prepared: PreparedSuggestionState
): Option.Option<PreparedTpeModelContext> =>
  prepared.kind === PREPARED_TPE_STATE_KIND && isPreparedTpeModelContext(prepared.state)
    ? Option.some(prepared.state)
    : Option.none()

/**
 * Looks up cached parameter-local observation summaries from a prepared TPE context.
 *
 * @since 0.3.0
 * @category guards
 */
export const preparedTpeParameterObservations = (
  prepared: Option.Option<PreparedTpeModelContext>,
  parameterName: string
): Option.Option<PreparedTpeParameterObservations> =>
  Option.flatMap(
    prepared,
    (context) => Arr.findFirst(context.parameterObservations, (observations) => observations.name === parameterName)
  )
