/** Cooperative and synchronous drivers over the same canonical traversal. @internal */

import {
  Boolean as B,
  Chunk,
  Effect,
  Either,
  Iterable,
  MutableHashSet,
  MutableList,
  MutableRef,
  Number as N,
  Option,
  Predicate,
  Stream
} from "effect"
import { constVoid } from "effect/Function"

import { ByteLimitExceeded, type Error as CanonicalizationError } from "../../CanonicalJson.js"
import { utf8ByteLengthUnchecked } from "../utf8.js"
import { process } from "./serialization.js"
import { flushPending, Frame, State } from "./state.js"

const makeState = <E>(
  value: unknown,
  admit: (text: string) => Either.Either<void, E>,
  sink: Option.Option<(segment: string) => void>
): State<E> =>
  new State({
    stack: MutableList.make(Frame.Visit({ value })),
    active: MutableHashSet.empty(),
    segments: MutableList.empty(),
    sink,
    admit,
    pending: MutableRef.make(""),
    failure: MutableRef.make(Option.none())
  })

const stopped = <E>(state: State<E>): boolean =>
  B.or(MutableList.isEmpty(state.stack), Option.isSome(MutableRef.get(state.failure)))

const processBatch = <E>(state: State<E>): void => {
  Iterable.forEach(
    Iterable.takeWhile(Iterable.range(1, 256), () => B.not(stopped(state))),
    () =>
      Option.match(Option.fromNullable(MutableList.shift(state.stack)), {
        onNone: constVoid,
        onSome: (frame) => process(state, frame)
      })
  )
}

const complete = <E>(state: State<E>): Either.Either<void, CanonicalizationError | E> =>
  Option.match(MutableRef.get(state.failure), {
    onSome: Either.left,
    onNone: () => {
      flushPending(state)
      return Either.right(undefined)
    }
  })

const execute = <E>(state: State<E>): Effect.Effect<void, CanonicalizationError | E> =>
  Effect.iterate(state, {
    while: Predicate.not(stopped),
    body: (current) =>
      Effect.gen(function*() {
        processBatch(current)
        yield* Effect.when(Effect.sleep(0), () => B.not(stopped(current)))
        return current
      })
  }).pipe(Effect.flatMap(complete))

const executeSynchronously = <E>(state: State<E>): Either.Either<void, CanonicalizationError | E> => {
  Iterable.forEach(Iterable.takeWhile(Iterable.range(0), () => B.not(stopped(state))), () => processBatch(state))
  return complete(state)
}

const admitBounded =
  (maximumBytes: number, byteLength: MutableRef.MutableRef<number>) =>
  (text: string): Either.Either<void, ByteLimitExceeded> => {
    const next = N.sum(MutableRef.get(byteLength), utf8ByteLengthUnchecked(text))
    return B.match(N.greaterThan(next, maximumBytes), {
      onTrue: () => Either.left(new ByteLimitExceeded({})),
      onFalse: () => {
        MutableRef.set(byteLength, next)
        return Either.right(undefined)
      }
    })
  }

export const canonicalizeSegments = (value: unknown): Effect.Effect<Chunk.Chunk<string>, CanonicalizationError> =>
  Effect.suspend(() => {
    const state = makeState(value, () => Either.right(undefined), Option.none())
    return Effect.map(execute(state), () => Chunk.fromIterable(state.segments))
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

export const canonicalizeWithByteLimitEither = (
  value: unknown,
  maximumBytes: number,
  sink: (segment: string) => void
): Either.Either<number, CanonicalizationError | ByteLimitExceeded> => {
  const length = MutableRef.make(0)
  const state = makeState(value, admitBounded(maximumBytes, length), Option.some(sink))
  return Either.map(executeSynchronously(state), () => MutableRef.get(length))
}

export const canonicalizeValue = (value: unknown): Effect.Effect<string, CanonicalizationError> =>
  Effect.map(canonicalizeSegments(value), (segments) => Chunk.join(segments, ""))

/** Final materialization is synchronous; bounded hashing consumes segments instead. */
export const encodeCanonicalSegments = (segments: Chunk.Chunk<string>): Effect.Effect<Uint8Array> =>
  Stream.make(Chunk.join(segments, "")).pipe(Stream.encodeText, Stream.runHead, Effect.map(Option.getOrThrow))
