import { Equivalence, Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { markersBeside } from "../../../contracts/demo/imagined-place-flow.js"
import {
  type CodeSite,
  type CodeSiteId,
  codeSiteOf,
  composeSite,
  inferenceSite,
  layoutSite,
  mergedDigestSite,
  originDigestSite,
  type PlaceMark,
  type PlaceProvenance,
  proposalDigestSite,
  proposalSignatureSite,
  type ProvenanceFact,
  sealSite,
  searchSite,
  versionSignatureSite
} from "../../../contracts/demo/imagined-place-provenance.js"
import { renderTrials } from "../../../contracts/demo/imagined-place-search.js"
import {
  PlaceBuild,
  type PlaceMarker,
  type PlaceProjection,
  type ProposalRecord,
  type SignatureRecord,
  type Version
} from "../../../contracts/imagined-place-result.js"
import { type ParticipantRole, placeFeatures } from "../../../contracts/imagined-place.js"
import { PlaceRenderFrame, type PlaceSearch } from "../../atoms/imagined-place-render.js"

import { currentVersion, participantLabel, searching, shortId, signatureFor } from "./placeViewModel.js"

/**
 * What the page says about the thing under the pointer. Every answer is
 * read from the build the server returned and the frame the stage is
 * drawing this instant; nothing here is stored, so an answer can never
 * disagree with what is visible. Each names the line of code that made the
 * thing, and each such line is answered in turn by the thing it made.
 */

/**
 * What the page has to answer from: the build, once the server has
 * returned it, and the frame the stage is showing, once the search has
 * drawn one. Either may be missing; marks are answered from whichever
 * they need, so a signature is answered before a single disc is drawn,
 * and a line of the prose is answered from the drawing on the paper — the
 * trial being scrubbed, or a rendering on its way — not from the best
 * arrangement the search knows of.
 *
 * @since 0.3.0
 */
export const PlaceOnPage = Schema.Struct({
  build: Schema.Option(PlaceBuild),
  shown: Schema.Option(PlaceRenderFrame)
})
export type PlaceOnPage = typeof PlaceOnPage.Type

const fact = (label: string, value: string): ProvenanceFact => ({ label, value })

const answer = (
  mark: PlaceMark,
  title: string,
  facts: ReadonlyArray<ProvenanceFact>,
  site: CodeSite,
  copy: Option.Option<string> = Option.none()
): PlaceProvenance => ({ mark, title, detail: Option.none(), facts, site, copy })

/** A feature speaks for itself first: its description, then the facts. */
const described = (provenance: PlaceProvenance, detail: string): PlaceProvenance => ({
  ...provenance,
  detail: Option.some(detail)
})

/** The same answer, credited to the line of code that was pointed at rather than the one that made its subject. */
const creditedTo = (provenance: PlaceProvenance, site: CodeSite): PlaceProvenance => ({ ...provenance, site })

const proposalFor = (build: PlaceBuild, role: ParticipantRole): Option.Option<ProposalRecord> =>
  Arr.findFirst(build.proposals, (record) => record.proposal.proposer === role)

const proposalOfFeature = (build: PlaceBuild, name: string): Option.Option<ProposalRecord> =>
  Arr.findFirst(build.proposals, (record) => record.proposal.feature.name === name)

const versionFor = (build: PlaceBuild, contentId: string): Option.Option<Version> =>
  Arr.findFirst(build.evidence.lineage, (version) => version.contentId === contentId)

const proposalById = (build: PlaceBuild, contentId: string): Option.Option<ProposalRecord> =>
  Arr.findFirst(build.proposals, (record) => record.contentId === contentId)

const versionName = (version: Version): string => `v${String(version.version)}`

/** The trial a shown drawing is of, and whether the search kept it. */
const trialName = (search: PlaceSearch, index: number): string =>
  index === search.bestIndex ? `Trial ${String(index + 1)} · kept` : `Trial ${String(index + 1)} · not kept`

/** Two markers are the same disc: the same feature, at the same place, the same size. */
const sameDisc: Equivalence.Equivalence<PlaceMarker> = Equivalence.struct({
  name: Equivalence.string,
  x: Equivalence.number,
  y: Equivalence.number,
  radius: Equivalence.number
})

const sameDiscs = Arr.getEquivalence(sameDisc)

/**
 * Whether the drawing on the paper is the frame's trial itself, or a
 * drawing still on its way to it: the discs travel over many frames, and
 * only when every one stands where the trial put it is the trial what is
 * drawn.
 */
const arrivedAtTrial = (frame: PlaceRenderFrame): boolean =>
  Option.exists(
    Arr.get(frame.search.tried, frame.trial),
    (arrangement) => sameDiscs(frame.rendering.projection.markers, arrangement.markers)
  )

/** The drawing named as what it is: the trial it has arrived at, or the trial it is heading for. */
const drawingName = (frame: PlaceRenderFrame): string =>
  arrivedAtTrial(frame) ? trialName(frame.search, frame.trial) : `Toward trial ${String(frame.trial + 1)}`

/** Where a feature stands in the drawing on the paper, if it is drawn there. */
const drawnFacts = (shown: Option.Option<PlaceRenderFrame>, name: string): ReadonlyArray<ProvenanceFact> =>
  Option.match(
    Option.flatMap(shown, (frame) =>
      Option.map(
        Arr.findFirst(frame.rendering.projection.markers, (marker) => marker.name === name),
        (marker) => ({ frame, marker })
      )),
    {
      onNone: (): ReadonlyArray<ProvenanceFact> => [],
      onSome: ({ frame, marker }) => [
        fact("Drawn", `${drawingName(frame)} · r ${String(Math.round(marker.radius))} px`)
      ]
    }
  )

/** A feature from the brief was composed; one from a proposal was offered, and merged or declined. */
const featureAnswer = (mark: PlaceMark, page: PlaceOnPage, name: string): Option.Option<PlaceProvenance> =>
  Option.flatMap(page.build, (build) =>
    Option.match(proposalOfFeature(build, name), {
      onNone: () =>
        Option.map(
          Arr.findFirst(build.artifact.composition.features, (feature) => feature.name === name),
          (feature) =>
            described(
              answer(
                mark,
                feature.name,
                Arr.appendAll(
                  [
                    fact("From", "Your brief"),
                    fact("Weight", feature.weight.toFixed(2)),
                    fact(
                      "In",
                      Option.match(Arr.head(build.evidence.lineage), { onNone: () => "v1", onSome: versionName })
                    )
                  ],
                  drawnFacts(page.shown, name)
                ),
                composeSite
              ),
              feature.description
            )
        ),
      onSome: (record) =>
        Option.some(
          described(
            answer(
              mark,
              record.proposal.feature.name,
              Arr.appendAll(
                [
                  fact("From", participantLabel(record.proposal.proposer)),
                  fact(
                    "Decision",
                    record.accepted
                      ? Option.match(currentVersion(build.evidence), {
                        onNone: () => "Merged",
                        onSome: (version) => `Merged into ${versionName(version)}`
                      })
                      : "Declined"
                  ),
                  fact("Proposal", shortId(record.contentId))
                ],
                drawnFacts(page.shown, name)
              ),
              proposalDigestSite
            ),
            record.proposal.feature.description
          )
        )
    }))

const signatureFacts = (signature: SignatureRecord): ReadonlyArray<ProvenanceFact> => [
  fact("Signer", participantLabel(signature.signer)),
  fact("Key", signature.keyFingerprint.slice(0, 16)),
  fact("Check", signature.valid ? "Verified" : "Did not verify")
]

/** A signature over a proposal is the proposer's; one over a version is the author's. */
const signatureAnswer = (mark: PlaceMark, build: PlaceBuild, subject: string): Option.Option<PlaceProvenance> =>
  Option.map(signatureFor(build.evidence.signatures, subject), (signature) =>
    Option.match(versionFor(build, subject), {
      onNone: () =>
        answer(
          mark,
          `${signature.algorithm} over the proposal`,
          signatureFacts(signature),
          proposalSignatureSite
        ),
      onSome: (version) =>
        answer(
          mark,
          `${signature.algorithm} over ${versionName(version)}`,
          signatureFacts(signature),
          versionSignatureSite
        )
    }))

const digestFacts = (contentId: string, more: ReadonlyArray<ProvenanceFact>): ReadonlyArray<ProvenanceFact> =>
  Arr.prepend(more, fact("Digest", contentId.slice(0, contentId.indexOf(":"))))

/** A version's ID digests the whole artifact, its parent's ID included; a proposal's digests the proposal alone. */
const digestAnswer = (mark: PlaceMark, build: PlaceBuild, contentId: string): Option.Option<PlaceProvenance> =>
  Option.match(versionFor(build, contentId), {
    onSome: (version) =>
      Option.some(
        answer(
          mark,
          `${versionName(version)} content ID`,
          digestFacts(contentId, [
            fact("Over", `${String(version.featureCount)} features`),
            fact(
              "Parent",
              Option.match(Option.fromNullable(version.parent), { onNone: () => "None · origin", onSome: shortId })
            )
          ]),
          Option.isNone(Option.fromNullable(version.parent)) ? originDigestSite : mergedDigestSite,
          Option.some(contentId)
        )
      ),
    onNone: () =>
      Option.map(proposalById(build, contentId), (record) =>
        answer(
          mark,
          "Proposal content ID",
          digestFacts(contentId, [
            fact("Over", `${participantLabel(record.proposal.proposer)}'s proposal`),
            fact("Decision", record.accepted ? "Merged · ID unchanged" : "Declined · ID kept")
          ]),
          proposalDigestSite,
          Option.some(contentId)
        ))
  })

/** The line that composed the place is answered by the whole composition it returned. */
const compositionAnswer = (mark: PlaceMark, build: PlaceBuild): PlaceProvenance => {
  const composition = build.artifact.composition
  return described(
    answer(
      mark,
      composition.title,
      [
        fact("From", "Your brief"),
        fact("Features", String(composition.features.length)),
        fact("In", Option.match(Arr.head(build.evidence.lineage), { onNone: () => "v1", onSome: versionName }))
      ],
      composeSite
    ),
    composition.summary
  )
}

const composedNames = (build: PlaceBuild): ReadonlyArray<string> =>
  Arr.map(build.artifact.composition.features, (feature) => feature.name)

/**
 * The features a version's ID is over: the origin digests the composition
 * alone; a version with a parent digests the composition and every proposal
 * merged into it, which is what the place draws.
 */
const featuresOfVersion = (build: PlaceBuild, version: Version): ReadonlyArray<string> =>
  Option.isNone(Option.fromNullable(version.parent))
    ? composedNames(build)
    : Arr.map(placeFeatures(build.artifact), (feature) => feature.name)

/** The features a content ID is over: a version's, or the one feature a proposal offered. */
const featuresOfSubject = (build: PlaceBuild, contentId: string): ReadonlyArray<string> =>
  Option.match(versionFor(build, contentId), {
    onSome: (version) => featuresOfVersion(build, version),
    onNone: () =>
      Option.match(proposalById(build, contentId), {
        onNone: (): ReadonlyArray<string> => [],
        onSome: (record) => [record.proposal.feature.name]
      })
  })

/**
 * The names of the features an answer is about, so each can say so where it
 * stands: a feature's own; every feature the composing line, or the recorded
 * inference, returned; the features a content ID or a signature is over. A
 * line of the prose, a trial and the sealed note are about no feature.
 */
export const featuresAnswered = (provenance: PlaceProvenance, build: PlaceBuild): ReadonlyArray<string> =>
  Match.value(provenance.mark).pipe(
    Match.tag("Feature", ({ name }): ReadonlyArray<string> => [name]),
    Match.tag(
      "CodeLine",
      ({ match, step }): ReadonlyArray<string> =>
        Option.exists(codeSiteOf(step, match), (site) => site.id === composeSite.id) ? composedNames(build) : []
    ),
    Match.tag("Inference", () => composedNames(build)),
    Match.tag("Digest", ({ contentId }) => featuresOfSubject(build, contentId)),
    Match.tag("Signature", ({ subject }) => featuresOfSubject(build, subject)),
    Match.tag("Line", "Trial", "Note", (): ReadonlyArray<string> => []),
    Match.exhaustive
  )

const inferenceAnswer = (mark: PlaceMark, build: PlaceBuild): Option.Option<PlaceProvenance> =>
  Option.map(
    Arr.findFirst(build.evidence.inference, (evidence) => evidence.program === "theoria-place-composer"),
    (evidence) =>
      answer(
        mark,
        "Recorded inference",
        [
          fact("Program", evidence.program),
          fact("Model", evidence.responseModel),
          fact("Served", `${evidence.mode} · ${evidence.serveMode}`)
        ],
        inferenceSite
      )
  )

const noteAnswer = (mark: PlaceMark, build: PlaceBuild): PlaceProvenance => {
  const note = build.evidence.sealedNote
  return answer(
    mark,
    "Sealed note",
    [
      fact("From", `${participantLabel(note.from)} to ${participantLabel(note.to).toLocaleLowerCase("en-US")}`),
      fact("Key", `${note.agreement} · ${note.kdf}`),
      fact("Sealed", `${note.algorithm} · ${String(note.envelopeBytes)} bytes`)
    ],
    sealSite
  )
}

/** The width a line has when no disc stands beside it. */
const fullLineWidth = (projection: PlaceProjection): number => projection.stageWidth - 2 * projection.padding

/** The discs standing beside a line of the drawing on the paper, by the flow's own rule. */
const beside = (frame: PlaceRenderFrame, index: number) =>
  markersBeside(frame.rendering.projection, frame.rendering.projection.markers, index)

/** A line's room is what the discs beside it leave; a full line has none beside it. */
const lineAnswer = (mark: PlaceMark, frame: PlaceRenderFrame, index: number): Option.Option<PlaceProvenance> => {
  const projection = frame.rendering.projection
  const full = fullLineWidth(projection)
  const besideIt = beside(frame, index)
  return Option.map(Arr.get(projection.lines, index), (line) =>
    answer(
      mark,
      `Line ${String(index + 1)} of ${String(projection.lines.length)}`,
      Arr.appendAll(
        [
          fact(
            "Room",
            Arr.isNonEmptyReadonlyArray(besideIt)
              ? `${String(Math.round(line.maxWidth))} of ${String(full)} px · beside a disc`
              : `${String(full)} px · full`
          ),
          fact("Set", `${String(Math.round(line.width))} px`)
        ],
        Arr.isNonEmptyReadonlyArray(besideIt)
          ? [fact("Beside", Arr.join(Arr.map(besideIt, (marker) => marker.name), ", "))]
          : []
      ),
      layoutSite
    ))
}

const trialAnswer = (mark: PlaceMark, search: PlaceSearch, index: number): Option.Option<PlaceProvenance> =>
  Option.map(Arr.get(search.tried, index), (arrangement) =>
    answer(
      mark,
      trialName(search, index),
      [
        fact("Loss", arrangement.quality.loss.toFixed(3)),
        fact(
          "Search",
          searching(search)
            ? `${search.best.evidence.sampler} · ${String(search.tried.length)} of ${String(renderTrials)} tried`
            : `${search.best.evidence.sampler} · ${String(search.tried.length)} tried`
        ),
        fact("Seed", String(search.best.evidence.seed))
      ],
      searchSite
    ))

/** The first line of the drawing that a disc narrows; the first line at all if none is narrowed. */
const narrowedLine = (frame: PlaceRenderFrame): Option.Option<number> =>
  Option.orElse(
    Arr.findFirstIndex(
      frame.rendering.projection.lines,
      (_, index) => Arr.isNonEmptyReadonlyArray(beside(frame, index))
    ),
    () => Option.map(Arr.head(frame.rendering.projection.lines), () => 0)
  )

/**
 * The mark a line of code made, so the line is answered by it. Lines that
 * measure the arrangement answer with the trial on the paper, which they
 * measured; the composing line made every feature at once and is answered
 * by the composition itself, not by one mark. What each site made is
 * matched on the site's name, exhaustively, so a new site must say.
 */
const markMadeBy = (id: CodeSiteId, page: PlaceOnPage): Option.Option<PlaceMark> =>
  Match.value(id).pipe(
    Match.when("compose", () => Option.none<PlaceMark>()),
    Match.when("inference", () => Option.some<PlaceMark>({ _tag: "Inference" })),
    Match.when("proposal-digest", () =>
      Option.map(
        Option.flatMap(page.build, (build) => proposalFor(build, "neighbor")),
        (record): PlaceMark => ({ _tag: "Digest", contentId: record.contentId })
      )),
    Match.when("proposal-signature", () =>
      Option.map(
        Option.flatMap(page.build, (build) => proposalFor(build, "neighbor")),
        (record): PlaceMark => ({ _tag: "Signature", subject: record.contentId })
      )),
    Match.when("seal", () => Option.some<PlaceMark>({ _tag: "Note" })),
    Match.when("origin-digest", () =>
      Option.map(
        Option.flatMap(page.build, (build) => Arr.head(build.evidence.lineage)),
        (version): PlaceMark => ({ _tag: "Digest", contentId: version.contentId })
      )),
    Match.when("merged-digest", () =>
      Option.map(
        Option.flatMap(page.build, (build) => Arr.get(build.evidence.lineage, 1)),
        (version): PlaceMark => ({ _tag: "Digest", contentId: version.contentId })
      )),
    Match.when("version-signature", () =>
      Option.map(
        Option.flatMap(page.build, (build) => currentVersion(build.evidence)),
        (version): PlaceMark => ({ _tag: "Signature", subject: version.contentId })
      )),
    Match.when("layout", () =>
      Option.map(
        Option.flatMap(page.shown, narrowedLine),
        (index): PlaceMark => ({ _tag: "Line", index })
      )),
    Match.whenOr("separation", "search", () =>
      Option.map(page.shown, (frame): PlaceMark => ({ _tag: "Trial", index: frame.trial }))),
    Match.exhaustive
  )

/**
 * A line of code is answered by what it made, credited to the line itself:
 * `Statistics.minimum(` and `Study.tell(` both made the trial on the paper,
 * and each says so under its own package's name.
 */
const codeLineAnswer = (mark: PlaceMark, page: PlaceOnPage, site: CodeSite): Option.Option<PlaceProvenance> =>
  site.id === composeSite.id
    ? Option.map(page.build, (build) => compositionAnswer(mark, build))
    : Option.map(
      Option.flatMap(markMadeBy(site.id, page), (made) => answerFor(made, page)),
      (provenance) => creditedTo(provenance, site)
    )

const answerFor = (mark: PlaceMark, page: PlaceOnPage): Option.Option<PlaceProvenance> =>
  Match.value(mark).pipe(
    Match.tag("Feature", ({ name }) => featureAnswer(mark, page, name)),
    Match.tag("Line", ({ index }) => Option.flatMap(page.shown, (frame) => lineAnswer(mark, frame, index))),
    Match.tag(
      "Signature",
      ({ subject }) => Option.flatMap(page.build, (build) => signatureAnswer(mark, build, subject))
    ),
    Match.tag("Digest", ({ contentId }) => Option.flatMap(page.build, (build) => digestAnswer(mark, build, contentId))),
    Match.tag("Trial", ({ index }) => Option.flatMap(page.shown, (frame) => trialAnswer(mark, frame.search, index))),
    Match.tag("Inference", () => Option.flatMap(page.build, (build) => inferenceAnswer(mark, build))),
    Match.tag("Note", () => Option.map(page.build, (build) => noteAnswer(mark, build))),
    Match.tag(
      "CodeLine",
      ({ match, step }) => Option.flatMap(codeSiteOf(step, match), (site) => codeLineAnswer(mark, page, site))
    ),
    Match.exhaustive
  )

/**
 * The answer for a mark, if the page has one yet: a mark needing the build
 * before it has arrived, or the drawing before one is on the paper, has
 * nothing to say, and neither has a mark naming something the page does not
 * have (a feature of another scenario, a trial not yet run).
 */
export const provenanceFor = (mark: PlaceMark, page: PlaceOnPage): Option.Option<PlaceProvenance> =>
  answerFor(mark, page)
