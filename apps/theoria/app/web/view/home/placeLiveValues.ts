import { Boolean as Bool, Equal, Inspectable, Match, Option } from "effect"
import * as Arr from "effect/Array"
import * as Num from "effect/Number"
import * as Tuple from "effect/Tuple"

import {
  proposalSignatureSite,
  sealSite,
  versionSignatureSite
} from "../../../contracts/demo/imagined-place-provenance.js"
import { renderTrials } from "../../../contracts/demo/imagined-place-search.js"
import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import type { PlaceSearch, ShownGeometry } from "../../atoms/imagined-place-render.js"
import { CodeAnnotation } from "../primitives/code/CodeLine.js"

import type { PlaceStep } from "./placeSteps.js"
import { currentVersion, fixedDecimal, searching, shortId, signatureFor, signatureLabel } from "./placeViewModel.js"

/**
 * What each line of the code sample produced in the build on screen. Every
 * value here is read from the server's evidence, the browser's search, or
 * the drawing on the stage; a value that does not exist yet is simply absent.
 */
const annotation = (match: string, text: Option.Option<string>): Option.Option<CodeAnnotation> =>
  Option.map(text, (value) => CodeAnnotation.make({ match, text: value }))

const composeValues = (build: PlaceBuild) =>
  Arr.getSomes(Arr.make(
    annotation(
      "composer.forward(",
      Option.some(
        `“${build.artifact.composition.title}” · ${
          Inspectable.toStringUnknown(Arr.length(build.artifact.composition.features))
        } features`
      )
    ),
    annotation(
      "InferenceTesting.languageModel(",
      Option.map(
        Arr.findFirst(build.evidence.inference, (evidence) => Equal.equals(evidence.program, "theoria-place-composer")),
        (evidence) => evidence.responseModel
      )
    )
  ))

const proposeValues = (build: PlaceBuild) => {
  const neighbor = Arr.findFirst(build.proposals, (record) => Equal.equals(record.proposal.proposer, "neighbor"))
  const note = build.evidence.sealedNote
  return Arr.getSomes(Arr.make(
    annotation(
      "ContentDigest.fromSchema(Proposal,",
      Option.map(neighbor, (record) => `neighbor's proposal · ${shortId(record.contentId)}`)
    ),
    annotation(proposalSignatureSite.match, Option.map(neighbor, (record) => signatureLabel(record.signature))),
    annotation(
      sealSite.match,
      Option.some(`${Inspectable.toStringUnknown(note.envelopeBytes)} bytes · opened with your key`)
    )
  ))
}

const recordValues = (build: PlaceBuild) => {
  const lineage = build.evidence.lineage
  return Arr.getSomes(Arr.make(
    annotation(
      "ContentDigest.fromSchema(PlaceArtifact, origin,",
      Option.map(Arr.head(lineage), (version) => `v1 · ${shortId(version.contentId)}`)
    ),
    annotation(
      "ContentDigest.fromSchema(PlaceArtifact, merged,",
      Option.map(Arr.get(lineage, 1), (version) => `v2 · ${shortId(version.contentId)}`)
    ),
    annotation(
      versionSignatureSite.match,
      Option.map(
        signatureFor(build.evidence.signatures, currentVersion(build.evidence).contentId),
        signatureLabel
      )
    )
  ))
}

/**
 * The geometry lines say what the drawing on the stage is, the search line
 * where the search stands: the two are read from different things, since
 * the drawing shown need not be the best the search has found.
 */
const arrangeValues = (search: PlaceSearch, shown: ShownGeometry) => {
  const { evidence } = search.best
  return Arr.make(
    CodeAnnotation.make({
      match: "Text.layoutLinesWith(",
      text: `${Inspectable.toStringUnknown(shown.lineCount)} lines at ${
        Inspectable.toStringUnknown(shown.stageWidth)
      } px`
    }),
    CodeAnnotation.make({
      match: "Statistics.minimum(",
      text: `closest markers ${
        Inspectable.toStringUnknown(Num.round(Num.multiply(shown.minimumSeparation, 100), 0))
      }% of width apart`
    }),
    CodeAnnotation.make({
      match: "Optimization.tell(",
      text: Bool.match(searching(search), {
        onTrue: () =>
          `trial ${Inspectable.toStringUnknown(Arr.length(search.tried))} of ${
            Inspectable.toStringUnknown(renderTrials)
          }`,
        onFalse: () =>
          `${Inspectable.toStringUnknown(evidence.trials)} tried · best loss ${fixedDecimal(evidence.bestLoss, 3)}`
      })
    })
  )
}

export const placeLiveValues = (
  step: PlaceStep,
  build: Option.Option<PlaceBuild>,
  search: Option.Option<PlaceSearch>,
  shown: Option.Option<ShownGeometry>
) =>
  Match.value(step).pipe(
    Match.when("compose", () => Option.match(build, { onNone: Arr.empty<CodeAnnotation>, onSome: composeValues })),
    Match.when("propose", () => Option.match(build, { onNone: Arr.empty<CodeAnnotation>, onSome: proposeValues })),
    Match.when("record", () => Option.match(build, { onNone: Arr.empty<CodeAnnotation>, onSome: recordValues })),
    Match.when("arrange", () =>
      Option.match(Option.all(Tuple.make(search, shown)), {
        onNone: Arr.empty<CodeAnnotation>,
        onSome: ([found, geometry]) => arrangeValues(found, geometry)
      })),
    Match.exhaustive
  )
