/** Cooperative Effect Schema tuple/array interpreter. @internal */

import { Array as Arr, Effect, MutableRef, Option, ParseResult, type SchemaAST } from "effect"

import {
  appendMutable,
  type EncodeState,
  failResult,
  holdSemanticResult,
  type Parse,
  runAnnotatedTasks,
  scan,
  type SemanticResult
} from "./schema-encode-model.js"
import {
  computeTupleFailure,
  computeTupleResult,
  failTuple,
  parseTupleElement,
  scanTuple,
  TupleResultState,
  TupleState
} from "./schema-encode-tuple-state.js"

export const parseTuple = (
  ast: SchemaAST.TupleType,
  input: unknown,
  parse: Parse,
  direction: "Decode" | "Encode",
  options: SchemaAST.ParseOptions,
  cooperation: EncodeState
): Effect.Effect<SemanticResult> => {
  if (!Arr.isArray(input)) return Effect.succeed(failResult(new ParseResult.Type(ast, input)))

  return Effect.suspend(() => {
    const state = new TupleState()
    const allErrors = options?.errors === "all"
    const required: Array<SchemaAST.OptionalType | SchemaAST.Type> = []
    const length = input.length

    return Effect.map(
      Effect.gen(function*() {
        yield* scan(cooperation, 0, (index) => index < ast.elements.length, (index) =>
          Effect.sync(() => {
            const element = Arr.unsafeGet(ast.elements, index)
            if (!element.isOptional) appendMutable(required, element)
          }))
        yield* scan(cooperation, 1, (index) => index < ast.rest.length, (index) =>
          Effect.sync(() => {
            appendMutable(required, Arr.unsafeGet(ast.rest, index))
          }))

        yield* scanTuple(length, required.length, state, cooperation, (index) =>
          Effect.sync(() =>
            failTuple(
              ast,
              input,
              state,
              new ParseResult.Pointer(index, input, new ParseResult.Missing(Arr.unsafeGet(required, index - length))),
              allErrors
            )
          ))

        if (ast.rest.length === 0) {
          const expectedParts: Array<string> = []
          yield* scan(cooperation, 0, (index) => index < ast.elements.length, (index) =>
            Effect.sync(() => {
              appendMutable(expectedParts, String(index))
            }))
          const expected = expectedParts.join(" | ")
          yield* scanTuple(ast.elements.length, length, state, cooperation, (index) =>
            Effect.sync(() =>
              failTuple(
                ast,
                input,
                state,
                new ParseResult.Pointer(
                  index,
                  input,
                  new ParseResult.Unexpected(input[index], `is unexpected, expected: ${expected || "never"}`)
                ),
                allErrors
              )
            ))
        }

        yield* scanTuple(0, ast.elements.length, state, cooperation, (index) => {
          const element = Arr.unsafeGet(ast.elements, index)
          return index < length
            ? parseTupleElement(
              ast,
              input,
              state,
              parse,
              element.type,
              index,
              options,
              direction,
              allErrors,
              cooperation
            )
            : Effect.void
        })

        const rest = Arr.head(ast.rest)
        if (Option.isSome(rest)) {
          const tailLength = ast.rest.length - 1
          const restEnd = length - tailLength
          yield* scanTuple(
            ast.elements.length,
            restEnd,
            state,
            cooperation,
            (index) =>
              parseTupleElement(
                ast,
                input,
                state,
                parse,
                rest.value.type,
                index,
                options,
                direction,
                allErrors,
                cooperation
              )
          )

          const tailStart = Math.max(ast.elements.length, restEnd)
          yield* scanTuple(0, tailLength, state, cooperation, (offset) => {
            const index = tailStart + offset
            return index < length
              ? parseTupleElement(
                ast,
                input,
                state,
                parse,
                Arr.unsafeGet(ast.rest, offset + 1).type,
                index,
                options,
                direction,
                allErrors,
                cooperation
              )
              : Effect.void
          })
        }

        const failure = MutableRef.get(state.failure)
        if (Option.isSome(failure)) {
          return holdSemanticResult(
            computeTupleFailure(ast, input, failure.value, state.output, cooperation)
          )
        }
        if (state.tasks.length === 0) {
          return holdSemanticResult(
            computeTupleResult(
              ast,
              input,
              new TupleResultState(state.errors, state.output),
              cooperation
            )
          )
        }

        const tasks = state.tasks
        const initialErrors = state.errors
        const initialOutput = state.output
        return holdSemanticResult(Effect.suspend(() => {
          const runtime = new TupleResultState(initialErrors, initialOutput)
          return Effect.flatMap(
            runAnnotatedTasks(ast, tasks, (run) => run(runtime)),
            () => computeTupleResult(ast, input, runtime, cooperation)
          )
        }))
      }),
      (value) => value.result
    )
  })
}
