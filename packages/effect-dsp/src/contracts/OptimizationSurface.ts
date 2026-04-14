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
  /**
   * Deterministic trace-entry projection carrying the fields an optimizer's
   * objective function needs — I/O, tokens, timing, and score.
   *
   * @since 0.1.0
   * @category models
   */
  TraceObjectiveProjection as OptimizationObjectiveSurface
} from "./TraceProjection.js"

/**
 * Schema-level declaration that generic search primitives (traversal,
 * sampling, Pareto filtering) are sourced from `effect-search`. Serves
 * as a machine-readable provenance record — `effect-dsp` owns only the
 * domain-specific objective projections.
 *
 * @see {@link SearchPrimitiveOwnership.effectSearch} — canonical instance
 * @see {@link EffectSearchInteropOwnership} — interop-specific variant
 *
 * @since 0.1.0
 * @category models
 */
export class SearchPrimitiveOwnership extends Schema.Class<SearchPrimitiveOwnership>("SearchPrimitiveOwnership")({
  traversal: Schema.Literal("effect-search"),
  sampler: Schema.Literal("effect-search"),
  pareto: Schema.Literal("effect-search")
}) {
  /**
   * Canonical ownership record for generic search primitives sourced from `effect-search`.
   *
   * @since 0.1.0
   * @category constants
   */
  static readonly effectSearch = SearchPrimitiveOwnership.make({
    traversal: "effect-search",
    sampler: "effect-search",
    pareto: "effect-search"
  })
}

/**
 * Schema-level declaration that ask/tell, Pareto, acquisition, and
 * progress-streaming capabilities are sourced from `effect-search`
 * interop APIs.
 *
 * @see {@link EffectSearchInteropOwnership.effectSearch} — canonical instance
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
}) {
  /**
   * Canonical ownership record for `effect-search` interop capabilities.
   *
   * @since 0.1.0
   * @category constants
   */
  static readonly effectSearch = EffectSearchInteropOwnership.make({
    askTell: "effect-search",
    pareto: "effect-search",
    acquisition: "effect-search",
    progress: "effect-search"
  })
}

/**
 * Snapshot of a module's learnable parameter state projected into scalar
 * dimensions for optimizer search space construction. Separates the
 * searchable surface from the mutable `Ref<ModuleParams>` so optimizers
 * can reason about parameter geometry without runtime references.
 *
 * @see {@link OptimizationParameterSurface.fromModuleParams} — canonical projection function
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
{
  /**
   * Snapshot the current {@link ModuleParams} into an immutable
   * {@link OptimizationParameterSurface}. Resolves nullable fields into
   * `Option` so the surface is self-describing.
   *
   * @since 0.1.0
   * @category combinators
   */
  static fromModuleParams(params: ModuleParams): OptimizationParameterSurface {
    return OptimizationParameterSurface.make({
      instructions: params.instructions,
      demoCount: params.demos.length,
      outputStrategy: params.outputStrategy ?? "auto",
      temperature: Option.fromNullable(params.temperature),
      maxTokens: Option.fromNullable(params.maxTokens)
    })
  }
}

const OptimizationDimensionValue = Schema.Union(Schema.String, Schema.Number)

/**
 * Named scalar value representing one axis of the optimizer's search
 * space. Each dimension captures either a string (e.g. instruction text)
 * or a number (e.g. demo count, temperature).
 *
 * @see {@link OptimizationDimension.fromModuleParams} — produces these from ModuleParams
 * @see {@link OptimizationParameterSurface} — the parameter snapshot they derive from
 *
 * @since 0.1.0
 * @category models
 */
export class OptimizationDimension extends Schema.Class<OptimizationDimension>("OptimizationDimension")({
  name: Schema.String,
  value: OptimizationDimensionValue
}) {
  /**
   * Lift an optional numeric parameter into a deterministic dimension list.
   *
   * @since 0.2.0
   * @category constructors
   */
  static fromOptionalNumber(options: {
    readonly name: string
    readonly value: Option.Option<number>
  }): ReadonlyArray<OptimizationDimension> {
    return Option.match(options.value, {
      onNone: () => [],
      onSome: (numberValue) => [OptimizationDimension.make({ name: options.name, value: numberValue })]
    })
  }

  /**
   * Decompose {@link ModuleParams} into an array of named
   * {@link OptimizationDimension} values — instructions, demo count,
   * output strategy, and optionally temperature and maxTokens.
   *
   * @since 0.1.0
   * @category combinators
   */
  static fromModuleParams(params: ModuleParams): ReadonlyArray<OptimizationDimension> {
    const projection = OptimizationParameterSurface.fromModuleParams(params)

    const required = Arr.make(
      OptimizationDimension.make({ name: "instructions", value: projection.instructions }),
      OptimizationDimension.make({ name: "demoCount", value: projection.demoCount }),
      OptimizationDimension.make({ name: "outputStrategy", value: projection.outputStrategy })
    )

    return Arr.appendAll(
      Arr.appendAll(
        required,
        OptimizationDimension.fromOptionalNumber({
          name: "temperature",
          value: projection.temperature
        })
      ),
      OptimizationDimension.fromOptionalNumber({
        name: "maxTokens",
        value: projection.maxTokens
      })
    )
  }
}
