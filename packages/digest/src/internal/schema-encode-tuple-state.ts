/** Mutable invocation state for cooperative Schema tuple parsing. @internal */

import { Array as Arr, Effect, Either, MutableRef, Option, ParseResult, type SchemaAST } from "effect"

import {
  appendMutable,
  type EncodeState,
  failResult,
  indexed,
  indexedEffect,
  type Parse,
  scan,
  type SemanticResult
} from "./schema-encode-model.js"

type Entry<A> = readonly [number, A]
type Task = (state: TupleResultState) => Effect.Effect<void, ParseResult.ParseIssue>

export class TupleResultState {
  readonly errors: Array<Entry<ParseResult.ParseIssue>>
  readonly output: Array<Entry<unknown>>

  constructor(errors: Array<Entry<ParseResult.ParseIssue>>, output: Array<Entry<unknown>>) {
    this.errors = errors
    this.output = output
  }
}

export class TupleState {
  readonly errors: Array<Entry<ParseResult.ParseIssue>> = []
  readonly output: Array<Entry<unknown>> = []
  readonly tasks: Array<Task> = []
  readonly failure = MutableRef.make(Option.none<ParseResult.ParseIssue>())
  readonly stepKey = MutableRef.make(0)
}

const nextKey = (state: TupleState): number => {
  const key = MutableRef.get(state.stepKey)
  MutableRef.set(state.stepKey, key + 1)
  return key
}

const output = (state: { readonly output: ReadonlyArray<Entry<unknown>> }): Array<unknown> => indexed(state.output)

export const failTuple = (
  ast: SchemaAST.TupleType,
  input: ReadonlyArray<unknown>,
  state: TupleState,
  issue: ParseResult.ParseIssue,
  allErrors: boolean
): void => {
  if (allErrors) appendMutable(state.errors, [nextKey(state), issue])
  else MutableRef.set(state.failure, Option.some(new ParseResult.Composite(ast, input, issue, output(state))))
}

const succeed = (state: TupleState, value: unknown): void => {
  appendMutable(state.output, [nextKey(state), value])
}

const addTask = (
  ast: SchemaAST.TupleType,
  input: ReadonlyArray<unknown>,
  state: TupleState,
  parsed: SemanticResult,
  index: number,
  allErrors: boolean
): void => {
  const key = nextKey(state)
  appendMutable(state.tasks, (runtime) =>
    Effect.flatMap(Effect.either(parsed), (result) => {
      if (Either.isRight(result)) {
        appendMutable(runtime.output, [key, result.right])
        return Effect.void
      }
      const issue = new ParseResult.Pointer(index, input, result.left)
      if (allErrors) {
        appendMutable(runtime.errors, [key, issue])
        return Effect.void
      }
      return Effect.fail(new ParseResult.Composite(ast, input, issue, output(runtime)))
    }))
}

export const parseTupleElement = (
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
      onNone: () => addTask(ast, input, state, parsed, index, allErrors),
      onSome: (synchronous) => {
        if (Either.isRight(synchronous)) return succeed(state, synchronous.right)
        failTuple(ast, input, state, new ParseResult.Pointer(index, input, synchronous.left), allErrors)
      }
    })
  })

export const scanTuple = (
  from: number,
  until: number,
  state: TupleState,
  cooperation: EncodeState,
  body: (index: number) => Effect.Effect<void>
): Effect.Effect<void> =>
  scan(cooperation, from, (index) => index < until && Option.isNone(MutableRef.get(state.failure)), body)

export const computeTupleResult = (
  ast: SchemaAST.TupleType,
  input: ReadonlyArray<unknown>,
  state: TupleResultState,
  cooperation: EncodeState
): SemanticResult =>
  Effect.flatMap(
    indexedEffect(state.errors, cooperation),
    (errors) =>
      Effect.flatMap(indexedEffect(state.output, cooperation), (values) =>
        Arr.isNonEmptyReadonlyArray(errors)
          ? failResult(new ParseResult.Composite(ast, input, errors, values))
          : Effect.succeed(values))
  )
