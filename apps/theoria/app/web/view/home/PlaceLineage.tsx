import { useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"

import type { PlaceBuild, Version } from "../../../contracts/imagined-place-result.js"
import { placeVersionChangeAtom } from "../../atoms/imagined-place.js"
import { ChangedValue } from "../primitives/ChangedValue.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { StatusPill } from "../primitives/StatusPill.js"

import { ContentId } from "./ContentId.js"
import {
  isCurrentVersion,
  parentText,
  signatureFor,
  versionChanges,
  versionSignatureLabel,
  versionTitle
} from "./placeViewModel.js"

const digestTone = toneClassesFor("digest")
const signTone = toneClassesFor("sign")

const signaturePillClassName = (valid: boolean): string =>
  valid
    ? `border ${signTone.borderSubtle} bg-stage-0/80 ${signTone.text}`
    : "border border-danger-200/80 bg-danger-50/70 text-danger-700"

const nodeClassName = (current: boolean): string =>
  `inline-flex size-3 shrink-0 rounded-full border-2 ${digestTone.border} ${current ? digestTone.bg : "bg-stage-0"}`

/**
 * One version on the timeline: what it is, what it added, who signed it and
 * its content ID. The node is filled for the version being drawn.
 */
const VersionNode = ({ build, last, version }: {
  readonly build: PlaceBuild
  readonly last: boolean
  readonly version: Version
}) => {
  const current = isCurrentVersion(build.evidence, version)
  const change = useAtomValue(placeVersionChangeAtom)
  return (
    <Layer className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3" data-place-version={String(version.version)}>
      <Layer aria-hidden className="flex flex-col items-center pt-1">
        <Layer render={<span />} className={nodeClassName(current)} />
        {last ? null : <Layer render={<span />} className={`mt-1 w-px flex-1 ${digestTone.bg} opacity-40`} />}
      </Layer>
      <Stack className={`min-w-0 gap-1.5 ${last ? "" : "pb-4"}`}>
        <Layer className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
          <SemanticText
            as="p"
            className="min-w-0 text-ink-900"
            role="row-label"
            text={versionTitle(build.evidence, version)}
            variant="compact"
            wrapAuthority="native-browser"
          />
          {Option.match(parentText(version), {
            onNone: () => null,
            onSome: (text) => <SemanticText as="span" className="text-ink-500" role="code-meta" text={text} />
          })}
        </Layer>
        {Arr.map(versionChanges(build, version), (change) => (
          <SemanticText
            as="p"
            className="text-ink-700"
            key={change}
            role="status"
            text={change}
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
              <StatusPill
                className={signaturePillClassName(signature.valid)}
                label={versionSignatureLabel(signature)}
              />
            </Cluster>
          )
        })}
      </Stack>
    </Layer>
  )
}

/**
 * The place's history as a chain of content IDs. Version 2 digests version
 * 1's ID as its parent, so the chain cannot be reordered or have a link
 * removed without every later ID changing. The author signs each version.
 */
export const PlaceLineage = ({ build }: { readonly build: PlaceBuild }) => (
  <Stack className="gap-0" data-place-lineage>
    {Arr.map(build.evidence.lineage, (version, index) => (
      <VersionNode
        build={build}
        key={version.contentId}
        last={index === build.evidence.lineage.length - 1}
        version={version}
      />
    ))}
  </Stack>
)
