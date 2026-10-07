/**
 * Text generation and instruction extraction for optimizer-level LLM calls.
 *
 * @since 0.1.0
 */
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { empty, type ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import { Array as Arr, Boolean, Effect, Number as Num, Option, String as Str } from "effect"
import type * as Prompt from "effect/ai/Prompt"
import { RolloutRef } from "../cache/rollout.js"
import { callLmText } from "../lm.js"
import { CurrentRole } from "../modelRole.js"

/** @internal */
export const generateText = Effect.fnUntraced(function*(prompt: Prompt.RawInput, settings: ModelSettings = empty) {
  return yield* callLmText(prompt).pipe(ModelBinder.bind(
    new ModelBinder.Request({
      settings,
      role: yield* CurrentRole,
      rolloutId: yield* RolloutRef
    })
  ))
})

// CPython's str.isspace() set, used by str.strip() and str-pattern \s/\S. It
// differs from JavaScript trim/\s: U+001C-U+001F and U+0085 are whitespace,
// U+FEFF is not. Every member is one UTF-16 code unit.
const pythonWhitespace =
  "\t\n\v\f\r\x1c\x1d\x1e\x1f \x85\xa0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000"
const isPythonSpace = (unit: string): boolean => Str.isNonEmpty(unit) && Str.includes(unit)(pythonWhitespace)
const units = (text: string): ReadonlyArray<string> => Arr.filter(Str.split("")(text), Str.isNonEmpty)

/** Python `str.strip()`. */
const pythonStrip = (text: string): string => {
  const parts = units(text)
  return Option.match(
    Option.all([
      Arr.findFirstIndex(parts, (unit) => Boolean.not(isPythonSpace(unit))),
      Arr.findLastIndex(parts, (unit) => Boolean.not(isPythonSpace(unit)))
    ]),
    { onNone: () => "", onSome: ([start, end]) => Str.slice(start, Num.increment(end))(text) }
  )
}

/** Index of the first Python whitespace unit, i.e. the length of a leading `\S*` run. */
const nonSpaceRun = (text: string): number =>
  Option.getOrElse(Arr.findFirstIndex(units(text), isPythonSpace), () => Str.length(text))

/** Removes a leading `^```\S*\n?` opening fence with any non-space language tag. */
const dropOpeningFence = (response: string): string => {
  const rest = Str.slice(3)(response)
  const afterTag = Str.slice(nonSpaceRun(rest))(rest)
  return Boolean.match(Str.startsWith("\n")(afterTag), {
    onTrue: () => Str.slice(1)(afterTag),
    onFalse: () => afterTag
  })
}

/** Removes a leading `^\S*\n` language tag line, if present. */
const dropLanguageLine = (content: string): string => {
  const tag = nonSpaceRun(content)
  return Boolean.match(Str.startsWith("\n", tag)(content), {
    onTrue: () => Str.slice(Num.increment(tag))(content),
    onFalse: () => content
  })
}

const fence = "```"

const incompleteBlock = (response: string): string => {
  const stripped = pythonStrip(response)
  return Boolean.match(Str.startsWith(fence)(response), {
    onTrue: () => pythonStrip(dropOpeningFence(response)),
    onFalse: () =>
      Boolean.match(Boolean.not(Str.startsWith(fence)(stripped)) && Str.endsWith(fence)(stripped), {
        onTrue: () => pythonStrip(Str.slice(0, -3)(stripped)),
        onFalse: () => stripped
      })
  })
}

/**
 * Extract the new instruction from a reflection reply exactly as GEPA 0.1.4's
 * `InstructionProposalSignature.output_extractor` does.
 *
 * @remarks
 * The instruction spans from the first to the last triple-backtick fence, minus
 * a non-space language tag line, and is stripped with Python whitespace rules.
 * A single or missing fence handles incomplete blocks; otherwise the stripped
 * reply is returned. There is no fallback: an empty reply proposes an empty
 * instruction, as upstream does. Indices are UTF-16 code units; the fence is
 * ASCII, so the extracted text equals Python's code-point slicing.
 *
 * @since 0.1.0
 * @category combinators
 */
export const extractInstruction = (response: string): string => {
  const start = Num.sum(Option.getOrElse(Str.indexOf(fence)(response), () => -1), 3)
  const end = Option.getOrElse(Str.lastIndexOf(fence)(response), () => -1)
  return Boolean.match(Num.isGreaterThanOrEqualTo(start, end), {
    onTrue: () => incompleteBlock(response),
    onFalse: () => pythonStrip(dropLanguageLine(Str.slice(start, end)(response)))
  })
}
