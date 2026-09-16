/**
 * Text generation and instruction extraction for optimizer-level LLM calls.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean, Option, String as Str } from "effect"

export { callLmText as generateText } from "../lm.js"

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
  const nonEmpty = (text: string): boolean => Boolean.not(Str.isEmpty(text))
  const fullResponse = Option.liftPredicate(nonEmpty)(Str.trim(response))
  const extracted = Str.match(backtickPattern)(response).pipe(
    Option.flatMap((match) => Arr.get(match, 1)),
    Option.map(Str.trim)
  )
  return Option.match(extracted, {
    onNone: () => Option.getOrElse(fullResponse, () => fallback),
    onSome: (instruction) => Option.getOrElse(Option.liftPredicate(nonEmpty)(instruction), () => fallback)
  })
}
