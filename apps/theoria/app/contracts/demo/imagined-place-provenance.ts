import { type Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { Id as CardId } from "../id.js"

/**
 * The demo's story in four steps, in the order they run on the server
 * (`server/imagined-place/run.ts`) and in the browser
 * (`atoms/imagined-place-render.ts`). Each is one thing the visitor can see
 * happen and one tab of the code panel.
 *
 * @since 0.3.0
 */
export const PlaceStep = Schema.Literal("compose", "propose", "record", "arrange")
export type PlaceStep = typeof PlaceStep.Type
export const placeSteps: ReadonlyArray<PlaceStep> = PlaceStep.literals

/**
 * The acts of the story as the page lays them out: the arrival, the three
 * acts on the spine, and the code that built it all. Each is a landmark in
 * the reading column; the stage answers the one in view.
 *
 * @since 0.3.0
 */
export const PlaceAct = Schema.Literal("arrive", "compose", "propose", "record", "build")
export type PlaceAct = typeof PlaceAct.Type

/**
 * The lines of the samples that produced something on the page, each by
 * name: what a site is, before where it is. A closed set, so what answers
 * for a site can be matched exhaustively, and a site is one value however
 * many places name it.
 *
 * @since 0.3.0
 */
export const CodeSiteId = Schema.Literal(
  "compose",
  "inference",
  "proposal-digest",
  "proposal-signature",
  "seal",
  "origin-digest",
  "merged-digest",
  "version-signature",
  "layout",
  "separation",
  "search"
)
export type CodeSiteId = typeof CodeSiteId.Type

/**
 * A line of the code sample, named by the step it is in and a substring
 * unique to it there, and the package that call comes from. The same
 * `match` keys the live value shown under that line.
 *
 * @since 0.3.0
 */
export const CodeSite = Schema.Struct({
  id: CodeSiteId,
  step: PlaceStep,
  match: Schema.String,
  package: CardId
})
export type CodeSite = typeof CodeSite.Type

const site = (id: CodeSiteId, step: PlaceStep, match: string, pkg: CardId): CodeSite => ({
  id,
  step,
  match,
  package: pkg
})

/**
 * Every line of the samples that produced something on the page. Each is
 * answered by the thing it made; each thing on the page is answered by its
 * line. The order within a step is the order of the lines in the sample.
 */
export const composeSite = site("compose", "compose", "composer.forward(", "effect-inference")
export const inferenceSite = site("inference", "compose", "InferenceTesting.staticLanguageModel(", "effect-inference")
export const proposalDigestSite = site("proposal-digest", "propose", "digestSchemaValue(Proposal,", "digest")
export const proposalSignatureSite = site("proposal-signature", "propose", "ed25519Sign(proposer.secretKey", "sign")
export const sealSite = site("seal", "propose", "seal(\"xchacha20-poly1305\"", "seal")
export const originDigestSite = site("origin-digest", "record", "digestSchemaValue(PlaceArtifact, origin,", "digest")
export const mergedDigestSite = site("merged-digest", "record", "digestSchemaValue(PlaceArtifact, merged,", "digest")
export const versionSignatureSite = site("version-signature", "record", "ed25519Sign(author.secretKey", "sign")
export const layoutSite = site("layout", "arrange", "Text.layoutLinesWith(", "effect-text")
export const separationSite = site("separation", "arrange", "Statistics.minimum(", "effect-math")
export const searchSite = site("search", "arrange", "Study.tell(", "effect-search")

export const allCodeSites: ReadonlyArray<CodeSite> = [
  composeSite,
  inferenceSite,
  proposalDigestSite,
  proposalSignatureSite,
  sealSite,
  originDigestSite,
  mergedDigestSite,
  versionSignatureSite,
  layoutSite,
  separationSite,
  searchSite
]

/**
 * Something on the page a visitor can point at and be answered about: a
 * feature's disc or name, a line of the drawn prose, a signature, a content
 * ID, a trial of the search, the recorded inference, the sealed note, or a
 * line of the code that made one of these. A mark is the whole of what is
 * remembered about the pointer; everything said about it is derived.
 *
 * @since 0.3.0
 */
export const PlaceMark = Schema.Union(
  Schema.TaggedStruct("Feature", { name: Schema.String }),
  Schema.TaggedStruct("Line", { index: Schema.Int }),
  Schema.TaggedStruct("Signature", { subject: Schema.String }),
  Schema.TaggedStruct("Digest", { contentId: Schema.String }),
  Schema.TaggedStruct("Trial", { index: Schema.Int }),
  Schema.TaggedStruct("Inference", {}),
  Schema.TaggedStruct("Note", {}),
  Schema.TaggedStruct("CodeLine", { step: PlaceStep, match: Schema.String })
)
export type PlaceMark = typeof PlaceMark.Type

/** How an answer became open; press answers stay pinned when the pointer leaves. */
export const AnswerOpening = Schema.Literal("hover", "press")
export type AnswerOpening = typeof AnswerOpening.Type

/** The single open provenance answer. */
export class PlaceAnswer extends Schema.Class<PlaceAnswer>("PlaceAnswer")({
  triggerId: Schema.String,
  mark: PlaceMark,
  opening: AnswerOpening
}) {}

/** A mark as one mounted trigger carries it: the element's id and the mark it stands for. */
export const MarkTrigger = Schema.Struct({ triggerId: Schema.String, mark: PlaceMark })
export type MarkTrigger = typeof MarkTrigger.Type

/** Where the pointer is within the provenance interaction region. */
export const PointerOver = Schema.Union(
  Schema.TaggedStruct("Mark", MarkTrigger.fields),
  Schema.TaggedStruct("Answer", {})
)
export type PointerOver = typeof PointerOver.Type

/** A delayed decision made by the owned hover-intent process. */
export const HoverIntent = Schema.Union(
  Schema.TaggedStruct("Open", MarkTrigger.fields),
  Schema.TaggedStruct("Close", {})
)
export type HoverIntent = typeof HoverIntent.Type

/** A press on a mark, as the popover reports it: whether it would open, and which mark. */
export const MarkPress = Schema.Struct({ opening: Schema.Boolean, pressed: MarkTrigger })
export type MarkPress = typeof MarkPress.Type

/**
 * What a press does: `Leave` keeps the answer exactly as it is and the
 * popover's own change is cancelled; `Pin` likewise cancels the popover's
 * close and makes a hover answer a pressed one; `Answer` is the new answer.
 */
export const PressOutcome = Schema.Union(
  Schema.TaggedStruct("Leave", {}),
  Schema.TaggedStruct("Pin", { answer: PlaceAnswer }),
  Schema.TaggedStruct("Answer", { answer: Schema.Option(PlaceAnswer) })
)
export type PressOutcome = typeof PressOutcome.Type

/** A mark carried on an element as one attribute value, and read back from it. */
export const PlaceMarkAttribute = Schema.parseJson(PlaceMark)

export const encodeMark = Schema.encodeSync(PlaceMarkAttribute)
export const decodeMark: (value: unknown) => Option.Option<PlaceMark> = Schema.decodeUnknownOption(
  PlaceMarkAttribute
)

/** The call a site's line makes, by name: `composer.forward(` is `composer.forward`. */
export const codeSiteCall = (site: CodeSite): string => site.match.slice(0, site.match.indexOf("("))

/** The code site a code-line mark names, if the sample has such a line. */
export const codeSiteOf = (step: PlaceStep, match: string): Option.Option<CodeSite> =>
  Arr.findFirst(allCodeSites, (candidate) => candidate.step === step && candidate.match === match)

/** The code site a line of `step`'s sample is, if the line is one that made something on the page. */
export const codeSiteOnLine = (step: PlaceStep, line: string): Option.Option<CodeSite> =>
  Arr.findFirst(allCodeSites, (candidate) => candidate.step === step && line.includes(candidate.match))

/**
 * What a visitor pointing at a mark is told: what it is, the facts about it
 * worth a line each, and the line of code that made it. `copy` is a value
 * worth putting on the clipboard whole, such as a content ID.
 *
 * @since 0.3.0
 */
export const ProvenanceFact = Schema.Struct({
  label: Schema.String,
  value: Schema.String
})
export type ProvenanceFact = typeof ProvenanceFact.Type

export const PlaceProvenance = Schema.Struct({
  /** The mark answered: for a code line, the mark of the thing it made. */
  mark: PlaceMark,
  title: Schema.String,
  /** The thing's own words, when it has any: a feature's description. */
  detail: Schema.Option(Schema.String),
  facts: Schema.Array(ProvenanceFact),
  site: CodeSite,
  copy: Schema.Option(Schema.String)
})
export type PlaceProvenance = typeof PlaceProvenance.Type
