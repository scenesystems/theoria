import { Context, Effect, Encoding, Inspectable, Layer, Schema, String as Str, Struct } from "effect"

import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import * as Digest from "@scenesystems/digest/Digest"
import { Bytes, Ed25519, Entropy, KeyPair, X25519 } from "@scenesystems/sign"

import { SignatureRecord } from "../../contracts/imagined-place-result.js"
import { ParticipantRole, PlaceArtifact, PlaceBuildError, Proposal } from "../../contracts/imagined-place.js"

/**
 * One participant's keys: an Ed25519 pair for signing and an X25519 pair for
 * agreeing on a sealing key with another participant.
 */
export const ParticipantKeys = Schema.Struct({ signing: KeyPair.KeyPair, agreement: KeyPair.KeyPair })
export type ParticipantKeys = typeof ParticipantKeys.Type

export const ParticipantSet = Schema.Record({ key: ParticipantRole, value: ParticipantKeys })
export type ParticipantSet = typeof ParticipantSet.Type

/**
 * Session keys for the three participants. They are generated once per
 * process and prove only that this server signed on a participant's behalf;
 * the UI labels every verification "valid for session key".
 */
export class Participants extends Context.Tag("@theoria/app/server/imagined-place/Participants")<
  Participants,
  ParticipantSet
>() {}

const participantKeys: Effect.Effect<ParticipantKeys, KeyPair.GenerationFailed, Entropy.Entropy> = Effect.all({
  signing: Ed25519.generateKeyPair(),
  agreement: X25519.generateKeyPair()
}).pipe(Effect.map(ParticipantKeys.make))

export const ParticipantsLive = Layer.effect(
  Participants,
  Effect.all({ author: participantKeys, neighbor: participantKeys, program: participantKeys }).pipe(
    Effect.map(ParticipantSet.make)
  )
).pipe(Layer.provide(Entropy.layer))

const identityError = (cause: unknown) =>
  new PlaceBuildError({ stage: "identity", message: Inspectable.toStringUnknown(cause) })

/**
 * Content identity is a BLAKE3 digest of the canonical encoding of a value.
 * Versions and proposals are digested with their own schemas so each keeps an
 * identity that survives being merged into something else.
 */
export const versionId = (artifact: PlaceArtifact): Effect.Effect<string, PlaceBuildError> =>
  ContentDigest.fromSchema(PlaceArtifact, artifact, "blake3-256").pipe(
    Effect.map(ContentDigest.toString),
    Effect.mapError(identityError)
  )

export const proposalId = (proposal: Proposal): Effect.Effect<string, PlaceBuildError> =>
  ContentDigest.fromSchema(Proposal, proposal, "blake3-256").pipe(
    Effect.map(ContentDigest.toString),
    Effect.mapError(identityError)
  )

export const fingerprint = (publicKey: Uint8Array): string =>
  Str.takeLeft(Encoding.encodeHex(Digest.hash("blake3-256", publicKey)), 16)

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
    const key = Struct.get(signer)(participants).signing
    const message = Bytes.fromString(subject)
    const signature = yield* Ed25519.sign(message, key.secretKey, key.publicKey)
    const valid = yield* Ed25519.verify(signature.signature, message, key.publicKey)
    const keyFingerprint = fingerprint(key.publicKey)
    return SignatureRecord.make({
      signer,
      subject,
      algorithm: "ed25519",
      keyFingerprint,
      signatureHex: Encoding.encodeHex(signature.signature),
      valid
    })
  }).pipe(
    Effect.mapError((cause) => new PlaceBuildError({ stage: "signature", message: Inspectable.toStringUnknown(cause) }))
  )
