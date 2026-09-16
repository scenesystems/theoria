import { Boolean, Match, Number, Option, Schema, String } from "effect"
import * as Arr from "effect/Array"

import { renderTrials } from "../../../contracts/demo/imagined-place-search.js"
import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import type { PlaceSearch, ShownGeometry } from "../../atoms/imagined-place-render.js"
import { CodeAnnotation } from "../primitives/code/CodeLine.js"

import type { PlaceStep } from "./placeSteps.js"
import { currentVersion, searching, shortId, signatureFor, signatureLabel } from "./placeViewModel.js"

/**
 * What each line of the code sample produced in the build on screen. Every
 * value here is read from the server's evidence, the browser's search, or
 * the drawing on the stage; a value that does not exist yet is simply absent.
 */
const annotation = (match: string, text: Option.Option<string>): Option.Option<CodeAnnotation> =>
  Option.map(text, (value) => ({ match, text: value }))

const CodeAnnotations = Schema.Array(CodeAnnotation)
type CodeAnnotations = typeof CodeAnnotations.Type

const numberText = Schema.encodeSync(Schema.NumberFromString)

const fixedDecimal = (value: number, places: number): string => {
  const parts = String.split(numberText(Number.round(value, places)), ".")
  return Arr.join(
    Arr.make(
      Arr.headNonEmpty(parts),
      String.padEnd(places, "0")(Option.getOrElse(Arr.get(parts, 1), () => ""))
    ),
    "."
  )
}

const composeValues = (build: PlaceBuild): CodeAnnotations =>
  Arr.getSomes([
    annotation(
      "composer.forward(",
      Option.some(
        `“${build.artifact.composition.title}” · ${
          numberText(Arr.length(build.artifact.composition.features))
        } features`
      )
    ),
    annotation(
      "InferenceTesting.languageModel(",
      Option.map(
        Arr.findFirst(
          build.evidence.inference,
          (evidence) => String.Equivalence(evidence.program, "theoria-place-composer")
        ),
        (evidence) => evidence.responseModel
      )
    )
  ])

const proposeValues = (build: PlaceBuild): CodeAnnotations => {
  const neighbor = Arr.findFirst(build.proposals, (record) => String.Equivalence(record.proposal.proposer, "neighbor"))
  const note = build.evidence.sealedNote
  return Arr.getSomes([
    annotation(
      "digestSchemaValue(Proposal,",
      Option.map(neighbor, (record) => `neighbor's proposal · ${shortId(record.contentId)}`)
    ),
    annotation("ed25519Sign(proposer.secretKey", Option.map(neighbor, (record) => signatureLabel(record.signature))),
    annotation(
      "seal(\"xchacha20-poly1305\"",
      Option.some(`${numberText(note.envelopeBytes)} bytes · opened with your key`)
    )
  ])
}

const recordValues = (build: PlaceBuild): CodeAnnotations => {
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
const arrangeValues = (search: PlaceSearch, shown: ShownGeometry): CodeAnnotations => {
  const { evidence } = search.best
  return [
    {
      match: "Text.layoutLinesWith(",
      text: `${numberText(shown.lineCount)} lines at ${numberText(shown.stageWidth)} px`
    },
    {
      match: "Statistics.minimum(",
      text: `closest markers ${
        numberText(Number.round(Number.multiply(shown.minimumSeparation, 100), 0))
      }% of width apart`
    },
    {
      match: "Study.tell(",
      text: Boolean.match(searching(search), {
        onTrue: () => `trial ${numberText(Arr.length(search.tried))} of ${numberText(renderTrials)}`,
        onFalse: () => `${numberText(evidence.trials)} tried · best loss ${fixedDecimal(evidence.bestLoss, 3)}`
      })
    }
  ]
}

export const placeLiveValues = (
  step: PlaceStep,
  build: Option.Option<PlaceBuild>,
  search: Option.Option<PlaceSearch>,
  shown: Option.Option<ShownGeometry>
): CodeAnnotations =>
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
