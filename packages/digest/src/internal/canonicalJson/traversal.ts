/** Cooperative and synchronous drivers over the same canonical traversal. @internal */

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
  Result
} from "effect"
import { constVoid } from "effect/Function"

import { ByteLimitExceeded, type Error as CanonicalizationError } from "../../CanonicalJson.js"
import { encodeUtf8Unchecked, utf8ByteLengthUnchecked } from "../utf8.js"
import { process } from "./serialization.js"
import { flushPending, Frame, State } from "./state.js"

const makeState = <E>(
  value: unknown,
  admit: (text: string) => Result.Result<void, E>,
  sink: Option.Option<(segment: string) => void>
): State<E> => {
  const stack = MutableList.make<Frame>()
  MutableList.prepend(stack, Frame.Visit({ value }))
  return new State({
    stack,
    active: MutableHashSet.empty(),
    segments: MutableList.make(),
    sink,
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

const executeSynchronously = <E>(state: State<E>): Result.Result<void, CanonicalizationError | E> => {
  Iterable.forEach(Iterable.takeWhile(Iterable.range(0), () => B.not(stopped(state))), () => processBatch(state))
  return complete(state)
}

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
    const state = makeState(value, () => Result.succeed(undefined), Option.none())
    return Effect.map(execute(state), () => Chunk.fromIterable(MutableList.toArray(state.segments)))
  })

export const canonicalizeWithByteLimit = (
  value: unknown,
  maximumBytes: number,
  sink: (segment: string) => void
): Effect.Effect<number, CanonicalizationError | ByteLimitExceeded> =>
  Effect.suspend(() => {
    const length = MutableRef.make(0)
    const state = makeState(value, admitBounded(maximumBytes, length), Option.some(sink))
    return Effect.map(execute(state), () => MutableRef.get(length))
  })

export const canonicalizeWithByteLimitResult = (
  value: unknown,
  maximumBytes: number,
  sink: (segment: string) => void
): Result.Result<number, CanonicalizationError | ByteLimitExceeded> => {
  const length = MutableRef.make(0)
  const state = makeState(value, admitBounded(maximumBytes, length), Option.some(sink))
  return Result.map(executeSynchronously(state), () => MutableRef.get(length))
}

export const canonicalizeValue = (value: unknown): Effect.Effect<string, CanonicalizationError> =>
  Effect.map(canonicalizeSegments(value), (segments) => Chunk.join(segments, ""))

/** Final materialization is synchronous; bounded hashing consumes segments instead. */
export const encodeCanonicalSegments = (segments: Chunk.Chunk<string>): Effect.Effect<Uint8Array> =>
  Effect.sync(() => encodeUtf8Unchecked(Chunk.join(segments, "")))
