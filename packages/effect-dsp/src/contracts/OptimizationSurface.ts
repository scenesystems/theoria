/**
 * Optimizer-facing aliases and projections for module state, traces, and graphs.
 *
 * @since 0.1.0
 */
import { Array as Arr, Option, Schema } from "effect"
import type { ModuleParams } from "./ModuleParams.js"
import { OutputStrategySchema } from "./OutputStrategy.js"

export { UsageSample as OptimizationObjectiveUsage } from "./Usage.js"

export {
  projectTraceObjectiveProjection as projectOptimizationObjective,
  TraceObjectiveProjection as OptimizationObjectiveSurface
} from "./TraceProjection.js"

export {
  ModuleGraphProjection as OptimizationModuleGraphSurface,
  projectModuleGraph as projectOptimizationModuleGraph
} from "./ModuleGraph.js"

/**
 * Records `effect-search` as the source package for three search operations.
 *
 * @remarks
 * Every field accepts only the literal `"effect-search"`; the value carries no
 * service, implementation, or runtime capability.
 *
 * @since 0.1.0
 * @category models
 */
export class SearchPrimitiveOwnership extends Schema.Class<SearchPrimitiveOwnership>("SearchPrimitiveOwnership")({
  /** Package marker for traversal operations. */
  traversal: Schema.Literal("effect-search"),
  /** Package marker for sampler operations. */
  sampler: Schema.Literal("effect-search"),
  /** Package marker for Pareto operations. */
  pareto: Schema.Literal("effect-search")
}) {}

/**
 * Preconstructed package markers for generic search operations.
 *
 * @since 0.1.0
 * @category constants
 */
export const searchPrimitiveOwnership = new SearchPrimitiveOwnership({
  traversal: "effect-search",
  sampler: "effect-search",
  pareto: "effect-search"
})

/**
 * Records `effect-search` as the source package for DSP search interop operations.
 *
 * @remarks
 * Every field accepts only the literal `"effect-search"`; the value carries no
 * service, implementation, or runtime capability.
 *
 * @since 0.1.0
 * @category models
 */
export class EffectSearchInteropOwnership extends Schema.Class<EffectSearchInteropOwnership>(
  "EffectSearchInteropOwnership"
)({
  /** Package marker for ask/tell operations. */
  askTell: Schema.Literal("effect-search"),
  /** Package marker for Pareto operations. */
  pareto: Schema.Literal("effect-search"),
  /** Package marker for acquisition operations. */
  acquisition: Schema.Literal("effect-search"),
  /** Package marker for progress streams. */
  progress: Schema.Literal("effect-search")
}) {}

/**
 * Preconstructed package markers for DSP search interop operations.
 *
 * @since 0.1.0
 * @category constants
 */
export const effectSearchInteropOwnership = new EffectSearchInteropOwnership({
  askTell: "effect-search",
  pareto: "effect-search",
  acquisition: "effect-search",
  progress: "effect-search"
})

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
): ReadonlyArray<OptimizationDimension> =>
  Option.match(value, {
    onNone: () => [],
    onSome: (numberValue) => [new OptimizationDimension({ name, value: numberValue })]
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
    demoCount: params.demos.length,
    outputStrategy: params.outputStrategy ?? "auto",
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
export const projectOptimizationDimensions = (params: ModuleParams): ReadonlyArray<OptimizationDimension> => {
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
