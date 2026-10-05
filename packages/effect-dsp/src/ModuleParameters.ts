/**
 * Prompt, demonstration, rendering, and generation settings stored by a module.
 *
 * @since 0.1.0
 * @module
 */
import { ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import { Array as Arr, Boolean, Effect, Match, Number, Option, Schema } from "effect"
import { Demonstration } from "./Demonstration.js"

/** Output rendering policy used by module generation.
 * @since 0.1.0
 * @category schemas
 */
export const OutputStrategy = Schema.Literals(["text", "structured", "auto"])

/** Decoded output rendering policy.
 * @since 0.1.0
 * @category type-level
 */
export type OutputStrategy = typeof OutputStrategy.Type

const ConcreteStrategy = OutputStrategy.pick(["text", "structured"])

/** Resolves automatic output selection from the demonstration count.
 * @since 0.1.0
 * @category combinators
 */
export const resolveStrategy = (strategy: OutputStrategy, demoCount: number): typeof ConcreteStrategy.Type =>
  Match.value(strategy).pipe(
    Match.withReturnType<typeof ConcreteStrategy.Type>(),
    Match.when("auto", () =>
      Boolean.match(Number.isGreaterThan(demoCount, 0), {
        onTrue: () => "text",
        onFalse: () => "structured"
      })),
    Match.when("text", () => "text"),
    Match.when("structured", () => "structured"),
    Match.exhaustive
  )

/**
 * Stores the replaceable state behind each module's parameter `Ref`.
 *
 * @remarks
 * Generation settings share the model settings contract. Token limits are
 * integers; provider-specific range acceptance remains the provider's responsibility.
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleParameters extends Schema.Class<ModuleParameters>("@scenesystems/effect-dsp/ModuleParameters")({
  /** Instruction text included in the system prompt. */
  instructions: Schema.String,
  /** Ordered few-shot demonstrations rendered into text-mode prompts. */
  demos: Schema.Array(Demonstration),
  /** Output rendering policy; omitted encoded values decode to `"auto"`. */
  outputStrategy: OutputStrategy.pipe(
    Schema.withDecodingDefaultTypeKey(Effect.succeed("auto")),
    Schema.withConstructorDefault(Effect.succeed<OutputStrategy>("auto"))
  ),
  /** Optional provider sampling temperature with no contract-level range check. */
  temperature: ModelSettings.fields.temperature,
  /** Optional integer provider output-token limit. */
  maxTokens: ModelSettings.fields.maxTokens
}) {}

/** Projects predictor generation settings for model binding.
 * @since 0.6.0
 * @category getters
 */
export const settings = (params: ModuleParameters): ModelSettings =>
  new ModelSettings({ temperature: params.temperature, maxTokens: params.maxTokens })

/**
 * Creates default parameters with no demonstrations and automatic output selection.
 *
 * @param instructions - Initial instruction text, often derived from a signature.
 * @returns Parameters with empty demonstrations and no generation overrides.
 *
 * @since 0.1.0
 * @category constructors
 */
export const make = (instructions: string): ModuleParameters =>
  new ModuleParameters({
    instructions,
    demos: Arr.empty()
  })

/**
 * Replaces demonstrations while retaining all other module parameters.
 *
 * @remarks
 * The constructor validates the replacement; array identity is not guaranteed.
 *
 * @param params - Existing parameter state.
 * @param demos - Ordered replacement demonstrations.
 * @returns A copy that retains `instructions`, `outputStrategy`, `temperature`, and `maxTokens` from `params`.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withDemos = (
  params: ModuleParameters,
  demos: ModuleParameters["demos"]
): ModuleParameters =>
  new ModuleParameters({
    instructions: params.instructions,
    demos,
    outputStrategy: params.outputStrategy,
    temperature: params.temperature,
    maxTokens: params.maxTokens
  })

/**
 * Replaces instructions and demonstrations while retaining rendering and generation settings.
 *
 * @param params - Existing parameter state.
 * @param demos - Ordered replacement demonstrations, validated by the constructor.
 * @param instructions - Replacement instruction text.
 * @returns A copy that retains `outputStrategy`, `temperature`, and `maxTokens` from `params`.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withDemosAndInstructions = (
  params: ModuleParameters,
  demos: ModuleParameters["demos"],
  instructions: string
): ModuleParameters =>
  new ModuleParameters({
    instructions,
    demos,
    outputStrategy: params.outputStrategy,
    temperature: params.temperature,
    maxTokens: params.maxTokens
  })

/**
 * Replaces instructions while retaining demonstrations and generation settings.
 *
 * @param params - Existing parameter state.
 * @param instructions - Replacement instruction text.
 * @returns A validated parameter value retaining the original demonstrations.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withInstructions = (
  params: ModuleParameters,
  instructions: string
): ModuleParameters =>
  new ModuleParameters({
    instructions,
    demos: params.demos,
    outputStrategy: params.outputStrategy,
    temperature: params.temperature,
    maxTokens: params.maxTokens
  })

/**
 * Immutable optimizer-facing projection of module parameters.
 * @since 0.1.0
 * @category models
 */
export class Projection extends Schema.Class<Projection>("@scenesystems/effect-dsp/ModuleParameters/Projection")({
  instructions: Schema.String,
  demoCount: Schema.Finite,
  outputStrategy: OutputStrategy,
  temperature: Schema.Option(Schema.Finite),
  maxTokens: Schema.Option(Schema.Finite)
}) {}

/**
 * One stable scalar optimization dimension.
 * @since 0.1.0
 * @category models
 */
export class Dimension extends Schema.Class<Dimension>("@scenesystems/effect-dsp/ModuleParameters/Dimension")({
  name: Schema.String,
  value: Schema.Union([Schema.String, Schema.Finite])
}) {}

/**
 * Projects mutable module state to its optimizer-visible scalar surface.
 * @since 0.1.0
 * @category combinators
 */
export const project = (params: ModuleParameters): Projection =>
  new Projection({
    instructions: params.instructions,
    demoCount: Arr.length(params.demos),
    outputStrategy: params.outputStrategy,
    temperature: Option.fromNullishOr(params.temperature),
    maxTokens: Option.fromNullishOr(params.maxTokens)
  })

const optionalDimension = (name: string, value: Option.Option<number>) =>
  Option.match(value, {
    onNone: () => Arr.empty<Dimension>(),
    onSome: (numberValue) => Arr.make(new Dimension({ name, value: numberValue }))
  })

/**
 * Flattens parameters into stable string and numeric dimensions.
 * @since 0.1.0
 * @category combinators
 */
export const dimensions = (params: ModuleParameters) => {
  const projection = project(params)
  const required = Arr.make(
    new Dimension({ name: "instructions", value: projection.instructions }),
    new Dimension({ name: "demoCount", value: projection.demoCount }),
    new Dimension({ name: "outputStrategy", value: projection.outputStrategy })
  )
  return Arr.appendAll(
    Arr.appendAll(required, optionalDimension("temperature", projection.temperature)),
    optionalDimension("maxTokens", projection.maxTokens)
  )
}
