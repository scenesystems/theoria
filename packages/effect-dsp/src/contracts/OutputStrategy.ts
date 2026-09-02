/**
 * Controls how a module renders its output prompt and parses the LM response.
 *
 * @since 0.1.0
 */
import { Match, Schema } from "effect"

/**
 * Decodes the three output-rendering policies accepted by module parameters.
 *
 * @remarks
 * `"text"` requests delimiter-based text generation and parsing. `"structured"`
 * requests provider-native object generation with the output Schema. `"auto"`
 * defers the choice until the module knows its demonstration count.
 *
 * @since 0.1.0
 * @category schemas
 */
export const OutputStrategySchema = Schema.Literal("text", "structured", "auto")

/**
 * Selects an output-rendering policy decoded by {@link OutputStrategySchema}.
 * @since 0.1.0
 * @category type-level
 */
export type OutputStrategy = Schema.Schema.Type<typeof OutputStrategySchema>

const resolveAutoStrategy = (demoCount: number): "text" | "structured" =>
  Match.value(demoCount).pipe(
    Match.withReturnType<"text" | "structured">(),
    Match.when((count) => count > 0, () => "text"),
    Match.orElse(() => "structured")
  )

/**
 * Resolves an output policy before a module invokes the language model.
 *
 * @remarks
 * Explicit text and structured policies ignore `demoCount`. Automatic selection
 * uses text when `demoCount` is greater than zero and structured output for zero
 * or negative values.
 *
 * @param strategy - Configured rendering policy.
 * @param demoCount - Number of demonstrations available to an automatic policy.
 * @returns A concrete generation and parsing mode.
 *
 * @since 0.1.0
 * @category combinators
 */
export const resolveStrategy = (strategy: OutputStrategy, demoCount: number): "text" | "structured" =>
  Match.value(strategy).pipe(
    Match.withReturnType<"text" | "structured">(),
    Match.when("auto", () => resolveAutoStrategy(demoCount)),
    Match.orElse((value) => value)
  )
