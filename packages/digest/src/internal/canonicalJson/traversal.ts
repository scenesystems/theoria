/** Cooperative drivers over canonical traversal. @internal */

import {
  Boolean as B,
  Chunk,
  Effect,
  Iterable,
  Match,
  MutableHashSet,
  MutableList,
  MutableRef,
  Number as N,
  Option,
  Result,
  Stream
} from "effect"
import { constVoid } from "effect/Function"

import { ByteLimitExceeded, type Error as CanonicalizationError } from "../../CanonicalJson.js"
import { utf8ByteLengthUnchecked } from "../utf8.js"
import { process } from "./serialization.js"
import { flushPending, Frame, State } from "./state.js"

const makeState = <E>(
  value: unknown,
  admit: (text: string) => Result.Result<void, E>
): State<E> => {
  const stack = MutableList.make<Frame>()
  MutableList.prepend(stack, Frame.Visit({ value }))
  return new State({
    stack,
    active: MutableHashSet.empty(),
    segments: MutableList.make(),
    admit,
    pending: MutableRef.make(""),
    failure: MutableRef.make(Option.none())
  })
}

const stopped = <E>(state: State<E>): boolean =>
  B.or(N.Equivalence(state.stack.length, 0), Option.isSome(MutableRef.get(state.failure)))

const processBatch = <E>(state: State<E>): void => {
  Iterable.forEach(
    Iterable.takeWhile(Iterable.range(1, 256), () => B.not(stopped(state))),
    () =>
      Match.value(MutableList.take(state.stack)).pipe(
        Match.when(MutableList.Empty, constVoid),
        Match.orElse((frame) => process(state, frame))
      )
  )
}

const complete = <E>(state: State<E>): Result.Result<void, CanonicalizationError | E> =>
  Option.match(MutableRef.get(state.failure), {
    onSome: Result.fail,
    onNone: () => {
      flushPending(state)
      return Result.succeed(undefined)
    }
  })

const execute = <E>(state: State<E>): Effect.Effect<void, CanonicalizationError | E> =>
  Effect.suspend(() => {
    processBatch(state)
    return B.match(stopped(state), {
      onTrue: () => Effect.fromResult(complete(state)),
      onFalse: () => Effect.andThen(Effect.yieldNow, execute(state))
    })
  })

const admitBounded =
  (maximumBytes: number, byteLength: MutableRef.MutableRef<number>) =>
  (text: string): Result.Result<void, ByteLimitExceeded> => {
    const next = N.sum(MutableRef.get(byteLength), utf8ByteLengthUnchecked(text))
    return B.match(N.isGreaterThan(next, maximumBytes), {
      onTrue: () => Result.fail(new ByteLimitExceeded({})),
      onFalse: () => {
        MutableRef.set(byteLength, next)
        return Result.succeed(undefined)
      }
    })
  }

export const canonicalizeSegments = (value: unknown): Effect.Effect<Chunk.Chunk<string>, CanonicalizationError> =>
  Effect.suspend(() => {
    const state = makeState(value, () => Result.succeed(undefined))
    return Effect.map(execute(state), () => Chunk.fromIterable(MutableList.toArray(state.segments)))
  })

const executeInto = <E>(
  state: State<E>,
  sink: (segment: string) => Effect.Effect<void>
): Effect.Effect<void, CanonicalizationError | E> =>
  Effect.gen(function*() {
    processBatch(state)
    yield* Effect.fromResult(complete(state))
    const segments = MutableList.toArray(state.segments)
    MutableList.clear(state.segments)
    yield* Effect.forEach(segments, sink, { discard: true })
    yield* B.match(stopped(state), {
      onTrue: () => Effect.void,
      onFalse: () => Effect.andThen(Effect.yieldNow, executeInto(state, sink))
    })
  })

export const canonicalizeInto = (
  value: unknown,
  sink: (segment: string) => Effect.Effect<void>
): Effect.Effect<void, CanonicalizationError> =>
  Effect.suspend(() => executeInto(makeState(value, () => Result.succeed(undefined)), sink))

export const canonicalizeWithByteLimit = (
  value: unknown,
  maximumBytes: number,
  sink: (segment: string) => Effect.Effect<void>
): Effect.Effect<number, CanonicalizationError | ByteLimitExceeded> =>
  Effect.suspend(() => {
    const length = MutableRef.make(0)
    const state = makeState(value, admitBounded(maximumBytes, length))
    return Effect.map(executeInto(state, sink), () => MutableRef.get(length))
  })

export const canonicalizeValue = (value: unknown): Effect.Effect<string, CanonicalizationError> =>
  Effect.map(canonicalizeSegments(value), (segments) => Chunk.join(segments, ""))

/** Encode segments without joining the canonical text first. */
export const encodeCanonicalSegments = (segments: Chunk.Chunk<string>): Effect.Effect<Uint8Array> =>
  Stream.fromIterable(segments).pipe(Stream.encodeText, Stream.mkUint8Array)
