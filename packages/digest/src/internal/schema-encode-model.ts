/** Shared state and helpers for cooperative Schema encoding. @internal */

import { Array as Arr, Effect, Either, MutableRef, Option, Order, ParseResult, Record, SchemaAST } from "effect"

export const ENCODE_BATCH = 512
export const ENCODE_HOST_YIELD_BATCHES = 16

export type Direction = "Decode" | "Encode"
export type SemanticResult = Effect.Effect<unknown, ParseResult.ParseIssue>

export class SemanticResultValue {
  readonly result: SemanticResult

  constructor(result: SemanticResult) {
    this.result = result
  }
}

export const holdSemanticResult = (result: SemanticResult): SemanticResultValue => new SemanticResultValue(result)

export type Parse = (
  ast: SchemaAST.AST,
  input: unknown,
  direction: Direction,
  options: SchemaAST.ParseOptions
) => Effect.Effect<SemanticResult>

export class EncodeState {
  readonly steps = MutableRef.make(0)
  readonly batches = MutableRef.make(0)
}

const yieldBatch = (state: EncodeState): Effect.Effect<void> =>
  Effect.suspend(() => {
    const batches = MutableRef.get(state.batches) + 1
    MutableRef.set(state.batches, batches % ENCODE_HOST_YIELD_BATCHES)
    return Effect.zipRight(
      Effect.yieldNow(),
      batches === ENCODE_HOST_YIELD_BATCHES ? Effect.sleep(0) : Effect.void
    )
  })

export const cooperate = (state: EncodeState): Effect.Effect<void> =>
  Effect.suspend(() => {
    const steps = MutableRef.get(state.steps) + 1
    MutableRef.set(state.steps, steps % ENCODE_BATCH)
    if (steps !== ENCODE_BATCH) return Effect.void
    return yieldBatch(state)
  })

export const scan = <E, R>(
  state: EncodeState,
  initial: number,
  whileScanning: (index: number) => boolean,
  body: (index: number) => Effect.Effect<void, E, R>
): Effect.Effect<void, E, R> =>
  Effect.as(
    Effect.iterate(initial, {
      while: whileScanning,
      body: (index) => Effect.as(Effect.zipRight(cooperate(state), body(index)), index + 1)
    }),
    undefined
  )

export const runAnnotatedTasks = <A, E, R>(
  ast: SchemaAST.AST,
  tasks: Iterable<A>,
  run: (task: A) => Effect.Effect<void, E, R>,
  defaultSequential = false
): Effect.Effect<void, E, R> => {
  const concurrency = Option.orElse(
    SchemaAST.getConcurrencyAnnotation(ast),
    () => defaultSequential ? Option.some(1) : Option.none()
  )
  const batching = SchemaAST.getBatchingAnnotation(ast)
  return Option.match(concurrency, {
    onNone: () =>
      Option.match(batching, {
        onNone: () => Effect.forEach(tasks, run, { discard: true }),
        onSome: (batching) => Effect.forEach(tasks, run, { batching, discard: true })
      }),
    onSome: (concurrency) =>
      Option.match(batching, {
        onNone: () => Effect.forEach(tasks, run, { concurrency, discard: true }),
        onSome: (batching) => Effect.forEach(tasks, run, { batching, concurrency, discard: true })
      })
  })
}

export const succeedResult = (value: unknown): SemanticResult => Either.right(value)

export const failResult = (issue: ParseResult.ParseIssue): SemanticResult => Either.left(issue)

export const mapResult = (
  self: Effect.Effect<SemanticResult>,
  f: (value: unknown) => unknown
): Effect.Effect<SemanticResult> => Effect.map(self, (result) => ParseResult.map(result, f))

export const mapResultError = (
  self: Effect.Effect<SemanticResult>,
  f: (issue: ParseResult.ParseIssue) => ParseResult.ParseIssue
): Effect.Effect<SemanticResult> => Effect.map(self, (result) => ParseResult.mapError(result, f))

export const flatMapResult = (
  self: Effect.Effect<SemanticResult>,
  f: (value: unknown) => Effect.Effect<SemanticResult>
): Effect.Effect<SemanticResult> =>
  Effect.flatMap(self, (result) => {
    return Option.match(Option.fromNullable(ParseResult.eitherOrUndefined(result)), {
      onNone: () => Effect.succeed(Effect.flatMap(result, (value) => Effect.flatten(f(value)))),
      onSome: (synchronous) => Either.isLeft(synchronous) ? Effect.succeed(synchronous) : f(synchronous.right)
    })
  })

export const orElseResult = (
  self: Effect.Effect<SemanticResult>,
  fallback: (issue: ParseResult.ParseIssue) => SemanticResult
): Effect.Effect<SemanticResult> => Effect.map(self, (result) => ParseResult.orElse(result, fallback))

export const mergeOptions = (
  options: SchemaAST.ParseOptions,
  override: SchemaAST.ParseOptions
): SchemaAST.ParseOptions => ({ ...options, ...override })

export const appendMutable = <A>(items: Array<A>, value: A): void => {
  items[items.length] = value
}

export const indexed = <A>(entries: ReadonlyArray<readonly [number, A]>): Array<A> =>
  Arr.map(Arr.sortWith(entries, ([key]) => key, Order.number), ([, value]) => value)

export const indexedEffect = <A>(
  entries: ReadonlyArray<readonly [number, A]>,
  state: EncodeState
): Effect.Effect<Array<A>> =>
  Effect.suspend(() => {
    const sparse: Array<A> = []
    const output: Array<A> = []
    return Effect.as(
      Effect.zipRight(
        scan(state, 0, (index) => index < entries.length, (index) =>
          Effect.sync(() => {
            const [key, value] = entries[index]!
            sparse[key] = value
          })),
        scan(state, 0, (index) => index < sparse.length, (index) =>
          Effect.sync(() => {
            if (Object.prototype.hasOwnProperty.call(sparse, index)) appendMutable(output, sparse[index]!)
          }))
      ),
      output
    )
  })

export const getKeysForIndexSignature = (
  input: { readonly [key: PropertyKey]: unknown },
  parameter: SchemaAST.Parameter
): ReadonlyArray<PropertyKey> => {
  if (SchemaAST.isStringKeyword(parameter) || SchemaAST.isTemplateLiteral(parameter)) return Record.keys(input)
  if (SchemaAST.isSymbolKeyword(parameter)) return Arr.filter(Reflect.ownKeys(input), (key) => typeof key === "symbol")
  return getKeysForIndexSignature(input, parameter.from)
}

export const parseOptions = (
  ast: SchemaAST.AST,
  inherited: SchemaAST.ParseOptions
): SchemaAST.ParseOptions =>
  Option.match(SchemaAST.getParseOptionsAnnotation(ast), {
    onNone: () => inherited,
    onSome: (annotation) => mergeOptions(inherited, annotation)
  })
