import { Effect, identity, Number as N, Record, Schema } from "effect"
import * as Verification from "../Verification.js"

const VerificationInput = Schema.Struct({
  signature: Schema.Uint8ArrayFromSelf,
  message: Schema.Uint8ArrayFromSelf.pipe(
    Schema.filter((bytes) => N.lessThanOrEqualTo(bytes.length, Verification.maxMessageBytes))
  ),
  publicKey: Schema.Uint8ArrayFromSelf
})

/** Snapshot caller-owned bytes through the native byte schema. */
export const copyBytes = (bytes: Uint8Array): Effect.Effect<Uint8Array, Verification.InvalidInput> =>
  Effect.try({
    try: () => Schema.encodeEither(Schema.Uint8Array)(bytes),
    catch: () => new Verification.InvalidInput({})
  }).pipe(
    Effect.flatMap(identity),
    Effect.flatMap(Schema.decode(Schema.Uint8Array)),
    Effect.mapError(() => new Verification.InvalidInput({}))
  )

export const detachVerificationInputs = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<typeof VerificationInput.Type, Verification.InvalidInput> =>
  Effect.try({
    try: () => Schema.decodeUnknownEither(VerificationInput)({ signature, message, publicKey }),
    catch: () => new Verification.InvalidInput({})
  }).pipe(
    Effect.flatMap(identity),
    Effect.flatMap((input) =>
      Effect.all({
        signature: copyBytes(input.signature),
        message: copyBytes(input.message),
        publicKey: copyBytes(input.publicKey)
      })
    ),
    Effect.mapError(() => new Verification.InvalidInput({}))
  )

export const detachMlDsaVerificationInputs = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
  context: Uint8Array,
  contextSchema: Schema.Schema<Uint8Array, Uint8Array>
) =>
  Effect.try({
    try: () => Schema.decodeUnknownEither(contextSchema)(context),
    catch: () => new Verification.InvalidInput({})
  }).pipe(
    Effect.flatMap(identity),
    Effect.flatMap(copyBytes),
    Effect.flatMap((detachedContext) =>
      detachVerificationInputs(signature, message, publicKey).pipe(
        Effect.map((inputs) => Record.set(inputs, "context", detachedContext))
      )
    ),
    Effect.mapError(() => new Verification.InvalidInput({}))
  )
