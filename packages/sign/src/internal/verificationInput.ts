import { Effect, identity, Number as N, Record, Schema } from "effect"
import { InvalidVerificationInput } from "../schemas/errors.js"

export const DIRECT_VERIFICATION_MAX_MESSAGE_BYTES = 8_192
export const ML_DSA_MAX_CONTEXT_BYTES = 255

const VerificationInput = Schema.Struct({
  signature: Schema.Uint8ArrayFromSelf,
  message: Schema.Uint8ArrayFromSelf.pipe(
    Schema.filter((bytes) => N.lessThanOrEqualTo(bytes.length, DIRECT_VERIFICATION_MAX_MESSAGE_BYTES))
  ),
  publicKey: Schema.Uint8ArrayFromSelf
})

const MlDsaContext = Schema.Uint8ArrayFromSelf.pipe(
  Schema.filter((bytes) => N.lessThanOrEqualTo(bytes.length, ML_DSA_MAX_CONTEXT_BYTES))
)

/** Snapshot caller-owned bytes through the native byte schema. */
export const copyBytes = (bytes: Uint8Array): Effect.Effect<Uint8Array, InvalidVerificationInput> =>
  Effect.try({
    try: () => Schema.encodeEither(Schema.Uint8Array)(bytes),
    catch: () => new InvalidVerificationInput({})
  }).pipe(
    Effect.flatMap(identity),
    Effect.flatMap(Schema.decode(Schema.Uint8Array)),
    Effect.mapError(() => new InvalidVerificationInput({}))
  )

export const detachVerificationInputs = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<typeof VerificationInput.Type, InvalidVerificationInput> =>
  Effect.try({
    try: () => Schema.decodeUnknownEither(VerificationInput)({ signature, message, publicKey }),
    catch: () => new InvalidVerificationInput({})
  }).pipe(
    Effect.flatMap(identity),
    Effect.flatMap((input) =>
      Effect.all({
        signature: copyBytes(input.signature),
        message: copyBytes(input.message),
        publicKey: copyBytes(input.publicKey)
      })
    ),
    Effect.mapError(() => new InvalidVerificationInput({}))
  )

export const detachMlDsaVerificationInputs = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
  context: Uint8Array
) =>
  Effect.try({
    try: () => Schema.decodeUnknownEither(MlDsaContext)(context),
    catch: () => new InvalidVerificationInput({})
  }).pipe(
    Effect.flatMap(identity),
    Effect.flatMap(copyBytes),
    Effect.flatMap((detachedContext) =>
      detachVerificationInputs(signature, message, publicKey).pipe(
        Effect.map((inputs) => Record.set(inputs, "context", detachedContext))
      )
    ),
    Effect.mapError(() => new InvalidVerificationInput({}))
  )
