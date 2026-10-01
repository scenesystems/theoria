import { BigDecimal, BigInt as BI, Boolean as Bool, Equal, Inspectable, Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Num from "effect/Number"
import * as Str from "effect/String"

import { contributorsOf } from "../../../contracts/demo/imagined-place-arrangement.js"
import type { PlaceAct } from "../../../contracts/demo/imagined-place-provenance.js"
import { renderTrials } from "../../../contracts/demo/imagined-place-search.js"
import {
  type PlaceEvidence,
  PlaceMarker,
  type PlaceProjection,
  type ProposalRecord,
  type SealedNote,
  type SignatureRecord,
  type Version
} from "../../../contracts/imagined-place-result.js"
import {
  type OfferedProposal,
  ParticipantRole,
  placeFeatures,
  type PlaceOutline,
  type VersionShape
} from "../../../contracts/imagined-place.js"
import type { Tone } from "../../../contracts/theme.js"
import type { PlaceDiscDrawn, PlaceSearch, PlaceWait, StageFailure } from "../../atoms/imagined-place-render.js"
import type { MotionPreference } from "../../atoms/motion.js"
import {
  discFillClassName,
  discSlotClassName,
  silentOutlineClassName,
  type ToneClasses,
  toneClassesFor
} from "../primitives/designSystem.js"
import { departed, shiftTransition } from "../primitives/motion.js"
import type { PlaceholderMotion } from "../primitives/Skeleton.js"

/**
 * Pure formatting for the home-page demo. Everything here turns a build or a
 * render frame into strings; nothing here reads atoms or touches the DOM.
 */

/** Formats stage measurements with decimal half-away-from-zero rounding and retained trailing zeroes. */
export const fixedDecimal = (value: number, places: number): string =>
  Option.match(BigDecimal.safeFromNumber(value), {
    onNone: () => Inspectable.toStringUnknown(value),
    onSome: (decimal) => {
      const rounded = BigDecimal.scale(BigDecimal.round(decimal, { scale: places, mode: "half-from-zero" }), places)
      const digits = Str.padStart(Num.increment(places), "0")(
        Schema.encodeSync(Schema.BigInt)(BI.abs(rounded.value))
      )
      const separator = Num.subtract(Str.length(digits), places)
      const sign = Bool.match(BigDecimal.isNegative(decimal), { onTrue: () => "-", onFalse: () => "" })
      return Str.concat(
        sign,
        Bool.match(Equal.equals(places, 0), {
          onTrue: () => digits,
          onFalse: () => `${Str.slice(0, separator)(digits)}.${Str.slice(separator)(digits)}`
        })
      )
    }
  })

const numberText = (value: number): string => Inspectable.toStringUnknown(value)

/** Content IDs look like `blake3-256:…`; the short form keeps the first characters of the digest itself. */
export const shortId = (id: string): string => {
  const start = Option.match(Str.indexOf(":")(id), { onNone: () => 0, onSome: Num.increment })
  return `${Str.slice(start, Num.sum(start, 10))(id)}…`
}

/**
 * The room the build's evidence takes before it is here. A digest has the
 * authority's form — the algorithm, then 64 hex digits — so an ID cut to
 * either form is as long as the one that arrives; a key is named by eight of
 * its digits. The digits are room, not a digest: nothing reads them.
 */
const unknownDigest = Str.repeat(64)("0")
export const contentIdShape = `blake3-256:${unknownDigest}`
const keyDigits = (fingerprint: string): string => Str.takeLeft(fingerprint, 8)

/** Who has a feature in this version: the author always, and each proposer whose proposal was merged. */
export const presentParticipants = (place: PlaceOutline) =>
  Arr.filter(
    ParticipantRole.literals,
    (role) =>
      Bool.or(
        Equal.equals(role, "author"),
        Arr.some(place.accepted, (proposal) => Equal.equals(proposal.proposer, role))
      )
  )

export const participantLabel = (role: ParticipantRole): string =>
  Match.value(role).pipe(
    Match.when("author", () => "You"),
    Match.when("neighbor", () => "Neighbor"),
    Match.when("program", () => "Proposer program"),
    Match.exhaustive
  )

/**
 * One tone per participant, used everywhere that participant appears: on
 * markers, proposal cards, signature pills and the legend. The reader's own
 * voice is the primary, the neighbor's the secondary, the program's the
 * tertiary — colour on the page says who, and nothing else.
 */
export const participantTone = (role: ParticipantRole): Tone =>
  Match.value(role).pipe(
    Match.withReturnType<Tone>(),
    Match.when("author", () => "primary"),
    Match.when("neighbor", () => "secondary"),
    Match.when("program", () => "tertiary"),
    Match.exhaustive
  )

/** Features from the composition belong to the author, who signed version 1. */
export const markerContributor = (marker: PlaceMarker): ParticipantRole =>
  Option.getOrElse(Option.fromNullable(marker.contributedBy), (): ParticipantRole => "author")

export const markerTone = (marker: PlaceMarker): ToneClasses =>
  toneClassesFor(participantTone(markerContributor(marker)))

/**
 * One entry of the stage's marker legend: the feature a numbered disc stands
 * for, in its contributor's tone. The legend is laid from the outline before
 * the first drawing and from the drawing's markers after it — the same names
 * in the same order, so the first frame moves nothing under it.
 */
export const PlaceLegendEntry = Schema.Struct({
  name: Schema.String,
  contributedBy: ParticipantRole
})
export type PlaceLegendEntry = typeof PlaceLegendEntry.Type

export const legendFromOutline = (place: PlaceOutline) =>
  Arr.zipWith(placeFeatures(place), contributorsOf(place), (feature, contributor) =>
    PlaceLegendEntry.make({
      name: feature.name,
      contributedBy: Option.getOrElse(contributor, (): ParticipantRole => "author")
    }))

export const legendFromMarkers = (markers: Iterable<PlaceMarker>) =>
  Arr.map(
    Arr.fromIterable(markers),
    (marker) => PlaceLegendEntry.make({ name: marker.name, contributedBy: markerContributor(marker) })
  )

/** Under forced colours the ring is dropped with every shadow, so the disc keeps its edge as a `CanvasText` border on the `Canvas`. */
const discEdgeClassName = "forced-colors:border forced-colors:border-[CanvasText] forced-colors:bg-[Canvas]"

/**
 * The disc itself: a soft radial fill lit from the upper left, an inset ring
 * in the contributor's tone. Composed from the tone's disc slots; the palette
 * generator declares every composition for Tailwind to keep.
 */
export const discClassName = (role: ParticipantRole): string => {
  const tone = participantTone(role)
  return `${discFillClassName(tone)} ring-1 ring-inset ${discSlotClassName(tone, "ring")} ${discEdgeClassName}`
}

const actOutline = (tone: Tone): string => discSlotClassName(tone, "actOutline")

/**
 * The outline a disc wears while an act is in view. The outline is always
 * present and silent (`silentOutlineClassName`) when the act says nothing
 * about this disc, so only its colour ever transitions; Motion owns the
 * disc's opacity and must not find a CSS transition on it.
 */
export const discActOutline = (act: PlaceAct, marker: PlaceMarker): string => {
  const proposer = Option.fromNullable(marker.contributedBy)
  return Match.value(act).pipe(
    Match.when("compose", () =>
      Option.match(proposer, {
        onNone: () => actOutline(participantTone("author")),
        onSome: () => silentOutlineClassName
      })),
    Match.when("propose", () =>
      Option.match(proposer, {
        onNone: () => silentOutlineClassName,
        onSome: (role) => actOutline(participantTone(role))
      })),
    Match.when("record", () =>
      Option.match(proposer, {
        onNone: () => silentOutlineClassName,
        onSome: () => actOutline(participantTone("author"))
      })),
    Match.whenOr("arrive", "build", () => silentOutlineClassName),
    Match.exhaustive
  )
}

/** The ring a disc wears while the code line that placed it is under the pointer. */
export const discFocusRing = (role: ParticipantRole): string =>
  `data-[place-focused]:ring-2 ${discSlotClassName(participantTone(role), "focusRing")}`

/**
 * A disc in the band's miniature: the contributor's tone as a flat fill, or
 * as a dashed ring while the search is still making room for it; a disc
 * leaving keeps its fill as it shrinks. The stroke is kept at one width
 * whatever the miniature's scale; a disc answering the code line that made
 * it wears the contributor's ring, as on the stage. The fills sit close to
 * the strip in both modes, so the stroke in the tone's accent is the boundary
 * that stands out from the fill (≥ 3:1, held by the palette contract); focus
 * deepens and thickens it.
 */
export const bandDiscClassName = (role: ParticipantRole, drawn: PlaceDiscDrawn, focused: boolean): string => {
  const tone = participantTone(role)
  return Match.value(drawn).pipe(
    Match.when(
      "arriving",
      () =>
        `fill-none ${
          discSlotClassName(tone, "bandArrivingStroke")
        } stroke-2 [stroke-dasharray:4_3] [vector-effect:non-scaling-stroke]`
    ),
    Match.whenOr("settled", "trial", "leaving", () =>
      Bool.match(focused, {
        onTrue: () =>
          `${discSlotClassName(tone, "bandFill")} ${
            discSlotClassName(tone, "bandFocusedStroke")
          } stroke-[3] [vector-effect:non-scaling-stroke]`,
        onFalse: () =>
          `${discSlotClassName(tone, "bandFill")} ${
            discSlotClassName(tone, "bandStroke")
          } stroke-2 [vector-effect:non-scaling-stroke]`
      })),
    Match.exhaustive
  )
}

/** A disc of the place set in the band's row: the marker at its centre there. */
export const BandDisc = Schema.Struct({
  marker: PlaceMarker,
  cx: Schema.Number
})
export type BandDisc = typeof BandDisc.Type

/** The band's drawing, in the stage's own units: discs in a row on a strip of paper. */
export const BandRow = Schema.Struct({
  width: Schema.Number.pipe(Schema.positive()),
  height: Schema.Number.pipe(Schema.positive()),
  cy: Schema.Number,
  discs: Schema.Array(BandDisc)
})
export type BandRow = typeof BandRow.Type

/** Paper around the row, and paper between its discs, in stage units: a strip, not a sheet. */
const bandMargin = 6
const bandGap = 10

/**
 * The band drops the prose and keeps the discs, set in one row in the
 * proportions they have on the stage: a merge arrives as one more disc, a
 * code line pressed lights the disc it made. Their places on the sheet
 * are not kept — on a narrow stage they are one column beside the prose, and
 * a strip has no room for a sheet — so the row reads left to right in the
 * order the place names them. The row is in stage units; the strip draws it
 * at a line's height.
 */
export const bandRow = (projection: PlaceProjection): BandRow =>
  Arr.match(projection.markers, {
    onEmpty: () =>
      BandRow.make({
        width: Num.multiply(bandMargin, 2),
        height: Num.multiply(bandMargin, 2),
        cy: bandMargin,
        discs: Arr.empty()
      }),
    onNonEmpty: (markers) => {
      // Each disc's left edge; the last entry is where one more would start.
      const lefts = Arr.scan(
        markers,
        bandMargin,
        (left, marker) => Num.sumAll(Arr.make(left, Num.multiply(marker.radius, 2), bandGap))
      )
      const tallest = Arr.max(Arr.map(markers, (marker) => marker.radius), Num.Order)
      return BandRow.make({
        width: Num.sum(Num.subtract(Arr.lastNonEmpty(lefts), bandGap), bandMargin),
        height: Num.multiply(Num.sum(tallest, bandMargin), 2),
        cy: Num.sum(tallest, bandMargin),
        discs: Arr.zipWith(
          markers,
          lefts,
          (marker, left) => BandDisc.make({ marker, cx: Num.sum(left, marker.radius) })
        )
      })
    }
  })

/**
 * The band's name to assistive technology, from the row it draws: where the
 * link goes, and the features the row shows, in the row's order — so a
 * reader who cannot see the discs is told what the band carries, and a merge
 * that adds a disc adds a name. An empty row is only the way back.
 */
export const bandLabel = (row: BandRow): string =>
  Arr.match(row.discs, {
    onEmpty: () => "Back to the place",
    onNonEmpty: (discs) => `Back to the place: ${Arr.join(Arr.map(discs, (disc) => disc.marker.name), ", ")}`
  })

/**
 * How a disc takes its place in the row: fading in where it stands, and
 * sliding over at the shift relation as a merge shifts the row — or, under
 * reduced motion, placed outright where it now stands, fading in alone. `cx`
 * is not among the values Motion holds still for reduced motion, so it is
 * kept out of Motion's hands there and written as the attribute it is.
 */
export const bandDiscPlacing = (preference: MotionPreference, cx: number) =>
  Match.value(preference).pipe(
    Match.when("full", () => ({
      initial: { cx, opacity: 0 },
      animate: { cx, opacity: 1 },
      transition: { cx: shiftTransition }
    })),
    Match.when("reduced", () => ({ cx: fixedDecimal(cx, 1), initial: departed, animate: { opacity: 1 } })),
    Match.exhaustive
  )

/** A declined proposal's ghost: a dashed ring in the proposer's tone. */
export const ghostClassName = (role: ParticipantRole): string => discSlotClassName(participantTone(role), "ghost")

export const markerLabel = (marker: PlaceMarker): string =>
  Option.match(Option.fromNullable(marker.contributedBy), {
    onNone: () => marker.name,
    onSome: (role) => `${marker.name}, added by ${Str.toLocaleLowerCase("en-US")(participantLabel(role))}`
  })

/**
 * The attribute a focused element wears, as props to spread: present and
 * empty while focused, absent otherwise.
 */
const FocusedAttribute = Schema.Struct({ "data-place-focused": Schema.optional(Schema.Literal("")) })
export const focusedAttribute = (focused: boolean) =>
  Bool.match(focused, {
    onTrue: () => FocusedAttribute.make({ "data-place-focused": "" }),
    onFalse: () => FocusedAttribute.make({})
  })

/** What a region built from the place says of the build: here, or still pending. */
export const BuildPresence = Schema.Literal("built", "pending")
export type BuildPresence = typeof BuildPresence.Type
export const buildPresence = <A>(build: Option.Option<A>): BuildPresence =>
  Option.match(build, { onNone: (): BuildPresence => "pending", onSome: (): BuildPresence => "built" })

/** Whether an index is the first of a sequence: the one nothing stands before. */
export const isFirst = (index: number): boolean => Equal.equals(index, 0)

/** Whether an index is the last of a sequence this long. */
export const isLast = (index: number, count: number): boolean => Equal.equals(index, Num.decrement(count))

/**
 * A valid signature proves possession of a session key, not who a person is,
 * so the label names the key and nothing more.
 */
const verifiedLabel = (fingerprint: string): string => `Verified · key ${keyDigits(fingerprint)}`
export const signatureLabel = (signature: SignatureRecord): string =>
  Bool.match(signature.valid, {
    onTrue: () => verifiedLabel(signature.keyFingerprint),
    onFalse: () => "Signature did not verify"
  })
/** The room a proposal's signature takes before the build: verified, by a key yet to be named. */
export const signatureLabelShape = verifiedLabel(unknownDigest)

/** The author signs every version; the lineage pill says who and with which key. */
const signedLabel = (signer: ParticipantRole, fingerprint: string): string =>
  `${participantLabel(signer)} signed · key ${keyDigits(fingerprint)}`
export const versionSignatureLabel = (signature: SignatureRecord): string =>
  Bool.match(signature.valid, {
    onTrue: () => signedLabel(signature.signer, signature.keyFingerprint),
    onFalse: () => `${participantLabel(signature.signer)} signed · did not verify`
  })
/** The room a version's signature takes before the build: the author's, by a key yet to be named. */
export const versionSignatureLabelShape = signedLabel("author", unknownDigest)

export const signatureFor = (
  signatures: Iterable<SignatureRecord>,
  subject: string
): Option.Option<SignatureRecord> => Arr.findFirst(signatures, (signature) => Equal.equals(signature.subject, subject))

/** The version being drawn: the last in the lineage. */
export const currentVersion = (evidence: PlaceEvidence): Version => Arr.lastNonEmpty(evidence.lineage)

/** A merged proposal is part of the current version; the pill on its card names which one. */
export const mergedIntoText = (current: VersionShape): string => `In v${numberText(current.version)}`

export const isCurrentVersion = (evidence: PlaceEvidence, version: Version): boolean =>
  Equal.equals(currentVersion(evidence).contentId, version.contentId)

/** The first version in a lineage: the origin. */
const isOrigin = (shape: VersionShape): boolean => Equal.equals(shape.version, 1)

/** The knot's label: the first version is the origin; every later one is the current version while it is last. */
export const knotLabel = (shape: VersionShape): string =>
  `V${numberText(shape.version)} · ${Bool.match(isOrigin(shape), { onTrue: () => "Origin", onFalse: () => "Current" })}`

/** The version a knot on the strand records, once the build is here: the one of the knot's shape. */
export const versionOf = (evidence: PlaceEvidence, shape: VersionShape): Option.Option<Version> =>
  Arr.findFirst(evidence.lineage, (version) => Equal.equals(version.version, shape.version))

const sealedNoteText = (bytes: string): string => `Sealed note · ${bytes} bytes`
/** The envelope as anyone but the author sees it: sealed, and this big. */
export const sealedNoteLabel = (note: SealedNote): string => sealedNoteText(numberText(note.envelopeBytes))
/** The room the envelope takes before it is sealed: a size of three digits, as the notes run. */
export const sealedNoteLabelShape = sealedNoteText("000")

/** The text with its spaces taken out: where the lines break — between words or, on a narrow stage, inside one — no longer shows. */
const lettersOf = (text: string): string => Str.replaceAll(/\s+/gu, "")(text)

/**
 * The line of the drawn prose where a proposal's sentence begins, once it is
 * merged: the margin the proposal belongs beside. The whole sentence is
 * looked for in the prose the lines flow, read past the line breaks, and the
 * line holding its first letter is the answer — never a line that merely
 * holds its first word. Declined proposals have no line, as they are not in
 * the prose.
 */
export const proposalAnchorLine = (projection: PlaceProjection, record: ProposalRecord): Option.Option<number> =>
  Bool.match(record.accepted, {
    onFalse: () => Option.none(),
    onTrue: () => {
      const letters = Arr.map(projection.lines, (line) => lettersOf(line.text))
      // Where each line's letters end in the prose: the sentence begins on the first line that ends past its first letter.
      const ends = Arr.drop(Arr.scan(letters, 0, (sum, text) => Num.sum(sum, Str.length(text))), 1)
      return Option.flatMap(
        Str.indexOf(lettersOf(record.proposal.feature.description))(Arr.join(letters, "")),
        (start) => Arr.findFirstIndex(ends, (end) => Num.greaterThan(end, start))
      )
    }
  })

/** What the version added: the origin's feature count, or each merged proposal with who offered it. */
export const versionChanges = (offered: Iterable<OfferedProposal>, shape: VersionShape) =>
  Bool.match(isOrigin(shape), {
    onTrue: () => Arr.make(`${numberText(shape.featureCount)} features from your brief`),
    onFalse: () =>
      Arr.map(
        Arr.filter(Arr.fromIterable(offered), (proposal) => proposal.accepted),
        (proposal) => `+ ${proposal.proposal.feature.name} · ${participantLabel(proposal.proposal.proposer)}`
      )
  })

/** The trial the stage draws: the one chosen from the trace if it exists, else the best. */
export const shownTrialIndex = (search: PlaceSearch, preview: Option.Option<number>): number =>
  Option.getOrElse(
    Option.filter(preview, (index) => Option.isSome(Arr.get(search.tried, index))),
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

/** Trials are numbered from one for the reader, and from zero in the trace. */
const trialOrdinal = (index: number): string => numberText(Num.increment(index))

/** Whether the trial at this index is the one the search kept. */
export const isKept = (search: PlaceSearch, index: number): boolean => Equal.equals(index, search.bestIndex)

const searchingText = (tried: number): string =>
  `Searching arrangements · ${numberText(tried)} of ${numberText(renderTrials)}`
/** The room the caption takes before the search has started: the search, with nothing tried yet. */
export const searchCaptionShape = searchingText(0)

/**
 * The search, captioned as measure · value · scope. While it runs, how far it
 * is; when it stops, which trial the stage draws and what it scored. "Loss"
 * is the word the code panel uses for the same number.
 */
export const renderProgressText = (search: PlaceSearch, shown: number): string =>
  Bool.match(searching(search), {
    onTrue: () => searchingText(Arr.length(search.tried)),
    onFalse: () =>
      Option.match(lossOf(search, shown), {
        onNone: () => `${numberText(Arr.length(search.tried))} arrangements tried`,
        onSome: (loss) =>
          Bool.match(isKept(search, shown), {
            onTrue: () =>
              `Kept trial ${trialOrdinal(shown)} of ${numberText(Arr.length(search.tried))} · loss ${
                fixedDecimal(loss, 3)
              }`,
            onFalse: () =>
              `Trial ${trialOrdinal(shown)} of ${numberText(Arr.length(search.tried))} · loss ${
                fixedDecimal(loss, 3)
              } · not kept`
          })
      })
  })

/** The way back from a rejected trial: the kept one, by number. */
export const keptTrialLabel = (search: PlaceSearch): string => `Kept trial ${trialOrdinal(search.bestIndex)}`

/**
 * What the caption's row says in the search's place when the stage has
 * failed: what failed, or that the run asked for in its place is under way.
 */
export const stageFailureText = (failure: StageFailure): string =>
  Match.value(failure).pipe(
    Match.when({ failed: "build", waiting: false }, () => "The place could not be built."),
    Match.when({ failed: "build", waiting: true }, () => "Building the place again."),
    Match.when({ failed: "draw", waiting: false }, () => "The place could not be drawn."),
    Match.when({ failed: "draw", waiting: true }, () => "Drawing the place again."),
    Match.exhaustive
  )

/** What stands in for the drawing breathes while one is on its way, and holds still when none is coming. */
export const waitMotion = (wait: PlaceWait): PlaceholderMotion =>
  Match.value(wait).pipe(
    Match.when("pending", (): PlaceholderMotion => "breathing"),
    Match.when("failed", (): PlaceholderMotion => "still"),
    Match.exhaustive
  )

/** The run that answers the failure: the build again, or the drawing again. */
export const stageFailureActionLabel = (failure: StageFailure): string =>
  Match.value(failure.failed).pipe(
    Match.when("build", () => "Try again"),
    Match.when("draw", () => "Draw again"),
    Match.exhaustive
  )

/** What a screen reader hears for the trace thumb. */
export const trialValueText = (search: PlaceSearch, index: number): string =>
  Option.match(lossOf(search, index), {
    onNone: () => `Trial ${trialOrdinal(index)}, not tried yet`,
    onSome: (loss) =>
      `Trial ${trialOrdinal(index)} of ${numberText(Arr.length(search.tried))}, loss ${fixedDecimal(loss, 3)}${
        Bool.match(isKept(search, index), { onTrue: () => ", kept", onFalse: () => "" })
      }`
  })

export const stagePresetLabel = (width: number): string => `${numberText(width)} px`

/** Presets closer together than this draw almost the same picture. */
const presetGapMin = 80

/**
 * The widths worth choosing between: the fixed presets that fit with room to
 * spare, then the full column. Below two there is nothing to choose.
 */
export const drawablePresets = (presets: Iterable<number>, maxDrawable: number) => {
  const fitting = Arr.append(
    Arr.filter(
      Arr.fromIterable(presets),
      (preset) => Num.lessThanOrEqualTo(Num.sum(preset, presetGapMin), maxDrawable)
    ),
    maxDrawable
  )
  return Bool.match(Num.greaterThanOrEqualTo(Arr.length(fitting), 2), {
    onTrue: () => fitting,
    onFalse: () => Arr.empty<number>()
  })
}

export const briefCountText = (length: number, max: number): string => `${numberText(length)} / ${numberText(max)}`
