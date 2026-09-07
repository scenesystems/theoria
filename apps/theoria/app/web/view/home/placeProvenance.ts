import { Match, Option } from "effect"
import * as Arr from "effect/Array"

import {
  type CodeSite,
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
  separationSite,
  versionSignatureSite
} from "../../../contracts/demo/imagined-place-provenance.js"
import { renderTrials } from "../../../contracts/demo/imagined-place-search.js"
import type {
  PlaceBuild,
  PlaceLine,
  PlaceProjection,
  ProposalRecord,
  SignatureRecord,
  Version
} from "../../../contracts/imagined-place-result.js"
import type { ParticipantRole } from "../../../contracts/imagined-place.js"
import type { PlaceSearch } from "../../atoms/imagined-place-render.js"

import { currentVersion, participantLabel, searching, shortId, signatureFor } from "./placeViewModel.js"

/**
 * What the page says about the thing under the pointer. Every answer is
 * read from the build the server returned and the search the browser ran;
 * nothing here is stored, so an answer can never disagree with the page.
 * Each names the line of code that made the thing, and each such line is
 * answered in turn by the thing it made.
 */

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

const proposalFor = (build: PlaceBuild, role: ParticipantRole): Option.Option<ProposalRecord> =>
  Arr.findFirst(build.proposals, (record) => record.proposal.proposer === role)

const proposalOfFeature = (build: PlaceBuild, name: string): Option.Option<ProposalRecord> =>
  Arr.findFirst(build.proposals, (record) => record.proposal.feature.name === name)

const versionFor = (build: PlaceBuild, contentId: string): Option.Option<Version> =>
  Arr.findFirst(build.evidence.lineage, (version) => version.contentId === contentId)

const proposalById = (build: PlaceBuild, contentId: string): Option.Option<ProposalRecord> =>
  Arr.findFirst(build.proposals, (record) => record.contentId === contentId)

const versionName = (version: Version): string => `v${String(version.version)}`

/** A feature from the brief was composed; one from a proposal was offered, and merged or declined. */
const featureAnswer = (mark: PlaceMark, build: PlaceBuild, name: string): Option.Option<PlaceProvenance> =>
  Option.match(proposalOfFeature(build, name), {
    onNone: () =>
      Option.map(
        Arr.findFirst(build.artifact.composition.features, (feature) => feature.name === name),
        (feature) =>
          described(
            answer(
              mark,
              feature.name,
              [
                fact("From", "Your brief"),
                fact("Weight", feature.weight.toFixed(2)),
                fact("In", Option.match(Arr.head(build.evidence.lineage), { onNone: () => "v1", onSome: versionName }))
              ],
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
            proposalDigestSite
          ),
          record.proposal.feature.description
        )
      )
  })

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

