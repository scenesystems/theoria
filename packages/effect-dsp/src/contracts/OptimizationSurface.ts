/**
 * Deterministic projections that bridge module parameters and traces into
 * the surfaces consumed by optimizer search loops — parameter snapshots,
 * search dimensions, and ownership declarations for `effect-search` primitives.
 *
 * @since 0.1.0
 */
import { Array as Arr, Option, Schema } from "effect"
import type { ModuleParams } from "./ModuleParams.js"
import { OutputStrategySchema } from "./OutputStrategy.js"

export {
  /**
   * Per-call token/cache usage snapshot re-exported under an optimization-domain
   * alias for objective function signatures.
   *
   * @see {@link UsageSample}
   * @since 0.1.0
   * @category models
   */
  UsageSample as OptimizationObjectiveUsage
} from "./Usage.js"

export {
  /**
   * Convert a runtime trace entry into a stable optimization objective payload.
   *
   * @see {@link TraceObjectiveProjection}
   * @since 0.1.0
   * @category combinators
   */
  projectTraceObjectiveProjection as projectOptimizationObjective,
  /**
   * Deterministic trace-entry projection carrying the fields an optimizer's
   * objective function needs — I/O, tokens, timing, and score.
   *
   * @since 0.1.0
   * @category models
   */
  TraceObjectiveProjection as OptimizationObjectiveSurface
} from "./TraceProjection.js"

export {
  /**
   * Pre-computed traversal + lineage analysis of the module composition DAG,
   * re-exported under an optimization-domain alias.
   *
   * @see {@link ModuleGraphProjection}
   * @since 0.1.0
   * @category models
   */
  ModuleGraphProjection as OptimizationModuleGraphSurface,
  /**
   * Project a module composition DAG into deterministic traversal order
   * and root-to-node lineages.
   *
   * @see {@link ModuleGraphProjection}
   * @since 0.1.0
   * @category combinators
   */
  projectModuleGraph as projectOptimizationModuleGraph
} from "./ModuleGraph.js"

/**
 * Schema-level declaration that generic search primitives (traversal,
 * sampling, Pareto filtering) are sourced from `effect-search`. Serves
 * as a machine-readable provenance record — `effect-dsp` owns only the
 * domain-specific objective projections.
 *
 * @see {@link searchPrimitiveOwnership} — canonical instance
 * @see {@link EffectSearchInteropOwnership} — interop-specific variant
 *
 * @since 0.1.0
 * @category models
 */
export class SearchPrimitiveOwnership extends Schema.Class<SearchPrimitiveOwnership>("SearchPrimitiveOwnership")({
  traversal: Schema.Literal("effect-search"),
  sampler: Schema.Literal("effect-search"),
  pareto: Schema.Literal("effect-search")
}) {}

/**
 * Singleton {@link SearchPrimitiveOwnership} instance.
 *
 * @see {@link SearchPrimitiveOwnership}
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
 * Schema-level declaration that ask/tell, Pareto, acquisition, and
 * progress-streaming capabilities are sourced from `effect-search`
 * interop APIs.
 *
 * @see {@link effectSearchInteropOwnership} — canonical instance
 * @see {@link SearchPrimitiveOwnership} — generic search variant
 *
 * @since 0.1.0
 * @category models
 */
export class EffectSearchInteropOwnership extends Schema.Class<EffectSearchInteropOwnership>(
  "EffectSearchInteropOwnership"
)({
  askTell: Schema.Literal("effect-search"),
  pareto: Schema.Literal("effect-search"),
  acquisition: Schema.Literal("effect-search"),
  progress: Schema.Literal("effect-search")
}) {}

/**
 * Singleton {@link EffectSearchInteropOwnership} instance.
 *
 * @see {@link EffectSearchInteropOwnership}
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
 * Snapshot of a module's learnable parameter state projected into scalar
 * dimensions for optimizer search space construction. Separates the
 * searchable surface from the mutable `Ref<ModuleParams>` so optimizers
 * can reason about parameter geometry without runtime references.
 *
 * @see {@link projectOptimizationParameters} — canonical projection function
 * @see {@link ModuleParams} — the source parameter bundle
 *
 * @since 0.1.0
 * @category models
 */
export class OptimizationParameterSurface
  extends Schema.Class<OptimizationParameterSurface>("OptimizationParameterSurface")({
    instructions: Schema.String,
    demoCount: Schema.Number,
    outputStrategy: OutputStrategySchema,
    temperature: Schema.OptionFromSelf(Schema.Number),
    maxTokens: Schema.OptionFromSelf(Schema.Number)
  })
{}

const OptimizationDimensionValue = Schema.Union(Schema.String, Schema.Number)

/**
 * Named scalar value representing one axis of the optimizer's search
 * space. Each dimension captures either a string (e.g. instruction text)
 * or a number (e.g. demo count, temperature).
 *
 * @see {@link projectOptimizationDimensions} — produces these from ModuleParams
 * @see {@link OptimizationParameterSurface} — the parameter snapshot they derive from
 *
 * @since 0.1.0
 * @category models
 */
export class OptimizationDimension extends Schema.Class<OptimizationDimension>("OptimizationDimension")({
  name: Schema.String,
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
 * Snapshot the current {@link ModuleParams} into an immutable
 * {@link OptimizationParameterSurface}. Resolves nullable fields into
 * `Option` so the surface is self-describing.
 *
 * @see {@link OptimizationParameterSurface}
 * @see {@link ModuleParams}
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
 * Decompose {@link ModuleParams} into an array of named
 * {@link OptimizationDimension} values — instructions, demo count,
 * output strategy, and optionally temperature and maxTokens.
 *
 * @see {@link OptimizationDimension}
 * @see {@link projectOptimizationParameters}
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
