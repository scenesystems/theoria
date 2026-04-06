import {
  batchVerify,
  BatchVerifyDetachedSignatureRequest,
  BatchVerifySignatureRequest,
  generateKeyPair,
  sign,
  signDetached,
  utf8ToBytes
} from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const ed25519 = yield* generateKeyPair("ed25519")
  const secp256k1 = yield* generateKeyPair("secp256k1-ecdsa")

  const releaseMessage = utf8ToBytes("release artifact")
  const policyMessage = utf8ToBytes("security policy")

  const signedRelease = yield* sign("ed25519", releaseMessage, ed25519.secretKey, ed25519.publicKey)
  const signedPolicy = yield* signDetached(
    "secp256k1-ecdsa",
    policyMessage,
    secp256k1.secretKey,
    secp256k1.publicKey
  )

  const report = yield* batchVerify([
    new BatchVerifySignatureRequest({
      kind: "self-describing",
      message: releaseMessage,
      signature: signedRelease
    }),
    new BatchVerifyDetachedSignatureRequest({
      kind: "detached",
      message: policyMessage,
      signature: signedPolicy,
      publicKey: secp256k1.publicKey
    })
  ])

  return report
})

export default program
