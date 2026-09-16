/**
 * Lexical collection scopes for trace entries, calls, and usage.
 *
 * @since 0.1.0
 */
import { Chunk, Data, Effect, Option, Ref } from "effect"
import { accumulateUsage, emptyUsage } from "../../Trace.js"
import type { Call, Entry } from "../../Trace.js"
import { CallCollections, CallCollector, EntryCollections, EntryCollector } from "./refs.js"

const entryAncestors = (parent: Option.Option<EntryCollections>) =>
  Option.match(parent, {
    onNone: () => Chunk.empty<Ref.Ref<Chunk.Chunk<Entry>>>(),
    onSome: (collections) => Chunk.prepend(collections.ancestors, collections.current)
  })

const callAncestors = (parent: Option.Option<CallCollections>) =>
  Option.match(parent, {
    onNone: () => Chunk.empty<Ref.Ref<Chunk.Chunk<Call>>>(),
    onSome: (collections) => Chunk.prepend(collections.ancestors, collections.current)
  })

const collectEntries = <A, E, R>(program: Effect.Effect<A, E, R>) =>
  Effect.gen(function*() {
    const parent = yield* Effect.serviceOption(EntryCollector)
    const current = yield* Ref.make(Chunk.empty<Entry>())
    const collections = new EntryCollections({
      current,
      ancestors: entryAncestors(parent)
    })

    return yield* Effect.gen(function*() {
      const result = yield* program
      const entries = yield* Ref.get(current)

      return Data.tuple(result, Chunk.toReadonlyArray(entries))
    }).pipe(Effect.provideService(EntryCollector, collections))
  })

const collectCalls = <A, E, R>(program: Effect.Effect<A, E, R>) =>
  Effect.gen(function*() {
    const parent = yield* Effect.serviceOption(CallCollector)
    const current = yield* Ref.make(Chunk.empty<Call>())
    const collections = new CallCollections({
      current,
      ancestors: callAncestors(parent)
    })

    return yield* Effect.gen(function*() {
      const result = yield* program
      const calls = yield* Ref.get(current)

      return Data.tuple(result, calls)
    }).pipe(Effect.provideService(CallCollector, collections))
  })

const summarizeCalls = (calls: Chunk.Chunk<Call>) =>
  Chunk.reduce(calls, emptyUsage, (summary, call) => accumulateUsage(summary, call.usage))

/**
 * Collects entries appended while a program runs.
 *
 * @remarks
 * Every scope owns a fresh collection. Nested events are added once to the
 * nested collection and once to each lexical ancestor, while concurrent sibling
 * scopes never share their own snapshots. On failure or interruption no tuple
 * is returned. Put `Effect.exit(program)` inside this scope to retain failed
 * result evidence. Getters are also available to `onExit` finalizers installed
 * inside the scope.
 *
 * @param program - Effect executed with entry collection enabled.
 * @returns The result paired with this scope's entries on success.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withTracing = <A, E, R>(program: Effect.Effect<A, E, R>) => collectEntries(program)

/**
 * Collects call records appended while a program runs.
 *
 * @remarks
 * On failure or interruption no tuple is returned. Put `Effect.exit(program)`
 * inside this scope to retain evidence, or read {@link getCalls} from an
 * `onExit` finalizer installed inside the scope.
 *
 * @param program - Effect executed with call collection enabled.
 * @returns The result paired with this scope's calls on success.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withCalls = <A, E, R>(program: Effect.Effect<A, E, R>) =>
  collectCalls(program).pipe(
    Effect.map(([result, calls]) => Data.tuple(result, Chunk.toReadonlyArray(calls)))
  )

/**
 * Accumulates canonical usage from calls observed while a program runs.
 *
 * @remarks
 * Usage tracking is a projection of per-invocation call evidence and follows
 * the same lexical nesting and failure behavior as {@link withCalls}.
 *
 * @param program - Effect executed with call collection enabled.
 * @returns The result paired with this scope's canonical usage aggregate.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withUsageTracking = <A, E, R>(program: Effect.Effect<A, E, R>) =>
  collectCalls(program).pipe(
    Effect.map(([result, calls]) => Data.tuple(result, summarizeCalls(calls)))
  )

/**
 * Reads this lexical tracing scope's entries, or an empty array outside a scope.
 *
 * @since 0.1.0
 * @category combinators
 */
export const get = Effect.serviceOption(EntryCollector).pipe(
  Effect.flatMap(
    Option.match({
      onNone: () => Effect.succeed(Chunk.empty<Entry>()),
      onSome: (collections) => Ref.get(collections.current)
    })
  ),
  Effect.map(Chunk.toReadonlyArray)
)

/**
 * Reads this lexical call scope's calls, or an empty array outside a scope.
 *
 * @since 0.1.0
 * @category combinators
 */
export const getCalls = Effect.serviceOption(CallCollector).pipe(
  Effect.flatMap(
    Option.match({
      onNone: () => Effect.succeed(Chunk.empty<Call>()),
      onSome: (collections) => Ref.get(collections.current)
    })
  ),
  Effect.map(Chunk.toReadonlyArray)
)

/**
 * Reads usage projected from this lexical call scope, or five known zeros
 * outside a scope.
 *
 * @since 0.1.0
 * @category combinators
 */
export const getUsage = Effect.serviceOption(CallCollector).pipe(
  Effect.flatMap(
    Option.match({
      onNone: () => Effect.succeed(Chunk.empty<Call>()),
      onSome: (collections) => Ref.get(collections.current)
    })
  ),
  Effect.map(summarizeCalls)
)
