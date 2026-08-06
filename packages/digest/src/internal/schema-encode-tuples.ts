/** Cooperative Effect Schema tuple/array interpreter. @internal */

import { Array as Arr, Effect, Either, MutableList, MutableRef, Option, ParseResult, type SchemaAST } from "effect"

import {
  type EncodeState,
  failResult,
  holdSemanticResult,
  indexed,
  type Parse,
  runAnnotatedTasks,
  scan,
  type SemanticResult
} from "./schema-encode-model.js"

type Entry<A> = readonly [number, A]

class TupleResultState {
  errors: Array<Entry<ParseResult.ParseIssue>>
  output: Array<Entry<unknown>>

  constructor(errors: Array<Entry<ParseResult.ParseIssue>>, output: Array<Entry<unknown>>) {
    this.errors = errors
    this.output = output
  }
}

type Task = (state: TupleResultState) => Effect.Effect<void, ParseResult.ParseIssue>

class TupleState {
  readonly errors = MutableList.empty<Entry<ParseResult.ParseIssue>>()
  readonly output = MutableList.empty<Entry<unknown>>()
  readonly tasks = MutableList.empty<Task>()
  readonly failure = MutableRef.make(Option.none<ParseResult.ParseIssue>())
  readonly stepKey = MutableRef.make(0)
}

const nextKey = (state: TupleState): number => {
  const key = MutableRef.get(state.stepKey)
  MutableRef.set(state.stepKey, key + 1)
  return key
}

const output = (state: { readonly output: Iterable<Entry<unknown>> }): Array<unknown> =>
  indexed(Arr.fromIterable(state.output))

const fail = (
  ast: SchemaAST.TupleType,
  input: ReadonlyArray<unknown>,
  state: TupleState,
  issue: ParseResult.ParseIssue,
  allErrors: boolean
): void => {
  if (allErrors) void MutableList.append(state.errors, [nextKey(state), issue])
  else MutableRef.set(state.failure, Option.some(new ParseResult.Composite(ast, input, issue, output(state))))
}

const succeed = (state: TupleState, value: unknown): void => {
  void MutableList.append(state.output, [nextKey(state), value])
}

const task = (
  ast: SchemaAST.TupleType,
  input: ReadonlyArray<unknown>,
  state: TupleState,
  parsed: SemanticResult,
  index: number,
  allErrors: boolean
): void => {
  const key = nextKey(state)
  MutableList.append(state.tasks, (runtime) =>
    Effect.flatMap(Effect.either(parsed), (result) => {
      if (Either.isRight(result)) {
        runtime.output = Arr.append(runtime.output, [key, result.right])
        return Effect.void
      }
      const issue = new ParseResult.Pointer(index, input, result.left)
      if (allErrors) {
        runtime.errors = Arr.append(runtime.errors, [key, issue])
        return Effect.void
      }
      return Effect.fail(new ParseResult.Composite(ast, input, issue, output(runtime)))
    }))
}

const parseElement = (
  ast: SchemaAST.TupleType,
  input: ReadonlyArray<unknown>,
  state: TupleState,
  parse: Parse,
  child: SchemaAST.AST,
  index: number,
  options: SchemaAST.ParseOptions,
  direction: "Decode" | "Encode",
  allErrors: boolean
): Effect.Effect<void> =>
  Effect.map(parse(child, input[index], direction, options), (parsed) => {
    Option.match(Option.fromNullable(ParseResult.eitherOrUndefined(parsed)), {
      onNone: () => task(ast, input, state, parsed, index, allErrors),
      onSome: (synchronous) => {
        if (Either.isRight(synchronous)) return succeed(state, synchronous.right)
        fail(ast, input, state, new ParseResult.Pointer(index, input, synchronous.left), allErrors)
      }
    })
  })

const scanTuple = (
  from: number,
  until: number,
  state: TupleState,
  cooperation: EncodeState,
  body: (index: number) => Effect.Effect<void>
): Effect.Effect<void> =>
  scan(cooperation, from, (index) => index < until && Option.isNone(MutableRef.get(state.failure)), body)

const computeResult = (
  ast: SchemaAST.TupleType,
  input: ReadonlyArray<unknown>,
  state: TupleResultState
): SemanticResult => {
  const errors = indexed(state.errors)
  return Arr.isNonEmptyReadonlyArray(errors)
    ? failResult(new ParseResult.Composite(ast, input, errors, output(state)))
    : Either.right(output(state))
}

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
    const required = Arr.appendAll(
      Arr.filter(ast.elements, (element) => !element.isOptional),
      Arr.drop(ast.rest, 1)
    )
    const length = input.length

    return Effect.map(
      Effect.gen(function*() {
        yield* scanTuple(length, required.length, state, cooperation, (index) =>
          Effect.sync(() =>
            fail(
              ast,
              input,
              state,
              new ParseResult.Pointer(index, input, new ParseResult.Missing(Arr.unsafeGet(required, index - length))),
              allErrors
            )
          ))

        if (ast.rest.length === 0) {
          const expected = Arr.join(Arr.map(ast.elements, (_, index) => String(index)), " | ")
          yield* scanTuple(ast.elements.length, length, state, cooperation, (index) =>
            Effect.sync(() =>
              fail(
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
            ? parseElement(ast, input, state, parse, element.type, index, options, direction, allErrors)
            : Effect.void
        })

        const rest = Arr.head(ast.rest)
        if (Option.isSome(rest)) {
          const tail = Arr.drop(ast.rest, 1)
          const restEnd = length - tail.length
          yield* scanTuple(
            ast.elements.length,
            restEnd,
            state,
            cooperation,
            (index) => parseElement(ast, input, state, parse, rest.value.type, index, options, direction, allErrors)
          )

          const tailStart = Math.max(ast.elements.length, restEnd)
          yield* scanTuple(0, tail.length, state, cooperation, (offset) => {
            const index = tailStart + offset
            return index < length
              ? parseElement(
                ast,
                input,
                state,
                parse,
                Arr.unsafeGet(tail, offset).type,
                index,
                options,
                direction,
                allErrors
              )
              : Effect.void
          })
        }

        const failure = MutableRef.get(state.failure)
        if (Option.isSome(failure)) return holdSemanticResult(failResult(failure.value))
        if (MutableList.isEmpty(state.tasks)) {
          return holdSemanticResult(computeResult(
            ast,
            input,
            new TupleResultState(Arr.fromIterable(state.errors), Arr.fromIterable(state.output))
          ))
        }

        const tasks = Arr.fromIterable(state.tasks)
        const initialErrors = Arr.fromIterable(state.errors)
        const initialOutput = Arr.fromIterable(state.output)
        return holdSemanticResult(Effect.suspend(() => {
          const runtime = new TupleResultState(Arr.copy(initialErrors), Arr.copy(initialOutput))
          return Effect.flatMap(
            runAnnotatedTasks(ast, tasks, (run) => run(runtime)),
            () => computeResult(ast, input, runtime)
          )
        }))
      }),
      (value) => value.result
    )
  })
}
