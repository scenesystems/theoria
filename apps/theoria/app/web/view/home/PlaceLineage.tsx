import { ArrowLongRightIcon } from "@heroicons/react/20/solid"
import { Option } from "effect"
import * as Arr from "effect/Array"

import type { PlaceEvidence, Version } from "../../../contracts/imagined-place-result.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { StatusPill } from "../primitives/StatusPill.js"

import { shortId, signatureFor, versionSignatureLabel } from "./placeViewModel.js"

const digestTone = toneClassesFor("digest")
const signTone = toneClassesFor("sign")

const versionTitle = (version: Version): string =>
  `Version ${String(version.version)} · ${String(version.featureCount)} features`

const parentText = (version: Version): string =>
  Option.match(Option.fromNullable(version.parent), {
    onNone: () => "Origin",
    onSome: (parent) => `Parent ${shortId(parent)}`
  })

const signaturePillClassName = (valid: boolean): string =>
  valid
    ? `border ${signTone.borderSubtle} bg-stage-0/80 ${signTone.text}`
    : "border border-danger-200/80 bg-danger-50/70 text-danger-700"

const VersionCard = ({ evidence, version }: { readonly evidence: PlaceEvidence; readonly version: Version }) => (
  <Stack
    className={`min-w-0 gap-2.5 rounded-lg border px-3.5 py-3 ${digestTone.borderSubtle} ${digestTone.bgTinted}`}
    data-place-version={String(version.version)}
  >
    <Layer className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
      <SemanticText
        as="p"
        className="min-w-0 text-ink-900"
        role="row-label"
        text={versionTitle(version)}
        variant="compact"
        wrapAuthority="native-browser"
      />
      <SemanticText as="span" className="text-ink-500" role="code-meta" text={parentText(version)} />
    </Layer>
    <SemanticText
      as="code"
      className={`block truncate ${digestTone.textStrong}`}
      role="code-meta"
      text={version.contentId}
    />
    {Option.match(signatureFor(evidence.signatures, version.contentId), {
      onNone: () => null,
      onSome: (signature) => (
        <Layer className="flex flex-wrap">
          <StatusPill
            className={signaturePillClassName(signature.valid)}
            label={versionSignatureLabel(signature)}
          />
        </Layer>
      )
    })}
  </Stack>
)

/**
 * The place's history as a chain of content IDs. Version 2 digests version
 * 1's ID as its parent, so the chain cannot be reordered or have a link
 * removed without every later ID changing. The author signs each version.
 */
export const PlaceLineage = ({ evidence }: { readonly evidence: PlaceEvidence }) => (
  <Stack className="gap-3">
    <SemanticText as="p" className="text-ink-900" role="row-label" text="Lineage" variant="compact" />
    <Layer className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      {Arr.map(evidence.lineage, (version, index) => (
        <Layer className="contents" key={version.contentId}>
          {index === 0 ? null : (
            <Layer aria-hidden className="flex justify-center text-ink-400 sm:px-1">
              <ArrowLongRightIcon className="size-5 rotate-90 sm:rotate-0" />
            </Layer>
          )}
          <VersionCard evidence={evidence} version={version} />
        </Layer>
      ))}
    </Layer>
  </Stack>
)
