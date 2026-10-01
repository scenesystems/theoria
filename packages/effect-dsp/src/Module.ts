/**
 * Executable modules, live ownership nodes, and module operations.
 *
 * @since 0.1.0
 * @module
 */
import type * as AiError from "@effect/ai/AiError"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import type * as Tool from "@effect/ai/Tool"
import type * as Toolkit from "@effect/ai/Toolkit"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean, Data, Equivalence, Graph, HashMap, Match, Option, Order, Schema, Tuple } from "effect"
import type { Effect, Record, Ref } from "effect"
import * as Schedule from "effect/Schedule"
import type { Codec as DemonstrationCodec } from "./Demonstration.js"
import type { DspError, ParseOutputError } from "./DspError.js"
import { bestOfN as bestOfNInternal } from "./internal/module/bestOfN/construct.js"
import { chainOfThought as chainOfThoughtInternal } from "./internal/module/chainOfThought/construct.js"
import { toChainOfThoughtSignature as toChainOfThoughtSignatureInternal } from "./internal/module/chainOfThought/schema.js"
import { compose as composeInternal } from "./internal/module/compose/construct.js"
import { composeGraph as composeGraphInternal } from "./internal/module/compose/graph.js"
import {
  discoverModuleGraph as discoverModuleGraphInternal,
  discoverModules as discoverModulesInternal,
  withDiscoveryScope as withDiscoveryScopeInternal
} from "./internal/module/discovery/collect.js"
import { predict as predictInternal } from "./internal/module/predict/construct.js"
import { react as reactInternal } from "./internal/module/react/construct.js"
import { refine as refineInternal } from "./internal/module/refine/construct.js"
import { load as loadInternal, save as saveInternal } from "./internal/module/saveLoad.js"
import type { Result as MetricResult } from "./Metric.js"
import type { ModuleGraph } from "./ModuleGraph.js"
import { ModuleParameters } from "./ModuleParameters.js"
import type { Signature } from "./Signature.js"

/** Validated identity used by module ownership and discovery graphs.
 * @since 0.1.0
 * @category schemas
 */
export const Id = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]*$/),
  Schema.brand("@scenesystems/effect-dsp/Module/Id")
)

/** Branded module identity.
 * @since 0.1.0
 * @category type-level
 */
export type Id = typeof Id.Type

/** Positive number of executions performed by repeated-execution wrappers.
 * @since 0.3.0
 * @category schemas
 */
export const RolloutCount = Schema.Int.pipe(
  Schema.positive(),
  Schema.brand("@scenesystems/effect-dsp/Module/RolloutCount")
)

/** Branded positive rollout count.
 * @since 0.3.0
 * @category type-level
 */
export type RolloutCount = typeof RolloutCount.Type

/** Prompt metadata retained by a live ownership node.
 * @since 0.1.0
 * @category models
 */
export class NodeSignature extends Schema.Class<NodeSignature>("@scenesystems/effect-dsp/Module/NodeSignature")({
  description: Schema.String,
  instructions: Schema.String
}) {}

/** Live ownership view used for composition, optimization, and persistence.
 * @since 0.1.0
 * @category models
 */
export class Node extends Data.Class<{
  readonly moduleId: Id
  readonly name: string
  readonly signature: NodeSignature
  readonly demonstrationCodec: DemonstrationCodec
  readonly params: Ref.Ref<ModuleParameters>
  readonly subModules: HashMap.HashMap<Id, Node>
}> {}

/** One retained child declaration in a normalized live ownership graph.
 * @since 0.4.0
 * @category models
 */
export class Declaration extends Data.Class<{
  readonly declaredId: Id
  readonly child: Node
}> {}

class NormalizationWorklist extends Data.Class<{
  readonly pending: Iterable<Node>
  readonly expanded: Iterable<Node>
}> {}

const nodeIdentity = Equivalence.strict<Node>()
const ownerIdentity = Equivalence.strict<Node["params"]>()
const declarationOrder: Order.Order<Declaration> = Order.mapInput(Order.string, (edge) => edge.declaredId)

