import { useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"

import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import type { PlaceFeature } from "../../../contracts/imagined-place.js"
import { briefIsEdited, placeControlsAtom } from "../../atoms/imagined-place.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ShimmerLine } from "../primitives/Skeleton.js"
import { StatusPill } from "../primitives/StatusPill.js"

import { PlaceControls } from "./PlaceControls.js"
import { participantTone } from "./placeViewModel.js"

const authorTone = toneClassesFor(participantTone("author"))
const inferenceTone = toneClassesFor("dsp")

/** A feature the composer named; the same accent as its marker on the stage. */
const FeatureChip = ({ feature }: { readonly feature: PlaceFeature }) => (
  <Layer
    as="span"
    className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 ${authorTone.borderSubtle} ${authorTone.bgSubtle}`}
  >
    <SemanticText as="span" className={`truncate ${authorTone.textStrong}`} role="tab-label" text={feature.name} />
  </Layer>
)

const Pending = () => (
  <Stack className="gap-2.5 pt-1">
    <ShimmerLine width="w-2/3" />
    <ShimmerLine width="w-4/5" />
  </Stack>
)

/**
 * What the composer returned for the brief: the title it gave the place and
 * the features it named, in the author's accent because the author signs them. The pill is the honest part:
 * the runtime is recorded, so the answer is the one recorded for this
 * scenario, checked against the output schema each time. When the brief has
 * been edited, one line says what that does and does not change.
 */
const Composed = ({ build, edited }: { readonly build: PlaceBuild; readonly edited: boolean }) => (
  <Stack className="gap-2" data-place-composition>
    <Cluster className="items-center justify-between gap-x-3 gap-y-1">
      <SemanticText
        as="p"
        className="min-w-0 text-ink-900"
        role="card-title"
        text={build.artifact.composition.title}
        variant="compact"
        wrapAuthority="native-browser"
      />
      <StatusPill
        className={`border ${inferenceTone.borderSubtle} ${inferenceTone.bgTinted} ${inferenceTone.text}`}
        label="Recorded inference"
      />
    </Cluster>
    <Cluster className="gap-1.5">
      {Arr.map(build.artifact.composition.features, (feature) => <FeatureChip feature={feature} key={feature.name} />)}
    </Cluster>
    {edited
      ? (
        <SemanticText
          as="p"
          className="text-ink-500"
          role="status"
          text="The recording answers the original brief; your edited brief is what version 1 signs."
          variant="compact"
          wrapAuthority="native-browser"
        />
      )
      : null}
  </Stack>
)

/** The Compose step: the brief goes in, a typed composition comes out. */
export const PlaceComposition = ({ build }: { readonly build: Option.Option<PlaceBuild> }) => {
  const edited = briefIsEdited(useAtomValue(placeControlsAtom))
  return (
    <Stack className="gap-4">
      <PlaceControls disabled={false} />
      {Option.match(build, {
        onNone: () => <Pending />,
        onSome: (value) => <Composed build={value} edited={edited} />
      })}
    </Stack>
  )
}
