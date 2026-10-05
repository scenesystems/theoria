/** Cooperative drivers over canonical traversal. @internal */

import * as Arr from "effect/Array"
import * as B from "effect/Boolean"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import { memoize } from "effect/Function"
import * as MutableHashSet from "effect/MutableHashSet"
import * as MutableList from "effect/MutableList"
import * as MutableRef from "effect/MutableRef"
import * as N from "effect/Number"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Result from "effect/Result"
import * as Stream from "effect/Stream"
import * as Tuple from "effect/Tuple"

import { ByteLimitExceeded, type Error as CanonicalizationError } from "../../CanonicalJson.js"
import { utf8ByteLengthUnchecked } from "../utf8.js"
import { makeProcessor } from "./serialization.js"
import { append, fail, flushPending, Frame, State } from "./state.js"

const makeState = <E>(
  value: unknown,
  write: (state: State<E>, text: string) => void
): State<E> => {
  const stack = MutableList.make<Frame>()
  const nextIdentity = MutableRef.make(0)
  MutableList.prepend(stack, Frame.Visit({ value }))
  return new State({
    stack,
    active: MutableHashSet.empty(),
    // Function.memoize uses reference keys, without reading input Hash/Equal hooks.
    identity: memoize<object, number>(() => MutableRef.getAndIncrement(nextIdentity)),
    segments: MutableList.make(),
    write,
    pending: MutableRef.make(""),
    failure: MutableRef.make(Option.none())
  })
}

const stopped = <E>(state: State<E>): boolean =>
  B.or(N.Equivalence(state.stack.length, 0), Option.isSome(MutableRef.get(state.failure)))

// A record advance can consume both a short key and its value.
const batchSteps = Arr.range(0, 127)

const makeBatch = <E>(state: State<E>): Effect.Effect<void> => {
  const process = makeProcessor(state)
  return Effect.sync(() => {
    Arr.every(batchSteps, () => {
      // Keep collection cursors in their existing bucket until exhausted.
      const head = state.stack.head
      if (!Predicate.isUndefined(head)) process(Arr.getUnsafe(head.array, head.offset))
      return !stopped(state)
    })
  })
}

const complete = <E>(state: State<E>): Result.Result<void, CanonicalizationError | E> =>
  Option.match(MutableRef.get(state.failure), {
    onSome: Result.fail,
    onNone: () => {
      flushPending(state)
      return Result.succeed(undefined)
    }
  })

const execute = <E>(state: State<E>, batch: Effect.Effect<void>): Effect.Effect<void, CanonicalizationError | E> =>
  Effect.flatMap(batch, () => {
    return B.match(stopped(state), {
      onTrue: () => Effect.fromResult(complete(state)),
      onFalse: () => Effect.andThen(Effect.yieldNow, execute(state, batch))
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
    const state = makeState<never>(value, append)
    return Effect.map(execute(state, makeBatch(state)), () => Chunk.fromIterable(MutableList.toArray(state.segments)))
  })

const byteStream = <E>(state: State<E>): Stream.Stream<Uint8Array, CanonicalizationError | E> => {
  const batch = makeBatch(state)
  return Stream.paginate(
    false,
    Effect.fnUntraced(function*(shouldYield) {
      yield* B.match(shouldYield, { onTrue: () => Effect.yieldNow, onFalse: () => Effect.void })
      yield* batch
      yield* Effect.fromResult(complete(state))
      return Tuple.make(
        MutableList.takeAll(state.segments),
        Option.liftPredicate(B.not)(stopped(state)).pipe(Option.map(() => true))
      )
    })
  ).pipe(Stream.encodeText)
}

export const canonicalizeInto = (
  value: unknown,
  sink: (segment: Uint8Array) => Effect.Effect<void>
): Effect.Effect<void, CanonicalizationError> =>
  Effect.suspend(() => {
    const state = makeState<never>(value, append)
    return Stream.runForEach(byteStream(state), sink)
  })

export const canonicalizeWithByteLimit = (
  value: unknown,
  maximumBytes: number,
  sink: (segment: Uint8Array) => Effect.Effect<void>
): Effect.Effect<number, CanonicalizationError | ByteLimitExceeded> =>
  Effect.suspend(() => {
    const length = MutableRef.make(0)
    const admit = admitBounded(maximumBytes, length)
    const state = makeState<ByteLimitExceeded>(value, (state, text) => {
      Result.match(admit(text), {
        onFailure: (error) => fail(state, error),
        onSuccess: () => append(state, text)
      })
    })
    return Effect.map(Stream.runForEach(byteStream(state), sink), () => MutableRef.get(length))
  })

export const canonicalizeValue = (value: unknown): Effect.Effect<string, CanonicalizationError> =>
  Effect.map(canonicalizeSegments(value), (segments) => Chunk.join(segments, ""))

/** Encode segments without joining the canonical text first. */
export const encodeCanonicalSegments = (segments: Chunk.Chunk<string>): Effect.Effect<Uint8Array> =>
  Stream.fromIterable(segments).pipe(Stream.encodeText, Stream.mkUint8Array)
