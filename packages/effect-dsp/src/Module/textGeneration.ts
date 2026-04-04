/**
 * Text generation and instruction extraction for optimizer-level LLM calls.
 *
 * @since 0.1.0
 */
import { Option } from "effect"

export {
  /**
   * Send a prompt to the configured language model and return the raw text
   * response. Adapter over the internal LM boundary — useful for
   * optimizer-level LLM calls outside the predict runtime.
   *
   * @since 0.1.0
   * @category combinators
   */
  callLmText as generateText
} from "../internal/lm.js"

/**
 * Extract an instruction block from an LLM response.
 *
 * Looks for content wrapped in triple-backtick fences. Falls back to
 * the trimmed full response when no fences are found, or to the
 * provided `fallback` when the response is empty.
 *
 * @since 0.1.0
 * @category combinators
 */
export const extractInstruction = (response: string, fallback: string): string => {
  const backtickPattern = /```(?:\w*\n)?([\s\S]*?)```/
  const match = backtickPattern.exec(response)
  const extracted = Option.fromNullable(match?.[1]?.trim())
  return Option.match(extracted, {
    onNone: () => response.trim().length > 0 ? response.trim() : fallback,
    onSome: (instruction) => instruction.length > 0 ? instruction : fallback
  })
}
