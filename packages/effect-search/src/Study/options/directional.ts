/**
 * Direction-aware option constructors for single and multi-objective studies.
 *
 * @since 0.1.0
 */
import type { Duration } from "effect"
import { Effect, Predicate, Schema } from "effect"

import { type Direction } from "../../contracts/Direction.js"
import { InvalidStudyConfig } from "../../Errors/index.js"
import type * as Sampler from "../../Sampler/index.js"
import type * as Scheduler from "../../Scheduler/index.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import { type ObjectiveFunction } from "../objectiveEvaluator.js"
import {
  type OptimizeOptions,
  type OptimizePlan,
  OptimizePlanFlatInputSchema,
  optimizePlanFromOptions,
  OptimizePlanScheduledInputSchema,
  type PriorTrial,
  type RetrySchedule
} from "../options.js"
import type { PruningPolicy, StopMode } from "../runtime/pruning.js"

const DirectionlessFlatInputSchema = OptimizePlanFlatInputSchema.omit("direction", "directions")
const DirectionlessScheduledInputSchema = OptimizePlanScheduledInputSchema.omit("direction", "directions")

/**
 * Schema-first request shape for directional convenience combinators.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DirectionalOptimizeRequestSchema = Schema.Union(
  DirectionlessFlatInputSchema,
  DirectionlessScheduledInputSchema
)

/**
 * @since 0.1.0
 * @category type-level
 */
export type DirectionlessFlatOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> = {
  readonly space: Space
  readonly sampler: Sampler.Sampler
  readonly trials: number
} & {
  readonly objective: ObjectiveFunction<Config>
  readonly pruningPolicy?: PruningPolicy
  readonly stopMode?: StopMode
  readonly concurrency?: number
  readonly priorTrials?: ReadonlyArray<PriorTrial<Config>>
  readonly priorWeight?: number
  readonly maxCost?: number
  readonly evaluationsPerTrial?: number
  readonly maxDuration?: Duration.DurationInput
  readonly targetValue?: number
  readonly noImprovementWindow?: number
  readonly epsilon?: number
  readonly retrySchedule?: RetrySchedule
  readonly trialTimeout?: Duration.DurationInput
}

/**
 * @since 0.1.0
 * @category type-level
 */
export type DirectionlessScheduledOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> = {
  readonly space: Space
  readonly scheduler: Scheduler.Scheduler
} & {
  readonly objective: ObjectiveFunction<Config>
  readonly pruningPolicy?: PruningPolicy
  readonly stopMode?: StopMode
  readonly concurrency?: number
  readonly priorTrials?: ReadonlyArray<PriorTrial<Config>>
  readonly priorWeight?: number
  readonly maxCost?: number
  readonly evaluationsPerTrial?: number
  readonly maxDuration?: Duration.DurationInput
  readonly targetValue?: number
  readonly noImprovementWindow?: number
  readonly epsilon?: number
  readonly retrySchedule?: RetrySchedule
  readonly trialTimeout?: Duration.DurationInput
}

/**
 * @since 0.1.0
 * @category type-level
 */
export type DirectionalOptimizeOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> = DirectionlessFlatOptions<Config, Space> | DirectionlessScheduledOptions<Config, Space>

/**
 * @since 0.1.0
 * @category type-level
 */
export type MinimizeOptionsFromSpace<Space extends SearchSpace.SearchSpace> = DirectionalOptimizeOptions<
  SearchSpace.Type<Space>,
  Space
>

/**
 * @since 0.1.0
 * @category type-level
 */
export type MaximizeOptionsFromSpace<Space extends SearchSpace.SearchSpace> = DirectionalOptimizeOptions<
  SearchSpace.Type<Space>,
  Space
>

const directionalDecodeFailure = (direction: Direction): InvalidStudyConfig =>
  new InvalidStudyConfig({
    reason: `Study.${direction} options failed schema decode`
  })

const decodeDirectionalShape = <Config, Space extends SearchSpace.SearchSpace>(
  options: DirectionalOptimizeOptions<Config, Space>,
  direction: Direction
): Effect.Effect<void, InvalidStudyConfig> =>
  Schema.decodeUnknown(DirectionalOptimizeRequestSchema)(options).pipe(
    Effect.mapError(() => directionalDecodeFailure(direction)),
    Effect.asVoid
  )

const isScheduledDirectionalOptions = <Config, Space extends SearchSpace.SearchSpace>(
  options: DirectionalOptimizeOptions<Config, Space>
): options is DirectionlessScheduledOptions<Config, Space> => Predicate.hasProperty(options, "scheduler")

const withDirection = <Config, Space extends SearchSpace.SearchSpace>(
  options: DirectionalOptimizeOptions<Config, Space>,
  direction: Direction
): OptimizeOptions<Config, Space> =>
  isScheduledDirectionalOptions(options)
    ? { ...options, direction }
    : { ...options, direction }

const optimizePlanFromDirectionalOptions = <Space extends SearchSpace.SearchSpace>(
  options: DirectionalOptimizeOptions<SearchSpace.Type<Space>, Space>,
  direction: Direction
): Effect.Effect<OptimizePlan<SearchSpace.Type<Space>, Space>, InvalidStudyConfig> =>
  decodeDirectionalShape(options, direction).pipe(
    Effect.flatMap(() => optimizePlanFromOptions(withDirection(options, direction)))
  )

/**
 * @since 0.1.0
 * @category utils
 */
export const minimizePlanFromOptions = <Space extends SearchSpace.SearchSpace>(
  options: MinimizeOptionsFromSpace<Space>
): Effect.Effect<OptimizePlan<SearchSpace.Type<Space>, Space>, InvalidStudyConfig> =>
  optimizePlanFromDirectionalOptions(options, "minimize")

/**
 * @since 0.1.0
 * @category utils
 */
export const maximizePlanFromOptions = <Space extends SearchSpace.SearchSpace>(
  options: MaximizeOptionsFromSpace<Space>
): Effect.Effect<OptimizePlan<SearchSpace.Type<Space>, Space>, InvalidStudyConfig> =>
  optimizePlanFromDirectionalOptions(options, "maximize")
