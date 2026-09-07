import { Match, Option } from "effect"
import * as Arr from "effect/Array"

import { renderTrials } from "../../../contracts/demo/imagined-place-search.js"
import type {
  PlaceBuild,
  PlaceEvidence,
  PlaceMarker,
  PlaceProjection,
  ProposalRecord,
  SealedNote,
  SignatureRecord,
  Version
} from "../../../contracts/imagined-place-result.js"
import type { ParticipantRole, PlaceArtifact } from "../../../contracts/imagined-place.js"
import type { CardTone } from "../../../contracts/theme.js"
import type { PlaceSearch } from "../../atoms/imagined-place-render.js"
import { type ToneClasses, toneClassesFor } from "../primitives/designSystem.js"

/**
 * Pure formatting for the home-page demo. Everything here turns a build or a
 * render frame into strings; nothing here reads atoms or touches the DOM.
 */

/** Content IDs look like `blake3-256:…`; the short form keeps the first characters of the digest itself. */
export const shortId = (id: string): string => `${id.slice(id.indexOf(":") + 1, id.indexOf(":") + 11)}…`

const participants: ReadonlyArray<ParticipantRole> = ["author", "neighbor", "program"]

/** Who has a feature in this version: the author always, and each proposer whose proposal was merged. */
export const presentParticipants = (artifact: PlaceArtifact): ReadonlyArray<ParticipantRole> =>
  Arr.filter(
    participants,
    (role) => role === "author" || Arr.some(artifact.accepted, (proposal) => proposal.proposer === role)
  )

export const participantLabel = (role: ParticipantRole): string =>
  Match.value(role).pipe(
    Match.when("author", () => "You"),
    Match.when("neighbor", () => "Neighbor"),
    Match.when("program", () => "Proposer program"),
    Match.exhaustive
  )

/**
 * One accent per participant, used everywhere that participant appears: on
 * markers, proposal cards, signature pills and the legend. The author's is the
 * signing tone, the neighbor's the sealing tone, the program's the dsp tone.
 */
export const participantTone = (role: ParticipantRole): CardTone =>
  Match.value(role).pipe(
    Match.when("author", (): CardTone => "sign"),
    Match.when("neighbor", (): CardTone => "seal"),
    Match.when("program", (): CardTone => "dsp"),
    Match.exhaustive
  )

/** Features from the composition belong to the author, who signed version 1. */
export const markerContributor = (marker: PlaceMarker): ParticipantRole =>
  Option.getOrElse(Option.fromNullable(marker.contributedBy), (): ParticipantRole => "author")

export const markerTone = (marker: PlaceMarker): ToneClasses =>
  toneClassesFor(participantTone(markerContributor(marker)))

/**
 * The disc itself: a soft radial fill lit from the upper left, an inset ring
 * and a low shadow, in the contributor's tone. Full literals per participant
 * because Tailwind purges anything assembled at run time.
 */
export const discClassName = (role: ParticipantRole): string =>
  Match.value(role).pipe(
    Match.when(
      "author",
      () => "bg-place-disc-sign ring-1 ring-inset ring-tone-sign-300/60 shadow-chip"
    ),
    Match.when(
      "neighbor",
      () => "bg-place-disc-seal ring-1 ring-inset ring-tone-seal-300/60 shadow-chip"
    ),
    Match.when(
      "program",
      () => "bg-place-disc-dsp ring-1 ring-inset ring-tone-dsp-300/60 shadow-chip"
    ),
    Match.exhaustive
  )

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

export const signatureFor = (
  signatures: ReadonlyArray<SignatureRecord>,
  subject: string
): Option.Option<SignatureRecord> => Arr.findFirst(signatures, (signature) => signature.subject === subject)

/** The version being drawn: the last in the lineage. */
export const currentVersion = (evidence: PlaceEvidence): Option.Option<Version> => Arr.last(evidence.lineage)

/** A merged proposal is part of the current version; the pill on its card names which one. */
export const mergedIntoText = (evidence: PlaceEvidence): string =>
  Option.match(currentVersion(evidence), {
    onNone: () => "Merged",
    onSome: (version) => `In v${String(version.version)}`
  })

export const isCurrentVersion = (evidence: PlaceEvidence, version: Version): boolean =>
  Option.exists(currentVersion(evidence), (current) => current.contentId === version.contentId)

/** The knot's label: the first version is the origin; every later one is the current version while it is last. */
export const knotLabel = (version: Version): string =>
  `V${String(version.version)} · ${Option.isNone(Option.fromNullable(version.parent)) ? "Origin" : "Current"}`

