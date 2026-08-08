/** Cooperative Effect Schema union interpreter. @internal */

import { Array as Arr, Effect, Either, MutableRef, Option, ParseResult, Predicate, SchemaAST } from "effect"

import {
  appendMutable,
  compactEffect,
  type EncodeState,
  failResult,
  holdSemanticResult,
  type Parse,
  runAnnotatedTasks,
  scan as scanBatches,
  type SemanticResult
} from "./schema-encode-model.js"
import type { TypeAstProjector } from "./schema-encode-type-ast.js"
import {
  expectedUnionDiscriminator,
  getUnionBucket,
  makeUnionSearchTree,
  type UnionSearchTree
} from "./schema-encode-union-search.js"
class UnionResultState {
  readonly errors: Array<ParseResult.ParseIssue>
  readonly final: MutableRef.MutableRef<Option.Option<unknown>>
  constructor(
    errors: Array<ParseResult.ParseIssue> = [],
    final = MutableRef.make(Option.none<unknown>())
  ) {
    this.errors = errors
    this.final = final
  }
}
type Task = (state: UnionResultState) => Effect.Effect<void>

class UnionState extends UnionResultState {
  readonly candidates: Array<SchemaAST.AST> = []
  readonly tasks: Array<Task> = []
  readonly queueStarted = MutableRef.make(false)
  readonly stepKey = MutableRef.make(0)
}

const nextKey = (state: UnionState): number => {
  const key = MutableRef.get(state.stepKey)
  MutableRef.set(state.stepKey, key + 1)
  return key
}

const appendError = (state: UnionResultState, issue: ParseResult.ParseIssue, key: number): void => {
  state.errors[key] = issue
}

const addTask = (state: UnionState, parsed: SemanticResult): void => {
  const key = nextKey(state)
  MutableRef.set(state.queueStarted, true)
  appendMutable(state.tasks, (runtime) =>
    Effect.suspend(() => {
      if (Option.isSome(MutableRef.get(runtime.final))) return Effect.void
      return Effect.map(Effect.either(parsed), (result) => {
        if (Either.isRight(result)) MutableRef.set(runtime.final, Option.some(result.right))
        else appendError(runtime, result.left, key)
      })
    }))
}

const scan = (
  length: number,
  cooperation: EncodeState,
  body: (index: number) => Effect.Effect<void>,
  whileScanning: () => boolean = () => true
): Effect.Effect<void> => scanBatches(cooperation, 0, (index) => index < length && whileScanning(), body)

const propertyValue = (input: unknown, key: PropertyKey): unknown =>
  Predicate.isRecord(input) || Arr.isArray(input) ? Reflect.get(input, key) : undefined

const selectCandidates = (
  ast: SchemaAST.Union,
  input: unknown,
  tree: UnionSearchTree,
  state: UnionState,
  cooperation: EncodeState
): Effect.Effect<void> => {
  const keys = tree.keyOrder
  const treeCandidates = tree.candidates
  if (keys.length > 0 && !Predicate.isRecord(input) && !Arr.isArray(input)) {
    const expected = treeCandidates.length === ast.types.length ? ast : SchemaAST.Union.make(treeCandidates)
    appendError(state, new ParseResult.Type(expected, input), nextKey(state))
  }
  const scanKeys = Predicate.isRecord(input) || Arr.isArray(input)
    ? scan(keys.length, cooperation, (index) =>
      Effect.suspend(() => {
        const name = Arr.unsafeGet(keys, index)
        const bucket = getUnionBucket(tree, name)
        const bucketCandidates = bucket.candidates
        if (!Object.prototype.hasOwnProperty.call(input, name)) {
          const property = new SchemaAST.PropertySignature(name, expectedUnionDiscriminator(bucket), false, true)
          const expected = bucketCandidates.length === ast.types.length
            ? new SchemaAST.TypeLiteral([property], [])
            : SchemaAST.Union.make(bucketCandidates)
          appendError(
            state,
            new ParseResult.Composite(
              expected,
              input,
              new ParseResult.Pointer(name, input, new ParseResult.Missing(property))
            ),
            nextKey(state)
          )
          return Effect.void
        }
        const literal = String(propertyValue(input, name))
        const candidates = Object.prototype.hasOwnProperty.call(bucket.buckets, literal)
          ? Option.fromNullable(bucket.buckets[literal])
          : Option.none()
        Option.match(candidates, {
          onNone: () => {
            const expected = bucketCandidates.length === ast.types.length
              ? new SchemaAST.TypeLiteral([
                new SchemaAST.PropertySignature(name, expectedUnionDiscriminator(bucket), false, true)
              ], [])
              : SchemaAST.Union.make(bucketCandidates)
            appendError(
              state,
              new ParseResult.Composite(
                expected,
                input,
                new ParseResult.Pointer(
                  name,
                  input,
                  new ParseResult.Type(expectedUnionDiscriminator(bucket), propertyValue(input, name))
                )
              ),
              nextKey(state)
            )
          },
          onSome: () => {}
        })
        return Option.match(candidates, {
          onNone: () => Effect.void,
          onSome: (candidates) =>
            scan(candidates.length, cooperation, (candidateIndex) =>
              Effect.sync(() => {
                appendMutable(state.candidates, Arr.unsafeGet(candidates, candidateIndex))
              }))
        })
      }))
    : Effect.void

  return Effect.zipRight(
    scanKeys,
    scan(tree.otherwise.length, cooperation, (index) =>
      Effect.sync(() => {
        appendMutable(state.candidates, Arr.unsafeGet(tree.otherwise, index))
      }))
  )
}

