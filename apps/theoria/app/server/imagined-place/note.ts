import { Cause, Effect, Option, Struct } from "effect"

import * as Hkdf from "@scenesystems/digest/Hkdf"
import { seal, unpackEnvelope, unseal, utf8FromBytes, utf8ToBytes } from "@scenesystems/seal"
import { X25519 } from "@scenesystems/sign"

import { SealedNote } from "../../contracts/imagined-place-result.js"
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
    const shared = yield* X25519.deriveSharedSecret(mine.agreement.secretKey, theirs.agreement.publicKey)
    return yield* Hkdf.sha256(shared.sharedSecret, Option.none(), noteContext, 32)
  })

/**
 * The sender seals the note to the recipient; the recipient opens it with
 * their own key. The result records the sizes and the text the recipient read.
 */
export const sendSealedNote = (
  from: ParticipantRole,
  to: ParticipantRole,
  text: string
): Effect.Effect<SealedNote, PlaceBuildError, Participants> =>
  Effect.gen(function*() {
    const participants = yield* Participants
    const sender = Struct.get(from)(participants)
    const recipient = Struct.get(to)(participants)

    const envelope = yield* seal("xchacha20-poly1305", yield* sealingKey(sender, recipient), utf8ToBytes(text))
    const packed = yield* unpackEnvelope(envelope)

    const opened = yield* unseal(yield* sealingKey(recipient, sender), envelope)

    return SealedNote.make({
      from,
      to,
      agreement: "x25519",
      kdf: "hkdf-sha256",
      algorithm: "xchacha20-poly1305",
      envelopeBytes: packed.length,
      openedText: utf8FromBytes(opened)
    })
  }).pipe(
    Effect.mapError((cause) => new PlaceBuildError({ stage: "seal", message: Cause.pretty(Cause.fail(cause)) }))
  )