/** Materializes recursive ownership into a directed graph without reading parameters.
 * @since 0.4.0
 * @category constructors
 */
export const nodeGraph = (roots: Iterable<Node>): Graph.DirectedGraph<Node, Declaration> =>
  Graph.directed<Node, Declaration>((mutable) => {
    const register = (node: Node) =>
      Option.getOrElse(
        Graph.findNode(mutable, (existing) => ownerIdentity(existing.params, node.params)),
        () => Graph.addNode(mutable, node)
      )
    const initial = Arr.fromIterable(roots)
    Arr.forEach(initial, register)
    Arr.unfold(
      new NormalizationWorklist({ pending: initial, expanded: Arr.empty() }),
      (state) =>
        Option.map(Arr.head(Arr.fromIterable(state.pending)), (node) => {
          const rest = Arr.drop(state.pending, 1)
          return Tuple.make(
            node,
            Boolean.match(Arr.containsWith(nodeIdentity)(state.expanded, node), {
              onTrue: () => new NormalizationWorklist({ pending: rest, expanded: state.expanded }),
              onFalse: () => {
                const source = register(node)
                const declarations = Arr.sort(
                  Arr.map(
                    HashMap.toEntries(node.subModules),
                    ([declaredId, child]) => new Declaration({ declaredId, child })
                  ),
                  declarationOrder
                )
                Arr.forEach(declarations, (declaration) => {
                  Graph.addEdge(mutable, source, register(declaration.child), declaration)
                })
                return new NormalizationWorklist({
                  pending: Arr.appendAll(rest, Arr.map(declarations, (declaration) => declaration.child)),
                  expanded: Arr.append(state.expanded, node)
                })
              }
            })
          )
        })
    )
  })

/** Runtime registration captured while a module executes.
 * @since 0.1.0
 * @category models
 */
export class Registration extends Data.TaggedClass("ModuleRegistration")<{
  readonly id: Id
  readonly params: Ref.Ref<ModuleParameters>
  readonly signature: NodeSignature
  readonly subModuleIds: Schema.Array$<typeof Id>["Type"]
}> {}

/**
 * Captures module parameter values in the version 1 persistence envelope.
 *
 * @remarks
 * Schema decoding accepts only version `1`. {@link load} additionally requires
 * exactly one entry for each name in the target parameter tree and rejects
 * duplicate, missing, or unknown names. Metadata is preserved by the schema but
 * ignored by `load`; `save` omits it.
 *
 * @since 0.1.0
 * @category models
 */
export class SavedState extends Schema.Class<SavedState>("@scenesystems/effect-dsp/Module/SavedState")({
  /** Envelope format version; only `1` is accepted. */
  version: Schema.Literal(1),
  /** Parameter entries matched to a target module tree by exact name. */
  modules: Schema.Array(
    Schema.Struct({
      /** Module name used by persistence matching. */
      name: Schema.String,
      /** Complete parameter value restored into the module ref. */
      params: ModuleParameters
    })
  ),
  /** Caller-defined envelope metadata ignored by module restoration. */
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
}) {}

/**
 * Binds a decoded signature to mutable parameters and an executable operation.
 *
 * @remarks
 * The signature determines compile-time input and output types. `forward` does
 * not promise to decode untrusted input before execution; callers crossing an
 * untyped boundary must decode with `signature.inputSchema`. Each implementation
 * may use a language-model service and any Schema context, and may fail with an
 * AI provider error or package-owned `DspError`.
 *
 * Parameters remain mutable through a `Ref`. The child map records owned nodes
 * for composition, discovery, optimization, and persistence. Operational
 * wrappers include the inner modules whose parameters their execution reads.
 *
 * @typeParam I - Fields defining decoded input and input Schema requirements.
 * @typeParam O - Fields defining decoded output and output Schema requirements.
 * @typeParam E - Additional checked failures from the module implementation.
 * @typeParam R - Additional services required by the module implementation.
 *
 * @since 0.1.0
 * @category models
 */
