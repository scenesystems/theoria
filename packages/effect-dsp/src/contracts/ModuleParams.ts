/**
 * Learnable parameter bundle carried by every module instance — the mutable
 * state that optimizers search over.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"
import { Option } from "effect"
import { Demo } from "../Example/index.js"
import { OutputStrategySchema } from "./OutputStrategy.js"

/**
 * The mutable state that optimizers manipulate during search. Carries
 * the system-prompt `instructions`, few-shot `demos`, output rendering
 * strategy, and optional LM generation knobs. Each module holds a
 * `Ref<ModuleParams>` that optimizers update between trials.
 *
 * @see {@link makeDefaultModuleParams} — zero-demo seed from a Signature
 * @see {@link OutputStrategySchema} — governs how output is rendered
 * @see {@link withModuleParamsDemos} — replace demos while preserving other fields
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleParams extends Schema.Class<ModuleParams>("ModuleParams")({
  instructions: Schema.String,
  demos: Schema.Array(Demo),
  outputStrategy: Schema.optionalWith(OutputStrategySchema, {
    default: () => "auto"
  }),
  temperature: Schema.optional(Schema.Number),
  maxTokens: Schema.optional(Schema.Number)
}) {}

/**
 * Create a zero-demo {@link ModuleParams} seeded with the given
 * instructions (typically derived from a {@link Signature}).
 *
 * @see {@link ModuleParams}
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeDefaultModuleParams = (instructions: string): ModuleParams =>
  new ModuleParams({
    instructions,
    demos: []
  })

type ModuleParamsPatch = Readonly<{
  readonly instructions?: string
  readonly demos?: ReadonlyArray<Demo>
}>

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
 * Return a copy of {@link ModuleParams} with the `demos` array replaced,
 * preserving instructions, output strategy, and generation knobs. Used by
 * bootstrap optimizers to inject curated few-shot examples.
 *
 * @see {@link ModuleParams}
 *
 * @since 0.1.0
 * @category combinators
 */
export const withModuleParamsDemos = (
  params: ModuleParams,
  demos: ReadonlyArray<Demo>
): ModuleParams => mergeModuleParams(params, { demos })

/**
 * Return a copy of {@link ModuleParams} with both `demos` and `instructions`
 * replaced, preserving output strategy and generation knobs. Used by GEPA
 * and MIPROv2 which co-optimize instructions alongside demonstrations.
 *
 * @see {@link ModuleParams}
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
 * Return a copy of {@link ModuleParams} with `instructions` replaced,
 * preserving demos, output strategy, and generation knobs. Used by
 * instruction-only optimizers that leave demonstrations unchanged.
 *
 * @see {@link ModuleParams}
 *
 * @since 0.1.0
 * @category combinators
 */
export const withModuleParamsInstructions = (
  params: ModuleParams,
  instructions: string
): ModuleParams => mergeModuleParams(params, { instructions })
