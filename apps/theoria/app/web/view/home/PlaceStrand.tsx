import { useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"

import type { PlaceBuild, PlaceEvidence, Version } from "../../../contracts/imagined-place-result.js"
import {
  type OfferedProposal,
  type PlaceOutline,
  type VersionShape,
  versionShapes
} from "../../../contracts/imagined-place.js"
import { placeVersionChangeAtom } from "../../atoms/imagined-place.js"
import { ChangedValue } from "../primitives/ChangedValue.js"
import { dangerStatusTone, inlineStatusToneFor, toneClassesFor } from "../primitives/designSystem.js"
import { Cluster, Layer, Rail, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { GhostText } from "../primitives/Skeleton.js"

import { ContentId, ContentIdPending } from "./ContentId.js"
import { StatusMark, StatusMarkPending } from "./PlaceProvenance.js"
import {
  isCurrentVersion,
  knotLabel,
  signatureFor,
  versionChanges,
  versionOf,
  versionSignatureLabel,
  versionSignatureLabelShape
} from "./placeViewModel.js"

const digestTone = toneClassesFor("digest")
const signTone = inlineStatusToneFor("sign")

const signatureTone = (valid: boolean) => valid ? signTone : dangerStatusTone

/** The version being drawn is the last of the outline's shapes: filled on the strand before the build names it. */
const isCurrentShape = (shapes: ReadonlyArray<VersionShape>, shape: VersionShape): boolean =>
  Option.exists(Arr.last(shapes), (last) => last.version === shape.version)

/** A knot on the strand: filled for the version being drawn, open for the ones before it. */
const knotClassName = (current: boolean, size: "strand" | "stage"): string =>
  `inline-flex shrink-0 rounded-full border-2 ${digestTone.border} forced-colors:border-[CanvasText] ${
    current ? `${digestTone.bg} forced-colors:bg-[CanvasText]` : "bg-stage-0 forced-colors:bg-[Canvas]"
  } ${size === "strand" ? "size-3" : "size-2"}`

/**
 * The strand as it appears on the pinned stage: one small knot per version,
 * the current one filled, and the current version's name and fingerprint.
 * The version is always in view without a badge. The knots are the outline's
 * from the first frame; the name and fingerprint are the build's, and their
 * room before it.
 */
export const StageKnots = ({ evidence, outline }: {
  readonly evidence: Option.Option<PlaceEvidence>
  readonly outline: PlaceOutline
}) => {
  const change = useAtomValue(placeVersionChangeAtom)
  const shapes = versionShapes(outline)
  const current = Arr.lastNonEmpty(shapes)
  return (
    <Rail
      aria-busy={Option.isNone(evidence)}
      className="min-w-0 justify-end gap-2.5"
      data-place-current-version={Option.isSome(evidence) ? "built" : "pending"}
    >
      <Rail aria-hidden className="gap-1">
        {Arr.map(shapes, (shape, index) => (
          <Rail className="gap-1" key={shape.version}>
            {index === 0 ? null : <Layer render={<span />} className={`h-px w-2 ${digestTone.bg} opacity-40`} />}
            <Layer render={<span />} className={knotClassName(isCurrentShape(shapes, shape), "stage")} />
          </Rail>
        ))}
      </Rail>
      {Option.match(Option.flatMap(evidence, (value) => versionOf(value, current)), {
        onNone: () => (
          <Layer className="flex min-w-0 items-center gap-1.5">
            <GhostText
              as="span"
              className="tabular-nums text-ink-500"
              role="code-meta"
              text={`V${String(current.version)} ·`}
            />
            <ContentIdPending form="short" />
          </Layer>
        ),
        onSome: (version) => (
          <ChangedValue changes={change.changes} className="flex min-w-0 items-center gap-1.5" tone={digestTone}>
            <SemanticText
              as="span"
              className="tabular-nums text-ink-500"
              role="code-meta"
              text={`V${String(version.version)} ·`}
            />
            <ContentId form="short" id={version.contentId} />
          </ChangedValue>
        )
      })}
    </Rail>
  )
}

/** The build's account of a version: the version itself and the author's signature over it. */
const Recorded = ({ current, version, evidence }: {
  readonly current: boolean
  readonly evidence: PlaceEvidence
  readonly version: Version
}) => {
  const change = useAtomValue(placeVersionChangeAtom)
  return (
    <>
      <ChangedValue changes={current ? change.changes : 0} className="flex min-w-0" tone={digestTone}>
        <ContentId form="full" id={version.contentId} />
      </ChangedValue>
      {Option.match(signatureFor(evidence.signatures, version.contentId), {
        onNone: () => null,
        onSome: (signature) => (
          <Cluster>
            <StatusMark
              label={versionSignatureLabel(signature)}
              mark={{ _tag: "Signature", subject: version.contentId }}
              tone={signatureTone(signature.valid)}
            />
          </Cluster>
        )
      })}
    </>
  )
}

/** The room the build's account of a version takes before it is here: its ID and the author's signature, as ghosts. */
const RecordedPending = () => (
  <>
    <Layer className="flex min-w-0">
      <ContentIdPending form="full" />
    </Layer>
    <Cluster>
      <StatusMarkPending label={versionSignatureLabelShape} tone={signTone} />
    </Cluster>
  </>
)

/**
 * One knot on the strand: its label, what the version added and who offered
 * it, its fingerprint in technical type, and the author's signature over it.
 * The label and the changes are the outline's; the fingerprint and signature
 * are the build's, and ghosts of their shape before the build is here.
 */
const Knot = ({ build, last, offered, shape, shapes }: {
  readonly build: Option.Option<PlaceBuild>
  readonly last: boolean
  readonly offered: ReadonlyArray<OfferedProposal>
  readonly shape: VersionShape
  readonly shapes: ReadonlyArray<VersionShape>
}) => {
  const version = Option.flatMap(build, (value) => versionOf(value.evidence, shape))
  const current = Option.match(build, {
    onNone: () => isCurrentShape(shapes, shape),
    onSome: (value) => Option.exists(version, (found) => isCurrentVersion(value.evidence, found))
  })
  return (
    <Layer className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3" data-place-version={String(shape.version)}>
      <Layer aria-hidden className="flex flex-col items-center pt-1">
        <Layer render={<span />} className={knotClassName(current, "strand")} />
        {last ? null : <Layer render={<span />} className={`mt-1 w-px flex-1 ${digestTone.bg} opacity-40`} />}
      </Layer>
      <Stack className={`min-w-0 gap-1.5 ${last ? "" : "pb-5"}`}>
        <SemanticText
          as="p"
          className="min-w-0 text-ink-900"
          role="row-label"
          text={knotLabel(shape)}
          variant="compact"
        />
        {Arr.map(versionChanges(offered, shape), (line) => (
          <SemanticText
            as="p"
            className="text-ink-700"
            key={line}
            role="status"
            text={line}
            variant="compact"
            wrapAuthority="native-browser"
          />
        ))}
        {Option.match(
          Option.zipWith(build, version, (value, found) => ({ evidence: value.evidence, version: found })),
          {
            onNone: () => <RecordedPending />,
            onSome: ({ evidence, version: found }) => <Recorded current={current} evidence={evidence} version={found} />
          }
        )}
      </Stack>
    </Layer>
  )
}

/**
 * The place's history as a strand of knots. Version 2 digests version 1's ID
 * as its parent, so the strand cannot be reordered or have a knot removed
 * without every later ID changing. The author signs each version; when a
 * merge grows the strand, the current ID washes once. The knots are the
 * outline's versions, so the strand has its length before the build is here;
 * the build fills each knot's fingerprint and signature.
 */
export const PlaceStrand = ({ build, offered, outline }: {
  readonly build: Option.Option<PlaceBuild>
  readonly offered: ReadonlyArray<OfferedProposal>
  readonly outline: PlaceOutline
}) => {
  const shapes = versionShapes(outline)
  return (
    <Stack className="gap-0" data-place-lineage={Option.isSome(build) ? "built" : "pending"}>
      {Arr.map(shapes, (shape, index) => (
        <Knot
          build={build}
          key={shape.version}
          last={index === shapes.length - 1}
          offered={offered}
          shape={shape}
          shapes={shapes}
        />
      ))}
    </Stack>
  )
}
