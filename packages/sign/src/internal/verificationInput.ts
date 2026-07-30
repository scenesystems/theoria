import { Effect } from "effect"
import { InvalidVerificationInput } from "../schemas/errors.js"

export const DIRECT_VERIFICATION_MAX_MESSAGE_BYTES = 8_192
export const ML_DSA_MAX_CONTEXT_BYTES = 255

const invalidInput = (): Effect.Effect<never, InvalidVerificationInput> => Effect.fail(new InvalidVerificationInput({}))

export const detachVerificationInputs = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<{
  readonly signature: Uint8Array
  readonly message: Uint8Array
  readonly publicKey: Uint8Array
}, InvalidVerificationInput> => {
  if (
    !(signature instanceof Uint8Array) ||
    !(message instanceof Uint8Array) ||
    !(publicKey instanceof Uint8Array) ||
    message.length > DIRECT_VERIFICATION_MAX_MESSAGE_BYTES
  ) {
    return invalidInput()
  }

  return Effect.succeed({
    signature: Uint8Array.from(signature),
    message: Uint8Array.from(message),
    publicKey: Uint8Array.from(publicKey)
  })
}

export const detachMlDsaVerificationInputs = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
  context: Uint8Array
) => {
  if (!(context instanceof Uint8Array) || context.length > ML_DSA_MAX_CONTEXT_BYTES) {
    return invalidInput()
  }
  const detachedContext = Uint8Array.from(context)
  return detachVerificationInputs(signature, message, publicKey).pipe(
    Effect.map((inputs) => ({ ...inputs, context: detachedContext }))
  )
}
