import { useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"

import type { PlaceBuild, PlaceEvidence, Version } from "../../../contracts/imagined-place-result.js"
import { placeVersionChangeAtom } from "../../atoms/imagined-place.js"
import { ChangedValue } from "../primitives/ChangedValue.js"
import { dangerStatusTone, inlineStatusToneFor, toneClassesFor } from "../primitives/designSystem.js"
import { Cluster, Layer, Rail, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { ContentId } from "./ContentId.js"
import { StatusMark } from "./PlaceProvenance.js"
import { isCurrentVersion, knotLabel, signatureFor, versionChanges, versionSignatureLabel } from "./placeViewModel.js"

const digestTone = toneClassesFor("digest")
const signTone = inlineStatusToneFor("sign")

const signatureTone = (valid: boolean) => valid ? signTone : dangerStatusTone

/** A knot on the strand: filled for the version being drawn, open for the ones before it. */
const knotClassName = (current: boolean, size: "strand" | "stage"): string =>
  `inline-flex shrink-0 rounded-full border-2 ${digestTone.border} ${current ? digestTone.bg : "bg-stage-0"} ${
    size === "strand" ? "size-3" : "size-2"
  }`

/**
 * The strand as it appears on the pinned stage: one small knot per version,
 * the current one filled, and the current version's name and fingerprint.
 * The version is always in view without a badge.
 */
export const StageKnots = ({ evidence }: { readonly evidence: PlaceEvidence }) => {
  const change = useAtomValue(placeVersionChangeAtom)
  return (
    <Rail className="min-w-0 justify-end gap-2.5" data-place-current-version>
      <Rail aria-hidden className="gap-1">
        {Arr.map(evidence.lineage, (version, index) => (
          <Rail className="gap-1" key={version.contentId}>
            {index === 0 ? null : <Layer render={<span />} className={`h-px w-2 ${digestTone.bg} opacity-40`} />}
            <Layer render={<span />} className={knotClassName(isCurrentVersion(evidence, version), "stage")} />
          </Rail>
        ))}
      </Rail>
      {Option.match(Arr.last(evidence.lineage), {
        onNone: () => null,
        onSome: (version) => (
          <ChangedValue changes={change.changes} className="flex min-w-0 items-center gap-1.5">
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

/**
 * One knot on the strand: its label, what the version added and who offered
 * it, its fingerprint in technical type, and the author's signature over it.
 */
const Knot = ({ build, last, version }: {
  readonly build: PlaceBuild
  readonly last: boolean
  readonly version: Version
}) => {
  const current = isCurrentVersion(build.evidence, version)
  const change = useAtomValue(placeVersionChangeAtom)
  return (
    <Layer className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3" data-place-version={String(version.version)}>
      <Layer aria-hidden className="flex flex-col items-center pt-1">
        <Layer render={<span />} className={knotClassName(current, "strand")} />
        {last ? null : <Layer render={<span />} className={`mt-1 w-px flex-1 ${digestTone.bg} opacity-40`} />}
      </Layer>
      <Stack className={`min-w-0 gap-1.5 ${last ? "" : "pb-5"}`}>
        <SemanticText
          as="p"
          className="min-w-0 text-ink-900"
          role="row-label"
          text={knotLabel(version)}
          variant="compact"
        />
        {Arr.map(versionChanges(build, version), (line) => (
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
        <ChangedValue changes={current ? change.changes : 0} className="flex min-w-0">
          <ContentId form="full" id={version.contentId} />
        </ChangedValue>
        {Option.match(signatureFor(build.evidence.signatures, version.contentId), {
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
      </Stack>
    </Layer>
  )
}

/**
 * The place's history as a strand of knots. Version 2 digests version 1's ID
 * as its parent, so the strand cannot be reordered or have a knot removed
 * without every later ID changing. The author signs each version; when a
 * merge grows the strand, the current ID washes once.
 */
export const PlaceStrand = ({ build }: { readonly build: PlaceBuild }) => (
  <Stack className="gap-0" data-place-lineage>
    {Arr.map(build.evidence.lineage, (version, index) => (
      <Knot
        build={build}
        key={version.contentId}
        last={index === build.evidence.lineage.length - 1}
        version={version}
      />
    ))}
  </Stack>
)
