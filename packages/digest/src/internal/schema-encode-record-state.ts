/** Mutable invocation state for cooperative Schema record parsing. @internal */

import type { SchemaAST } from "effect"
import { Effect, Either, MutableRef, Option, ParseResult } from "effect"

import {
  appendMutable,
  compactEffect,
  type EncodeState,
  type Parse,
  scan,
  type SemanticResult
} from "./schema-encode-model.js"

export class RecordResultState {
  errors: Array<ParseResult.ParseIssue>
  output: Record<PropertyKey, unknown>

  constructor(
    errors: Array<ParseResult.ParseIssue>,
    output: Record<PropertyKey, unknown>
  ) {
    this.errors = errors
    this.output = output
  }
}

type Task = (state: RecordResultState) => Effect.Effect<void, ParseResult.ParseIssue>

export class RecordState {
  readonly errors: Array<ParseResult.ParseIssue> = []
  readonly tasks: Array<Task> = []
  readonly output: Record<PropertyKey, unknown> = {}
  readonly failure = MutableRef.make(Option.none<ParseResult.ParseIssue>())
  readonly stepKey = MutableRef.make(0)
}

const nextKey = (state: RecordState): number => {
  const key = MutableRef.get(state.stepKey)
  MutableRef.set(state.stepKey, key + 1)
  return key
}

export const recordFailure = (
  ast: SchemaAST.TypeLiteral,
  input: Record<PropertyKey, unknown>,
  state: RecordState,
  issue: ParseResult.ParseIssue,
  allErrors: boolean
): void => {
  if (allErrors) state.errors[nextKey(state)] = issue
  else MutableRef.set(state.failure, Option.some(new ParseResult.Composite(ast, input, issue, state.output)))
}

const recordTask = (
  ast: SchemaAST.TypeLiteral,
  input: Record<PropertyKey, unknown>,
  state: RecordState,
  parsed: SemanticResult,
  key: PropertyKey,
  order: number,
  allErrors: boolean,
  missing: Option.Option<SchemaAST.PropertySignature>,
  write: boolean
): void =>
  appendMutable(state.tasks, (runtime) =>
    Effect.flatMap(Effect.either(parsed), (result) => {
      if (Either.isRight(result)) {
        if (write) runtime.output[key] = result.right
        return Effect.void
      }
      const issue = new ParseResult.Pointer(
        key,
        input,
        Option.match(missing, {
          onNone: () => result.left,
          onSome: (property) => new ParseResult.Missing(property)
        })
      )
      if (allErrors) {
        runtime.errors[order] = issue
        return Effect.void
      }
      return Effect.fail(new ParseResult.Composite(ast, input, issue, runtime.output))
    }))

export const parseRecordValue = (
  ast: SchemaAST.TypeLiteral,
  input: Record<PropertyKey, unknown>,
  state: RecordState,
  parse: Parse,
  child: SchemaAST.AST,
  key: PropertyKey,
  options: SchemaAST.ParseOptions,
  direction: "Decode" | "Encode",
  allErrors: boolean,
  missing: Option.Option<SchemaAST.PropertySignature>,
  write: boolean
): Effect.Effect<void> =>
  Effect.map(parse(child, input[key], direction, options), (parsed) => {
    Option.match(Option.fromNullable(ParseResult.eitherOrUndefined(parsed)), {
      onNone: () => recordTask(ast, input, state, parsed, key, nextKey(state), allErrors, missing, write),
      onSome: (synchronous) => {
        if (Either.isRight(synchronous)) {
          if (write) state.output[key] = synchronous.right
          return
        }
        recordFailure(
          ast,
          input,
          state,
          new ParseResult.Pointer(
            key,
            input,
            Option.match(missing, {
              onNone: () => synchronous.left,
              onSome: (property) => new ParseResult.Missing(property)
            })
          ),
          allErrors
        )
      }
    })
  })

export const scanRecord = (
  length: number,
  state: RecordState,
  cooperation: EncodeState,
  body: (index: number) => Effect.Effect<void>
): Effect.Effect<void> =>
  scan(cooperation, 0, (index) => index < length && Option.isNone(MutableRef.get(state.failure)), body)

export const orderedRecordOutput = (
  output: Record<PropertyKey, unknown>,
  inputKeys: ReadonlyArray<PropertyKey>,
  expectedKeys: ReadonlyArray<PropertyKey>,
  cooperation: EncodeState
): Effect.Effect<Record<PropertyKey, unknown>> =>
  Effect.suspend(() => {
    const ordered: Record<PropertyKey, unknown> = {}
    const present: Record<PropertyKey, null> = {}
    return Effect.as(
      Effect.zipRight(
        scan(cooperation, 0, (index) => index < inputKeys.length, (index) =>
          Effect.sync(() => {
            const key = inputKeys[index]!
            Object.defineProperty(present, key, { configurable: true, value: null })
            if (Object.prototype.hasOwnProperty.call(output, key)) ordered[key] = output[key]
          })),
        scan(cooperation, 0, (index) => index < expectedKeys.length, (index) =>
          Effect.sync(() => {
            const key = expectedKeys[index]!
            if (
              !Object.prototype.hasOwnProperty.call(present, key) &&
              Object.prototype.hasOwnProperty.call(output, key)
            ) ordered[key] = output[key]
          }))
      ),
      ordered
    )
  })

export const recordErrors = (
  errors: ReadonlyArray<ParseResult.ParseIssue>,
  cooperation: EncodeState
): Effect.Effect<Array<ParseResult.ParseIssue>> => compactEffect(errors, cooperation)