/** The envelope as anyone but the author sees it: sealed, and this big. */
export const sealedNoteLabel = (note: SealedNote): string => `Sealed note · ${String(note.envelopeBytes)} bytes`

const leadingWords = (text: string, count: number): string => text.split(" ").slice(0, count).join(" ")

/**
 * The line of the drawn prose where a proposal's sentence begins, once it is
 * merged: the margin the proposal belongs beside. The sentence's first words
 * are looked for whole, then fewer of them, since a line may wrap inside
 * them. Declined proposals have no line, as they are not in the prose.
 */
export const proposalAnchorLine = (projection: PlaceProjection, record: ProposalRecord): Option.Option<number> =>
  record.accepted
    ? Option.orElse(
      Arr.findFirstIndex(
        projection.lines,
        (line) => line.text.includes(leadingWords(record.proposal.feature.description, 3))
      ),
      () =>
        Arr.findFirstIndex(
          projection.lines,
          (line) => line.text.includes(leadingWords(record.proposal.feature.description, 1))
        )
    )
    : Option.none()

/** What the version added: the origin's feature count, or each merged proposal with who offered it. */
export const versionChanges = (build: PlaceBuild, version: Version): ReadonlyArray<string> =>
  Option.match(Option.fromNullable(version.parent), {
    onNone: () => [`${String(version.featureCount)} features from your brief`],
    onSome: () =>
      Arr.map(
        Arr.filter(build.proposals, (record: ProposalRecord) => record.accepted),
        (record) => `+ ${record.proposal.feature.name} · ${participantLabel(record.proposal.proposer)}`
      )
  })

/** The trial the stage draws: the one chosen from the trace if it exists, else the best. */
export const shownTrialIndex = (search: PlaceSearch, preview: Option.Option<number>): number =>
  Option.getOrElse(
    Option.filter(preview, (index) => index >= 0 && index < search.tried.length),
    () => search.bestIndex
  )

/**
 * Whether the search is still under way for whoever reads it: trials coming
 * in, or the drawing still travelling to the best. The caption, the trace and
 * the code's live values report progress until the discs have landed, so
 * nothing announces a result the stage has not shown yet.
 */
export const searching = (search: PlaceSearch): boolean =>
  Match.value(search.phase).pipe(
    Match.when("running", () => true),
    Match.when("landing", () => true),
    Match.when("complete", () => false),
    Match.exhaustive
  )

const lossOf = (search: PlaceSearch, index: number): Option.Option<number> =>
  Option.map(Arr.get(search.tried, index), (arrangement) => arrangement.quality.loss)

/**
 * The search, captioned as measure · value · scope. While it runs, how far it
 * is; when it stops, which trial the stage draws and what it scored. "Loss"
 * is the word the code panel uses for the same number.
 */
export const renderProgressText = (search: PlaceSearch, shown: number): string =>
  searching(search)
    ? `Searching arrangements · ${String(search.tried.length)} of ${String(renderTrials)}`
    : Option.match(lossOf(search, shown), {
      onNone: () => `${String(search.tried.length)} arrangements tried`,
      onSome: (loss) =>
        shown === search.bestIndex
          ? `Kept trial ${String(shown + 1)} of ${String(search.tried.length)} · loss ${loss.toFixed(3)}`
          : `Trial ${String(shown + 1)} of ${String(search.tried.length)} · loss ${loss.toFixed(3)} · not kept`
    })

/** The way back from a rejected trial: the kept one, by number. */
export const keptTrialLabel = (search: PlaceSearch): string => `Kept trial ${String(search.bestIndex + 1)}`

/** What a screen reader hears for the trace thumb. */
export const trialValueText = (search: PlaceSearch, index: number): string =>
  Option.match(lossOf(search, index), {
    onNone: () => `Trial ${String(index + 1)}, not tried yet`,
    onSome: (loss) =>
      `Trial ${String(index + 1)} of ${String(search.tried.length)}, loss ${loss.toFixed(3)}${
        index === search.bestIndex ? ", kept" : ""
      }`
  })

export const stagePresetLabel = (width: number): string => `${String(width)} px`

/** Presets closer together than this draw almost the same picture. */
const presetGapMin = 80

/**
 * The widths worth choosing between: the fixed presets that fit with room to
 * spare, then the full column. Below two there is nothing to choose.
 */
export const drawablePresets = (presets: ReadonlyArray<number>, maxDrawable: number): ReadonlyArray<number> => {
  const fitting = Arr.append(
    Arr.filter(presets, (preset) => preset + presetGapMin <= maxDrawable),
    maxDrawable
  )
  return fitting.length >= 2 ? fitting : []
}

export const briefCountText = (length: number, max: number): string => `${String(length)} / ${String(max)}`
