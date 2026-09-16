import { Array as Arr, Effect, Either, identity, Iterable, Number as N, Schema } from "effect"
import * as Verification from "../Verification.js"

/**
 * Read length once, admit it before traversal, and copy at most length + 1
 * bytes. Never trust a caller's iterator to agree with its reported length.
 * Even empty inputs are iterated so detached storage still fails admission.
 */
export const copyBytes = <A extends number>(
  bytes: Uint8Array,
  lengthSchema: Schema.Schema<A>
): Effect.Effect<Uint8Array, Verification.InvalidInput> =>
  Effect.gen(function*() {
    const length = yield* Effect.try({
      try: () =>
        Schema.decodeUnknownEither(Schema.Uint8ArrayFromSelf)(bytes).pipe(
          Either.flatMap((input) => Schema.decodeUnknownEither(lengthSchema)(input.length))
        ),
      catch: () => new Verification.InvalidInput({})
    }).pipe(Effect.flatMap(identity), Effect.mapError(() => new Verification.InvalidInput({})))
    const values = yield* Effect.try({
      try: () => Arr.fromIterable(Iterable.take(bytes, N.increment(length))),
      catch: () => new Verification.InvalidInput({})
    }).pipe(
      Effect.filterOrFail(
        (values) => N.Equivalence(Arr.length(values), length),
        () => new Verification.InvalidInput({})
      )
    )
    return yield* Schema.decode(Schema.Array(Schema.Uint8.pipe(Schema.int())))(values).pipe(
      Effect.flatMap(Schema.decode(Schema.Uint8Array)),
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
    message: copyBytes(message, Schema.NonNegativeInt.pipe(Schema.lessThanOrEqualTo(Verification.maxMessageBytes))),
    publicKey: copyBytes(publicKey, Schema.Literal(publicKeyBytes))
  })