export class Module<
  I extends Schema.Struct.Fields = Schema.Struct.Fields,
  O extends Schema.Struct.Fields = Schema.Struct.Fields,
  E = never,
  R = never
> extends Data.TaggedClass("Module")<{
  /** Name used by discovery, tracing, and parameter persistence. */
  readonly name: string
  /** Runtime schemas and prompt metadata for this module boundary. */
  readonly signature: Signature<I, O>
  /** Mutable instruction, demonstration, rendering, and generation state. */
  readonly params: Ref.Ref<ModuleParameters>
  /** Child nodes owned for composition and parameter persistence. */
  readonly subModules: HashMap.HashMap<Id, Node>
  /** Executes the module for one already-decoded input value. */
  readonly forward: (
    input: Schema.Schema.Type<Schema.Struct<I>>
  ) => Effect.Effect<
    Schema.Schema.Type<Schema.Struct<O>>,
    AiError.AiError | DspError | E,
    | LanguageModel.LanguageModel
    | Schema.Schema.Context<Schema.Struct<I>>
    | Schema.Schema.Context<Schema.Struct<O>>
    | R
  >
}> {}

/** Scores one module output in the context of its original input.
 * @since 0.1.0
 * @category models
 */
export type RewardFn<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = never,
  R = never
> = (
  input: Schema.Schema.Type<Schema.Struct<I>>,
  output: Schema.Schema.Type<Schema.Struct<O>>
) => Effect.Effect<MetricResult, E, R>

/** Controls repeated candidate generation and score-based selection.
 * @since 0.1.0
 * @category models
 */
export class BestOfNOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ModuleE = never,
  ModuleR = never,
  RewardE = never,
  RewardR = never
> extends Data.Class<{
  readonly name: string
  readonly module: Module<I, O, ModuleE, ModuleR>
  readonly N: RolloutCount
  readonly reward: RewardFn<I, O, RewardE, RewardR>
  readonly threshold?: number
}> {}

/** Output fields added by {@link chainOfThought}.
 * @since 0.1.0
 * @category type-level
 */
export type ChainOfThoughtOutputFields<O extends Schema.Struct.Fields> =
  & O
  & Record.ReadonlyRecord<"reasoning", typeof Schema.String>

/** Live module shape accepted by composition declarations.
 * @since 0.1.0
 * @category models
 */
export class ComposableModule extends Data.Class<{
  readonly name: string
  readonly signature: {
    readonly description: string
    readonly instructions: string
    readonly demonstrationCodec: DemonstrationCodec
  }
  readonly params: Ref.Ref<ModuleParameters>
  readonly subModules: HashMap.HashMap<Id, Node>
}> {}

/** Declares direct modules under caller-local aliases.
 * @since 0.1.0
 * @category models
 */
export type ComposeSubModules = Record.ReadonlyRecord<string, ComposableModule>

/** Carries decoded input and ownership metadata into a composed callback.
 * @since 0.1.0
 * @category models
 */
export class ComposeForwardContext<I extends Schema.Struct.Fields> extends Data.Class<{
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly subModuleNodes: HashMap.HashMap<Id, Node>
  readonly graph: ModuleGraph
}> {}

/** Computes a composed module's output.
 * @since 0.1.0
 * @category models
 */
export type ComposeForward<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = never,
  R = never
> = (
  context: ComposeForwardContext<I>
) => Effect.Effect<
  Schema.Schema.Type<Schema.Struct<O>>,
  AiError.AiError | DspError | E,
  | LanguageModel.LanguageModel
  | Schema.Schema.Context<Schema.Struct<I>>
  | Schema.Schema.Context<Schema.Struct<O>>
  | R
>

/** Declares a composed module's root contract and children.
 * @since 0.1.0
 * @category models
 */
export class ComposeOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = never,
  R = never
> extends Data.Class<{
  readonly name: string
  readonly signature: Signature<I, O>
  readonly subModules: ComposeSubModules
  readonly forward: ComposeForward<I, O, E, R>
}> {}

