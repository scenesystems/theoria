/**
 * Generated-code normalization for `programOfThought`.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import { Array as Arr, Effect, Option } from "effect"

import { ProgramCodeParseError } from "../../Errors/module.js"

const CODE_BLOCK_PATTERN = /```python[ \n](.*?)[ \n]```?/is
const EMPTY_CODE_MESSAGE = "Error: Empty code after parsing."
const INVALID_CODE_FORMAT_MESSAGE = "Error: Code format is not correct."

const parsedCodeError = (options: {
  readonly attempt: number
  readonly moduleName: string
  readonly rawCode: string
  readonly parsedCode: string
  readonly message: string
}): ProgramCodeParseError =>
  new ProgramCodeParseError({
    message: options.message,
    moduleName: options.moduleName,
    attempt: options.attempt,
    rawCode: options.rawCode,
    parsedCode: options.parsedCode
  })

const sanitizeGeneratedCode = (rawCode: string): string => rawCode.split("---", 1)[0]?.split("\n\n\n", 1)[0] ?? ""

const extractCodeBlock = (code: string): string => {
  const match = CODE_BLOCK_PATTERN.exec(code)
  return match?.[1] ?? code
}

const appendAssignedIdentifier = (code: string): string => {
  const lines = code.split("\n")
  const lastLine = Arr.last(lines)

  return Option.match(lastLine, {
    onNone: () => code,
    onSome: (value) => {
      const match = /^(\w+)\s*=/.exec(value.trim())
      return match !== null && lines.length > 1 ? `${code}\n${match[1]}` : code
    }
  })
}

/**
 * Normalize a generated program body into the executable code string used by
 * the interpreter boundary. Mirrors DSPy's fenced-code extraction and
 * single-line format guards.
 *
 * @since 0.2.0
 * @category combinators
 * @internal
 */
export const parseGeneratedCode = (options: {
  readonly attempt: number
  readonly generatedCode: string
  readonly moduleName: string
}): Effect.Effect<string, ProgramCodeParseError> =>
  Effect.gen(function*() {
    const sanitized = sanitizeGeneratedCode(options.generatedCode)
    const extracted = extractCodeBlock(sanitized)

    if (extracted.length === 0) {
      return yield* Effect.fail(
        parsedCodeError({
          attempt: options.attempt,
          moduleName: options.moduleName,
          rawCode: options.generatedCode,
          parsedCode: extracted,
          message: EMPTY_CODE_MESSAGE
        })
      )
    }

    if (!extracted.includes("\n") && extracted.split("=").length > 2) {
      return yield* Effect.fail(
        parsedCodeError({
          attempt: options.attempt,
          moduleName: options.moduleName,
          rawCode: options.generatedCode,
          parsedCode: extracted,
          message: INVALID_CODE_FORMAT_MESSAGE
        })
      )
    }

    return appendAssignedIdentifier(extracted)
  })
