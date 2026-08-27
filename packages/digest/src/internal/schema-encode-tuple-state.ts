/** Mutable invocation state for cooperative Schema tuple parsing. @internal */

import { Array as Arr, Effect, Either, MutableRef, Option, ParseResult, type SchemaAST } from "effect"

import {
  appendMutable,
  compactEffect,
  type EncodeState,
  failResult,
  type Parse,
  scan,
  type SemanticResult
} from "./schema-encode-model.js"

type Task = (state: TupleResultState) => Effect.Effect<void, ParseResult.ParseIssue>

export class TupleResultState {
  readonly errors: Array<ParseResult.ParseIssue>
  readonly output: Array<unknown>
  readonly closed: MutableRef.MutableRef<boolean>

  constructor(
    errors: Array<ParseResult.ParseIssue>,
    output: Array<unknown>,
    closed = MutableRef.make(false)
  ) {
    this.errors = errors
    this.output = output
    this.closed = closed
  }
}

export class TupleState {
  readonly errors: Array<ParseResult.ParseIssue> = []
  readonly output: Array<unknown> = []
  readonly tasks: Array<Task> = []
  readonly failure = MutableRef.make(Option.none<ParseResult.ParseIssue>())
  readonly stepKey = MutableRef.make(0)
}

const nextKey = (state: TupleState): number => {
  const key = MutableRef.get(state.stepKey)
  MutableRef.set(state.stepKey, key + 1)
  return key
}

export const failTuple = (
  ast: SchemaAST.TupleType,
  input: ReadonlyArray<unknown>,
  state: TupleState,
  issue: ParseResult.ParseIssue,
  allErrors: boolean
): void => {
  if (allErrors) state.errors[nextKey(state)] = issue
  else MutableRef.set(state.failure, Option.some(issue))
}

const succeed = (state: TupleState, value: unknown): void => {
  state.output[nextKey(state)] = value
}

const addTask = (
  ast: SchemaAST.TupleType,
  input: ReadonlyArray<unknown>,
  state: TupleState,
  parsed: SemanticResult,
  index: number,
  allErrors: boolean,
  cooperation: EncodeState
): void => {
  const key = nextKey(state)
  appendMutable(state.tasks, (runtime) =>
    Effect.suspend(() => {
      if (MutableRef.get(runtime.closed)) return Effect.void
      return Effect.flatMap(Effect.either(parsed), (result) => {
        if (Either.isRight(result)) {
          runtime.output[key] = result.right
          return Effect.void
        }
        const issue = new ParseResult.Pointer(index, input, result.left)
        if (allErrors) {
          runtime.errors[key] = issue
          return Effect.void
        }
        MutableRef.set(runtime.closed, true)
        return Effect.flatMap(
          compactEffect(runtime.output, cooperation),
          (output) => Effect.fail(new ParseResult.Composite(ast, input, issue, output))
        )
      })
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
  allErrors: boolean,
  cooperation: EncodeState
): Effect.Effect<void> =>
  Effect.map(parse(child, input[index], direction, options), (parsed) => {
    Option.match(Option.fromNullable(ParseResult.eitherOrUndefined(parsed)), {
      onNone: () => addTask(ast, input, state, parsed, index, allErrors, cooperation),
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
    compactEffect(state.errors, cooperation),
    (errors) =>
      Effect.flatMap(compactEffect(state.output, cooperation), (values) =>
        Arr.isNonEmptyReadonlyArray(errors)
          ? failResult(new ParseResult.Composite(ast, input, errors, values))
          : Effect.succeed(values))
  )

export const computeTupleFailure = (
  ast: SchemaAST.TupleType,
  input: ReadonlyArray<unknown>,
  issue: ParseResult.ParseIssue,
  output: ReadonlyArray<unknown>,
  cooperation: EncodeState
): SemanticResult =>
  Effect.flatMap(
    compactEffect(output, cooperation),
    (values) => failResult(new ParseResult.Composite(ast, input, issue, values))
  )
