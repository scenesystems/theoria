import { Context, Effect, Layer } from "effect"

import { digestBytesHex, digestSchemaValue } from "@scenesystems/digest"
import {
  ed25519Keygen,
  ed25519Sign,
  ed25519Verify,
  generateKeyPair,
  type KeyPair,
  toHex,
  utf8ToBytes
} from "@scenesystems/sign"

import type { SignatureRecord } from "../../contracts/imagined-place-result.js"
import type { ParticipantRole, PlaceArtifact, Proposal } from "../../contracts/imagined-place.js"
import {
  PlaceArtifact as PlaceArtifactSchema,
  PlaceBuildError,
  Proposal as ProposalSchema
} from "../../contracts/imagined-place.js"

/**
 * One participant's keys: an Ed25519 pair for signing and an X25519 pair for
 * agreeing on a sealing key with another participant.
 */
export type ParticipantKeys = {
  readonly signing: KeyPair
  readonly agreement: KeyPair
}

export type ParticipantSet = {
  readonly [Role in ParticipantRole]: ParticipantKeys
}

/**
 * Session keys for the three participants. They are generated once per
 * process and prove only that this server signed on a participant's behalf;
 * the UI labels every verification "valid for session key".
 */
export class Participants extends Context.Tag("theoria/imagined-place/Participants")<
  Participants,
  ParticipantSet
>() {}

const participantKeys: Effect.Effect<ParticipantKeys> = Effect.all({
  signing: ed25519Keygen(),
  agreement: generateKeyPair("x25519").pipe(Effect.orDie)
})

export const ParticipantsLive = Layer.effect(
  Participants,
  Effect.all({ author: participantKeys, neighbor: participantKeys, program: participantKeys })
)

const identityError = (cause: unknown) => new PlaceBuildError({ stage: "identity", message: String(cause) })

/**
 * Content identity is a BLAKE3 digest of the canonical encoding of a value.
 * Versions and proposals are digested with their own schemas so each keeps an
 * identity that survives being merged into something else.
 */
export const versionId = (artifact: PlaceArtifact): Effect.Effect<string, PlaceBuildError> =>
  digestSchemaValue(PlaceArtifactSchema, artifact, "blake3-256").pipe(Effect.mapError(identityError))

export const proposalId = (proposal: Proposal): Effect.Effect<string, PlaceBuildError> =>
  digestSchemaValue(ProposalSchema, proposal, "blake3-256").pipe(Effect.mapError(identityError))

export const fingerprint = (publicKey: Uint8Array): Effect.Effect<string> =>
  Effect.map(digestBytesHex("blake3-256", publicKey), (hex) => hex.slice(0, 16))

/**
 * Signs a content ID with the participant's session key, then verifies it
 * immediately so the record carries a real verification result.
 */
export const signAs = (
  signer: ParticipantRole,
  subject: string
): Effect.Effect<SignatureRecord, PlaceBuildError, Participants> =>
  Effect.gen(function*() {
    const participants = yield* Participants
    const key = participants[signer].signing
    const message = utf8ToBytes(subject)
    const signature = yield* ed25519Sign(message, key.secretKey, key.publicKey)
    const valid = yield* ed25519Verify(signature.signature, message, key.publicKey)
    const keyFingerprint = yield* fingerprint(key.publicKey)
    const record: SignatureRecord = {
      signer,
      subject,
      algorithm: "ed25519",
      keyFingerprint,
      signatureHex: toHex(signature.signature),
      valid
    }
    return record
  }).pipe(Effect.mapError((cause) => new PlaceBuildError({ stage: "signature", message: String(cause) })))
