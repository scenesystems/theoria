import { Boolean as Bool, Equal, Match, Option } from "effect"
import * as Arr from "effect/Array"
import * as Num from "effect/Number"

import { renderTrials } from "../../../contracts/demo/imagined-place-search.js"
import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import type { PlaceSearch, ShownGeometry } from "../../atoms/imagined-place-render.js"
import type { CodeAnnotation } from "../primitives/code/CodeLine.js"

import type { PlaceStep } from "./placeSteps.js"
import { currentVersion, searching, shortId, signatureFor, signatureLabel } from "./placeViewModel.js"

/**
 * What each line of the code sample produced in the build on screen. Every
 * value here is read from the server's evidence, the browser's search, or
 * the drawing on the stage; a value that does not exist yet is simply absent.
 */
const annotation = (match: string, text: Option.Option<string>): Option.Option<CodeAnnotation> =>
  Option.map(text, (value) => ({ match, text: value }))

const composeValues = (build: PlaceBuild): ReadonlyArray<CodeAnnotation> =>
  Arr.getSomes([
    annotation(
      "composer.forward(",
      Option.some(
        `“${build.artifact.composition.title}” · ${String(Arr.length(build.artifact.composition.features))} features`
      )
    ),
    annotation(
      "InferenceTesting.staticLanguageModel(",
      Option.map(
        Arr.findFirst(build.evidence.inference, (evidence) => Equal.equals(evidence.program, "theoria-place-composer")),
        (evidence) => evidence.responseModel
      )
    )
  ])

const proposeValues = (build: PlaceBuild): ReadonlyArray<CodeAnnotation> => {
  const neighbor = Arr.findFirst(build.proposals, (record) => Equal.equals(record.proposal.proposer, "neighbor"))
  const note = build.evidence.sealedNote
  return Arr.getSomes([
    annotation(
      "digestSchemaValue(Proposal,",
      Option.map(neighbor, (record) => `neighbor's proposal · ${shortId(record.contentId)}`)
    ),
    annotation("ed25519Sign(proposer.secretKey", Option.map(neighbor, (record) => signatureLabel(record.signature))),
    annotation(
      "seal(\"xchacha20-poly1305\"",
      Option.some(`${String(note.envelopeBytes)} bytes · opened with your key`)
    )
  ])
}

const recordValues = (build: PlaceBuild): ReadonlyArray<CodeAnnotation> => {
  const lineage = build.evidence.lineage
  return Arr.getSomes([
    annotation(
      "digestSchemaValue(PlaceArtifact, origin,",
      Option.map(Arr.head(lineage), (version) => `v1 · ${shortId(version.contentId)}`)
    ),
    annotation(
      "digestSchemaValue(PlaceArtifact, merged,",
      Option.map(Arr.get(lineage, 1), (version) => `v2 · ${shortId(version.contentId)}`)
    ),
    annotation(
      "ed25519Sign(author.secretKey",
      Option.map(
        signatureFor(build.evidence.signatures, currentVersion(build.evidence).contentId),
        signatureLabel
      )
    )
  ])
}

/**
 * The geometry lines say what the drawing on the stage is, the search line
 * where the search stands: the two are read from different things, since
 * the drawing shown need not be the best the search has found.
 */
const arrangeValues = (search: PlaceSearch, shown: ShownGeometry): ReadonlyArray<CodeAnnotation> => {
  const { evidence } = search.best
  return [
    {
      match: "Text.linesWith(",
      text: `${String(shown.lineCount)} lines at ${String(shown.stageWidth)} px`
    },
    {
      match: "Statistics.minimum(",
      text: `closest markers ${String(Num.round(Num.multiply(shown.minimumSeparation, 100), 0))}% of width apart`
    },
    {
      match: "Study.tell(",
      text: Bool.match(searching(search), {
        onTrue: () => `trial ${String(Arr.length(search.tried))} of ${String(renderTrials)}`,
        onFalse: () => `${String(evidence.trials)} tried · best loss ${evidence.bestLoss.toFixed(3)}`
      })
    }
  ]
}

export const placeLiveValues = (
  step: PlaceStep,
  build: Option.Option<PlaceBuild>,
  search: Option.Option<PlaceSearch>,
  shown: Option.Option<ShownGeometry>
): ReadonlyArray<CodeAnnotation> =>
  Match.value(step).pipe(
    Match.when("compose", () => Option.match(build, { onNone: () => [], onSome: composeValues })),
    Match.when("propose", () => Option.match(build, { onNone: () => [], onSome: proposeValues })),
    Match.when("record", () => Option.match(build, { onNone: () => [], onSome: recordValues })),
    Match.when("arrange", () =>
      Option.match(Option.all([search, shown]), {
        onNone: () => [],
        onSome: ([found, geometry]) => arrangeValues(found, geometry)
      })),
    Match.exhaustive
  )