/** Declares root metadata and direct owners for graph validation.
 * @since 0.1.0
 * @category models
 */
export class ComposeGraphOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> extends Data.Class<{
  readonly name: string
  readonly signature: Signature<I, O>
  readonly subModules: ComposeSubModules
}> {}

/** Builds the schedule applied after text-output parse failures.
 * @since 0.1.0
 * @category models
 */
export type ParseRetryScheduleFactory = (maxRetries: number) => Schedule.Schedule<unknown, unknown, never>

/** Formats one parse failure for the next prompt attempt.
 * @since 0.1.0
 * @category models
 */
export type ParseFeedbackTemplate = (error: ParseOutputError) => string

/** Resolved text-output parse policy.
 * @since 0.1.0
 * @category models
 */
export class ParsePolicy extends Data.Class<{
  readonly maxRetries: number
  readonly retrySchedule: ParseRetryScheduleFactory
  readonly feedbackTemplate: ParseFeedbackTemplate
}> {}

/** Resolved policy used by a predictor.
 * @since 0.1.0
 * @category models
 */
export class PredictPolicy extends Data.Class<{ readonly parse: ParsePolicy }> {}

/** Optional text parse policy replacements.
 * @since 0.1.0
 * @category models
 */
export class ParsePolicyOverrides extends Data.Class<{
  readonly maxRetries?: number
  readonly retrySchedule?: ParseRetryScheduleFactory
  readonly feedbackTemplate?: ParseFeedbackTemplate
}> {}

/** Optional predictor policy replacements.
 * @since 0.1.0
 * @category models
 */
export class PredictPolicyOverrides extends Data.Class<{ readonly parse?: ParsePolicyOverrides }> {}

/** Configures one predictor's text-output policy.
 * @since 0.1.0
 * @category models
 */
export class PredictOptions extends Data.Class<{ readonly policy?: PredictPolicyOverrides }> {}

/** Default maximum additional parse attempts.
 * @since 0.1.0
 * @category constants
 */
export const defaultParseMaxRetries = 3

/** Default initial parse retry delay.
 * @since 0.1.0
 * @category constants
 */
export const defaultParseInitialDelay = "100 millis"

/** Default exponential parse retry multiplier.
 * @since 0.1.0
 * @category constants
 */
export const defaultParseBackoffFactor = 2

const normalizeRetryCount = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Numeric.isFinite, (candidate) => Numeric.max(0, Numeric.floor(candidate))),
    Match.orElse(() => 0)
  )

/** Creates the default exponential parse retry schedule.
 * @since 0.1.0
 * @category constructors
 */
export const defaultParseRetrySchedule: ParseRetryScheduleFactory = (maxRetries) =>
  Schedule.intersect(
    Schedule.exponential(defaultParseInitialDelay, defaultParseBackoffFactor),
    Schedule.recurs(normalizeRetryCount(maxRetries))
  )

const formatFieldDiagnostic = (diagnostic: ParseOutputError["fieldDiagnostics"][number]): string =>
  Arr.join(Arr.make("- ", diagnostic.field, " (", diagnostic.issue, "): ", diagnostic.message), "")

/** Formats parse diagnostics for the next prompt attempt.
 * @since 0.1.0
 * @category constructors
 */
export const defaultParseFeedbackTemplate: ParseFeedbackTemplate = (error) => {
  const diagnostics = Arr.map(error.fieldDiagnostics, formatFieldDiagnostic)
  return Arr.join(
    Arr.appendAll(
      Arr.make(
        Arr.join(
          Arr.make(
            "Parse error (",
            Schema.encodeSync(Schema.NumberFromString)(Option.getOrElse(error.retryCount, () => 0)),
            "): ",
            error.message
          ),
          ""
        ),
        "Field diagnostics:"
      ),
      Option.match(Arr.head(diagnostics), { onNone: () => Arr.of("- none"), onSome: () => diagnostics })
    ),
    "\n"
  )
}

