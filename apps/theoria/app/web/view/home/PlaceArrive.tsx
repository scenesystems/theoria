import { Option } from "effect"

import type { PlaceBuild } from "../../../contracts/imagined-place-result.js"
import { Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { PulseLayer } from "../primitives/Skeleton.js"

/**
 * What the demonstration is and how it works, said once. The story itself is
 * on the paper; this names the mechanism the acts then show, in their order:
 * compose, arrange, propose, record.
 */
export const placeArriveText =
  "An imagined place built live from a short brief. Theoria packages compose it as prose and features, draw it on the page, take in the proposals you merge, and record every version as a digest you sign."

/** The place's name while the build is still on its way: the same line, reserved. */
const PendingTitle = () => (
  <Stack aria-busy className="min-h-(--st-lh-hero-title) justify-center" data-place-arrive-pending>
    <PulseLayer className="h-6 w-2/3 rounded bg-stage-200/60" />
  </Stack>
)

/** What the composer named the place: the build's own output, so the title is already made by the pipeline. */
const PlaceTitle = ({ build }: { readonly build: PlaceBuild }) => (
  <SemanticText
    as="h2"
    className="text-balance text-ink-950"
    role="hero-title"
    text={build.artifact.composition.title}
    variant="expanded"
    wrapAuthority="native-browser"
  />
)

/** Arrival at the demonstration: the place's name, then what is being looked at and how it works. */
export const PlaceArrive = ({ build }: { readonly build: Option.Option<PlaceBuild> }) => (
  <Stack className="gap-4" data-place-arrive>
    {Option.match(build, {
      onNone: () => <PendingTitle />,
      onSome: (value) => <PlaceTitle build={value} />
    })}
    <SemanticText
      as="p"
      className="text-ink-700"
      role="lead"
      text={placeArriveText}
      variant="expanded"
      wrapAuthority="native-browser"
    />
  </Stack>
)