const computeFailure = (
  ast: SchemaAST.Union,
  input: unknown,
  errors: ReadonlyArray<ParseResult.ParseIssue>,
  cooperation: EncodeState
): SemanticResult =>
  Effect.flatMap(compactEffect(errors, cooperation), (issues) => {
    if (!Arr.isNonEmptyReadonlyArray(issues)) return failResult(new ParseResult.Type(ast, input))
    const first = Arr.headNonEmpty(issues)
    return failResult(
      issues.length === 1 && first._tag === "Type"
        ? first
        : new ParseResult.Composite(ast, input, issues)
    )
  })

export const parseUnion = (
  ast: SchemaAST.Union,
  input: unknown,
  parse: Parse,
  direction: "Decode" | "Encode",
  options: SchemaAST.ParseOptions,
  cooperation: EncodeState,
  typeAst: TypeAstProjector
): Effect.Effect<SemanticResult> =>
  Effect.suspend(() => {
    const state = new UnionState()
    return Effect.map(
      Effect.gen(function*() {
        const tree = yield* makeUnionSearchTree(ast, direction, cooperation, typeAst)
        yield* selectCandidates(ast, input, tree, state, cooperation)
        const candidates = state.candidates
        yield* scan(candidates.length, cooperation, (index) =>
          Effect.map(parse(Arr.unsafeGet(candidates, index), input, direction, options), (parsed) =>
            Option.match(Option.fromNullable(ParseResult.eitherOrUndefined(parsed)), {
              onNone: () =>
                addTask(state, parsed),
              onSome: (synchronous) => {
                if (MutableRef.get(state.queueStarted)) {
                  return addTask(state, parsed)
                }
                if (Either.isRight(synchronous)) {
                  MutableRef.set(state.final, Option.some(synchronous.right))
                } else appendError(state, synchronous.left, nextKey(state))
              }
            })), () =>
          Option.isNone(MutableRef.get(state.final)))

        const immediate = MutableRef.get(state.final)
        if (Option.isSome(immediate)) {
          return holdSemanticResult(Either.right(immediate.value))
        }
        if (state.tasks.length === 0) {
          return holdSemanticResult(computeFailure(ast, input, state.errors, cooperation))
        }

        const tasks = state.tasks
        return holdSemanticResult(Effect.suspend(() => {
          const runtime = new UnionResultState(state.errors)
          return Effect.flatMap(
            runAnnotatedTasks(ast, tasks, (run) =>
              run(runtime), true),
            () =>
              Option.match(MutableRef.get(runtime.final), {
                onNone: () =>
                  computeFailure(ast, input, runtime.errors, cooperation),
                onSome: Effect.succeed
              })
          )
        }))
      }),
      (value) => value.result
    )
  })