/** The names of the features an answer is about: a feature's own, or every one the composing line returned. */
export const featuresAnswered = (provenance: PlaceProvenance, build: PlaceBuild): ReadonlyArray<string> =>
  Match.value(provenance.mark).pipe(
    Match.tag("Feature", ({ name }) => [name]),
    Match.tag(
      "CodeLine",
      ({ match, step }) =>
        Option.exists(codeSiteOf(step, match), (site) => site.match === composeSite.match)
          ? Arr.map(build.artifact.composition.features, (feature) => feature.name)
          : []
    ),
    Match.orElse((): ReadonlyArray<string> => [])
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

/** Whether a disc stands beside the line and narrows it. */
const narrowed = (projection: PlaceProjection, line: PlaceLine): boolean =>
  line.maxWidth < fullLineWidth(projection) - 1

/** A line's room is what the discs beside it leave; a full line has none beside it. */
const lineAnswer = (mark: PlaceMark, search: PlaceSearch, index: number): Option.Option<PlaceProvenance> => {
  const projection = search.best.projection
  const full = fullLineWidth(projection)
  return Option.map(Arr.get(projection.lines, index), (line) =>
    answer(
      mark,
      `Line ${String(index + 1)} of ${String(projection.lines.length)}`,
      [
        fact(
          "Room",
          narrowed(projection, line)
            ? `${String(Math.round(line.maxWidth))} of ${String(full)} px · beside a disc`
            : `${String(full)} px · full`
        ),
        fact("Set", `${String(Math.round(line.width))} px`)
      ],
      layoutSite
    ))
}

const trialAnswer = (mark: PlaceMark, search: PlaceSearch, index: number): Option.Option<PlaceProvenance> =>
  Option.map(Arr.get(search.tried, index), (arrangement) =>
    answer(
      mark,
      index === search.bestIndex
        ? `Trial ${String(index + 1)} · kept`
        : `Trial ${String(index + 1)} · not kept`,
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

/**
 * The mark a line of code made, so the line is answered by it. Lines that
 * measure the arrangement answer with the kept trial they measured; the
 * composing line made every feature at once and is answered by the
 * composition itself, not by one mark.
 */
const markMadeBy = (site: CodeSite, build: PlaceBuild, search: PlaceSearch): Option.Option<PlaceMark> =>
  Match.value(site.match).pipe(
    Match.when(inferenceSite.match, () => Option.some<PlaceMark>({ _tag: "Inference" })),
    Match.when(proposalDigestSite.match, () =>
      Option.map(
        proposalFor(build, "neighbor"),
        (record): PlaceMark => ({ _tag: "Digest", contentId: record.contentId })
      )),
    Match.when(proposalSignatureSite.match, () =>
      Option.map(
        proposalFor(build, "neighbor"),
        (record): PlaceMark => ({ _tag: "Signature", subject: record.contentId })
      )),
    Match.when(sealSite.match, () => Option.some<PlaceMark>({ _tag: "Note" })),
    Match.when(originDigestSite.match, () =>
      Option.map(
        Arr.head(build.evidence.lineage),
        (version): PlaceMark => ({ _tag: "Digest", contentId: version.contentId })
      )),
    Match.when(mergedDigestSite.match, () =>
      Option.map(
        Arr.get(build.evidence.lineage, 1),
        (version): PlaceMark => ({ _tag: "Digest", contentId: version.contentId })
      )),
    Match.when(versionSignatureSite.match, () =>
      Option.map(
        currentVersion(build.evidence),
        (version): PlaceMark => ({ _tag: "Signature", subject: version.contentId })
      )),
    Match.when(layoutSite.match, () =>
      Option.map(
        Option.orElse(
          Arr.findFirstIndex(
            search.best.projection.lines,
            (line) => narrowed(search.best.projection, line)
          ),
          () => Option.map(Arr.head(search.best.projection.lines), () => 0)
        ),
        (index): PlaceMark => ({ _tag: "Line", index })
      )),
    Match.when(separationSite.match, () => Option.some<PlaceMark>({ _tag: "Trial", index: search.bestIndex })),
    Match.when(searchSite.match, () => Option.some<PlaceMark>({ _tag: "Trial", index: search.bestIndex })),
    Match.orElse(() => Option.none())
  )

const answerFor = (
  mark: PlaceMark,
  build: PlaceBuild,
  search: PlaceSearch
): Option.Option<PlaceProvenance> =>
  Match.value(mark).pipe(
    Match.tag("Feature", ({ name }) => featureAnswer(mark, build, name)),
    Match.tag("Line", ({ index }) => lineAnswer(mark, search, index)),
    Match.tag("Signature", ({ subject }) => signatureAnswer(mark, build, subject)),
    Match.tag("Digest", ({ contentId }) => digestAnswer(mark, build, contentId)),
    Match.tag("Trial", ({ index }) => trialAnswer(mark, search, index)),
    Match.tag("Inference", () => inferenceAnswer(mark, build)),
    Match.tag("Note", () => Option.some(noteAnswer(mark, build))),
    Match.tag("CodeLine", ({ match, step }) =>
      Option.flatMap(codeSiteOf(step, match), (site) =>
        site.match === composeSite.match
          ? Option.some(compositionAnswer(mark, build))
          : Option.flatMap(markMadeBy(site, build, search), (made) =>
            answerFor(made, build, search)))),
    Match.exhaustive
  )

/**
 * The answer for a mark, if the page has one yet: before the build or the
 * search is in there is nothing to say, and a mark naming something the
 * build does not have (a feature of another scenario, a trial not yet run)
 * has none either.
 */
export const provenanceFor = (
  mark: PlaceMark,
  build: Option.Option<PlaceBuild>,
  search: Option.Option<PlaceSearch>
): Option.Option<PlaceProvenance> =>
  Option.flatMap(Option.all({ build, search }), ({ build, search }) => answerFor(mark, build, search))
