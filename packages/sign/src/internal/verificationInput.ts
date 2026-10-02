import { Array as Arr, Effect, Iterable, Number as N, Result, Schema } from "effect"
import * as Verification from "../Verification.js"
import { lengthAtMost } from "./schema.js"

/**
 * Read length once, admit it before traversal, and copy at most length + 1
 * bytes. Never trust a caller's iterator to agree with its reported length.
 * Even empty inputs are iterated so detached storage still fails admission.
 */
export const copyBytes = <A extends number>(
  bytes: Uint8Array,
  lengthSchema: Schema.ConstraintDecoder<A>
): Effect.Effect<Uint8Array, Verification.InvalidInput> =>
  Effect.gen(function*() {
    const length = yield* Effect.try({
      try: () =>
        Schema.decodeResult(Schema.Uint8Array)(bytes).pipe(
          Result.flatMap((input) => Schema.decodeResult(lengthSchema)(input.length))
        ),
      catch: () => new Verification.InvalidInput({})
    }).pipe(Effect.flatMap(Effect.fromResult), Effect.mapError(() => new Verification.InvalidInput({})))
    const values = yield* Effect.try({
      try: () => Arr.fromIterable(Iterable.take(bytes, N.increment(length))),
      catch: () => new Verification.InvalidInput({})
    }).pipe(
      Effect.filterOrFail(
        (values) => N.Equivalence(Arr.length(values), length),
        () => new Verification.InvalidInput({})
      )
    )
    return yield* Schema.decodeEffect(
      Schema.Array(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 255 })))
    )(values).pipe(
      Effect.map((values) => new Uint8Array(values)),
      Effect.mapError(() => new Verification.InvalidInput({}))
    )
  })

export const detachVerificationInputs = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
  signatureBytes: number,
  publicKeyBytes: number
) =>
  Effect.all({
    signature: copyBytes(signature, Schema.Literal(signatureBytes)),
    message: copyBytes(message, lengthAtMost(Verification.maxMessageBytes)),
    publicKey: copyBytes(publicKey, Schema.Literal(publicKeyBytes))
  })
