/** Incremental byte hashing and surrogate carry across text chunks. @internal */

import { Boolean as B, Data, Effect, Number as N, Option, Stream, String as Str, Tuple } from "effect"
import type { Algorithm } from "../Digest.js"
import { InvalidUnicode } from "../Utf8.js"
import { type Hasher, makeHasher } from "./digest.js"
import { encodeUtf8Unchecked, unicodeFault } from "./utf8.js"

const isTrailingHighSurrogate = (text: string): boolean =>
  Option.exists(
    Str.charCodeAt(text, N.decrement(Str.length(text))),
    N.between({ minimum: 0xd800, maximum: 0xdbff })
  )

const splitTextForUtf8Boundary = (text: string) =>
  B.match(isTrailingHighSurrogate(text), {
    onTrue: () => Tuple.make(Str.slice(0, -1)(text), Str.slice(-1)(text)),
    onFalse: () => Tuple.make(text, "")
  })

class CarriedHighSurrogate extends Data.Class<{
  readonly value: string
  readonly codeUnitIndex: number
}> {}

class TextState extends Data.Class<{
  readonly hasher: Hasher
  readonly carriedHighSurrogate: Option.Option<CarriedHighSurrogate>
  readonly consumedCodeUnits: number
}> {}

const foldTextChunk = (state: TextState, chunk: string): Effect.Effect<TextState, InvalidUnicode> => {
  const window = Option.match(state.carriedHighSurrogate, {
    onNone: () => chunk,
    onSome: (carry) => Str.concat(carry.value, chunk)
  })
  const windowStart = Option.match(state.carriedHighSurrogate, {
    onNone: () => state.consumedCodeUnits,
    onSome: (carry) => carry.codeUnitIndex
  })
  const [emit, nextCarry] = splitTextForUtf8Boundary(window)

  return Option.match(unicodeFault(emit), {
    onNone: () =>
      Effect.sync(() => {
        state.hasher.update(encodeUtf8Unchecked(emit))
        return new TextState({
          hasher: state.hasher,
          carriedHighSurrogate: Option.liftPredicate(Str.isNonEmpty)(nextCarry).pipe(
            Option.map((value) =>
              new CarriedHighSurrogate({ value, codeUnitIndex: N.sum(windowStart, Str.length(emit)) })
            )
          ),
          consumedCodeUnits: N.sum(state.consumedCodeUnits, Str.length(chunk))
        })
      }),
    onSome: (fault) =>
      Effect.fail(new InvalidUnicode({ kind: fault.kind, codeUnitIndex: N.sum(windowStart, fault.codeUnitIndex) }))
  })
}

const finishText = (state: TextState): Effect.Effect<Uint8Array, InvalidUnicode> =>
  Option.match(state.carriedHighSurrogate, {
    onNone: () => Effect.sync(() => state.hasher.digest()),
    onSome: (carry) =>
      Effect.fail(new InvalidUnicode({ kind: "lone-high-surrogate", codeUnitIndex: carry.codeUnitIndex }))
  })

export const hashStream = <E, R>(
  algorithm: Algorithm,
  chunks: Stream.Stream<Uint8Array, E, R>
): Effect.Effect<Uint8Array, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => makeHasher(algorithm)),
    (hasher) =>
      chunks.pipe(
        Stream.runForEach((chunk) =>
          Effect.sync(() => {
            hasher.update(chunk)
          })
        ),
        Effect.map(() => hasher.digest())
      ),
    (hasher) => Effect.sync(() => hasher.destroy())
  )

export const hashStringStream = <E, R>(
  algorithm: Algorithm,
  chunks: Stream.Stream<string, E, R>
): Effect.Effect<Uint8Array, E | InvalidUnicode, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => makeHasher(algorithm)),
    (hasher) =>
      chunks.pipe(
        Stream.runFoldEffect(
          new TextState({ hasher, carriedHighSurrogate: Option.none(), consumedCodeUnits: 0 }),
          foldTextChunk
        ),
        Effect.flatMap(finishText)
      ),
    (hasher) => Effect.sync(() => hasher.destroy())
  )
