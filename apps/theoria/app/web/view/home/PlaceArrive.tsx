import { Option } from "effect"

import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import { Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { PulseLayer, ShimmerLine } from "../primitives/Skeleton.js"

/** The place's name and air while the build is still on its way: the same lines, reserved. */
const PendingPlace = () => (
  <Stack aria-busy className="gap-4" data-place-arrive-pending>
    <Stack className="min-h-(--st-lh-hero-title) justify-center">
      <PulseLayer className="h-6 w-2/3 rounded bg-stage-200/60" />
    </Stack>
    <Stack className="gap-2.5">
      <ShimmerLine width="w-4/5" />
      <ShimmerLine width="w-3/5" />
    </Stack>
  </Stack>
)

/** What the composer named the place and how it feels to be there, in the composer's own words. */
const NamedPlace = ({ build }: { readonly build: PlaceBuild }) => (
  <Stack className="gap-4">
    <SemanticText
      as="h2"
      className="text-balance text-ink-950"
      role="hero-title"
      text={build.artifact.composition.title}
      variant="expanded"
      wrapAuthority="native-browser"
    />
    <SemanticText
      as="p"
      className="text-ink-700"
      role="lead"
      text={build.artifact.composition.atmosphere}
      variant="expanded"
      wrapAuthority="native-browser"
    />
  </Stack>
)

/**
 * Arrival at the demonstration: the place speaks for itself. Its title and
 * atmosphere are the composer's output for the brief, so the first words of
 * the demo were already made by the pipeline the acts show.
 */
export const PlaceArrive = ({ build }: { readonly build: Option.Option<PlaceBuild> }) => (
  <Stack className="gap-4" data-place-arrive>
    {Option.match(build, {
      onNone: () => <PendingPlace />,
      onSome: (value) => <NamedPlace build={value} />
    })}
  </Stack>
)
