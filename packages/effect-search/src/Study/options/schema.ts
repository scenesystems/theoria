/**
 * Input schemas for validating optimization and resume plan configurations.
 *
 * @since 0.1.0
 */
import { Duration, Option, Predicate, Schedule, Schema } from "effect"

import { DirectionSchema } from "../../contracts/Direction.js"
import { ObjectiveValueSchema } from "../../contracts/ObjectiveValue.js"
import * as Scheduler from "../../Scheduler/index.js"
import * as SearchSpace from "../../SearchSpace/index.js"
import { ObjectiveFunctionSchema } from "../objectiveEvaluator.js"
import { StopModeSchema } from "../runtime/pruning.js"
import { StudySnapshot } from "../snapshot/versioning.js"

const SearchSpaceRuntimeSchema = Schema.declare(
  (input): input is SearchSpace.SearchSpace => input instanceof SearchSpace.SearchSpace,
  {
    identifier: "effect-search/Study/OptimizePlan/SearchSpace"
  }
)

const FunctionRuntimeSchema = Schema.declare(
  Predicate.isFunction,
  {
    identifier: "effect-search/Study/OptimizePlan/Function"
  }
)

const SamplerRuntimeSchema = Schema.Struct({
  kind: Schema.Unknown,
  pendingImputationPolicy: Schema.Unknown,
  acquire: Schema.optional(Schema.Unknown),
  release: Schema.optional(Schema.Unknown),
  suggest: FunctionRuntimeSchema,
  checkpoint: Schema.Unknown,
  restore: FunctionRuntimeSchema
})

const SchedulerRuntimeSchema = Schema.declare(
  (input): input is Scheduler.Scheduler => input instanceof Scheduler.Scheduler,
  {
    identifier: "effect-search/Study/OptimizePlan/Scheduler"
  }
)

const PruningPolicyRuntimeSchema = Schema.Struct({
  name: Schema.String,
  decide: FunctionRuntimeSchema
})

/**
 * Runtime schema that validates a value is a Schedule instance for retry logic.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RetryScheduleRuntimeSchema = Schema.declare(
  (input): input is Schedule.Schedule<unknown, unknown, never> => Schedule.isSchedule(input),
  {
    identifier: "effect-search/Study/OptimizePlan/RetrySchedule"
  }
)

const DurationInputRuntimeSchema = Schema.declare(
  (input): input is Duration.DurationInput => Option.isSome(Duration.decodeUnknown(input)),
  {
    identifier: "effect-search/Study/OptimizePlan/DurationInput"
  }
)

/**
 * Runtime schema for epsilon tolerance values — must be non-negative and finite.
 *
 * @since 0.1.0
 * @category schemas
 */
export const EpsilonRuntimeSchema = Schema.NonNegative.pipe(
  Schema.filter((value) => Number.isFinite(value))
)

const PriorTrialInputSchema = Schema.Struct({
  config: Schema.Unknown,
  value: ObjectiveValueSchema,
  cost: Schema.optional(Schema.Number)
})

/**
 * Input schema for flat (non-scheduler) optimization plans with sampler, space, objective, and all tuning options.
 *
 * @since 0.1.0
 * @category schemas
 */
export const OptimizePlanFlatInputSchema = Schema.Struct({
  space: SearchSpaceRuntimeSchema,
  sampler: SamplerRuntimeSchema,
  objective: ObjectiveFunctionSchema,
  direction: Schema.optional(DirectionSchema),
  directions: Schema.optional(Schema.Array(DirectionSchema)),
  pruningPolicy: Schema.optional(PruningPolicyRuntimeSchema),
  stopMode: Schema.optional(StopModeSchema),
  trials: Schema.Number,
  concurrency: Schema.optional(Schema.Number),
  priorTrials: Schema.optional(Schema.Array(PriorTrialInputSchema)),
  priorWeight: Schema.optional(Schema.Number),
  maxCost: Schema.optional(Schema.Number),
  evaluationsPerTrial: Schema.optional(Schema.Number),
  maxDuration: Schema.optional(DurationInputRuntimeSchema),
  targetValue: Schema.optional(Schema.Number),
  noImprovementWindow: Schema.optional(Schema.Number),
  epsilon: Schema.optional(EpsilonRuntimeSchema),
  retrySchedule: Schema.optional(RetryScheduleRuntimeSchema),
  trialTimeout: Schema.optional(DurationInputRuntimeSchema)
})

/**
 * Input schema for scheduler-based optimization plans using Hyperband or BOHB bracket scheduling.
 *
 * @since 0.1.0
 * @category schemas
 */
export const OptimizePlanScheduledInputSchema = Schema.Struct({
  space: SearchSpaceRuntimeSchema,
  scheduler: SchedulerRuntimeSchema,
  objective: ObjectiveFunctionSchema,
  direction: Schema.optional(DirectionSchema),
  directions: Schema.optional(Schema.Array(DirectionSchema)),
  pruningPolicy: Schema.optional(PruningPolicyRuntimeSchema),
  stopMode: Schema.optional(StopModeSchema),
  concurrency: Schema.optional(Schema.Number),
  priorTrials: Schema.optional(Schema.Array(PriorTrialInputSchema)),
  priorWeight: Schema.optional(Schema.Number),
  maxCost: Schema.optional(Schema.Number),
  evaluationsPerTrial: Schema.optional(Schema.Number),
  maxDuration: Schema.optional(DurationInputRuntimeSchema),
  targetValue: Schema.optional(Schema.Number),
  noImprovementWindow: Schema.optional(Schema.Number),
  epsilon: Schema.optional(EpsilonRuntimeSchema),
  retrySchedule: Schema.optional(RetryScheduleRuntimeSchema),
  trialTimeout: Schema.optional(DurationInputRuntimeSchema)
})

/**
 * Union schema accepting either flat or scheduler-based optimization plan inputs.
 *
 * @since 0.1.0
 * @category schemas
 */
export const OptimizePlanInputSchema = Schema.Union(OptimizePlanFlatInputSchema, OptimizePlanScheduledInputSchema)

/**
 * Input schema for resume plans — extends the flat optimize schema with a required snapshot field.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ResumePlanInputSchema = Schema.extend(
  OptimizePlanFlatInputSchema,
  Schema.Struct({
    snapshot: StudySnapshot
  })
)
