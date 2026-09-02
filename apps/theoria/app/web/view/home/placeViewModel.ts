import { Match, Option } from "effect"
import * as Arr from "effect/Array"

import { renderTrials } from "../../../contracts/demo/imagined-place-arrangement.js"
import type {
  PlaceBuild,
  PlaceEvidence,
  PlaceMarker,
  SealedNote,
  SignatureRecord
} from "../../../contracts/imagined-place-result.js"
import type { ParticipantRole } from "../../../contracts/imagined-place.js"
import type { CardTone } from "../../../contracts/theme.js"
import type { PlaceRenderFrame } from "../../atoms/imagined-place-render.js"
import { neutralToneClasses, type ToneClasses, toneClassesFor } from "../primitives/designSystem.js"
import type { DisplayMetric } from "../primitives/MetricStrip.js"

/**
 * Pure formatting for the home-page demo. Everything here turns a build or a
 * render frame into strings; nothing here reads atoms or touches the DOM.
 */

/** Content IDs look like `blake3-256:…`; the short form keeps the first characters of the digest itself. */
export const shortId = (id: string): string => `${id.slice(id.indexOf(":") + 1, id.indexOf(":") + 11)}…`

export const participantLabel = (role: ParticipantRole): string =>
  Match.value(role).pipe(
    Match.when("author", () => "You"),
    Match.when("neighbor", () => "Neighbor"),
    Match.when("program", () => "Proposer program"),
    Match.exhaustive
  )

/** Who added a feature decides its accent: the neighbor's seal, the program's dsp. */
export const participantTone = (role: ParticipantRole): CardTone =>
  Match.value(role).pipe(
    Match.when("author", (): CardTone => "sign"),
    Match.when("neighbor", (): CardTone => "seal"),
    Match.when("program", (): CardTone => "dsp"),
    Match.exhaustive
  )

export const markerTone = (marker: PlaceMarker): ToneClasses =>
  Option.match(Option.fromNullable(marker.contributedBy), {
    onNone: () => neutralToneClasses,
    onSome: (role) => toneClassesFor(participantTone(role))
  })

export const markerLabel = (marker: PlaceMarker): string =>
  Option.match(Option.fromNullable(marker.contributedBy), {
    onNone: () => marker.name,
    onSome: (role) => `${marker.name}, added by ${participantLabel(role).toLocaleLowerCase("en-US")}`
  })

/**
 * A valid signature proves possession of a session key, not who a person is,
 * so the label names the key and nothing more.
 */
export const signatureLabel = (signature: SignatureRecord): string =>
  signature.valid ? `Verified · key ${signature.keyFingerprint.slice(0, 8)}` : "Signature did not verify"

/** The author signs every version; the lineage pill says who and with which key. */
export const versionSignatureLabel = (signature: SignatureRecord): string =>
  signature.valid
    ? `${participantLabel(signature.signer)} signed · key ${signature.keyFingerprint.slice(0, 8)}`
    : `${participantLabel(signature.signer)} signed · did not verify`

export const sealedNoteRoute = (note: SealedNote): string =>
  `${note.agreement} → ${note.kdf} → ${note.algorithm} · ${String(note.envelopeBytes)} bytes`

/** The version being drawn: the last in the lineage. */
export const currentVersionText = (evidence: PlaceEvidence): string =>
  Option.match(Arr.last(evidence.lineage), {
    onNone: () => "No version yet",
    onSome: (version) => `Version ${String(version.version)} · ${shortId(version.contentId)}`
  })

export const signatureFor = (
  signatures: ReadonlyArray<SignatureRecord>,
  subject: string
): Option.Option<SignatureRecord> => Arr.findFirst(signatures, (signature) => signature.subject === subject)

export const renderProgressText = (frame: PlaceRenderFrame): string =>
  frame.phase === "running"
    ? `Searching arrangements · trial ${String(frame.trial)} of ${String(renderTrials)}`
    : `${String(frame.rendering.evidence.trials)} arrangements searched · loss ${
      frame.rendering.evidence.bestLoss.toFixed(3)
    }`

/** The stage-width slider only appears when it has a range worth dragging. */
export const stageSliderRangeMin = 60

const inferenceMetric = (build: PlaceBuild): DisplayMetric => ({
  label: "Inference",
  value: `${String(build.evidence.inference.length)} programs · recorded`,
  appearance: { _tag: "tone", tone: "dsp" }
})

const lineageMetric = (build: PlaceBuild): DisplayMetric => ({
  label: "Lineage",
  value: `${String(build.evidence.lineage.length)} ${build.evidence.lineage.length === 1 ? "version" : "versions"} · ${
    String(Arr.filter(build.proposals, (record) => record.accepted).length)
  } merged`,
  appearance: { _tag: "tone", tone: "digest" }
})

const signaturesMetric = (build: PlaceBuild): DisplayMetric => {
  const valid = Arr.filter(build.evidence.signatures, (signature) => signature.valid).length
  const total = build.evidence.signatures.length
  return {
    label: "Signatures",
    value: `${String(valid)} of ${String(total)} valid · ed25519`,
    appearance: valid === total ? { _tag: "tone", tone: "sign" } : { _tag: "danger" }
  }
}

const sealMetric = (build: PlaceBuild): DisplayMetric => ({
  label: "Sealed note",
  value: `${String(build.evidence.sealedNote.envelopeBytes)} bytes · opened`,
  appearance: { _tag: "tone", tone: "seal" }
})

const renderMetrics = (frame: Option.Option<PlaceRenderFrame>): ReadonlyArray<DisplayMetric> =>
  Option.match(frame, {
    onNone: () => [],
    onSome: ({ rendering }) => [
      {
        label: "Search",
        value: `${String(rendering.evidence.trials)} trials · ${rendering.evidence.sampler} · seed ${
          String(rendering.evidence.seed)
        }`,
        appearance: { _tag: "tone", tone: "search" }
      },
      {
        label: "Layout",
        value: `${String(rendering.evidence.lineCount)} lines · ${
          String(Math.round(rendering.evidence.narrowestLine * 100))
        }% narrowest`,
        appearance: { _tag: "tone", tone: "text" }
      },
      {
        label: "Separation",
        value: `${(rendering.evidence.minimumSeparation * 100).toFixed(1)}% of width`,
        appearance: { _tag: "tone", tone: "math" }
      }
    ]
  })

export const buildMetrics = (
  build: PlaceBuild,
  frame: Option.Option<PlaceRenderFrame>
): ReadonlyArray<DisplayMetric> =>
  Arr.appendAll(
    [inferenceMetric(build), lineageMetric(build), signaturesMetric(build), sealMetric(build)],
    renderMetrics(frame)
  )

export const briefCountText = (length: number, max: number): string => `${String(length)} / ${String(max)}`
