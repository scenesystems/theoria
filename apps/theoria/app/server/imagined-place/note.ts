import { Effect, Option, Stream } from "effect"

import { hkdfSha256 } from "@scenesystems/digest"
import { type Cipher, Envelope } from "@scenesystems/seal"
import { deriveSharedSecret, utf8ToBytes } from "@scenesystems/sign"

import type { SealedNote } from "../../contracts/imagined-place-result.js"
import type { ParticipantRole } from "../../contracts/imagined-place.js"
import { PlaceBuildError } from "../../contracts/imagined-place.js"

import { type ParticipantKeys, Participants } from "./authority.js"

const noteContext = utf8ToBytes("theoria/imagined-place/sealed-note/v1")

/**
 * Both sides derive the same sealing key: X25519 agreement between the
 * sender's secret key and the recipient's public key (or vice versa), then
 * HKDF-SHA256 bound to this demo's context string. Neither side ever sends
 * the key.
 */
const sealingKey = (mine: ParticipantKeys, theirs: ParticipantKeys) =>
  Effect.gen(function*() {
    const shared = yield* deriveSharedSecret("x25519", mine.agreement.secretKey, theirs.agreement.publicKey)
    return yield* hkdfSha256(shared.sharedSecret, Option.none(), noteContext, 32)
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

    const envelope = yield* Envelope.encrypt(
      "xchacha20-poly1305",
      yield* sealingKey(sender, recipient),
      utf8ToBytes(text)
    )
    const packed = yield* Envelope.toBytes(envelope)

    const opened = yield* Envelope.decrypt(yield* sealingKey(recipient, sender), envelope)

    const note: SealedNote = {
      from,
      to,
      agreement: "x25519",
      kdf: "hkdf-sha256",
      algorithm: "xchacha20-poly1305",
      envelopeBytes: packed.length,
      openedText: yield* Stream.make(opened).pipe(
        Stream.decodeText(),
        Stream.runFold("", (left, right) => left + right)
      )
    }
    return note
  }).pipe(Effect.mapError((cause) => new PlaceBuildError({ stage: "seal", message: String(cause) })))
