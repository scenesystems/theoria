import { Option } from "effect"
import * as Arr from "effect/Array"

import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import type { PlaceFeature } from "../../../contracts/imagined-place.js"
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
 * What the composer returned for the brief: a title and the features it
 * named. The pill is the honest part: the runtime is recorded, so the answer
 * is the one recorded for this scenario, checked against the output schema
 * each time.
 */
const Composed = ({ build }: { readonly build: PlaceBuild }) => (
  <Stack className="gap-2" data-place-composition>
    <Cluster>
      <StatusPill
        className={`border ${inferenceTone.borderSubtle} ${inferenceTone.bgTinted} ${inferenceTone.text}`}
        label="Recorded inference"
      />
    </Cluster>
    <Cluster className="gap-1.5">
      {Arr.map(build.artifact.composition.features, (feature) => <FeatureChip feature={feature} key={feature.name} />)}
    </Cluster>
  </Stack>
)

/** The Compose step: the brief goes in, a typed composition comes out. */
export const PlaceComposition = ({ build }: { readonly build: Option.Option<PlaceBuild> }) => (
  <Stack className="gap-4">
    <PlaceControls disabled={false} />
    {Option.match(build, {
      onNone: () => <Pending />,
      onSome: (value) => <Composed build={value} />
    })}
  </Stack>
)