const emptyParsePolicyOverrides = new ParsePolicyOverrides({})
const emptyPredictPolicyOverrides = new PredictPolicyOverrides({})
const resolveParsePolicy = (overrides: ParsePolicyOverrides): ParsePolicy =>
  new ParsePolicy({
    maxRetries: normalizeRetryCount(
      Option.getOrElse(Option.fromNullable(overrides.maxRetries), () => defaultParseMaxRetries)
    ),
    retrySchedule: Option.getOrElse(Option.fromNullable(overrides.retrySchedule), () => defaultParseRetrySchedule),
    feedbackTemplate: Option.getOrElse(Option.fromNullable(overrides.feedbackTemplate), () =>
      defaultParseFeedbackTemplate)
  })

/** Resolves predictor policy overrides against built-in defaults.
 * @since 0.1.0
 * @category constructors
 */
export const makePredictPolicy = (overrides: PredictPolicyOverrides = emptyPredictPolicyOverrides): PredictPolicy =>
  new PredictPolicy({
    parse: resolveParsePolicy(
      Option.getOrElse(Option.fromNullable(overrides.parse), () => emptyParsePolicyOverrides)
    )
  })

/** Default predictor policy.
 * @since 0.1.0
 * @category constants
 */
export const defaultPredictPolicy = makePredictPolicy()

/** Default ReAct model-call cap.
 * @since 0.1.0
 * @category constants
 */
export const defaultReactMaxIterations = 5

/** Configures one tool-capable text-generation loop.
 * @since 0.1.0
 * @category models
 */
export class ReactOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  Tools extends Record.ReadonlyRecord<string, Tool.Any>
> extends Data.Class<{
  readonly name: string
  readonly signature: Signature<I, O>
  readonly toolkit: Toolkit.WithHandler<Tools>
  readonly maxIterations?: number
}> {}

/** Controls a score-and-feedback refinement loop.
 * @since 0.1.0
 * @category models
 */
export class RefineOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ModuleE = never,
  ModuleR = never,
  RewardE = never,
  RewardR = never
> extends Data.Class<{
  readonly name: string
  readonly module: Module<I, O, ModuleE, ModuleR>
  readonly N: RolloutCount
  readonly reward: RewardFn<I, O, RewardE, RewardR>
  readonly threshold: number
}> {}

/** Creates a wrapper selecting the best repeated execution.
 * @since 0.1.0
 * @category constructors
 */
export const bestOfN = bestOfNInternal
/** Creates a predictor with an additional reasoning field.
 * @since 0.1.0
 * @category constructors
 */
export const chainOfThought = chainOfThoughtInternal
/** Extends a signature with the reasoning field.
 * @since 0.1.0
 * @category combinators
 */
export const toChainOfThoughtSignature = toChainOfThoughtSignatureInternal
/** Constructs a module with validated child ownership.
 * @since 0.1.0
 * @category constructors
 */
export const compose = composeInternal
/** Returns a validated ownership graph.
 * @since 0.1.0
 * @category constructors
 */
export const composeGraph = composeGraphInternal
/** Collects the graph observed during an operation.
 * @since 0.1.0
 * @category constructors
 */
export const discoverModuleGraph = discoverModuleGraphInternal
/** Collects module registrations observed during an operation.
 * @since 0.1.0
 * @category constructors
 */
export const discoverModules = discoverModulesInternal
/** Runs an operation in a module discovery scope.
 * @since 0.1.0
 * @category combinators
 */
export const withDiscoveryScope = withDiscoveryScopeInternal
/** Allocates a language-model predictor.
 * @since 0.1.0
 * @category constructors
 */
export const predict = predictInternal
/** Allocates a tool-capable predictor.
 * @since 0.1.0
 * @category constructors
 */
export const react = reactInternal
/** Creates an iterative score-and-feedback wrapper.
 * @since 0.1.0
 * @category constructors
 */
export const refine = refineInternal
/** Restores module parameters from saved state.
 * @since 0.1.0
 * @category persistence
 */
export const load = loadInternal
/** Captures module parameters as saved state.
 * @since 0.1.0
 * @category persistence
 */
export const save = saveInternal
