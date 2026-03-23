/**
 * Controls how a module renders its output prompt and parses the LM response.
 *
 * @since 0.0.0
 */
import { Match, Schema } from "effect"

/**
 * Tri-state schema governing module output rendering:
 *
 * - **`"auto"`** (default) — text format with `[[ ## field ## ]]` delimiters
 *   when demonstrations are present (optimization context), provider-native
 *   `generateObject` otherwise (direct inference).
 * - **`"text"`** — always emit DSPy-compatible `[[ ## field ## ]]` delimiters.
 * - **`"structured"`** — always use `generateObject` with the output Schema.
 *
 * @see {@link resolveStrategy} — resolves `"auto"` into a concrete mode
 * @see {@link ModuleParams} — carries the active strategy per module
 *
 * @since 0.0.0
 * @category schemas
 */
export const OutputStrategySchema = Schema.Literal("text", "structured", "auto")

/**
 * Inferred runtime type of {@link OutputStrategySchema}.
 *
 * @see {@link OutputStrategySchema}
 * @since 0.0.0
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
 * Collapse the tri-state {@link OutputStrategy} into a concrete `"text"` or
 * `"structured"` mode. When the strategy is `"auto"`, the presence of
 * demonstrations (demoCount > 0) selects text mode so that few-shot examples
 * appear in the prompt; zero demos selects structured mode for schema-guided
 * generation.
 *
 * @see {@link OutputStrategySchema} — the source schema
 *
 * @since 0.0.0
 * @category utils
 */
export const resolveStrategy = (strategy: OutputStrategy, demoCount: number): "text" | "structured" =>
  Match.value(strategy).pipe(
    Match.withReturnType<"text" | "structured">(),
    Match.when("auto", () => resolveAutoStrategy(demoCount)),
    Match.orElse((value) => value)
  )
