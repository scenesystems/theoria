/**
 * Prompt, demonstration, rendering, and generation settings stored by a module.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"
import { Option } from "effect"
import { Demo } from "../Example/index.js"
import { OutputStrategySchema } from "./OutputStrategy.js"

/**
 * Stores the replaceable state behind each module's parameter `Ref`.
 *
 * @remarks
 * Numeric generation settings are passed through without range or integer
 * validation. Provider-specific acceptance remains the provider's responsibility.
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleParams extends Schema.Class<ModuleParams>("ModuleParams")({
  /** Instruction text included in the system prompt. */
  instructions: Schema.String,
  /** Ordered few-shot demonstrations rendered into text-mode prompts. */
  demos: Schema.Array(Demo),
  /** Output rendering policy; omitted encoded values decode to `"auto"`. */
  outputStrategy: Schema.optionalWith(OutputStrategySchema, {
    default: () => "auto"
  }),
  /** Optional provider sampling temperature with no contract-level range check. */
  temperature: Schema.optional(Schema.Number),
  /** Optional provider output-token limit with no contract-level integer or range check. */
  maxTokens: Schema.optional(Schema.Number)
}) {}

/**
 * Creates default parameters with no demonstrations and automatic output selection.
 *
 * @param instructions - Initial instruction text, often derived from a signature.
 * @returns Parameters with empty demonstrations and no generation overrides.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeDefaultModuleParams = (instructions: string): ModuleParams =>
  new ModuleParams({
    instructions,
    demos: []
  })

class ModuleParamsPatch extends Data.Class<{
  readonly instructions?: string
  readonly demos?: ReadonlyArray<Demo>
}> {}

const optionalNumberField = (
  key: "temperature" | "maxTokens",
  value: Option.Option<number>
): Readonly<Record<string, number>> =>
  Option.match(value, {
    onNone: () => ({}),
    onSome: (numberValue) => ({ [key]: numberValue })
  })

const mergeModuleParams = (
  params: ModuleParams,
  patch: ModuleParamsPatch
): ModuleParams =>
  new ModuleParams({
    instructions: patch.instructions ?? params.instructions,
    demos: patch.demos ?? params.demos,
    outputStrategy: params.outputStrategy,
    ...optionalNumberField("temperature", Option.fromNullable(params.temperature)),
    ...optionalNumberField("maxTokens", Option.fromNullable(params.maxTokens))
  })

/**
 * Replaces demonstrations while retaining all other module parameters.
 *
 * @remarks
 * The returned value retains the supplied array; demonstrations are not cloned.
 *
 * @param params - Existing parameter state.
 * @param demos - Ordered replacement demonstrations.
 * @returns A copy that retains `instructions`, `outputStrategy`, `temperature`, and `maxTokens` from `params`.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withModuleParamsDemos = (
  params: ModuleParams,
  demos: ReadonlyArray<Demo>
): ModuleParams => mergeModuleParams(params, { demos })

/**
 * Replaces instructions and demonstrations while retaining rendering and generation settings.
 *
 * @param params - Existing parameter state.
 * @param demos - Ordered replacement demonstrations, retained without cloning.
 * @param instructions - Replacement instruction text.
 * @returns A copy that retains `outputStrategy`, `temperature`, and `maxTokens` from `params`.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withModuleParamsDemosAndInstructions = (
  params: ModuleParams,
  demos: ReadonlyArray<Demo>,
  instructions: string
): ModuleParams =>
  mergeModuleParams(params, {
    demos,
    instructions
  })

/**
 * Replaces instructions while retaining demonstrations and generation settings.
 *
 * @param params - Existing parameter state.
 * @param instructions - Replacement instruction text.
 * @returns A new parameter value sharing the original demonstrations array.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withModuleParamsInstructions = (
  params: ModuleParams,
  instructions: string
): ModuleParams => mergeModuleParams(params, { instructions })
