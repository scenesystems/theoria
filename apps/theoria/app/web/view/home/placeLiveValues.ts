import { Match, Option } from "effect"
import * as Arr from "effect/Array"

import { renderTrials } from "../../../contracts/demo/imagined-place-arrangement.js"
import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import type { PlaceRenderFrame } from "../../atoms/imagined-place-render.js"
import type { CodeAnnotation } from "../primitives/code/CodeLine.js"

import type { PlaceStep } from "./placeSteps.js"
import { currentVersion, shortId, signatureFor, signatureLabel } from "./placeViewModel.js"

/**
 * What each line of the code sample produced in the build on screen. Every
 * value here is read from the server's evidence or the browser's render frame;
 * a value that does not exist yet is simply absent.
 */
const annotation = (match: string, text: Option.Option<string>): Option.Option<CodeAnnotation> =>
  Option.map(text, (value) => ({ match, text: value }))

const composeValues = (build: PlaceBuild): ReadonlyArray<CodeAnnotation> =>
  Arr.getSomes([
    annotation(
      "composer.forward(",
      Option.some(
        `“${build.artifact.composition.title}” · ${String(build.artifact.composition.features.length)} features`
      )
    ),
    annotation(
      "InferenceTesting.staticLanguageModel(",
      Option.map(
        Arr.findFirst(build.evidence.inference, (evidence) => evidence.program === "theoria-place-composer"),
        (evidence) => evidence.responseModel
      )
    )
  ])

const proposeValues = (build: PlaceBuild): ReadonlyArray<CodeAnnotation> => {
  const neighbor = Arr.findFirst(build.proposals, (record) => record.proposal.proposer === "neighbor")
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
        Option.flatMap(
          currentVersion(build.evidence),
          (version) => signatureFor(build.evidence.signatures, version.contentId)
        ),
        signatureLabel
      )
    )
  ])
}

const arrangeValues = (frame: PlaceRenderFrame): ReadonlyArray<CodeAnnotation> => {
  const { evidence, projection } = frame.rendering
  return [
    {
      match: "Text.layoutLinesWith(",
      text: `${String(evidence.lineCount)} lines at ${String(projection.stageWidth)} px`
    },
    {
      match: "Statistics.minimum(",
      text: `closest markers ${String(Math.round(evidence.minimumSeparation * 100))}% of width apart`
    },
    {
      match: "Study.tell(",
      text: frame.phase === "running"
        ? `trial ${String(frame.trial)} of ${String(renderTrials)}`
        : `${String(evidence.trials)} tried · best loss ${evidence.bestLoss.toFixed(3)}`
    }
  ]
}

export const placeLiveValues = (
  step: PlaceStep,
  build: Option.Option<PlaceBuild>,
  frame: Option.Option<PlaceRenderFrame>
): ReadonlyArray<CodeAnnotation> =>
  Match.value(step).pipe(
    Match.when("compose", () => Option.match(build, { onNone: () => [], onSome: composeValues })),
    Match.when("propose", () => Option.match(build, { onNone: () => [], onSome: proposeValues })),
    Match.when("record", () => Option.match(build, { onNone: () => [], onSome: recordValues })),
    Match.when("arrange", () => Option.match(frame, { onNone: () => [], onSome: arrangeValues })),
    Match.exhaustive
  )
