import { Schema } from "effect"

import { Envelope } from "./envelope.js"
import { ParticipantRole, PlaceArtifact, Proposal } from "./imagined-place.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const UnitInterval = Schema.Number.pipe(Schema.between(0, 1))

/**
 * A feature marker on the stage in pixels; `contributedBy` is set when the
 * feature came from an accepted proposal.
 *
 * @since 0.3.0
 */
export const PlaceMarker = Schema.Struct({
  name: NonEmptyString,
  x: Schema.Number,
  y: Schema.Number,
  radius: Schema.Number.pipe(Schema.positive()),
  contributedBy: Schema.optional(ParticipantRole)
})
export type PlaceMarker = typeof PlaceMarker.Type

export const PlaceLine = Schema.Struct({
  text: Schema.String,
  y: Schema.Number,
  maxWidth: Schema.Number,
  width: Schema.Number
})
export type PlaceLine = typeof PlaceLine.Type

/**
 * The place at one stage width: markers and the description flowing around
 * them. Changing the width changes this value and leaves the content ID
 * untouched.
 *
 * @since 0.3.0
 */
export const PlaceProjection = Schema.Struct({
  stageWidth: Schema.Number.pipe(Schema.positive()),
  stageHeight: Schema.Number.pipe(Schema.positive()),
  padding: Schema.Number,
  lineHeight: Schema.Number.pipe(Schema.positive()),
  markers: Schema.Array(PlaceMarker),
  lines: Schema.Array(PlaceLine)
})
export type PlaceProjection = typeof PlaceProjection.Type

export const InferenceEvidence = Schema.Struct({
  program: NonEmptyString,
  mode: Schema.Literal("recorded"),
  responseModel: NonEmptyString,
  serveMode: NonEmptyString,
  selectionReason: NonEmptyString
})
export type InferenceEvidence = typeof InferenceEvidence.Type

export const RenderEvidence = Schema.Struct({
  sampler: Schema.Literal("tpe"),
  seed: Schema.Int,
  trials: Schema.Int,
  bestLoss: Schema.Number,
  minimumSeparation: Schema.Number,
  lineCount: Schema.Int,
  narrowestLine: UnitInterval,
  raggedness: Schema.Number
})
export type RenderEvidence = typeof RenderEvidence.Type

export const Version = Schema.Struct({
  version: Schema.Int,
  contentId: NonEmptyString,
  parent: Schema.optional(NonEmptyString),
  featureCount: Schema.Int
})
export type Version = typeof Version.Type

/**
 * One signature, verified. `subject` names what was signed (a version's or a
 * proposal's content ID). A valid signature proves possession of the signer's
 * session key, not a person's identity; the UI says so.
 *
 * @since 0.3.0
 */
export const SignatureRecord = Schema.Struct({
  signer: ParticipantRole,
  subject: NonEmptyString,
  algorithm: Schema.Literal("ed25519"),
  keyFingerprint: NonEmptyString,
  signatureHex: NonEmptyString,
  valid: Schema.Boolean
})
export type SignatureRecord = typeof SignatureRecord.Type

export const ProposalRecord = Schema.Struct({
  proposal: Proposal,
  contentId: NonEmptyString,
  accepted: Schema.Boolean,
  signature: SignatureRecord
})
export type ProposalRecord = typeof ProposalRecord.Type

/**
 * A note the neighbor sealed to the author. The client receives the opened
 * text only because the author's key opened it; the sealing key is derived
 * from an X25519 agreement and never leaves the server.
 *
 * @since 0.3.0
 */
export const SealedNote = Schema.Struct({
  from: ParticipantRole,
  to: ParticipantRole,
  agreement: Schema.Literal("x25519"),
  kdf: Schema.Literal("hkdf-sha256"),
  algorithm: Schema.Literal("xchacha20-poly1305"),
  envelopeBytes: Schema.Int,
  openedText: Schema.String
})
export type SealedNote = typeof SealedNote.Type

export const PlaceEvidence = Schema.Struct({
  inference: Schema.Array(InferenceEvidence),
  lineage: Schema.Array(Version),
  signatures: Schema.Array(SignatureRecord),
  sealedNote: SealedNote
})
export type PlaceEvidence = typeof PlaceEvidence.Type

/**
 * What the server returns for one request: the place, every proposal with its
 * verdict, and the evidence for identity, authorship and inference. Rendering
 * happens wherever the place is shown, with that surface's real font metrics.
 *
 * @since 0.3.0
 */
export const PlaceBuild = Schema.Struct({
  artifact: PlaceArtifact,
  proposals: Schema.Array(ProposalRecord),
  evidence: PlaceEvidence,
  durationMs: Schema.Number
})
export type PlaceBuild = typeof PlaceBuild.Type

export const PlaceBuildEnvelope = Envelope(PlaceBuild)
export type PlaceBuildEnvelope = typeof PlaceBuildEnvelope.Type

/**
 * One rendering of a build, produced by the search over arrangements.
 *
 * @since 0.3.0
 */
export const PlaceRendering = Schema.Struct({
  projection: PlaceProjection,
  evidence: RenderEvidence
})
export type PlaceRendering = typeof PlaceRendering.Type
