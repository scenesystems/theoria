import { Effect, Inspectable, Option, Stream, String } from "effect"

import { hkdfSha256 } from "@scenesystems/digest"
import { type Cipher, Envelope } from "@scenesystems/seal"
import { deriveSharedSecret } from "@scenesystems/sign"

import { SealedNote } from "../../contracts/imagined-place-result.js"
import type { ParticipantRole } from "../../contracts/imagined-place.js"
import { PlaceBuildError } from "../../contracts/imagined-place.js"

import { type ParticipantKeys, Participants } from "./authority.js"

const noteContext = Stream.make("theoria/imagined-place/sealed-note/v1").pipe(
  Stream.encodeText,
  Stream.runHead,
  Effect.flatten
)

/**
 * Both sides derive the same sealing key: X25519 agreement between the
 * sender's secret key and the recipient's public key (or vice versa), then
 * HKDF-SHA256 bound to this demo's context string. Neither side ever sends
 * the key.
 */
const sealingKey = (mine: ParticipantKeys, theirs: ParticipantKeys) =>
  Effect.gen(function*() {
    const shared = yield* deriveSharedSecret("x25519", mine.agreement.secretKey, theirs.agreement.publicKey)
    return yield* hkdfSha256(shared.sharedSecret, Option.none(), yield* noteContext, 32)
  })

/**
 * The sender seals the note to the recipient; the recipient opens it with
 * their own key. The result records the sizes and the text the recipient read.
 */
export const sendSealedNote = (
  from: ParticipantRole,
  to: ParticipantRole,
  text: string
): Effect.Effect<SealedNote, PlaceBuildError, Participants | Cipher.Cipher> =>
  Effect.gen(function*() {
    const participants = yield* Participants
    const sender = participants[from]
    const recipient = participants[to]
    const plaintext = yield* Stream.make(text).pipe(Stream.encodeText, Stream.runHead, Effect.flatten)

    const envelope = yield* Envelope.encrypt(
      "xchacha20-poly1305",
      yield* sealingKey(sender, recipient),
      plaintext
    )
    const packed = yield* Envelope.toBytes(envelope)

    const opened = yield* Envelope.decrypt(envelope, yield* sealingKey(recipient, sender))

    return SealedNote.make({
      from,
      to,
      agreement: "x25519",
      kdf: "hkdf-sha256",
      algorithm: "xchacha20-poly1305",
      envelopeBytes: packed.length,
      openedText: yield* Stream.make(opened).pipe(
        Stream.decodeText(),
        Stream.runFold("", String.concat)
      )
    })
  }).pipe(
    Effect.mapError((cause) => new PlaceBuildError({ stage: "seal", message: Inspectable.toStringUnknown(cause) }))
  )
