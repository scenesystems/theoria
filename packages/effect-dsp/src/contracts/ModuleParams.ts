/**
 * Prompt, demonstration, rendering, and generation settings stored by a module.
 *
 * @since 0.1.0
 */
import { Array as Arr, Schema } from "effect"
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
export const withModuleParamsDemos = (
  params: ModuleParams,
  demos: ModuleParams["demos"]
): ModuleParams => new ModuleParams({ ...params, demos })

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
export const withModuleParamsDemosAndInstructions = (
  params: ModuleParams,
  demos: ModuleParams["demos"],
  instructions: string
): ModuleParams => new ModuleParams({ ...params, demos, instructions })

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
export const withModuleParamsInstructions = (
  params: ModuleParams,
  instructions: string
): ModuleParams => new ModuleParams({ ...params, instructions })
