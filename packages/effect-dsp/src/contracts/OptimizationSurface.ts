/**
 * Optimizer-facing aliases and projections for module state, traces, and graphs.
 *
 * @since 0.1.0
 */
import { Array as Arr, Option, Schema } from "effect"
import type { ModuleParams } from "./ModuleParams.js"
import { OutputStrategySchema } from "./OutputStrategy.js"

export { Usage as OptimizationObjectiveUsage } from "@effect/ai/Response"

export {
  projectTraceObjectiveProjection as projectOptimizationObjective,
  TraceObjectiveProjection as OptimizationObjectiveSurface
} from "./TraceProjection.js"

export {
  ModuleGraphProjection as OptimizationModuleGraphSurface,
  projectModuleGraph as projectOptimizationModuleGraph
} from "./ModuleGraph.js"

/**
 * Captures module parameters without demonstrations or mutable refs.
 *
 * @remarks
 * Demonstrations are represented only by their count. Optional generation
 * settings use `Option`, which distinguishes omission from numeric zero.
 *
 * @since 0.1.0
 * @category models
 */
export class OptimizationParameterSurface
  extends Schema.Class<OptimizationParameterSurface>("OptimizationParameterSurface")({
    /** Instruction text copied from the module parameters. */
    instructions: Schema.String,
    /** Number of demonstrations in the source parameters. */
    demoCount: Schema.Number,
    /** Resolved parameter value, including the `"auto"` default. */
    outputStrategy: OutputStrategySchema,
    /** Sampling temperature when configured. */
    temperature: Schema.OptionFromSelf(Schema.Number),
    /** Output-token limit when configured. */
    maxTokens: Schema.OptionFromSelf(Schema.Number)
  })
{}

const OptimizationDimensionValue = Schema.Union(Schema.String, Schema.Number)

/**
 * Pairs a stable parameter name with its string or numeric value.
 *
 * @remarks
 * The schema does not restrict names to the built-in projection names.
 *
 * @since 0.1.0
 * @category models
 */
export class OptimizationDimension extends Schema.Class<OptimizationDimension>("OptimizationDimension")({
  /** Parameter name used by the flattened projection. */
  name: Schema.String,
  /** String or number copied from module parameter state. */
  value: OptimizationDimensionValue
}) {}

const optionalDimension = (
  name: string,
  value: Option.Option<number>
) =>
  Option.match(value, {
    onNone: () => Arr.empty<OptimizationDimension>(),
    onSome: (numberValue) => Arr.make(new OptimizationDimension({ name, value: numberValue }))
  })

/**
 * Snapshots the optimizer-visible portion of module parameters.
 *
 * @remarks
 * Demonstration contents are discarded after counting. Undefined generation
 * settings become `Option.none()`, and an absent output strategy becomes `"auto"`.
 *
 * @param params - Parameter value to snapshot.
 * @returns A detached scalar projection with no mutable refs.
 *
 * @since 0.1.0
 * @category combinators
 */
export const projectOptimizationParameters = (params: ModuleParams): OptimizationParameterSurface =>
  new OptimizationParameterSurface({
    instructions: params.instructions,
    demoCount: Arr.length(params.demos),
    outputStrategy: Option.match(Option.fromNullable(params.outputStrategy), {
      onNone: () => "auto",
      onSome: (outputStrategy) => outputStrategy
    }),
    temperature: Option.fromNullable(params.temperature),
    maxTokens: Option.fromNullable(params.maxTokens)
  })

/**
 * Flattens module parameters into ordered string and numeric dimensions.
 *
 * @remarks
 * The first entries are `instructions`, `demoCount`, and `outputStrategy`.
 * Configured `temperature` and `maxTokens` entries follow in that order.
 * Demonstration contents are not included.
 *
 * @param params - Parameter value to flatten.
 * @returns Five or fewer dimensions in stable order.
 *
 * @since 0.1.0
 * @category combinators
 */
export const projectOptimizationDimensions = (params: ModuleParams) => {
  const projection = projectOptimizationParameters(params)

  const required = Arr.make(
    new OptimizationDimension({ name: "instructions", value: projection.instructions }),
    new OptimizationDimension({ name: "demoCount", value: projection.demoCount }),
    new OptimizationDimension({ name: "outputStrategy", value: projection.outputStrategy })
  )

  return Arr.appendAll(
    Arr.appendAll(required, optionalDimension("temperature", projection.temperature)),
    optionalDimension("maxTokens", projection.maxTokens)
  )
}
